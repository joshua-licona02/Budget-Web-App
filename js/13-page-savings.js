(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.savings = {};

  APP.pages.savings.previousMonth = function (month) {
    var parts = month.split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 2, 1);

    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0");
  };

  APP.pages.savings.cell = function (text, className) {
    return APP.dom.el("td", className || "", text);
  };
APP.pages.savings.openFundModal = function (onCreated) {
  var form = APP.dom.el("form", "form-grid");

    var name = APP.ui.field(
      "Savings fund name",
      "name",
      "text",
      "",
      {
        required: true,
        full: true,
        placeholder: "Example: Vacation Fund"
      }
    );

    var group = APP.ui.field(
      "Organization group",
      "group",
      "text",
      "Savings and Funds",
      {
        required: true
      }
    );

    var openingBalance = APP.ui.field(
      "Opening balance",
      "openingBalance",
      "number",
      "0",
      {
        min: "0",
        step: "0.01"
      }
    );

    var openingMonth = APP.ui.field(
      "Opening-balance effective month",
      "openingBalanceEffectiveMonth",
      "month",
      APP.state.settings.selectedMonth
    );

    var monthlyGoal = APP.ui.field(
      "Monthly contribution goal",
      "monthlyGoal",
      "number",
      "0",
      {
        min: "0",
        step: "0.01"
      }
    );

    var eventualGoal = APP.ui.field(
      "Eventual savings goal",
      "eventualSavingsGoal",
      "number",
      "0",
      {
        min: "0",
        step: "0.01"
      }
    );

    var eventualDate = APP.ui.field(
      "Desired eventual-goal date",
      "eventualSavingsGoalDate",
      "month",
      ""
    );

    [
      name,
      group,
      openingBalance,
      openingMonth,
      monthlyGoal,
      eventualGoal,
      eventualDate
    ].forEach(function (field) {
      form.appendChild(field.root);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var fundName = APP.utils.text(name.input.value);
      var duplicate = APP.state.categories.some(function (category) {
        return !category.archived &&
          APP.utils.header(category.name) ===
          APP.utils.header(fundName);
      });

      if (!fundName) {
        APP.dom.toast("Enter a savings fund name.", "danger");
        return;
      }

      if (duplicate) {
        APP.dom.toast(
          "An active category or savings fund already uses that name.",
          "danger"
        );
        return;
      }

      var fund = {
        id: APP.utils.id("cat"),
        group: APP.utils.text(group.input.value) || "Savings and Funds",
        name: fundName,
        isSavingsFund: true,
        isDebtCategory: false,
        isTemporary: false,
        archived: false,
        openingBalance: APP.utils.money(openingBalance.input.value),
        openingBalanceEffectiveMonth: openingMonth.input.value || "",
        eventualSavingsGoal:
          APP.utils.money(eventualGoal.input.value),
        eventualSavingsGoalDate:
          eventualDate.input.value || "",
        createdAt: new Date().toISOString()
      };

      APP.state.categories.push(fund);

      var budget = APP.model.budget(
        APP.state.settings.selectedMonth,
        true
      );

      if (APP.utils.money(monthlyGoal.input.value) > 0) {
        budget.items.push({
          categoryId: fund.id,
          dollarTarget:
            APP.utils.money(monthlyGoal.input.value)
        });
      }

      APP.store.log(
        "success",
        "Created savings fund: " + fund.name + "."
      );

           if (typeof onCreated === "function") {
        onCreated(fund);
      }

      APP.ui.closeModal();
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var cancel = APP.ui.button("Cancel");
    var save = APP.ui.button(
      "Create savings fund",
      "button-primary"
    );

    save.type = "submit";

    cancel.addEventListener("click", APP.ui.closeModal);

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    APP.ui.modal("Add Savings Fund", form);
  };
  APP.pages.savings.render = function () {
    var root = APP.dom.refs.pages.savings;
    var month = APP.state.settings.selectedMonth;
    var priorMonth = APP.pages.savings.previousMonth(month);
    var funds = APP.analytics.savingsFunds(month);

    var totalBalance = APP.utils.sum(funds, function (fund) {
      return fund.balance;
    });

    var deposits = APP.utils.sum(funds, function (fund) {
      return fund.deposits;
    });

    var withdrawals = APP.utils.sum(funds, function (fund) {
      return fund.withdrawals;
    });

    var monthlyTarget = APP.utils.sum(funds, function (fund) {
      return fund.monthlyGoal;
    });

    APP.dom.clear(root);

    var page = APP.dom.el("section", "panel savings-page");

        var actions = APP.dom.el("div", "button-row");

    var addFund = APP.ui.button(
      "+ Add Savings Fund",
      "button-primary"
    );

    addFund.addEventListener("click", function () {
      APP.pages.savings.openFundModal();
    });

    actions.appendChild(addFund);

    page.appendChild(APP.ui.panelHeader(
      "Savings & Goals",
      "Track monthly contributions, eventual savings goals, target dates, projected completion, and savings-funded expenses.",
      actions
    ));

    var hero = APP.dom.el("div", "fund-hero savings-summary");
    hero.appendChild(APP.ui.currencyCard("Total saved", totalBalance));
    hero.appendChild(APP.ui.currencyCard("Added this month", deposits, "success"));
    hero.appendChild(APP.ui.currencyCard("Used this month", withdrawals, "danger"));
    hero.appendChild(APP.ui.currencyCard("Monthly target", monthlyTarget));
    page.appendChild(hero);

    var note = APP.dom.el(
      "div",
      "notice notice-info",
      "Savings-funded expenses reduce the associated savings fund. They are tracked separately from normal operating spending."
    );

    page.appendChild(note);

    if (!funds.length) {
      page.appendChild(APP.ui.empty("No savings funds are configured."));
      root.appendChild(page);
      return;
    }

    var wrap = APP.dom.el("div", "table-wrap savings-table-wrap");
    var table = APP.dom.el("table", "data-table savings-table");
    var head = APP.dom.el("thead");
    var body = APP.dom.el("tbody");
    var headerRow = APP.dom.el("tr");

    [
      "Savings & Goals",
      "Opening",
      "Deposits",
      "Withdrawals",
      "Current Balance",
      "Monthly Goal",
      "Projected Balance",
      "Eventual Goal",
      "Goal Progress",
      "Actions"
    ].forEach(function (label) {
      headerRow.appendChild(APP.dom.el("th", "", label));
    });

    head.appendChild(headerRow);

    funds.forEach(function (fund) {
      var row = APP.dom.el("tr");
      var openingBalance = APP.model.savingsBalance(
        fund.category.id,
        priorMonth
      );

      var projected = fund.projectedMonthlyBalance;
      var eventualLabel = fund.eventualGoal > 0 ?
        APP.utils.currency(fund.eventualGoal) :
        "Not set";

      var progressCell = APP.dom.el("td");
      var progressText = fund.eventualGoal > 0 ?
        Math.min(100, fund.eventualProgress).toFixed(1) + "%" :
        "—";

      var actionCell = APP.dom.el("td");
      var edit = APP.ui.button("Edit");

      edit.addEventListener("click", function () {
        APP.pages.categories.openModal(fund.category.id);
      });

      progressCell.appendChild(APP.dom.el(
        "span",
        fund.eventualGoal > 0 ? "" : "muted",
        progressText
      ));

      if (fund.eventualGoal > 0) {
        progressCell.appendChild(APP.ui.progress(
          fund.balance,
          fund.eventualGoal
        ));
      }

      row.appendChild(APP.pages.savings.cell(
        fund.category.name +
        (fund.category.archived ? " (Archived)" : "")
      ));

      row.appendChild(APP.pages.savings.cell(
        APP.utils.currency(openingBalance)
      ));

      row.appendChild(APP.pages.savings.cell(
  fund.deposits > 0 ?
    "+" + APP.utils.currency(fund.deposits) :
    APP.utils.currency(fund.deposits),
  fund.deposits > 0 ? "savings-deposit" : "savings-zero"
));

row.appendChild(APP.pages.savings.cell(
  fund.withdrawals > 0 ?
    "−" + APP.utils.currency(fund.withdrawals) :
    APP.utils.currency(fund.withdrawals),
  fund.withdrawals > 0 ? "savings-withdrawal" : "savings-zero"
));

      row.appendChild(APP.pages.savings.cell(
        APP.utils.currency(fund.balance)
      ));

      row.appendChild(APP.pages.savings.cell(
        APP.utils.currency(fund.monthlyGoal)
      ));

      row.appendChild(APP.pages.savings.cell(
        APP.utils.currency(projected)
      ));

      row.appendChild(APP.pages.savings.cell(eventualLabel));
      row.appendChild(progressCell);

      actionCell.appendChild(edit);
      row.appendChild(actionCell);

      body.appendChild(row);

      if (fund.eventualGoal > 0) {
        var detailRow = APP.dom.el("tr", "savings-detail-row");
        var detailCell = APP.dom.el("td", "muted");

        detailCell.colSpan = 10;

        var detailText =
          "Remaining to eventual goal: " +
          APP.utils.currency(fund.remainingEventual);

        if (fund.monthlyGoal > 0 && fund.remainingEventual > 0) {
          detailText +=
            " · Estimated completion: " +
            fund.estimatedCompletionMonth +
            " (" + Math.ceil(fund.estimatedMonthsRemaining) +
            " months at the current monthly goal).";
        } else if (fund.remainingEventual > 0) {
          detailText +=
            " · Set a monthly contribution goal to estimate completion.";
        } else {
          detailText += " · Eventual savings goal reached.";
        }

        if (fund.category.eventualSavingsGoalDate) {
          detailText +=
            " · Desired target date: " +
            fund.category.eventualSavingsGoalDate + ".";
        }

        detailCell.textContent = detailText;
        detailRow.appendChild(detailCell);
        body.appendChild(detailRow);
      }
    });

    table.appendChild(head);
    table.appendChild(body);
    wrap.appendChild(table);
    page.appendChild(wrap);
    root.appendChild(page);
  };
}());