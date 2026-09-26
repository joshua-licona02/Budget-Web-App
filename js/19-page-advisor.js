(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.advisor = {};
  APP.pages.advisor.requestId = 0;

  APP.pages.advisor.summary = function () {
    var month = APP.state.settings.selectedMonth;
    var totals = APP.analytics.month(month);

    return {
      selectedReportingMonth: month,
      income: totals.income,
      operatingSpending: totals.operating,
      savingsContributions: totals.savingsContributions,
      savingsWithdrawals: totals.savingsWithdrawals,
      debtPayments: totals.debtPayments,
      totalCashOutflow: totals.cashOutflow,
      netCashFlow: totals.netCashFlow,
      savingsFunds: APP.analytics.savingsFunds(month).map(function (fund) {
        return {
          name: fund.category.name,
          balance: fund.balance,
          monthlyGoal: fund.monthlyGoal,
          eventualGoal: fund.eventualGoal,
          contributions: fund.deposits,
          withdrawals: fund.withdrawals
        };
      }),
      goals: APP.state.savingsGoals,
      debts: APP.analytics.debts().map(function (item) {
        return {
          name: item.debt.name,
          balance: item.debt.currentBalance,
          apr: item.debt.apr,
          minimumPayment: item.debt.minimumMonthlyPayment,
          estimatedMonthlyInterest: item.interest
        };
      }),
      salaryPlanningAssumptions: APP.state.salary
    };
  };

  APP.pages.advisor.render = function () {
    var root = APP.dom.refs.pages.advisor;
    var ollama = APP.state.settings.ollama;
    var form = APP.dom.el("form", "form-grid");
    var question = APP.ui.field(
      "Financial-planning question",
      "question",
      "text",
      "",
      {
        full: true,
        placeholder: "Compare my debt avalanche and snowball priorities."
      }
    );

    var response = APP.dom.el("article", "fund-card");

    APP.dom.clear(root);

    root.appendChild(APP.ui.panelHeader(
      "Ollama financial advisor",
      "Uses the connection configured in Settings. Advisor output is informational planning support only, not professional financial, tax, investment, payroll, or legal advice."
    ));

    if (!ollama.endpoint || !ollama.model) {
      response.appendChild(APP.dom.el(
        "p",
        "danger",
        "Configure and test an Ollama endpoint and model in Settings before requesting advisor analysis."
      ));

      root.appendChild(response);
      return;
    }

    form.appendChild(question.root);

    var actions = APP.dom.el("div", "modal-actions full");
    var ask = APP.ui.button("Ask advisor", "button-primary");
    ask.type = "submit";
    actions.appendChild(ask);
    form.appendChild(actions);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var promptQuestion = APP.utils.text(question.input.value);
      var requestId = ++APP.pages.advisor.requestId;

      if (!promptQuestion) {
        APP.dom.toast("Enter a financial-planning question.", "danger");
        return;
      }

      ask.disabled = true;
      response.textContent = "Advisor request in progress...";

      var prompt =
        "You are a personal financial planning assistant. " +
        "Provide informational planning analysis only. " +
        "Do not provide tax, payroll, legal, investment, accounting, or professional financial advice. " +
        "State key assumptions, uncertainty, and calculation limitations. " +
        "Question: " + promptQuestion +
        "\n\nMinimized structured financial summary:\n" +
        JSON.stringify(APP.pages.advisor.summary(), null, 2);

      var timedOut = false;
      var timer = window.setTimeout(function () {
        timedOut = true;

        if (requestId === APP.pages.advisor.requestId) {
          response.textContent =
            "Request timed out. Verify endpoint reachability, configured model, CORS settings, or increase the timeout in Settings.";
          ask.disabled = false;
        }
      }, Math.max(1000, APP.utils.number(ollama.timeoutMs) || 30000));

      fetch(ollama.endpoint.replace(/\/$/, "") + "/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollama.model,
          prompt: prompt,
          stream: false
        })
      }).then(function (result) {
        if (!result.ok) {
          throw new Error("Generation failed with HTTP " + result.status + ".");
        }

        return result.json();
      }).then(function (data) {
        window.clearTimeout(timer);

        if (timedOut || requestId !== APP.pages.advisor.requestId) {
          return;
        }

        response.textContent =
          "Request timestamp: " + new Date().toLocaleString() +
          "\nReporting month: " + APP.state.settings.selectedMonth +
          "\nModel: " + ollama.model +
          "\nEndpoint: " + ollama.endpoint +
          "\n\n" + (data.response || "No advisor response returned.");

        ask.disabled = false;
      }).catch(function (error) {
        window.clearTimeout(timer);

        if (requestId === APP.pages.advisor.requestId) {
          response.textContent =
            "Advisor error: " + error.message +
            " Check Settings for endpoint reachability, CORS, timeout, and model availability.";

          ask.disabled = false;
        }
      });
    });

    root.appendChild(form);
    root.appendChild(response);
  };
}());