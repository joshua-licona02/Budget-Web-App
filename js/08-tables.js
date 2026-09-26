(function () {
  "use strict";

  var APP = window.APP;
  APP.tables = {};

  APP.tables.transactionType = function (transaction) {
    var kind = APP.model.classify(transaction);

    if (kind === "income") {
      return "Income";
    }

    if (kind === "savingsContribution") {
      return "Savings contribution";
    }

    if (kind === "savingsWithdrawal") {
      return "Expense — funded from savings";
    }

    if (kind === "debtPayment") {
      return "Expense — debt payment";
    }

    return "Expense";
  };

  APP.tables.transactionTone = function (transaction) {
    var kind = APP.model.classify(transaction);

    if (kind === "income") {
      return {
        typeClass: "transaction-income",
        amountClass: "money-income",
        sign: "+"
      };
    }

    if (kind === "savingsContribution") {
      return {
        typeClass: "transaction-savings",
        amountClass: "money-savings",
        sign: "+"
      };
    }

    if (kind === "savingsWithdrawal") {
      return {
        typeClass: "transaction-withdrawal",
        amountClass: "money-withdrawal",
        sign: "−"
      };
    }

    if (kind === "debtPayment") {
      return {
        typeClass: "transaction-debt",
        amountClass: "money-debt",
        sign: "−"
      };
    }

    return {
      typeClass: "transaction-expense",
      amountClass: "money-expense",
      sign: "−"
    };
  };

  APP.tables.transactions = function (transactions, options) {
    var config = options || {};
    var categories = APP.model.categories().byId;
    var wrap = APP.dom.el(
      "div",
      "table-wrap transaction-table-box " +
      (config.fullView ? "transaction-table-full" : "")
    );

    var table = APP.dom.el("table", "data-table transaction-data-table");
    var head = APP.dom.el("thead");
    var body = APP.dom.el("tbody");
    var heading = APP.dom.el("tr");

    [
      "Date",
      "Description",
      "Category",
      "Type",
      "Amount",
      "Notes",
      "Actions"
    ].forEach(function (label) {
      heading.appendChild(APP.dom.el("th", "", label));
    });

    head.appendChild(heading);

    transactions.forEach(function (transaction) {
      var row = APP.dom.el("tr");
      var category = categories[transaction.categoryId];
      var tone = APP.tables.transactionTone(transaction);
      var actionCell = APP.dom.el("td");

      var edit = APP.ui.button("Edit");
      var remove = APP.ui.button("Delete", "button-quiet danger");

      edit.dataset.action = "edit-transaction";
      edit.dataset.id = transaction.id;

      remove.dataset.action = "delete-transaction";
      remove.dataset.id = transaction.id;

      row.appendChild(APP.dom.el("td", "", transaction.date));
      row.appendChild(APP.dom.el("td", "", transaction.description));

      row.appendChild(APP.dom.el(
        "td",
        "",
        category ? category.name : "Unassigned / archived"
      ));

      row.appendChild(APP.dom.el(
        "td",
        tone.typeClass,
        APP.tables.transactionType(transaction)
      ));

      row.appendChild(APP.dom.el(
        "td",
        tone.amountClass,
        tone.sign + APP.utils.currency(transaction.amount)
      ));

      row.appendChild(APP.dom.el(
        "td",
        "",
        transaction.notes || "—"
      ));

      actionCell.appendChild(edit);
      actionCell.appendChild(remove);
      row.appendChild(actionCell);
      body.appendChild(row);
    });

    if (!transactions.length) {
      var emptyRow = APP.dom.el("tr");
      var emptyCell = APP.dom.el(
        "td",
        "muted",
        "No transactions match the current filters."
      );

      emptyCell.colSpan = 7;
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
    }

    table.appendChild(head);
    table.appendChild(body);
    wrap.appendChild(table);

    return wrap;
  };
}());