(function () {
  "use strict";

  // In-browser advisor engine: Gemma 4 running on this device's GPU through WebGPU, in a
  // worker (js/gemma-worker.js). The model downloads once per browser, only when the user
  // asks, and is then read from the browser's cache.
  var APP = window.APP;
  var local = APP.localLLM = {};

  // Sizes are the text-only files (decoder + token embeddings) for each format.
  local.models = {
    e2b: {
      id: "onnx-community/gemma-4-E2B-it-ONNX",
      name: "Gemma 4 E2B",
      note: "Best for phones",
      sizeGB: { q4f16: 3.1, q4: 3.6 }
    },
    e4b: {
      id: "onnx-community/gemma-4-E4B-it-ONNX",
      name: "Gemma 4 E4B",
      note: "Smarter, for laptops",
      sizeGB: { q4f16: 4.9, q4: 5.6 }
    }
  };

  local.CACHE_NAME = "transformers-cache";

  local.state = {
    support: null,      // null until checked, then { ok, reason, f16 }
    downloaded: {},     // modelKey -> true/false once checked
    status: "idle",     // idle | loading | ready | error
    loadedKey: "",
    progress: null,     // { loaded, total, progress } while loading
    error: ""
  };

  var worker = null;
  var listeners = [];
  var pending = null;   // handlers for the current generate() call
  var loadWaiters = [];

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

  local.modelKey = function () {
    var key = (APP.state.settings.ollama || {}).browserModel;
    return local.models[key] ? key : "e2b";
  };

  // q4f16 is smaller and faster but needs the GPU's 16-bit float support.
  local.dtype = function () {
    return local.state.support && local.state.support.f16 ? "q4f16" : "q4";
  };

  local.sizeLabel = function (key) {
    var model = local.models[key || local.modelKey()];
    return "about " + model.sizeGB[local.dtype()].toFixed(1) + " GB";
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

  function modelFiles(key) {
    var dtype = local.dtype();
    return ["decoder_model_merged_" + dtype + ".onnx", "embed_tokens_" + dtype + ".onnx"].map(function (file) {
      return local.models[key].id + "/resolve/main/onnx/" + file;
    });
  }

  // Downloaded means both weight files for this format are fully in the cache (files are
  // only cached once complete).
  local.checkDownloaded = function (key) {
    key = key || local.modelKey();

    if (!window.caches) {
      return Promise.resolve(false);
    }

    return caches.open(local.CACHE_NAME).then(function (cache) {
      return cache.keys();
    }).then(function (requests) {
      var urls = requests.map(function (request) { return request.url; });
      var have = modelFiles(key).every(function (file) {
        return urls.some(function (url) { return url.indexOf(file + "_data") !== -1; });
      });

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

      if (data.type === "progress") {
        local.state.progress = data;
        changed();
      } else if (data.type === "ready") {
        local.state.status = "ready";
        local.state.progress = null;
        local.state.downloaded[local.state.loadingKey] = true;
        local.state.loadedKey = local.state.loadingKey;
        settleLoad(null);
        changed();
      } else if (data.type === "text") {
        if (pending) {
          pending.onText(data.text);
        }
      } else if (data.type === "done") {
        finishGenerate(null);
      } else if (data.type === "error") {
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
      return "This device ran out of memory for the model. Close other tabs and apps and try again" +
        (local.modelKey() === "e4b" ? ", or switch to Gemma 4 E2B." : ".") + " (" + text + ")";
    }

    if (/quota|QuotaExceeded/i.test(text)) {
      return "There isn't enough free storage on this device to save the model. (" + text + ")";
    }

    if (/fetch|network|Failed to load/i.test(text)) {
      return "Couldn't download the model. Check your connection and try again. (" + text + ")";
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

  // Downloads (first time) or loads from the cache, then keeps the model in GPU memory.
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
        loadWaiters.push({ resolve: resolve, reject: reject });

        if (local.state.status === "loading" && local.state.loadingKey === key) {
          return;
        }

        // Ask the browser not to clear a multi-gigabyte download to make room.
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(function () {});
        }

        local.state.status = "loading";
        local.state.loadingKey = key;
        local.state.error = "";
        local.state.progress = null;
        changed();

        ensureWorker().postMessage({ type: "load", modelId: local.models[key].id, dtype: local.dtype() });
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

  // Streams a reply. onText receives each new piece of raw text, including Gemma's markers.
  // Returns { promise, abort }.
  local.generate = function (messages, options) {
    var config = options || {};
    var aborted = false;

    var promise = local.load().then(function () {
      if (aborted) {
        throw new DOMException("Stopped.", "AbortError");
      }

      return new Promise(function (resolve, reject) {
        pending = { resolve: resolve, reject: reject, onText: config.onText || function () {} };
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

  // Splits Gemma's raw output into reasoning and answer, and drops its control tokens.
  local.parse = function (raw) {
    var text = String(raw || "");
    var thinking = "";
    var start = text.indexOf("<|channel>");

    if (start !== -1) {
      var end = text.indexOf("<channel|>", start);
      var thought = end === -1 ? text.slice(start + 10) : text.slice(start + 10, end);

      thinking = thought.replace(/^thought\s*/, "");
      text = text.slice(0, start) + (end === -1 ? "" : text.slice(end + 10));
    }

    function clean(value) {
      return value.replace(/<\|?(turn|think|eos|bos|pad|end_of_turn|start_of_turn)\|?>/g, "").trim();
    }

    return { thinking: clean(thinking), content: clean(text) };
  };

  // Frees the GPU memory and deletes this model's files from the browser.
  local.remove = function (key) {
    key = key || local.modelKey();

    if (worker && (local.state.loadedKey === key || local.state.loadingKey === key)) {
      worker.terminate();
      worker = null;
      local.state.status = "idle";
      local.state.loadedKey = "";
      local.state.progress = null;
      settleLoad(new Error("Removed."));
      finishGenerate(new Error("Removed."));
    }

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
