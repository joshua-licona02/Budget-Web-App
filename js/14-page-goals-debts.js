(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.debts = {};

  APP.pages.debts.openDebtModal = function (debtId) {
    var existing = APP.state.debts.filter(function (debt) {
      return debt.id === debtId;
    })[0];

    var debt = existing || {
      name: "",
      confirmedBalance: 0,
      balanceAsOfDate: APP.utils.isoDate(new Date()),
      apr: 0,
      minimumMonthlyPayment: 0,
      notes: "",
      archived: false
    };

    var form = APP.dom.el("form", "form-grid");

        var paymentCategoryOptions = [{
      value: "",
      label: "Select payment category"
    }].concat(APP.state.categories
      .filter(function (category) {
        return !category.archived &&
          !category.isSavingsFund;
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      })
      .map(function (category) {
        return {
          value: category.id,
          label: category.name
        };
      }));

    var name = APP.ui.field(
      "Debt name",
      "name",
      "text",
      debt.name,
      {
        required: true,
        full: true,
        placeholder: "Example: Federal Student Loan"
      }
    );

        var paymentCategory = APP.ui.field(
      "Payment category",
      "categoryId",
      "select",
      debt.categoryId || "",
      {
        required: true,
        full: true,
        options: paymentCategoryOptions
      }
    );

    var confirmedBalance = APP.ui.field(
      "Confirmed balance",
      "confirmedBalance",
      "number",
      debt.confirmedBalance,
      {
        required: true,
        min: "0",
        step: "0.01"
      }
    );

    var balanceAsOfDate = APP.ui.field(
      "Balance confirmed as of",
      "balanceAsOfDate",
      "date",
      debt.balanceAsOfDate || APP.utils.isoDate(new Date()),
      {
        required: true
      }
    );

    var apr = APP.ui.field(
      "APR percentage",
      "apr",
      "number",
      debt.apr,
      {
        min: "0",
        step: "0.01"
      }
    );

    var minimumPayment = APP.ui.field(
      "Minimum monthly payment",
      "minimumMonthlyPayment",
      "number",
      debt.minimumMonthlyPayment,
      {
        min: "0",
        step: "0.01"
      }
    );

    var notes = APP.ui.field(
      "Notes",
      "notes",
      "text",
      debt.notes || "",
      {
        full: true,
        placeholder: "Optional lender, account, or planning notes"
      }
    );

    [
      name,
      paymentCategory,
      confirmedBalance,
      balanceAsOfDate,
      apr,
      minimumPayment,
      notes
    ].forEach(function (field) {
      form.appendChild(field.root);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var record = {
        id: existing ? existing.id : APP.utils.id("debt"),
       name: APP.utils.text(name.input.value),
       categoryId: paymentCategory.input.value,
       confirmedBalance: APP.utils.money(confirmedBalance.input.value),
        balanceAsOfDate: balanceAsOfDate.input.value,
        apr: APP.utils.money(apr.input.value),
        minimumMonthlyPayment: APP.utils.money(minimumPayment.input.value),
        notes: APP.utils.text(notes.input.value),
        archived: existing ? existing.archived : false,
        createdAt: existing ?
          existing.createdAt :
          new Date().toISOString()
      };

      if (!record.name) {
        APP.dom.toast("Enter a debt name.", "danger");
        return;
      }
            if (!record.categoryId) {
        APP.dom.toast(
          "Select the category used when paying this debt.",
          "danger"
        );
        return;
      }

      if (!record.balanceAsOfDate) {
        APP.dom.toast("Enter the date that the balance was confirmed.", "danger");
        return;
      }
      APP.state.categories.forEach(function (category) {
        if (category.id === record.categoryId) {
          category.isDebtCategory = true;
        }
      });
      if (existing) {
        APP.state.debts = APP.state.debts.map(function (item) {
          return item.id === record.id ? record : item;
        });

        APP.store.log(
          "success",
          "Updated confirmed balance for " + record.name + "."
        );
      } else {
        APP.state.debts.push(record);

        APP.store.log(
          "success",
          "Added debt: " + record.name + "."
        );
      }

      APP.ui.closeModal();
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var cancel = APP.ui.button("Cancel");
    var save = APP.ui.button(
      existing ? "Save debt changes" : "Add debt",
      "button-primary"
    );

    save.type = "submit";

    cancel.addEventListener("click", APP.ui.closeModal);

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    APP.ui.modal(
      existing ? "Edit debt" : "Add debt",
      form
    );
  };

  APP.pages.debts.toggleDebtArchive = function (debtId) {
    APP.state.debts.forEach(function (debt) {
      if (debt.id === debtId) {
        debt.archived = !debt.archived;

        APP.store.log(
          "info",
          (debt.archived ? "Archived" : "Restored") +
          " debt: " + debt.name + "."
        );
      }
    });

    APP.controller.commit();
  };

  APP.pages.debts.paymentTable = function (payments) {
    var wrap = APP.dom.el("div", "table-wrap");
    var table = APP.dom.el("table", "data-table");
    var head = APP.dom.el("thead");
    var body = APP.dom.el("tbody");
    var heading = APP.dom.el("tr");

    [
      "Date",
      "Description",
      "Payment"
    ].forEach(function (label) {
      heading.appendChild(APP.dom.el("th", "", label));
    });

    head.appendChild(heading);

    payments.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    }).forEach(function (payment) {
      var row = APP.dom.el("tr");

      row.appendChild(APP.dom.el("td", "", payment.date));
      row.appendChild(APP.dom.el("td", "", payment.description));
      row.appendChild(APP.dom.el(
        "td",
        "money-expense",
        "−" + APP.utils.currency(payment.amount)
      ));

      body.appendChild(row);
    });

    if (!payments.length) {
      var empty = APP.dom.el("tr");
      var cell = APP.dom.el(
        "td",
        "muted",
        "No allocated payments have been recorded for this debt."
      );

      cell.colSpan = 3;
      empty.appendChild(cell);
      body.appendChild(empty);
    }

    table.appendChild(head);
    table.appendChild(body);
    wrap.appendChild(table);

    return wrap;
  };

  APP.pages.debts.openPaymentHistory = function (debtSummary) {
    var content = APP.dom.el("div", "debt-payment-history");

    content.appendChild(APP.dom.el(
      "p",
      "muted",
      "Payments below are Expense transactions allocated to " +
      debtSummary.debt.name + "."
    ));

    content.appendChild(
      APP.pages.debts.paymentTable(debtSummary.paymentHistory)
    );

    APP.ui.modal(
      debtSummary.debt.name + " Payment History",
      content
    );
  };

    APP.pages.debts.render = function () {
    var root = APP.dom.refs.pages.debts;
    var controls = APP.dom.el("div", "button-row");
    var addDebt = APP.ui.button("+ Add debt", "button-primary");
    var summaries = APP.analytics.debts();
    var categoryMap = APP.model.categories().byId;

    var confirmedTotal = APP.utils.sum(summaries, function (summary) {
      return summary.confirmedBalance;
    });

    var paymentTotal = APP.utils.sum(summaries, function (summary) {
      return summary.paymentThisMonth;
    });

    var interestTotal = APP.utils.sum(summaries, function (summary) {
      return summary.estimatedMonthlyInterest;
    });

    var projectedTotal = APP.utils.sum(summaries, function (summary) {
      return summary.projectedBalance;
    });

    APP.dom.clear(root);

    addDebt.addEventListener("click", function () {
      APP.pages.debts.openDebtModal();
    });

    controls.appendChild(addDebt);

    var page = APP.dom.el("section", "panel debt-page");

    page.appendChild(APP.ui.panelHeader(
      "Debt Tracking",
      "Confirmed balances are manually maintained. Projected balances estimate interest and subtract allocated debt payments.",
      controls
    ));

    var summaryGrid = APP.dom.el("div", "fund-hero debt-summary-grid");

    summaryGrid.appendChild(APP.ui.currencyCard(
      "Confirmed debt balance",
      confirmedTotal,
      "danger"
    ));

    summaryGrid.appendChild(APP.ui.currencyCard(
      "Payments this month",
      paymentTotal,
      "success"
    ));

    summaryGrid.appendChild(APP.ui.currencyCard(
      "Estimated monthly interest",
      interestTotal,
      "danger"
    ));

    summaryGrid.appendChild(APP.ui.currencyCard(
      "Estimated projected balance",
      projectedTotal
    ));

    page.appendChild(summaryGrid);

    if (!summaries.length) {
      page.appendChild(APP.ui.empty(
        "No debts are currently tracked. Add a debt to begin."
      ));

      root.appendChild(page);
      return;
    }

    var wrap = APP.dom.el("div", "table-wrap debt-table-wrap");
    var table = APP.dom.el("table", "data-table debt-table");
    var head = APP.dom.el("thead");
    var body = APP.dom.el("tbody");
    var heading = APP.dom.el("tr");

    [
      "Debt Account",
      "Payment Category",
      "Confirmed Balance",
      "APR",
      "Minimum Payment",
      "Paid This Month",
      "Projected Balance",
      "Status",
      "Actions"
    ].forEach(function (label) {
      heading.appendChild(APP.dom.el("th", "", label));
    });

    head.appendChild(heading);

    summaries
      .slice()
      .sort(function (a, b) {
        return b.projectedBalance - a.projectedBalance;
      })
      .forEach(function (summary) {
        var debt = summary.debt;
        var category = categoryMap[debt.categoryId];
        var row = APP.dom.el("tr");
        var actionCell = APP.dom.el("td");

        var edit = APP.ui.button("Edit");
        var history = APP.ui.button("Payments");
        var archive = APP.ui.button(
          debt.archived ? "Restore" : "Archive"
        );

        var statusText = summary.minimumPaymentRisk ?
          "Minimum risk" :
          "On track";

        var statusClass = summary.minimumPaymentRisk ?
          "danger" :
          "success";

        row.appendChild(APP.dom.el("td", "", debt.name));

        row.appendChild(APP.dom.el(
          "td",
          "muted",
          category ? category.name : "Not assigned"
        ));

        row.appendChild(APP.dom.el(
          "td",
          "",
          APP.utils.currency(summary.confirmedBalance)
        ));

        row.appendChild(APP.dom.el(
          "td",
          "",
          debt.apr.toFixed(2) + "%"
        ));

        row.appendChild(APP.dom.el(
          "td",
          "",
          APP.utils.currency(debt.minimumMonthlyPayment)
        ));

       row.appendChild(APP.dom.el(
  "td",
  summary.paymentThisMonth > 0 ?
    "money-income" :
    "money-zero",
  summary.paymentThisMonth > 0 ?
    "+" + APP.utils.currency(summary.paymentThisMonth) :
    APP.utils.currency(0)
));

        row.appendChild(APP.dom.el(
          "td",
          "",
          APP.utils.currency(summary.projectedBalance)
        ));

        row.appendChild(APP.dom.el(
          "td",
          statusClass,
          statusText
        ));

        edit.addEventListener("click", function () {
          APP.pages.debts.openDebtModal(debt.id);
        });

        history.addEventListener("click", function () {
          APP.pages.debts.openPaymentHistory(summary);
        });

        archive.addEventListener("click", function () {
          APP.pages.debts.toggleDebtArchive(debt.id);
        });

        actionCell.appendChild(edit);
        actionCell.appendChild(history);
        actionCell.appendChild(archive);

        row.appendChild(actionCell);
        body.appendChild(row);

        var detailRow = APP.dom.el("tr", "debt-detail-row");
        var detailCell = APP.dom.el("td", "muted");

        detailCell.colSpan = 9;

        detailCell.textContent =
          "Balance confirmed as of " +
          summary.balanceAsOfDate +
          " · Estimated monthly interest: " +
          APP.utils.currency(summary.estimatedMonthlyInterest) +
          " · Payments since confirmation: " +
          APP.utils.currency(summary.paymentsSinceConfirmed) +
          " · Estimated principal reduction at minimum payment: " +
          APP.utils.currency(summary.principalEstimate);

        detailRow.appendChild(detailCell);
        body.appendChild(detailRow);
      });

    table.appendChild(head);
    table.appendChild(body);
    wrap.appendChild(table);

    page.appendChild(wrap);
    root.appendChild(page);
  };
}());