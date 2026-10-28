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
  // Sets a fund's monthly contribution target in the selected month's plan.
  APP.pages.savings.setMonthlyGoal = function (categoryId, amount) {
    var budget = APP.model.budget(APP.state.settings.selectedMonth, true);
    var item = APP.model.budgetItem(budget, categoryId);

    if (!item) {
      item = { categoryId: categoryId, dollarTarget: 0 };
      budget.items.push(item);
    }

    item.dollarTarget = APP.utils.money(amount);
    APP.store.log("success", "Updated a savings fund's monthly goal from its target date.");
    APP.controller.commit();
  };

  // Live "save $X/month" hint under a goal and target-date pair of fields.
  APP.pages.savings.goalHint = function (goalField, dateField, currentBalance) {
    var hint = APP.dom.el("p", "field-hint full");

    function update() {
      var remaining = APP.utils.money(goalField.input.value) - (currentBalance || 0);
      var plan = APP.analytics.goalPlan(remaining, dateField.input.value, APP.utils.month(new Date()));

      hint.textContent = !plan ? "" :
        plan.months > 0 ?
          "To reach it by " + APP.controller.monthName(plan.targetMonth) + ": save " +
            APP.utils.currency(plan.perMonth) + " a month for " + plan.months +
            (plan.months === 1 ? " month." : " months.") :
          "That date has already passed.";
    }

    goalField.input.addEventListener("input", update);
    dateField.input.addEventListener("input", update);
    dateField.input.addEventListener("change", update);
    update();
    return hint;
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

    var goalHint = APP.pages.savings.goalHint(eventualGoal, eventualDate, 0);

    name.root.classList.add("full");
    group.root.classList.add("full");
    monthlyGoal.root.classList.add("full");

    form.appendChild(APP.ui.formSection("", [name, group]));
    form.appendChild(APP.ui.formSection("Starting balance", [openingBalance, openingMonth]));
    form.appendChild(APP.ui.formSection("Goals", [monthlyGoal, eventualGoal, eventualDate, goalHint]));

    // With a target date and no monthly goal typed, use the amount the date requires.
    function fillMonthlyFromDate() {
      var plan = APP.analytics.goalPlan(
        APP.utils.money(eventualGoal.input.value) - APP.utils.money(openingBalance.input.value),
        eventualDate.input.value,
        APP.utils.month(new Date())
      );

      if (plan && plan.months > 0 && !APP.utils.money(monthlyGoal.input.value)) {
        monthlyGoal.input.value = APP.ui.formatMoneyText(plan.perMonth);
      }
    }

    eventualDate.input.addEventListener("change", fillMonthlyFromDate);

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

    APP.ui.modal("Add savings fund", form, { size: "sheet" });
  };
  APP.pages.savings.fundCard = function (fund, priorMonth) {
    var card = APP.dom.el("article", "item-card fund-item" + (fund.category.archived ? " is-archived" : ""));
    var head = APP.dom.el("div", "item-card-head");
    var title = APP.dom.el("div", "item-card-title");
    var edit = APP.ui.button("Edit", "button-quiet item-card-edit");

    title.appendChild(APP.dom.el("h3", "", fund.category.name));

    if (fund.category.archived) {
      title.appendChild(APP.ui.pill("Archived"));
    } else if (fund.eventualGoal > 0 && fund.remainingEventual <= 0) {
      title.appendChild(APP.ui.pill("Goal reached", "pill-good"));
    }

    edit.addEventListener("click", function () {
      APP.pages.categories.openModal(fund.category.id);
    });

    head.appendChild(title);
    head.appendChild(edit);
    card.appendChild(head);

    // Balance, and progress toward the eventual goal when there is one.
    var balance = APP.dom.el("div", "item-card-figure");
    balance.appendChild(APP.dom.el("strong", "", APP.utils.currency(fund.balance)));

    if (fund.eventualGoal > 0) {
      balance.appendChild(APP.dom.el("span", "muted", "of " + APP.utils.currency(fund.eventualGoal) + " goal"));
    } else {
      balance.appendChild(APP.dom.el("span", "muted", "saved"));
    }

    card.appendChild(balance);

    if (fund.eventualGoal > 0) {
      var progress = APP.dom.el("div", "item-card-progress");
      progress.appendChild(APP.ui.progress(fund.balance, fund.eventualGoal));
      progress.appendChild(APP.dom.el("span", "", Math.min(100, fund.eventualProgress).toFixed(0) + "%"));
      card.appendChild(progress);
    }

    // This month at a glance.
    var stats = APP.dom.el("div", "card-stats");
    var net = fund.deposits - fund.withdrawals;

    stats.appendChild(APP.ui.stat("This month",
      (net > 0 ? "+" : net < 0 ? "−" : "") + APP.utils.currency(Math.abs(net)),
      net > 0 ? "money-income" : net < 0 ? "money-expense" : "muted"));
    stats.appendChild(APP.ui.stat("Monthly goal",
      fund.monthlyGoal > 0 ? APP.utils.currency(fund.monthlyGoal) : "Not set",
      fund.monthlyGoal > 0 ? "" : "muted"));
    stats.appendChild(APP.ui.stat("End of month", APP.utils.currency(fund.projectedMonthlyBalance)));
    card.appendChild(stats);

    if (fund.deposits > 0 && fund.withdrawals > 0) {
      card.appendChild(APP.dom.el("p", "item-card-note",
        "+" + APP.utils.currency(fund.deposits) + " added · −" + APP.utils.currency(fund.withdrawals) +
        " used · started the month at " + APP.utils.currency(APP.model.savingsBalance(fund.category.id, priorMonth))));
    }

    // Plan toward the target date.
    var plan = fund.targetPlan;

    if (fund.eventualGoal > 0 && fund.remainingEventual > 0) {
      var planBox = APP.dom.el("div", "item-card-plan");

      if (plan && plan.months > 0) {
        var short = fund.monthlyGoal > 0 && fund.monthlyGoal < plan.perMonth;

        planBox.appendChild(APP.dom.el("p", "",
          "Save " + APP.utils.currency(plan.perMonth) + "/mo to reach it by " +
          APP.controller.monthName(plan.targetMonth) + " (" + plan.months +
          (plan.months === 1 ? " month left)" : " months left)")));

        if (short) {
          planBox.appendChild(APP.dom.el("p", "warning-text",
            "Your goal is " + APP.utils.currency(plan.perMonth - fund.monthlyGoal) + "/mo short."));
        }

        if (Math.abs(fund.monthlyGoal - plan.perMonth) >= 0.01) {
          var useIt = APP.ui.button("Use as this month's goal", "button-quiet");

          useIt.addEventListener("click", function () {
            APP.pages.savings.setMonthlyGoal(fund.category.id, plan.perMonth);
          });
          planBox.appendChild(useIt);
        }
      } else if (plan) {
        planBox.classList.add("is-late");
        planBox.appendChild(APP.dom.el("p", "danger",
          "Target date (" + APP.controller.monthName(plan.targetMonth) + ") has passed with " +
          APP.utils.currency(fund.remainingEventual) + " to go."));
      } else if (fund.monthlyGoal > 0) {
        planBox.appendChild(APP.dom.el("p", "",
          APP.utils.currency(fund.remainingEventual) + " to go · about " +
          Math.ceil(fund.estimatedMonthsRemaining) + " months at your monthly goal (" +
          fund.estimatedCompletionMonth + ")"));
      } else {
        planBox.appendChild(APP.dom.el("p", "muted",
          APP.utils.currency(fund.remainingEventual) + " to go. Add a target date or monthly goal to plan it."));
      }

      card.appendChild(planBox);
    }

    return card;
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
    var addFund = APP.ui.button("+ Add fund", "button-primary");

    addFund.addEventListener("click", function () {
      APP.pages.savings.openFundModal();
    });

    page.appendChild(APP.ui.panelHeader(
      "Savings & Goals",
      "Savings-funded expenses come out of their fund and don't count as normal spending.",
      addFund
    ));

    var hero = APP.dom.el("div", "fund-hero savings-summary");
    hero.appendChild(APP.ui.currencyCard("Total saved", totalBalance));
    hero.appendChild(APP.ui.currencyCard("Added this month", deposits, "success"));
    hero.appendChild(APP.ui.currencyCard("Used this month", withdrawals, "danger"));
    hero.appendChild(APP.ui.currencyCard("Monthly target", monthlyTarget));
    page.appendChild(hero);

    if (!funds.length) {
      page.appendChild(APP.ui.empty("No savings funds yet. Add one to start tracking."));
      root.appendChild(page);
      return;
    }

    var grid = APP.dom.el("div", "item-card-grid");

    funds.forEach(function (fund) {
      grid.appendChild(APP.pages.savings.fundCard(fund, priorMonth));
    });

    page.appendChild(grid);
    root.appendChild(page);
  };
}());
