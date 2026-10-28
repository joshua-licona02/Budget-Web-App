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
        step: "0.01",
        percent: true
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

    form.appendChild(APP.ui.formSection("", [name, paymentCategory]));
    form.appendChild(APP.ui.formSection("Balance", [confirmedBalance, balanceAsOfDate]));
    form.appendChild(APP.ui.formSection("Terms", [apr, minimumPayment]));
    form.appendChild(APP.ui.formSection("", [notes]));

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
      form,
      { size: "sheet" }
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

  APP.pages.debts.debtCard = function (summary, category) {
    var debt = summary.debt;
    var card = APP.dom.el("article", "item-card debt-item" + (debt.archived ? " is-archived" : ""));
    var head = APP.dom.el("div", "item-card-head");
    var title = APP.dom.el("div", "item-card-title");
    var edit = APP.ui.button("Edit", "button-quiet item-card-edit");

    title.appendChild(APP.dom.el("h3", "", debt.name));

    if (debt.archived) {
      title.appendChild(APP.ui.pill("Archived"));
    } else if (summary.minimumPaymentRisk) {
      title.appendChild(APP.ui.pill("Below minimum", "pill-bad"));
    } else {
      title.appendChild(APP.ui.pill("On track", "pill-good"));
    }

    edit.addEventListener("click", function () {
      APP.pages.debts.openDebtModal(debt.id);
    });

    head.appendChild(title);
    head.appendChild(edit);
    card.appendChild(head);

    var figure = APP.dom.el("div", "item-card-figure");
    figure.appendChild(APP.dom.el("strong", "", APP.utils.currency(summary.projectedBalance)));
    figure.appendChild(APP.dom.el("span", "muted", "estimated balance"));
    card.appendChild(figure);

    var stats = APP.dom.el("div", "card-stats");

    stats.appendChild(APP.ui.stat("Paid this month",
      APP.utils.currency(summary.paymentThisMonth),
      summary.paymentThisMonth > 0 ? "money-income" : "muted"));
    stats.appendChild(APP.ui.stat("Minimum", APP.utils.currency(debt.minimumMonthlyPayment)));
    stats.appendChild(APP.ui.stat("APR", Number(debt.apr || 0).toFixed(2) + "%"));
    card.appendChild(stats);

    card.appendChild(APP.dom.el("p", "item-card-note",
      APP.utils.currency(summary.confirmedBalance) + " confirmed on " + summary.balanceAsOfDate +
      " · about " + APP.utils.currency(summary.estimatedMonthlyInterest) + "/mo interest" +
      (category ? " · paid from " + category.name : "")));

    var footer = APP.dom.el("div", "item-card-actions");
    var history = APP.ui.button("Payment history", "button-quiet");
    var archive = APP.ui.button(debt.archived ? "Restore" : "Archive", "button-quiet");

    history.addEventListener("click", function () {
      APP.pages.debts.openPaymentHistory(summary);
    });

    archive.addEventListener("click", function () {
      APP.pages.debts.toggleDebtArchive(debt.id);
    });

    footer.appendChild(history);
    footer.appendChild(archive);
    card.appendChild(footer);

    return card;
  };

  APP.pages.debts.render = function () {
    var root = APP.dom.refs.pages.debts;
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

    var page = APP.dom.el("section", "panel debt-page");

    page.appendChild(APP.ui.panelHeader(
      "Debts",
      "Estimated balances add interest and subtract payments since each balance was confirmed.",
      addDebt
    ));

    var summaryGrid = APP.dom.el("div", "fund-hero debt-summary-grid");

    summaryGrid.appendChild(APP.ui.currencyCard("Estimated total", projectedTotal, "danger"));
    summaryGrid.appendChild(APP.ui.currencyCard("Paid this month", paymentTotal, "success"));
    summaryGrid.appendChild(APP.ui.currencyCard("Monthly interest", interestTotal, "danger"));
    summaryGrid.appendChild(APP.ui.currencyCard("Confirmed balances", confirmedTotal));
    page.appendChild(summaryGrid);

    if (!summaries.length) {
      page.appendChild(APP.ui.empty("No debts tracked yet. Add one to begin."));
      root.appendChild(page);
      return;
    }

    var grid = APP.dom.el("div", "item-card-grid");

    summaries
      .slice()
      .sort(function (a, b) {
        return Number(a.debt.archived) - Number(b.debt.archived) ||
          b.projectedBalance - a.projectedBalance;
      })
      .forEach(function (summary) {
        grid.appendChild(APP.pages.debts.debtCard(summary, categoryMap[summary.debt.categoryId]));
      });

    page.appendChild(grid);
    root.appendChild(page);
  };
}());
