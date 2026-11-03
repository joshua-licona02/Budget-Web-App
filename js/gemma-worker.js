// Runs Gemma 4 in the browser (WebGPU) for the advisor, off the main thread so the page
// stays responsive. Loaded by js/20-local-llm.js as a module worker.
//
// Messages in:  { type: "load", modelId, dtype }
//               { type: "generate", messages, think, maxNewTokens }
//               { type: "interrupt" }
// Messages out: { type: "progress", loaded, total, progress }
//               { type: "ready" } · { type: "text", text } · { type: "done" }
//               { type: "error", message }
import {
  AutoProcessor,
  Gemma4ForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js";

let processor = null;
let model = null;
let loadedKey = "";
let loading = null;
const stopping = new InterruptableStoppingCriteria();

function post(message) {
  self.postMessage(message);
}

async function load(modelId, dtype) {
  const key = modelId + "|" + dtype;

  if (model && loadedKey === key) {
    return;
  }

  if (loading) {
    await loading;

    if (model && loadedKey === key) {
      return;
    }
  }

  loading = (async () => {
    if (model) {
      await model.dispose();
      model = null;
    }

    let lastSent = 0;

    function progress(info) {
      // Throttle to a few updates a second; the final 100% always goes through.
      if (info.status === "progress_total" && (Date.now() - lastSent > 250 || info.progress >= 100)) {
        lastSent = Date.now();
        post({ type: "progress", loaded: info.loaded, total: info.total, progress: info.progress });
      }
    }

    processor = await AutoProcessor.from_pretrained(modelId);
    // The ForCausalLM class loads only the text parts (no image or audio encoders).
    model = await Gemma4ForCausalLM.from_pretrained(modelId, {
      dtype: dtype,
      device: "webgpu",
      progress_callback: progress
    });
    loadedKey = key;
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

async function generate(messages, think, maxNewTokens) {
  const prompt = processor.apply_chat_template(messages, {
    enable_thinking: Boolean(think),
    add_generation_prompt: true
  });
  const inputs = await processor(prompt, null, null, { add_special_tokens: false });

  // Special tokens are kept so the page can tell reasoning apart from the answer.
  const streamer = new TextStreamer(processor.tokenizer, {
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
      await load(data.modelId, data.dtype);
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
