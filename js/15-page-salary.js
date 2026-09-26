(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.salary = {};

  APP.pages.salary.render = function () {
    var root = APP.dom.refs.pages.salary;
    var salary = APP.state.salary;
    var estimate = APP.analytics.salary();
    var form = APP.dom.el("form", "form-grid");

    var fields = [
      APP.ui.field("Annual gross salary", "annualGrossSalary", "number", salary.annualGrossSalary, {
        min: "0", step: "0.01"
      }),
      APP.ui.field("Pay periods per year", "payPeriodsPerYear", "number", salary.payPeriodsPerYear, {
        min: "1", step: "1"
      }),
      APP.ui.field("Federal withholding percentage", "federalWithholdingPct", "number", salary.federalWithholdingPct, {
        min: "0", step: "0.01"
      }),
      APP.ui.field("State/local withholding percentage", "stateWithholdingPct", "number", salary.stateWithholdingPct, {
        min: "0", step: "0.01"
      }),
      APP.ui.field("Retirement contribution percentage", "retirementContributionPct", "number", salary.retirementContributionPct, {
        min: "0", step: "0.01"
      }),
      APP.ui.field("Insurance/fixed deductions per paycheck", "fixedDeductionsPerPaycheck", "number", salary.fixedDeductionsPerPaycheck, {
        min: "0", step: "0.01"
      })
    ];

    APP.dom.clear(root);
    root.appendChild(APP.ui.panelHeader(
      "Salary planner",
      "Manual planning estimates only. Confirm payroll, tax, withholding, and retirement details independently."
    ));

    fields.forEach(function (field) {
      form.appendChild(field.root);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      fields.forEach(function (field) {
        salary[field.input.name] = APP.utils.money(field.input.value);
      });

      salary.payPeriodsPerYear = Math.max(1, Math.round(APP.utils.number(salary.payPeriodsPerYear)));
      APP.store.log("success", "Salary-planning assumptions updated.");
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var save = APP.ui.button("Save salary assumptions", "button-primary");
    var useNet = APP.ui.button("Use estimated net income in monthly plan");
    save.type = "submit";

    useNet.addEventListener("click", function () {
      var budget = APP.model.budget(APP.state.settings.selectedMonth, true);
      budget.expectedIncome = APP.utils.money(estimate.netMonthly);
      APP.store.log("success", "Estimated net monthly income copied to the selected monthly plan.");
      APP.controller.commit();
    });

    actions.appendChild(useNet);
    actions.appendChild(save);
    form.appendChild(actions);
    root.appendChild(form);

    var cards = APP.dom.el("div", "fund-hero");
    cards.appendChild(APP.ui.currencyCard("Gross monthly income", estimate.grossMonthly));
    cards.appendChild(APP.ui.currencyCard("Estimated net monthly income", estimate.netMonthly));
    cards.appendChild(APP.ui.currencyCard("Gross paycheck", estimate.grossPaycheck));
    cards.appendChild(APP.ui.currencyCard("Estimated net paycheck", estimate.netPaycheck));
    cards.appendChild(APP.ui.currencyCard("Estimated withholding per paycheck", estimate.withholding));
    cards.appendChild(APP.ui.currencyCard("Fixed deductions per paycheck", estimate.fixed));
    root.appendChild(cards);
  };
}());