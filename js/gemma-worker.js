// Runs the advisor's in-browser model (WebGPU) off the main thread so the page stays
// responsive. Loaded by js/20-local-llm.js as a module worker.
//
// Messages in:  { type: "load", modelId, dtype, kind, sessions }
//               { type: "generate", messages, think, maxNewTokens }
//               { type: "interrupt" }
// Messages out: { type: "phase", phase }              "download" | "load"
//               { type: "progress", phase, loaded, total, progress }
//               { type: "downloaded", files }        cache URLs, once all are saved
//               { type: "ready" } · { type: "text", text } · { type: "done" }
//               { type: "error", message }
//
// kind "gemma4": Gemma 4 E2B/E4B, loaded text-only through Gemma4ForCausalLM.
// kind "causal": an ordinary text model (Gemma 3 1B, Qwen3 0.6B).
import {
  AutoProcessor,
  AutoTokenizer,
  AutoModelForCausalLM,
  Gemma4ForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";

// Must match Transformers.js: its browser cache name and its cache keys
// (https://huggingface.co/<model>/resolve/main/<file>).
const HUB = "https://huggingface.co/";
const CACHE_NAME = "transformers-cache";

let tokenizer = null;
let processor = null;
let model = null;
let kind = "";
let loadedKey = "";
let loading = null;
const stopping = new InterruptableStoppingCriteria();

function post(message) {
  self.postMessage(message);
}

function throttled(phase) {
  let lastSent = 0;

  return function (loaded, total) {
    const progress = total > 0 ? loaded / total * 100 : 0;

    if (Date.now() - lastSent > 250 || progress >= 100) {
      lastSent = Date.now();
      post({ type: "progress", phase: phase, loaded: loaded, total: total, progress: progress });
    }
  };
}

// The weight files this model needs in this format, with their sizes.
async function weightFiles(modelId, sessions, dtype) {
  const response = await fetch(HUB + "api/models/" + modelId + "/tree/main/onnx");

  if (!response.ok) {
    throw new Error("Couldn't get the model's file list (HTTP " + response.status + ").");
  }

  const prefixes = sessions.map((session) => "onnx/" + session + "_" + dtype + ".onnx");
  const files = (await response.json()).filter((item) => item.type === "file" &&
    prefixes.some((prefix) => item.path === prefix || item.path.startsWith(prefix + "_data")));

  if (!files.length) {
    throw new Error("This model has no " + dtype + " files.");
  }

  return files.map((item) => ({
    url: HUB + modelId + "/resolve/main/" + item.path,
    size: (item.lfs && item.lfs.size) || item.size || 0
  }));
}

// Saves each weight file straight into the browser cache as it arrives, one at a time,
// instead of holding whole files in memory (which phones can't afford). Files already
// saved are skipped, so an interrupted download picks up from the last finished file.
async function download(modelId, sessions, dtype) {
  const cache = await caches.open(CACHE_NAME);
  const files = await weightFiles(modelId, sessions, dtype);
  const total = files.reduce((sum, file) => sum + file.size, 0);
  const report = throttled("download");
  let done = 0;

  for (const file of files) {
    if (await cache.match(file.url)) {
      done += file.size;
      report(done, total);
      continue;
    }

    const response = await fetch(file.url);

    if (!response.ok || !response.body) {
      throw new Error("Couldn't download the model (HTTP " + response.status + ").");
    }

    let received = 0;
    const counter = new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        report(done + received, total);
        controller.enqueue(chunk);
      }
    });

    await cache.put(file.url, new Response(response.body.pipeThrough(counter), {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
        "Content-Length": String(file.size || received)
      }
    }));

    done += file.size || received;
  }

  report(total, total);
  post({ type: "downloaded", files: files.map((file) => file.url) });
}

async function load(config) {
  const key = config.modelId + "|" + config.dtype;

  if (model && loadedKey === key) {
    return;
  }

  if (loading) {
    await loading.catch(() => {});

    if (model && loadedKey === key) {
      return;
    }
  }

  loading = (async () => {
    if (model) {
      await model.dispose();
      model = null;
      loadedKey = "";
    }

    post({ type: "phase", phase: "download" });
    await download(config.modelId, config.sessions, config.dtype);

    post({ type: "phase", phase: "load" });
    const report = throttled("load");
    const options = {
      dtype: config.dtype,
      device: "webgpu",
      progress_callback: (info) => {
        if (info.status === "progress_total") {
          report(info.loaded, info.total);
        }
      }
    };

    kind = config.kind;

    if (kind === "gemma4") {
      processor = await AutoProcessor.from_pretrained(config.modelId);
      tokenizer = processor.tokenizer;
      // The ForCausalLM class loads only the text parts (no image or audio encoders).
      model = await Gemma4ForCausalLM.from_pretrained(config.modelId, options);
    } else {
      processor = null;
      tokenizer = await AutoTokenizer.from_pretrained(config.modelId);
      model = await AutoModelForCausalLM.from_pretrained(config.modelId, options);
    }

    loadedKey = key;
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

async function generate(messages, think, maxNewTokens) {
  let inputs;

  if (kind === "gemma4") {
    const prompt = processor.apply_chat_template(messages, {
      enable_thinking: Boolean(think),
      add_generation_prompt: true
    });
    inputs = await processor(prompt, null, null, { add_special_tokens: false });
  } else {
    inputs = tokenizer.apply_chat_template(messages, {
      enable_thinking: Boolean(think),
      add_generation_prompt: true,
      return_dict: true
    });
  }

  // Special tokens are kept so the page can tell reasoning apart from the answer.
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: false,
    callback_function: (text) => post({ type: "text", text: text })
  });

  stopping.reset();

  await model.generate({
    ...inputs,
    max_new_tokens: maxNewTokens || 1024,
    do_sample: true,
    temperature: 0.4,
    top_p: 0.95,
    top_k: 64,
    streamer: streamer,
    stopping_criteria: stopping
  });
}

self.addEventListener("message", async (event) => {
  const data = event.data || {};

  if (data.type === "interrupt") {
    stopping.interrupt();
    return;
  }

  try {
    if (data.type === "load") {
      await load(data);
      post({ type: "ready" });
    } else if (data.type === "generate") {
      if (!model) {
        throw new Error("The model isn't loaded yet.");
      }

      await generate(data.messages, data.think, data.maxNewTokens);
      post({ type: "done" });
    }
  } catch (error) {
    post({ type: "error", message: (error && error.message) || String(error) });
  }
});
