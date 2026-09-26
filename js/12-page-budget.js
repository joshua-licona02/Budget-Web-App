(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.budget = {};

  APP.pages.budget.previousMonth = function (month) {
    var parts = month.split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 2, 1);

    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0");
  };

  APP.pages.budget.actualForCategory = function (category, activity) {
    if (category.isSavingsFund) {
      return APP.utils.money(activity.contributions);
    }

    return APP.utils.money(activity.operating) +
      APP.utils.money(activity.debt);
  };

  APP.pages.budget.copyPreviousMonth = function (budget, month) {
    var priorMonth = APP.pages.budget.previousMonth(month);
    var priorBudget = APP.model.budget(priorMonth, false);

    if (!priorBudget.id && !priorBudget.items.length) {
      APP.dom.toast(
        "No monthly plan exists for " + priorMonth + ".",
        "danger"
      );
      return;
    }

    if (!window.confirm(
      "Copy budget targets from " + priorMonth + " into " + month + "?"
    )) {
      return;
    }

    budget.expectedIncome = APP.utils.money(priorBudget.expectedIncome);

    budget.items = (priorBudget.items || []).map(function (item) {
      return {
        categoryId: item.categoryId,
        dollarTarget: APP.utils.money(item.dollarTarget)
      };
    });

    APP.store.log(
      "success",
      "Copied monthly plan from " + priorMonth + " to " + month + "."
    );

    APP.controller.commit();
  };

  APP.pages.budget.render = function () {
    var root = APP.dom.refs.pages.budget;
    var month = APP.state.settings.selectedMonth;
    var budget = APP.model.budget(month, true);
    var activity = APP.analytics.categoryActivity(month);
    var salary = APP.analytics.salary();

    var totalGoals = APP.utils.sum(budget.items, function (item) {
      return item.dollarTarget;
    });

    var incomeAfterGoals =
      APP.utils.money(budget.expectedIncome) - totalGoals;

    var goalPercent = APP.utils.money(budget.expectedIncome) > 0 ?
      totalGoals / APP.utils.money(budget.expectedIncome) * 100 :
      0;

    APP.dom.clear(root);

    var page = APP.dom.el("section", "panel monthly-plan-page");
    var actionRow = APP.dom.el("div", "button-row");

    var useSalary = APP.ui.button("Use salary estimate");
    var copyPrior = APP.ui.button("Copy prior month");
    var saveNotice = APP.dom.el(
      "span",
      "muted",
      "Changes save automatically."
    );

    useSalary.addEventListener("click", function () {
      budget.expectedIncome = APP.utils.money(salary.netMonthly);

      APP.store.log(
        "success",
        "Estimated net monthly salary copied to the monthly plan."
      );

      APP.controller.commit();
    });

    copyPrior.addEventListener("click", function () {
      APP.pages.budget.copyPreviousMonth(budget, month);
    });

    actionRow.appendChild(useSalary);
    actionRow.appendChild(copyPrior);
    actionRow.appendChild(saveNotice);

    page.appendChild(APP.ui.panelHeader(
      "Monthly Category Budget",
      "Spending targets are limits. Savings targets are desired fund contributions. Dollar and percentage targets stay synchronized.",
      actionRow
    ));

    var incomeRow = APP.dom.el("div", "monthly-income-row");

    var expectedIncome = APP.ui.field(
      "Expected monthly income",
      "expectedIncome",
      "number",
      budget.expectedIncome,
      {
        min: "0",
        step: "0.01"
      }
    );

    expectedIncome.input.addEventListener("change", function () {
      budget.expectedIncome = APP.utils.money(expectedIncome.input.value);

      APP.store.log(
        "info",
        "Expected monthly income updated for " + month + "."
      );

      APP.controller.commit();
    });

    incomeRow.appendChild(expectedIncome.root);

    incomeRow.appendChild(APP.dom.el(
      "p",
      "muted",
      "Estimated salary reference: " +
      APP.utils.currency(salary.netMonthly)
    ));

    page.appendChild(incomeRow);

    var summary = APP.dom.el("div", "fund-hero monthly-plan-summary");

    summary.appendChild(APP.ui.currencyCard(
      "Expected income",
      budget.expectedIncome,
      "success"
    ));

    summary.appendChild(APP.ui.currencyCard(
      "Total goals",
      totalGoals,
      totalGoals > APP.utils.money(budget.expectedIncome) ? "danger" : ""
    ));

    summary.appendChild(APP.ui.currencyCard(
      "Income after goals",
      incomeAfterGoals,
      incomeAfterGoals < 0 ? "danger" : "success"
    ));

    var percentCard = APP.dom.el(
      "article",
      "summary-card " +
      (goalPercent > 100 ? "danger" : "")
    );

    percentCard.appendChild(APP.dom.el("span", "", "Goals % income"));
    percentCard.appendChild(APP.dom.el(
      "strong",
      "",
      APP.utils.money(budget.expectedIncome) > 0 ?
        goalPercent.toFixed(1) + "%" :
        "—"
    ));

    summary.appendChild(percentCard);
    page.appendChild(summary);

    var wrap = APP.dom.el("div", "table-wrap monthly-plan-table-wrap");
    var table = APP.dom.el("table", "data-table monthly-plan-table");
    var head = APP.dom.el("thead");
    var body = APP.dom.el("tbody");
    var headerRow = APP.dom.el("tr");

    [
      "Category",
      "Dollar Target",
      "% Income",
      "Actual",
      "Remaining / Over",
      "Status"
    ].forEach(function (label) {
      headerRow.appendChild(APP.dom.el("th", "", label));
    });

    head.appendChild(headerRow);

    APP.state.categories
      .filter(function (category) {
        return !category.archived;
      })
      .slice()
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      })
      .forEach(function (category) {
        var currentItem = APP.model.budgetItem(budget, category.id);
        var target = currentItem ?
          APP.utils.money(currentItem.dollarTarget) :
          0;

        var categoryActivity = activity[category.id] || {};
        var actual = APP.pages.budget.actualForCategory(
          category,
          categoryActivity
        );

        var remaining = target - actual;
        var status = "No target";
        var statusClass = "muted";

        if (target > 0 && actual < target) {
          status = "On track";
          statusClass = "success";
        }

        if (target > 0 && actual === target) {
          status = "Target met";
          statusClass = "success";
        }

        if (target > 0 && actual > target) {
          status = "Over target";
          statusClass = "danger";
        }

        var percent = APP.utils.money(budget.expectedIncome) > 0 ?
          target / APP.utils.money(budget.expectedIncome) * 100 :
          0;

        var row = APP.dom.el("tr");
        var targetCell = APP.dom.el("td");
        var percentCell = APP.dom.el("td");

        var targetInput = APP.dom.el("input");
        targetInput.type = "number";
        targetInput.min = "0";
        targetInput.step = "0.01";
        targetInput.value = target;
        targetInput.className = "monthly-target-input";

        var percentInput = APP.dom.el("input");
        percentInput.type = "number";
        percentInput.min = "0";
        percentInput.step = "0.1";
        percentInput.value = percent.toFixed(1);
        percentInput.className = "monthly-target-input";

        function saveTarget(value) {
          var budgetItem = APP.model.budgetItem(budget, category.id);

          if (!budgetItem) {
            budgetItem = {
              categoryId: category.id,
              dollarTarget: 0
            };

            budget.items.push(budgetItem);
          }

          budgetItem.dollarTarget = APP.utils.money(value);

          APP.store.log(
            "info",
            "Updated target for " + category.name + "."
          );

          APP.controller.commit();
        }

        targetInput.addEventListener("change", function () {
          saveTarget(targetInput.value);
        });

        percentInput.addEventListener("change", function () {
          if (APP.utils.money(budget.expectedIncome) <= 0) {
            APP.dom.toast(
              "Set expected monthly income before entering a percentage target.",
              "danger"
            );

            return;
          }

          saveTarget(
            APP.utils.money(budget.expectedIncome) *
            APP.utils.number(percentInput.value) / 100
          );
        });

        row.appendChild(APP.dom.el(
          "td",
          "",
          category.name +
          (category.isSavingsFund ? " (Savings Fund)" : "")
        ));

        targetCell.appendChild(targetInput);
        percentCell.appendChild(percentInput);

        row.appendChild(targetCell);
        row.appendChild(percentCell);

        row.appendChild(APP.dom.el(
          "td",
          actual > 0 ? "money-expense" : "money-zero",
          actual > 0 ?
            "−" + APP.utils.currency(actual) :
            APP.utils.currency(actual)
        ));

        row.appendChild(APP.dom.el(
          "td",
          remaining < 0 ? "money-expense" :
            remaining > 0 ? "money-income" :
              "money-zero",
          target <= 0 ?
            "—" :
            remaining < 0 ?
              "−" + APP.utils.currency(Math.abs(remaining)) :
              APP.utils.currency(remaining)
        ));

        row.appendChild(APP.dom.el(
          "td",
          statusClass,
          status
        ));

        body.appendChild(row);
      });

    table.appendChild(head);
    table.appendChild(body);
    wrap.appendChild(table);

    page.appendChild(wrap);
    root.appendChild(page);
  };
}());