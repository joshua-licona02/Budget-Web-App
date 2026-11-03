(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.advisor = {};

  APP.pages.advisor.defaultEndpoint = "http://localhost:11434";
  APP.pages.advisor.historyMonths = 6;

  APP.pages.advisor.suggestions = [
    "How am I doing this month compared to my budget?",
    "Which spending categories should I cut first, and by how much?",
    "Should I prioritize my debts or my savings funds right now?",
    "Compare debt avalanche and snowball for my current debts.",
    "How many months until each savings goal is reached at my current pace?"
  ];

  // Conversation state lives outside render() because every commit re-renders all pages.
  APP.pages.advisor.chat = {
    messages: [],
    busy: false,
    abort: null,
    draft: "",
    think: false,
    models: null,
    modelsError: "",
    modelsLoading: false
  };

  APP.pages.advisor.refs = {};

  // "ollama" (the Ollama app on this computer) or "browser" (Gemma 4 on this device's GPU).
  // Stored with the Ollama settings, which stay on each device rather than syncing.
  APP.pages.advisor.engine = function () {
    var ollama = APP.state.settings.ollama || {};
    return ollama.engine === "browser" ? "browser" : "ollama";
  };

  APP.pages.advisor.endpoint = function () {
    var ollama = APP.state.settings.ollama || {};
    return (APP.utils.text(ollama.endpoint) || APP.pages.advisor.defaultEndpoint)
      .replace(/\/$/, "");
  };

  APP.pages.advisor.round = function (value) {
    return Math.round(APP.utils.money(value) * 100) / 100;
  };

  APP.pages.advisor.monthTotals = function (month) {
    var round = APP.pages.advisor.round;
    var totals = APP.analytics.month(month);

    return {
      month: month,
      income: round(totals.income),
      incomeByType: Object.keys(totals.incomeByType).reduce(function (result, type) {
        result[APP.model.incomeTypeLabel(type)] = round(totals.incomeByType[type]);
        return result;
      }, {}),
      operatingSpendingAfterRefunds: round(totals.operating),
      refunds: round(totals.refunds),
      savingsContributions: round(totals.savingsContributions),
      movedToFreeMoney: round(totals.freeMoney),
      roundUpSavings: round(totals.roundUps),
      savingsWithdrawals: round(totals.savingsWithdrawals),
      debtPayments: round(totals.debtPayments),
      totalCashOutflow: round(totals.cashOutflow),
      netCashFlow: round(totals.netCashFlow)
    };
  };

  APP.pages.advisor.categoryBreakdown = function (month) {
    var round = APP.pages.advisor.round;
    var budget = APP.model.budget(month, false);
    var activity = APP.analytics.categoryActivity(month);
    var priorMonths = [1, 2, 3].map(function (offset) {
      return APP.analytics.categoryActivity(APP.analytics.addMonths(month, -offset));
    });

    return APP.state.categories.filter(function (category) {
      return !category.isSavingsFund;
    }).map(function (category) {
      var item = APP.model.budgetItem(budget, category.id);
      var values = activity[category.id] || {};
      var spent = APP.utils.money(values.operating) + APP.utils.money(values.debt);
      var budgeted = item ? APP.utils.money(item.dollarTarget) : 0;
      var priorTotal = priorMonths.reduce(function (total, prior) {
        var entry = prior[category.id] || {};
        return total + APP.utils.money(entry.operating) + APP.utils.money(entry.debt);
      }, 0);

      return {
        group: category.group,
        category: category.name,
        budgeted: round(budgeted),
        spent: round(spent),
        remaining: round(budgeted - spent),
        averageSpentPrior3Months: round(priorTotal / 3)
      };
    }).filter(function (row) {
      return row.budgeted || row.spent || row.averageSpentPrior3Months;
    }).sort(function (a, b) {
      return b.spent - a.spent;
    });
  };

  APP.pages.advisor.summary = function () {
    var round = APP.pages.advisor.round;
    var month = APP.state.settings.selectedMonth;
    var budget = APP.model.budget(month, false);
    var salary = APP.analytics.salary();
    var history = [];

    for (var offset = APP.pages.advisor.historyMonths - 1; offset >= 0; offset -= 1) {
      history.push(APP.pages.advisor.monthTotals(APP.analytics.addMonths(month, -offset)));
    }

    return {
      currency: APP.state.settings.currency || APP.config.currency,
      today: APP.utils.isoDate(new Date()),
      selectedReportingMonth: month,
      selectedMonthTotals: APP.pages.advisor.monthTotals(month),
      selectedMonthExpectedIncome: round(budget.expectedIncome),
      monthlyHistory: history,
      spendingByCategory: APP.pages.advisor.categoryBreakdown(month),
      savingsFunds: APP.analytics.savingsFunds(month).map(function (fund) {
        return {
          name: fund.category.name,
          balance: round(fund.balance),
          monthlyGoal: round(fund.monthlyGoal),
          contributedThisMonth: round(fund.deposits),
          withdrawnThisMonth: round(fund.withdrawals),
          eventualGoal: round(fund.eventualGoal),
          remainingToEventualGoal: round(fund.remainingEventual),
          estimatedCompletionMonth: fund.estimatedCompletionMonth || null
        };
      }),
      goals: APP.state.savingsGoals,
      debts: APP.analytics.debts().map(function (item) {
        return {
          name: item.debt.name,
          confirmedBalance: round(item.confirmedBalance),
          projectedBalanceToday: round(item.projectedBalance),
          aprPercent: item.debt.apr,
          minimumPayment: round(item.debt.minimumMonthlyPayment),
          estimatedMonthlyInterest: round(item.estimatedMonthlyInterest),
          paidThisMonth: round(item.paymentThisMonth),
          minimumPaymentDoesNotCoverInterest: item.minimumPaymentRisk
        };
      }),
      salary: {
        assumptions: APP.state.salary,
        estimatedGrossMonthly: round(salary.grossMonthly),
        estimatedNetMonthly: round(salary.netMonthly),
        estimatedNetPaycheck: round(salary.netPaycheck)
      }
    };
  };

  APP.pages.advisor.systemPrompt = function () {
    return [
      "You are a personal financial planning assistant built into the user's budget dashboard.",
      "The user's current financial data is provided below as JSON. The app computed every figure; treat them as correct.",
      "Rules:",
      "- Base your analysis on the provided data. Never invent balances, transactions, or rates. If data needed to answer is missing, say what is missing.",
      "- When you do arithmetic, show the calculation briefly so the user can verify it.",
      "- Be specific and practical: name the categories, funds, and debts involved and give concrete dollar amounts.",
      "- Keep answers focused and reasonably short. Use short headings, bullet lists, or a small table when helpful.",
      "- State key assumptions and uncertainty.",
      "- You provide informational planning support only, not professional tax, payroll, legal, investment, or accounting advice. Do not recommend specific securities.",
      "",
      "Financial data:",
      JSON.stringify(APP.pages.advisor.summary())
    ].join("\n");
  };

  APP.pages.advisor.loadModels = function () {
    var chat = APP.pages.advisor.chat;

    if (chat.modelsLoading) {
      return;
    }

    chat.modelsLoading = true;
    chat.modelsError = "";

    fetch(APP.pages.advisor.endpoint() + "/api/tags").then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      return response.json();
    }).then(function (data) {
      var ollama = APP.state.settings.ollama;

      chat.models = (data.models || []).map(function (item) {
        return { name: item.name, size: item.size };
      });

      if (!ollama.model && chat.models.length) {
        ollama.model = chat.models[0].name;
        APP.store.save();
      }
    }).catch(function (error) {
      chat.models = null;
      chat.modelsError = error.message;
    }).finally(function () {
      chat.modelsLoading = false;
      APP.pages.advisor.render();
    });
  };

  APP.pages.advisor.inline = function (parent, text) {
    text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        parent.appendChild(APP.dom.el("strong", "", part.slice(2, -2)));
      } else if (/^`[^`]+`$/.test(part)) {
        parent.appendChild(APP.dom.el("code", "", part.slice(1, -1)));
      } else if (part) {
        parent.appendChild(document.createTextNode(part));
      }
    });
  };

  // Small markdown subset rendered with DOM nodes only, so model output can never inject HTML.
  APP.pages.advisor.markdown = function (text) {
    var inline = APP.pages.advisor.inline;
    var root = APP.dom.el("div", "advisor-markdown");
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var list = null;
    var index = 0;

    function cells(line) {
      return line.trim().replace(/^\||\|$/g, "").split("|").map(function (cell) {
        return cell.trim();
      });
    }

    while (index < lines.length) {
      var line = lines[index];
      var heading = line.match(/^\s*#{1,6}\s+(.*)$/);
      var bullet = line.match(/^\s*[-*]\s+(.*)$/);
      var numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

      if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1] || "")) {
        var table = APP.dom.el("table", "advisor-table");
        var headRow = APP.dom.el("tr");

        cells(line).forEach(function (cell) {
          var th = APP.dom.el("th");
          inline(th, cell);
          headRow.appendChild(th);
        });

        table.appendChild(headRow);
        index += 2;

        while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
          var row = APP.dom.el("tr");

          cells(lines[index]).forEach(function (cell) {
            var td = APP.dom.el("td");
            inline(td, cell);
            row.appendChild(td);
          });

          table.appendChild(row);
          index += 1;
        }

        var wrap = APP.dom.el("div", "advisor-table-wrap");
        wrap.appendChild(table);
        root.appendChild(wrap);
        list = null;
        continue;
      }

      if (heading) {
        var h = APP.dom.el("h4");
        inline(h, heading[1].replace(/\*\*/g, ""));
        root.appendChild(h);
        list = null;
      } else if (bullet || numbered) {
        var tag = bullet ? "ul" : "ol";

        if (!list || list.tagName.toLowerCase() !== tag) {
          list = APP.dom.el(tag);
          root.appendChild(list);
        }

        var li = APP.dom.el("li");
        inline(li, (bullet || numbered)[1]);
        list.appendChild(li);
      } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
        root.appendChild(APP.dom.el("hr"));
        list = null;
      } else if (line.trim()) {
        var p = APP.dom.el("p");
        inline(p, line);
        root.appendChild(p);
        list = null;
      } else {
        list = null;
      }

      index += 1;
    }

    return root;
  };

  APP.pages.advisor.messageNode = function (message) {
    var node = APP.dom.el("article", "advisor-message advisor-" + message.role);
    var meta = APP.dom.el("div", "advisor-meta");

    meta.textContent = message.role === "user" ?
      "You" :
      "Advisor" + (message.model ? " · " + message.model : "") +
        (message.month ? " · " + message.month : "");

    node.appendChild(meta);

    if (message.thinking) {
      var details = APP.dom.el("details", "advisor-thinking");
      details.open = Boolean(message.pending && !message.content);
      details.appendChild(APP.dom.el("summary", "", message.pending && !message.content ?
        "Reasoning..." :
        "Show reasoning"));
      details.appendChild(APP.dom.el("pre", "", message.thinking));
      node.appendChild(details);
    }

    if (message.role === "user") {
      node.appendChild(APP.dom.el("p", "", message.content));
    } else if (message.content) {
      node.appendChild(APP.pages.advisor.markdown(message.content));
    } else if (message.pending) {
      node.appendChild(APP.dom.el("p", "muted", message.status || "Waiting for the model..."));
    }

    if (message.error) {
      node.appendChild(APP.dom.el("p", "danger", message.error));
    }

    return node;
  };

  APP.pages.advisor.paint = function () {
    var chat = APP.pages.advisor.chat;
    var refs = APP.pages.advisor.refs;

    if (!refs.log) {
      return;
    }

    var nearBottom = refs.log.scrollHeight - refs.log.scrollTop - refs.log.clientHeight < 80;

    APP.dom.clear(refs.log);

    if (!chat.messages.length) {
      refs.log.appendChild(APP.ui.empty(
        "Ask a question about your budget, spending, savings, or debts. The advisor sees an app-computed summary of the selected reporting month and the previous " +
        (APP.pages.advisor.historyMonths - 1) + " months."
      ));
    }

    chat.messages.forEach(function (message) {
      refs.log.appendChild(APP.pages.advisor.messageNode(message));
    });

    if (nearBottom || chat.busy) {
      refs.log.scrollTop = refs.log.scrollHeight;
    }

    refs.send.disabled = chat.busy;
    refs.stop.hidden = !chat.busy;
    refs.reset.disabled = chat.busy || !chat.messages.length;
  };

  APP.pages.advisor.schedulePaint = function () {
    if (APP.pages.advisor.paintQueued) {
      return;
    }

    APP.pages.advisor.paintQueued = true;
    window.requestAnimationFrame(function () {
      APP.pages.advisor.paintQueued = false;
      APP.pages.advisor.paint();
    });
  };

  APP.pages.advisor.send = function (questionText) {
    var chat = APP.pages.advisor.chat;
    var ollama = APP.state.settings.ollama;
    var question = APP.utils.text(questionText);

    if (chat.busy) {
      return;
    }

    if (!question) {
      APP.dom.toast("Enter a financial-planning question.", "danger");
      return;
    }

    var engine = APP.pages.advisor.engine();
    var local = APP.localLLM;

    if (engine === "ollama" && !ollama.model) {
      APP.dom.toast("Choose a model first.", "danger");
      return;
    }

    // Never start a multi-gigabyte download from a question; that's the Download button's job.
    if (engine === "browser" && local.state.status !== "ready" &&
        !local.state.downloaded[local.modelKey()]) {
      APP.dom.toast("Download the model first (button above the chat).", "danger");
      return;
    }

    var history = chat.messages.filter(function (message) {
      return !message.error && message.content;
    }).map(function (message) {
      return { role: message.role, content: message.content };
    });

    var reply = {
      role: "assistant",
      content: "",
      thinking: "",
      model: engine === "browser" ? local.models[local.modelKey()].name + " (this device)" : ollama.model,
      month: APP.state.settings.selectedMonth,
      pending: true,
      status: engine === "browser" ?
        (local.state.status === "ready" ? "Reading your data on this device..." : "Loading the model on this device...") :
        "Sending your data summary to the model..."
    };

    chat.messages.push({ role: "user", content: question });
    chat.messages.push(reply);
    chat.draft = "";
    chat.busy = true;

    if (APP.pages.advisor.refs.question) {
      APP.pages.advisor.refs.question.value = "";
    }

    APP.pages.advisor.paint();

    var controller = new AbortController();
    var idleMs = Math.max(1000, APP.utils.number(ollama.timeoutMs) || 30000);
    // The first token can be slow: the model may need to load and read the whole data summary.
    var firstTokenMs = Math.max(idleMs, 180000);
    var timedOut = false;
    var timer = null;
    var received = false;

    chat.abort = controller;

    function arm() {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, received ? idleMs : firstTokenMs);
    }

    function finish(error) {
      window.clearTimeout(timer);
      reply.pending = false;
      reply.content = reply.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

      if (error) {
        reply.error = error;
      } else if (!reply.content) {
        reply.error = "The model returned an empty response.";
      }

      chat.busy = false;
      chat.abort = null;
      APP.pages.advisor.paint();
    }

    var messages = [{ role: "system", content: APP.pages.advisor.systemPrompt() }]
      .concat(history)
      .concat([{ role: "user", content: question }]);

    if (engine === "browser") {
      var raw = "";
      var stopped = false;
      var job = local.generate(messages, {
        think: chat.think,
        onText: function (text) {
          var parsed;

          raw += text;
          parsed = local.parse(raw);
          reply.thinking = parsed.thinking;
          reply.content = parsed.content;
          reply.status = parsed.content || parsed.thinking ? "" : "Thinking...";
          APP.pages.advisor.schedulePaint();
        }
      });

      chat.abort = {
        abort: function () {
          stopped = true;
          job.abort();
        }
      };

      job.promise.then(function () {
        finish(stopped ? "Stopped." : "");
      }).catch(function (error) {
        finish(stopped || error.name === "AbortError" ? "Stopped." : "Advisor error: " + error.message);
      });
      return;
    }

    function handleLine(line) {
      if (!line.trim()) {
        return;
      }

      var data = JSON.parse(line);

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.message) {
        reply.thinking += data.message.thinking || "";
        reply.content += data.message.content || "";
      }

      if (!received && (reply.thinking || reply.content)) {
        received = true;
      }

      reply.status = "";
    }

    arm();

    fetch(APP.pages.advisor.endpoint() + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollama.model,
        stream: true,
        think: chat.think,
        options: {
          num_ctx: Math.max(2048, APP.utils.number(ollama.contextLength) || 8192),
          temperature: 0.3
        },
        messages: messages
      })
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (body) {
          var detail = "";

          try {
            detail = JSON.parse(body).error || "";
          } catch (error) {
            detail = body;
          }

          throw new Error("HTTP " + response.status + (detail ? ": " + detail : "."));
        });
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      reply.status = "Model is reading your data...";
      APP.pages.advisor.schedulePaint();

      function pump() {
        return reader.read().then(function (chunk) {
          if (chunk.done) {
            handleLine(buffer);
            return;
          }

          buffer += decoder.decode(chunk.value, { stream: true });

          var lines = buffer.split("\n");
          buffer = lines.pop();
          lines.forEach(handleLine);

          arm();
          APP.pages.advisor.schedulePaint();
          return pump();
        });
      }

      return pump();
    }).then(function () {
      finish("");
    }).catch(function (error) {
      if (error.name === "AbortError") {
        finish(timedOut ?
          "Timed out waiting for the model. Large or partly-CPU models can be slow; try a smaller model or raise the timeout in Settings." :
          "Stopped.");
        return;
      }

      finish(
        "Advisor error: " + error.message +
        (error instanceof TypeError ?
          " The browser could not reach Ollama at " + APP.pages.advisor.endpoint() + ". Make sure Ollama is running and the page is served from localhost (see the note above)." :
          "")
      );
    });
  };

  APP.pages.advisor.connectionNote = function () {
    var chat = APP.pages.advisor.chat;

    if (window.location.protocol === "file:") {
      var note = APP.dom.el("div", "notice notice-warning advisor-note");
      note.appendChild(APP.dom.el("strong", "", "Opened as a local file. "));
      note.appendChild(document.createTextNode(
        "Ollama blocks requests from pages opened by double-clicking the HTML file. " +
        "Close this tab and run start-budget-app.cmd in the app folder instead; it serves the app at http://localhost:8080. " +
        "Browser data is stored per address, so export a backup from Settings here and import it there once."
      ));
      return note;
    }

    if (chat.modelsError) {
      var error = APP.dom.el("div", "notice notice-warning advisor-note");
      error.appendChild(APP.dom.el("strong", "", "Can't reach Ollama. "));
      error.appendChild(document.createTextNode(
        "Tried " + APP.pages.advisor.endpoint() + " (" + chat.modelsError + "). " +
        "Make sure the Ollama app is running, then retry. You can change the endpoint in Settings."
      ));
      return error;
    }

    return null;
  };

  APP.pages.advisor.render = function () {
    var root = APP.dom.refs.pages.advisor;
    var chat = APP.pages.advisor.chat;
    var ollama = APP.state.settings.ollama;
    var refs = APP.pages.advisor.refs = {};

    var engine = APP.pages.advisor.engine();

    APP.dom.clear(root);

    if (engine === "ollama" && chat.models === null && !chat.modelsError && !chat.modelsLoading &&
        window.location.protocol !== "file:") {
      APP.pages.advisor.loadModels();
    }

    root.appendChild(APP.ui.panelHeader(
      "Financial advisor",
      "Runs on a model on your own device, so your data stays private. Advisor output is informational planning support only, not professional financial, tax, investment, payroll, or legal advice."
    ));

    root.appendChild(APP.pages.advisor.engineSwitch());

    if (engine === "browser") {
      root.appendChild(APP.pages.advisor.browserToolbar());
    } else {
      APP.pages.advisor.ollamaToolbar(root);
    }

    APP.pages.advisor.chatArea(root);
  };

  // Engine picker: a row of two buttons backed by a hidden select.
  APP.pages.advisor.engineSwitch = function () {
    var ollama = APP.state.settings.ollama;
    var wrap = APP.dom.el("div", "advisor-engine");
    var select = APP.dom.el("select");

    [["ollama", "Ollama (this computer)"], ["browser", "In the browser (Gemma 4)"]].forEach(function (choice) {
      var option = APP.dom.el("option", "", choice[1]);
      option.value = choice[0];
      select.appendChild(option);
    });

    select.value = APP.pages.advisor.engine();
    select.hidden = true;
    select.addEventListener("change", function () {
      ollama.engine = select.value;
      APP.store.log("info", "Advisor engine set to " + (select.value === "browser" ? "in-browser Gemma 4" : "Ollama") + ".");
      APP.store.save();
      APP.pages.advisor.render();
    });

    wrap.appendChild(APP.dom.el("span", "advisor-engine-label", "Runs on"));
    wrap.appendChild(APP.ui.segmented(select, [
      { value: "ollama", label: "Ollama" },
      { value: "browser", label: "This device (Gemma 4)" }
    ]));
    wrap.appendChild(select);
    return wrap;
  };

  APP.pages.advisor.thinkToggle = function () {
    var chat = APP.pages.advisor.chat;
    var thinkLabel = APP.dom.el("label", "advisor-check");
    var think = APP.dom.el("input");

    think.type = "checkbox";
    think.checked = chat.think;
    think.addEventListener("change", function () {
      chat.think = think.checked;
    });
    thinkLabel.appendChild(think);
    thinkLabel.appendChild(document.createTextNode(" Let the model reason first (better for math, much slower)"));
    return thinkLabel;
  };

  APP.pages.advisor.browserToolbar = function () {
    var local = APP.localLLM;
    var ollama = APP.state.settings.ollama;
    var refs = APP.pages.advisor.refs;
    var wrap = APP.dom.el("div", "advisor-local");
    var toolbar = APP.dom.el("div", "advisor-toolbar");

    var model = APP.ui.field("Model", "browserModel", "select", local.modelKey(), {
      options: Object.keys(local.models).map(function (key) {
        return { value: key, label: local.models[key].name + " · " + local.models[key].note };
      })
    });

    model.input.addEventListener("change", function () {
      ollama.browserModel = model.input.value;
      APP.store.save();
      local.checkDownloaded(model.input.value);
      APP.pages.advisor.paintLocal();
    });

    toolbar.appendChild(model.root);
    toolbar.appendChild(APP.pages.advisor.thinkToggle());
    wrap.appendChild(toolbar);

    refs.localStatus = APP.dom.el("div", "advisor-local-status");
    wrap.appendChild(refs.localStatus);

    // Check WebGPU first: it decides which file format, and so which files, to look for.
    if (!local.state.support) {
      local.checkSupport().then(function () {
        local.checkDownloaded();
      });
    } else if (local.state.downloaded[local.modelKey()] === undefined) {
      local.checkDownloaded();
    }

    if (!APP.pages.advisor.localListening) {
      APP.pages.advisor.localListening = true;
      local.onChange(APP.pages.advisor.paintLocal);
    }

    APP.pages.advisor.paintLocal();
    return wrap;
  };

  // Redraws only the download / status box, so progress updates don't disturb the chat.
  APP.pages.advisor.paintLocal = function () {
    var local = APP.localLLM;
    var box = APP.pages.advisor.refs.localStatus;

    if (!box || !box.isConnected) {
      return;
    }

    var key = local.modelKey();
    var model = local.models[key];
    var state = local.state;
    var downloaded = state.downloaded[key];
    var busyHere = state.status === "loading" && state.loadingKey === key;
    var readyHere = state.status === "ready" && state.loadedKey === key;

    APP.dom.clear(box);
    box.className = "advisor-local-status";

    function line(text, className) {
      box.appendChild(APP.dom.el("p", className || "", text));
    }

    function removeButton() {
      var remove = APP.ui.button("Remove from this device", "button-quiet");

      remove.addEventListener("click", function () {
        if (window.confirm("Remove " + model.name + " from this browser? You can download it again later.")) {
          local.remove(key).then(function () {
            APP.dom.toast(model.name + " was removed from this device.", "success");
          });
        }
      });
      return remove;
    }

    if (!state.support) {
      line("Checking this device…", "muted");
      return;
    }

    if (!state.support.ok) {
      box.classList.add("is-warning");
      line(state.support.reason);
      line("You can still use the Ollama engine on your computer.", "muted");
      return;
    }

    if (busyHere) {
      var progress = state.progress;
      var bar = APP.dom.el("div", "progress advisor-progress");
      var fill = APP.dom.el("span");

      fill.style.width = (progress ? Math.min(100, progress.progress) : 0) + "%";
      bar.appendChild(fill);

      line(downloaded ?
        "Loading " + model.name + " from this device…" :
        "Downloading " + model.name + "… keep this page open.", "advisor-local-title");
      box.appendChild(bar);
      line(progress && progress.total ?
        (progress.loaded / 1e9).toFixed(2) + " of " + (progress.total / 1e9).toFixed(2) + " GB · " +
          Math.floor(progress.progress) + "%" :
        "Starting…", "muted");
      return;
    }

    if (state.status === "error" && state.loadingKey === key) {
      var retry = APP.ui.button("Try again", "button-secondary");

      box.classList.add("is-error");
      line(state.error);
      retry.addEventListener("click", function () {
        local.load().catch(function () {});
      });
      box.appendChild(retry);
      return;
    }

    if (readyHere) {
      box.classList.add("is-ready");
      line("Ready · " + model.name + " is running on this device. Your data doesn't leave it.", "advisor-local-title");
      box.appendChild(removeButton());
      return;
    }

    if (downloaded === undefined) {
      line("Checking for a downloaded model…", "muted");
      return;
    }

    if (downloaded) {
      line(model.name + " is downloaded. It loads into memory when you send your first question.", "advisor-local-title");
      box.appendChild(removeButton());
      return;
    }

    var download = APP.ui.button("Download " + model.name + " (" + local.sizeLabel(key) + ")", "button-primary");

    line("Runs entirely on this device, so your data never leaves it. It's a one-time download per browser; use Wi-Fi.", "advisor-local-title");

    if (key === "e4b") {
      line("E4B needs a lot of memory. On phones, E2B is the better choice.", "muted");
    }

    download.addEventListener("click", function () {
      var check = navigator.storage && navigator.storage.estimate ?
        navigator.storage.estimate() :
        Promise.resolve(null);

      check.then(function (estimate) {
        var needed = model.sizeGB[local.dtype()] * 1e9;
        var free = estimate && estimate.quota ? estimate.quota - estimate.usage : Infinity;

        if (free < needed && !window.confirm("This browser reports only about " + (free / 1e9).toFixed(1) +
          " GB of space for this site, and the model needs " + local.sizeLabel(key) + ". Try anyway?")) {
          return;
        }

        local.load().then(function () {
          APP.dom.toast(model.name + " is ready on this device.", "success");
        }).catch(function () {
          // The status box shows the error.
        });
      });
    });

    box.appendChild(download);
  };

  APP.pages.advisor.ollamaToolbar = function (root) {
    var chat = APP.pages.advisor.chat;
    var ollama = APP.state.settings.ollama;
    var note = APP.pages.advisor.connectionNote();

    if (note) {
      root.appendChild(note);
    }

    var toolbar = APP.dom.el("div", "advisor-toolbar");
    var modelOptions = (chat.models || []).map(function (item) {
      return {
        value: item.name,
        label: item.name + (item.size ? " (" + (item.size / 1e9).toFixed(1) + " GB)" : "")
      };
    });

    if (ollama.model && !modelOptions.some(function (option) { return option.value === ollama.model; })) {
      modelOptions.unshift({ value: ollama.model, label: ollama.model });
    }

    if (!modelOptions.length) {
      modelOptions.push({ value: "", label: chat.modelsLoading ? "Loading models..." : "No models found" });
    }

    var model = APP.ui.field("Model", "model", "select", ollama.model, { options: modelOptions });

    model.input.addEventListener("change", function () {
      ollama.model = model.input.value;
      if (!ollama.endpoint) {
        ollama.endpoint = APP.pages.advisor.endpoint();
      }
      APP.store.log("info", "Advisor model set to " + ollama.model + ".");
      APP.store.save();
    });

    var refresh = APP.ui.button("Refresh models", "button-quiet");
    refresh.addEventListener("click", function () {
      chat.models = null;
      chat.modelsError = "";
      APP.pages.advisor.loadModels();
      APP.pages.advisor.render();
    });

    toolbar.appendChild(model.root);
    toolbar.appendChild(refresh);
    toolbar.appendChild(APP.pages.advisor.thinkToggle());
    root.appendChild(toolbar);
  };

  // The conversation, suggestions, question box and data preview, shared by both engines.
  APP.pages.advisor.chatArea = function (root) {
    var chat = APP.pages.advisor.chat;
    var refs = APP.pages.advisor.refs;

    refs.log = APP.dom.el("div", "advisor-log");
    root.appendChild(refs.log);

    var chips = APP.dom.el("div", "advisor-suggestions");
    APP.pages.advisor.suggestions.forEach(function (text) {
      var chip = APP.ui.button(text, "button-quiet advisor-chip");
      chip.addEventListener("click", function () {
        APP.pages.advisor.send(text);
      });
      chips.appendChild(chip);
    });
    root.appendChild(chips);

    var form = APP.dom.el("form", "advisor-form");
    refs.question = APP.dom.el("textarea");
    refs.question.rows = 2;
    refs.question.placeholder = "Ask a question. Enter to send, Shift+Enter for a new line.";
    refs.question.value = chat.draft;
    refs.question.addEventListener("input", function () {
      chat.draft = refs.question.value;
    });
    refs.question.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        APP.pages.advisor.send(refs.question.value);
      }
    });

    var actions = APP.dom.el("div", "advisor-actions");
    refs.send = APP.ui.button("Send", "button-primary");
    refs.send.type = "submit";
    refs.stop = APP.ui.button("Stop");
    refs.stop.addEventListener("click", function () {
      if (chat.abort) {
        chat.abort.abort();
      }
    });
    refs.reset = APP.ui.button("New conversation", "button-quiet");
    refs.reset.addEventListener("click", function () {
      chat.messages = [];
      APP.pages.advisor.paint();
    });

    actions.appendChild(refs.reset);
    actions.appendChild(refs.stop);
    actions.appendChild(refs.send);

    form.appendChild(refs.question);
    form.appendChild(actions);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      APP.pages.advisor.send(refs.question.value);
    });
    root.appendChild(form);

    var data = APP.dom.el("details", "advisor-data");
    data.appendChild(APP.dom.el("summary", "", "Show the data sent to the model"));
    data.addEventListener("toggle", function () {
      if (data.open && !data.querySelector("pre")) {
        data.appendChild(APP.dom.el("pre", "", JSON.stringify(APP.pages.advisor.summary(), null, 2)));
      }
    });
    root.appendChild(data);

    APP.pages.advisor.paint();
  };
}());
