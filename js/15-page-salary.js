(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.salary = {};

  APP.pages.salary.dateLabel = function (iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  APP.pages.salary.shortDate = function (iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Pay settings form. Fields for the pay type not in use are hidden.
  APP.pages.salary.settingsForm = function (settings) {
    var form = APP.dom.el("form", "form-grid salary-form");
    var schedules = APP.analytics.paySchedules;

    var payType = APP.ui.field("How you're paid", "payType", "select", settings.payType, {
      options: [
        { value: "hourly", label: "Hourly" },
        { value: "salary", label: "Salary" }
      ]
    });
    var hourlyRate = APP.ui.field("Hourly rate", "hourlyRate", "number", settings.hourlyRate, { money: true });
    var hoursPerDay = APP.ui.field("Hours per workday", "hoursPerDay", "number", settings.hoursPerDay, {
      min: "1",
      step: "0.25"
    });
    var annual = APP.ui.field("Annual salary", "annualGrossSalary", "number", settings.annualGrossSalary, { money: true });
    var schedule = APP.ui.field("Pay schedule", "schedule", "select", settings.schedule, {
      options: Object.keys(schedules).map(function (key) {
        return { value: key, label: schedules[key].label };
      })
    });
    var anchor = APP.ui.field("A recent payday", "payAnchorDate", "date", settings.payAnchorDate);
    var federal = APP.ui.field("Federal withholding %", "federalWithholdingPct", "number",
      settings.federalWithholdingPct, { min: "0", step: "0.01", percent: true });
    var state = APP.ui.field("State/local withholding %", "stateWithholdingPct", "number",
      settings.stateWithholdingPct, { min: "0", step: "0.01", percent: true });
    var fica = APP.ui.field("Social Security + Medicare %", "ficaPct", "number",
      settings.ficaPct, { min: "0", step: "0.01", percent: true, placeholder: "Usually 7.65" });
    var retirement = APP.ui.field("Retirement contribution % (pre-tax)", "retirementContributionPct", "number",
      settings.retirementContributionPct, { min: "0", step: "0.01", percent: true });
    var fixed = APP.ui.field("Insurance/fixed deductions per paycheck", "fixedDeductionsPerPaycheck", "number",
      settings.fixedDeductionsPerPaycheck, { money: true });

    var fields = [payType, hourlyRate, hoursPerDay, annual, schedule, anchor, federal, state, fica, retirement, fixed];

    function updateVisibility() {
      var hourly = payType.input.value === "hourly";
      var anchored = schedule.input.value === "biweekly" || schedule.input.value === "weekly";

      hourlyRate.root.style.display = hourly ? "" : "none";
      hoursPerDay.root.style.display = hourly ? "" : "none";
      annual.root.style.display = hourly ? "none" : "";
      anchor.root.style.display = anchored ? "" : "none";
    }

    payType.input.addEventListener("change", updateVisibility);
    schedule.input.addEventListener("change", updateVisibility);

    fields.forEach(function (field) {
      form.appendChild(field.root);
    });

    form.appendChild(APP.dom.el("p", "field-hint full salary-hint",
      "Hourly pay counts the weekdays in each pay period × your hours per workday, so twice-a-month checks are 80, 88 or 96 hours at 8 hours a day. Paydays on a weekend move to the Friday before."));

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      APP.state.salary = Object.assign({}, APP.state.salary, {
        payType: payType.input.value,
        hourlyRate: APP.utils.money(hourlyRate.input.value),
        hoursPerDay: APP.utils.number(hoursPerDay.input.value) || 8,
        annualGrossSalary: APP.utils.money(annual.input.value),
        schedule: schedule.input.value,
        payPeriodsPerYear: schedules[schedule.input.value].perYear,
        payAnchorDate: anchor.input.value,
        federalWithholdingPct: APP.utils.number(federal.input.value) || 0,
        stateWithholdingPct: APP.utils.number(state.input.value) || 0,
        ficaPct: APP.utils.number(fica.input.value) || 0,
        retirementContributionPct: APP.utils.number(retirement.input.value) || 0,
        fixedDeductionsPerPaycheck: APP.utils.money(fixed.input.value)
      });

      APP.store.log("success", "Pay settings updated.");
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var save = APP.ui.button("Save pay settings", "button-primary");

    save.type = "submit";
    actions.appendChild(save);
    form.appendChild(actions);
    updateVisibility();

    return form;
  };

  // Upcoming paychecks; checks longer or shorter than usual are marked.
  APP.pages.salary.calendar = function (checks) {
    var wrap = APP.dom.el("div", "table-wrap");
    var table = APP.dom.el("table", "data-table pay-calendar");
    var head = APP.dom.el("tr");
    var hourCounts = {};

    checks.forEach(function (check) {
      if (check.hours) {
        hourCounts[check.hours] = (hourCounts[check.hours] || 0) + 1;
      }
    });

    var usual = Object.keys(hourCounts).sort(function (a, b) {
      return hourCounts[b] - hourCounts[a];
    })[0];

    ["Payday", "Pay period", "Hours", "Gross", "Take-home"].forEach(function (label) {
      head.appendChild(APP.dom.el("th", "", label));
    });

    var thead = APP.dom.el("thead");
    var body = APP.dom.el("tbody");
    thead.appendChild(head);
    table.appendChild(thead);

    checks.forEach(function (check) {
      var row = APP.dom.el("tr");
      var hoursCell = APP.dom.el("td", "pay-hours");

      // "Oct 1–15" within a month; "Sep 28–Oct 11" across months.
      var sameMonth = check.start.slice(0, 7) === check.end.slice(0, 7);

      row.appendChild(APP.dom.el("td", "pay-date", APP.pages.salary.shortDate(check.payDate)));
      row.appendChild(APP.dom.el("td", "muted pay-date",
        APP.pages.salary.shortDate(check.start) + "–" +
        (sameMonth ? String(Number(check.end.slice(8))) : APP.pages.salary.shortDate(check.end))));

      hoursCell.textContent = check.hours === null ? "—" : check.hours;

      if (check.hours && usual && String(check.hours) !== usual) {
        hoursCell.appendChild(APP.dom.el("span",
          "pay-tag " + (check.hours > Number(usual) ? "pay-tag-up" : "pay-tag-down"),
          check.hours > Number(usual) ? "longer" : "shorter"));
      }

      row.appendChild(hoursCell);
      row.appendChild(APP.dom.el("td", "breakdown-number", APP.utils.currency(check.gross)));
      row.appendChild(APP.dom.el("td", "breakdown-number pay-net", APP.utils.currency(check.net)));
      body.appendChild(row);
    });

    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  };

  // Compact pay section for the Accounts page: settings (collapsed once filled in), this
  // month's take-home, the next paycheck, and the next few paychecks. The Monthly Plan's
  // salary estimate uses these settings.
  APP.pages.salary.renderSection = function (host) {
    var settings = APP.analytics.paySettings();
    var configured = settings.payType === "hourly" ? settings.hourlyRate > 0 : settings.annualGrossSalary > 0;
    var month = APP.state.settings.selectedMonth;
    var today = new Date();
    var monthPay = APP.analytics.salaryForMonth(month);
    var upcoming = APP.analytics.paychecks(
      new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      new Date(today.getFullYear(), today.getMonth() + 3, 0)
    );
    var details = APP.dom.el("details", "pay-settings");

    details.open = !configured;
    details.appendChild(APP.dom.el("summary", "", configured ? "Pay settings" : "Set up your pay"));
    details.appendChild(APP.pages.salary.settingsForm(settings));
    host.appendChild(details);

    if (!configured) {
      return;
    }

    var cards = APP.dom.el("div", "summary-grid salary-cards");
    var next = upcoming[0];

    cards.appendChild(APP.ui.currencyCard(
      "Take-home in " + APP.controller.monthName(month),
      monthPay.net,
      "success",
      monthPay.paychecks.length + " paycheck" + (monthPay.paychecks.length === 1 ? "" : "s") +
        (monthPay.hours ? " · " + monthPay.hours + " hours" : "")
    ));

    if (next) {
      cards.appendChild(APP.ui.currencyCard("Next paycheck", next.net, "",
        APP.pages.salary.dateLabel(next.payDate) + (next.hours ? " · " + next.hours + " hours" : "")));
    }

    host.appendChild(cards);
    host.appendChild(APP.pages.salary.calendar(upcoming.slice(0, 6)));
  };
}());
