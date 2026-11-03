(function () {
  "use strict";

  // In-browser advisor engine: a small open model running on this device's GPU through
  // WebGPU, in a worker (js/gemma-worker.js). A model downloads once per browser, only when
  // the user asks, and is then read from the browser's cache.
  var APP = window.APP;
  var local = APP.localLLM = {};

  // Phones allow a single page far less memory than the phone has (an iPhone 16 Pro page
  // closed at about 1.6 GB), and loading briefly needs about twice the file size, so the
  // phone models are the ones under 1 GB. Sizes are the weight files for each format.
  local.models = {
    gemma3: {
      id: "onnx-community/gemma-3-1b-it-ONNX",
      name: "Gemma 3 1B",
      note: "For phones · better writing",
      kind: "causal",
      sessions: ["model"],
      // Gemma's activations overflow 16-bit floats, so it always uses q4.
      dtypes: ["q4"],
      sizeGB: { q4: 0.86 },
      phone: true
    },
    qwen3: {
      id: "onnx-community/Qwen3-0.6B-ONNX",
      name: "Qwen3 0.6B",
      note: "For phones · lightest",
      kind: "causal",
      sessions: ["model"],
      dtypes: ["q4f16", "q4"],
      sizeGB: { q4f16: 0.57, q4: 0.92 },
      phone: true
    },
    e2b: {
      id: "onnx-community/gemma-4-E2B-it-ONNX",
      name: "Gemma 4 E2B",
      note: "For laptops · smarter",
      kind: "gemma4",
      sessions: ["decoder_model_merged", "embed_tokens"],
      dtypes: ["q4f16", "q4"],
      sizeGB: { q4f16: 3.1, q4: 3.6 }
    },
    e4b: {
      id: "onnx-community/gemma-4-E4B-it-ONNX",
      name: "Gemma 4 E4B",
      note: "For powerful laptops · smartest",
      kind: "gemma4",
      sessions: ["decoder_model_merged", "embed_tokens"],
      dtypes: ["q4f16", "q4"],
      sizeGB: { q4f16: 4.9, q4: 5.6 }
    }
  };

  var DONE_PREFIX = "personalBudgetDashboard.localModel.done.";
  var ACTIVE_KEY = "personalBudgetDashboard.localModel.active";

  local.CACHE_NAME = "transformers-cache";

  local.state = {
    support: null,      // null until checked, then { ok, reason, f16 }
    downloaded: {},     // modelKey -> true/false once checked
    status: "idle",     // idle | loading | ready | error
    phase: "",          // download | load, while loading
    loadingKey: "",
    loadedKey: "",
    progress: null,     // { loaded, total, progress } while loading
    error: "",
    crashed: null       // { key, phase } when the page closed mid-download, -load or -answer
  };

  var worker = null;
  var listeners = [];
  var pending = null;   // handlers for the current generate() call
  var loadWaiters = [];

  function storage(action, key, value) {
    try {
      if (action === "get") {
        return window.localStorage.getItem(key);
      }

      if (action === "set") {
        window.localStorage.setItem(key, value);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      // Storage blocked: the crash notice and download marker just aren't remembered.
    }

    return null;
  }

  // Remembers what the model was doing, so if the page is closed for using too much memory
  // the next visit can say so instead of silently starting over.
  function markActive(key, phase) {
    if (phase) {
      storage("set", ACTIVE_KEY, JSON.stringify({ key: key, phase: phase }));
    } else {
      storage("remove", ACTIVE_KEY);
    }
  }

  (function readCrash() {
    try {
      var active = JSON.parse(storage("get", ACTIVE_KEY) || "null");

      if (active && local.models[active.key]) {
        local.state.crashed = active;
      }
    } catch (error) {
      // Ignore a malformed entry.
    }

    storage("remove", ACTIVE_KEY);
  }());

  local.dismissCrash = function () {
    local.state.crashed = null;
    changed();
  };

  local.onChange = function (callback) {
    listeners.push(callback);
  };

  function changed() {
    listeners.forEach(function (callback) {
      try {
        callback();
      } catch (error) {
        console.error(error);
      }
    });
  }

  local.isPhone = function () {
    return /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent) ||
      Boolean(window.matchMedia && window.matchMedia("(pointer: coarse) and (max-width: 720px)").matches);
  };

  local.modelKey = function () {
    var key = (APP.state.settings.ollama || {}).browserModel;
    return local.models[key] ? key : (local.isPhone() ? "gemma3" : "e2b");
  };

  // q4f16 is smaller and faster but needs the GPU's 16-bit float support.
  local.dtype = function (key) {
    var dtypes = local.models[key || local.modelKey()].dtypes;
    var f16 = local.state.support && local.state.support.f16;
    return dtypes.indexOf("q4f16") !== -1 && f16 ? "q4f16" : dtypes[dtypes.length - 1];
  };

  local.sizeGB = function (key) {
    key = key || local.modelKey();
    return local.models[key].sizeGB[local.dtype(key)];
  };

  local.sizeLabel = function (key) {
    var size = local.sizeGB(key);
    return size < 1 ? Math.round(size * 1000) + " MB" : size.toFixed(1) + " GB";
  };

  local.checkSupport = function () {
    if (local.state.support) {
      return Promise.resolve(local.state.support);
    }

    if (!window.isSecureContext) {
      local.state.support = { ok: false, reason: "The in-browser model needs the app opened over https or localhost." };
      return Promise.resolve(local.state.support);
    }

    if (!navigator.gpu) {
      local.state.support = {
        ok: false,
        reason: "This browser doesn't support WebGPU, which the in-browser model needs. Try a recent Chrome or Edge, or a newer version of Safari."
      };
      return Promise.resolve(local.state.support);
    }

    return navigator.gpu.requestAdapter().then(function (adapter) {
      local.state.support = adapter ?
        { ok: true, f16: adapter.features.has("shader-f16") } :
        { ok: false, reason: "WebGPU is available but this device's GPU couldn't be used." };
      return local.state.support;
    }).catch(function (error) {
      local.state.support = { ok: false, reason: "WebGPU failed to start: " + error.message };
      return local.state.support;
    }).then(function (support) {
      changed();
      return support;
    });
  };

  function doneKey(key) {
    return DONE_PREFIX + local.models[key].id + "|" + local.dtype(key);
  }

  // Downloaded means the worker finished saving every weight file and they're all still in
  // the cache (the browser can clear its storage).
  local.checkDownloaded = function (key) {
    key = key || local.modelKey();

    var files = [];

    try {
      files = JSON.parse(storage("get", doneKey(key)) || "[]");
    } catch (error) {
      files = [];
    }

    if (!files.length || !window.caches) {
      local.state.downloaded[key] = false;
      changed();
      return Promise.resolve(false);
    }

    return caches.open(local.CACHE_NAME).then(function (cache) {
      return Promise.all(files.map(function (url) {
        return cache.match(url, { ignoreSearch: true }).then(function (hit) {
          return Boolean(hit);
        });
      }));
    }).then(function (hits) {
      var have = hits.every(Boolean);

      local.state.downloaded[key] = have;
      changed();
      return have;
    }).catch(function () {
      return false;
    });
  };

  function ensureWorker() {
    if (worker) {
      return worker;
    }

    worker = new Worker("js/gemma-worker.js", { type: "module" });

    worker.addEventListener("message", function (event) {
      var data = event.data || {};
      var key = local.state.loadingKey;

      if (data.type === "phase") {
        local.state.phase = data.phase;
        local.state.progress = null;
        markActive(key, data.phase);
        changed();
      } else if (data.type === "progress") {
        local.state.progress = data;
        changed();
      } else if (data.type === "downloaded") {
        storage("set", doneKey(key), JSON.stringify(data.files));
        local.state.downloaded[key] = true;
      } else if (data.type === "notSaved") {
        // Running from memory this session; it downloads again next visit.
        local.state.notSaved = key;
        changed();
      } else if (data.type === "ready") {
        markActive(key, "");
        local.state.status = "ready";
        local.state.phase = "";
        local.state.progress = null;
        local.state.loadedKey = key;
        local.state.crashed = null;
        settleLoad(null);
        changed();
      } else if (data.type === "text") {
        if (pending) {
          pending.onText(data.text);
        }
      } else if (data.type === "done") {
        markActive(key, "");
        finishGenerate(null);
      } else if (data.type === "error") {
        markActive(key, "");

        if (local.state.status === "loading") {
          local.state.status = "error";
          local.state.error = friendlyError(data.message);
          local.state.progress = null;
          settleLoad(new Error(local.state.error));
          changed();
        } else {
          finishGenerate(new Error(friendlyError(data.message)));
        }
      }
    });

    worker.addEventListener("error", function (event) {
      var message = "The in-browser model stopped unexpectedly" + (event.message ? " (" + event.message + ")" : "") + ".";

      markActive("", "");
      worker = null;
      local.state.status = "error";
      local.state.error = message;
      local.state.loadedKey = "";
      local.state.progress = null;
      settleLoad(new Error(message));
      finishGenerate(new Error(message));
      changed();
    });

    return worker;
  }

  function friendlyError(message) {
    var text = String(message || "Unknown error");

    if (/memory|allocat|OOM|device.*lost|Device was lost/i.test(text)) {
      return "This device ran out of memory for the model. Close other tabs and apps and try again, or choose a smaller model. (" + text + ")";
    }

    if (/quota|QuotaExceeded/i.test(text)) {
      return "There isn't enough free storage on this device to save the model. (" + text + ")";
    }

    if (/fetch|network|Failed to load|HTTP/i.test(text)) {
      return "Couldn't download the model. Check your connection and try again; finished files are kept. (" + text + ")";
    }

    return text;
  }

  function settleLoad(error) {
    var waiters = loadWaiters;
    loadWaiters = [];
    waiters.forEach(function (waiter) {
      if (error) {
        waiter.reject(error);
      } else {
        waiter.resolve();
      }
    });
  }

  // Downloads (first time, resuming from the last finished file) or loads from the cache,
  // then keeps the model in GPU memory.
  local.load = function () {
    var key = local.modelKey();

    if (local.state.status === "ready" && local.state.loadedKey === key) {
      return Promise.resolve();
    }

    return local.checkSupport().then(function (support) {
      if (!support.ok) {
        throw new Error(support.reason);
      }

      return new Promise(function (resolve, reject) {
        var model = local.models[key];

        loadWaiters.push({ resolve: resolve, reject: reject });

        if (local.state.status === "loading" && local.state.loadingKey === key) {
          return;
        }

        // Ask the browser not to clear a large download to make room.
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(function () {});
        }

        local.state.status = "loading";
        local.state.phase = "download";
        local.state.loadingKey = key;
        local.state.error = "";
        local.state.progress = null;
        local.state.crashed = null;
        markActive(key, "download");
        changed();

        ensureWorker().postMessage({
          type: "load",
          modelId: model.id,
          dtype: local.dtype(key),
          kind: model.kind,
          sessions: model.sessions
        });
      });
    });
  };

  function finishGenerate(error) {
    var current = pending;
    pending = null;

    if (current) {
      if (error) {
        current.reject(error);
      } else {
        current.resolve();
      }
    }
  }

  // Streams a reply. onText receives each new piece of raw text, including the model's
  // control tokens. Returns { promise, abort }.
  local.generate = function (messages, options) {
    var config = options || {};
    var aborted = false;

    var promise = local.load().then(function () {
      if (aborted) {
        throw new DOMException("Stopped.", "AbortError");
      }

      return new Promise(function (resolve, reject) {
        pending = { resolve: resolve, reject: reject, onText: config.onText || function () {} };
        markActive(local.state.loadedKey, "answer");
        worker.postMessage({
          type: "generate",
          messages: messages,
          think: Boolean(config.think),
          maxNewTokens: config.maxNewTokens || 1024
        });
      });
    });

    return {
      promise: promise,
      abort: function () {
        aborted = true;

        if (worker && pending) {
          worker.postMessage({ type: "interrupt" });
        }
      }
    };
  };

  // Splits raw output into reasoning and answer and drops control tokens. Gemma 4 marks
  // reasoning with <|channel>…<channel|>; Qwen3 uses <think>…</think>.
  local.parse = function (raw) {
    var text = String(raw || "");
    var thinking = "";
    var markers = [["<|channel>", "<channel|>"], ["<think>", "</think>"]];

    markers.forEach(function (pair) {
      var start = text.indexOf(pair[0]);

      if (start === -1) {
        return;
      }

      var end = text.indexOf(pair[1], start);
      var thought = end === -1 ?
        text.slice(start + pair[0].length) :
        text.slice(start + pair[0].length, end);

      thinking += thought.replace(/^thought\s*/, "");
      text = text.slice(0, start) + (end === -1 ? "" : text.slice(end + pair[1].length));
    });

    function clean(value) {
      return value
        .replace(/<\|?(turn|think|eos|bos|pad|end_of_turn|start_of_turn)\|?>/g, "")
        .replace(/<\|(im_end|im_start|endoftext)\|>/g, "")
        .trim();
    }

    return { thinking: clean(thinking), content: clean(text) };
  };

  // Frees the GPU memory and deletes this model's files from the browser.
  local.remove = function (key) {
    key = key || local.modelKey();

    if (worker && (local.state.loadedKey === key || local.state.loadingKey === key)) {
      worker.terminate();
      worker = null;
      markActive("", "");
      local.state.status = "idle";
      local.state.phase = "";
      local.state.loadedKey = "";
      local.state.progress = null;
      settleLoad(new Error("Removed."));
      finishGenerate(new Error("Removed."));
    }

    local.models[key].dtypes.forEach(function (dtype) {
      storage("remove", DONE_PREFIX + local.models[key].id + "|" + dtype);
    });

    if (!window.caches) {
      return Promise.resolve();
    }

    return caches.open(local.CACHE_NAME).then(function (cache) {
      return cache.keys().then(function (requests) {
        return Promise.all(requests.filter(function (request) {
          return request.url.indexOf(local.models[key].id + "/") !== -1;
        }).map(function (request) {
          return cache.delete(request);
        }));
      });
    }).then(function () {
      local.state.downloaded[key] = false;
      changed();
    });
  };
}());
