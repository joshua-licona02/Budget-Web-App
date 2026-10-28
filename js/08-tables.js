(function () {
  "use strict";

  var APP = window.APP;
  APP.tables = {};

  APP.tables.transactionType = function (transaction) {
    var kind = APP.model.classify(transaction);

    if (kind === "income") {
      var type = transaction.incomeType || "paycheck";
      return type === "paycheck" ? "Income" : "Income — " + APP.model.incomeTypeLabel(type).toLowerCase();
    }

    if (kind === "refund") {
      return "Refund";
    }

    if (kind === "roundUpContribution") {
      return "Round-up savings";
    }

    if (kind === "savingsContribution") {
      return "Savings contribution";
    }

    if (kind === "freeMoneyContribution") {
      return "Moved to Free Money";
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

    if (kind === "income" || kind === "refund") {
      return {
        typeClass: "transaction-income",
        amountClass: "money-income",
        sign: "+"
      };
    }

    if (kind === "savingsContribution" || kind === "freeMoneyContribution" ||
        kind === "roundUpContribution") {
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
    var roundUpsById = {};

    APP.state.transactions.forEach(function (item) {
      if (item.roundUpFor) {
        roundUpsById[item.id] = item;
      }
    });

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

      var amountCell = APP.dom.el(
        "td",
        tone.amountClass,
        tone.sign + APP.utils.currency(transaction.amount)
      );

      // An expense that was rounded up shows the change it saved.
      var roundUp = transaction.roundUpId ? roundUpsById[transaction.roundUpId] : null;

      if (roundUp) {
        amountCell.appendChild(APP.dom.el("span", "round-up-note",
          "+" + APP.utils.currency(roundUp.amount) + " rounded up"));
      }

      row.appendChild(amountCell);

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

  // Phone layout: transactions as tappable rows grouped under their date. Tapping a row
  // opens it for editing (delete is in the edit form).
  APP.tables.transactionList = function (transactions, options) {
    // Date headings only make sense when the list is sorted by date.
    var grouped = !options || options.grouped !== false;
    var roundUpsById = {};
    var categories = APP.model.categories().byId;
    var list = APP.dom.el("div", "transaction-list");
    var currentDate = null;
    var group = null;

    APP.state.transactions.forEach(function (item) {
      if (item.roundUpFor) {
        roundUpsById[item.id] = item;
      }
    });

    if (!transactions.length) {
      list.appendChild(APP.dom.el("p", "transaction-list-empty", "No transactions match the current filters."));
      return list;
    }

    transactions.forEach(function (transaction) {
      if (!group || (grouped && transaction.date !== currentDate)) {
        currentDate = transaction.date;
        group = APP.dom.el("div", "transaction-day");

        if (grouped) {
          group.appendChild(APP.dom.el("h3", "transaction-day-label", APP.tables.dayLabel(transaction.date)));
        }

        list.appendChild(group);
      }

      var category = categories[transaction.categoryId];
      var tone = APP.tables.transactionTone(transaction);
      var row = APP.dom.el("button", "transaction-item " + tone.typeClass);
      var main = APP.dom.el("span", "transaction-item-main");
      var amount = APP.dom.el("span", "transaction-item-amount " + tone.amountClass,
        tone.sign + APP.utils.currency(transaction.amount));
      var type = APP.tables.transactionType(transaction);
      var details = [];

      if (!grouped) {
        details.push(APP.tables.dayLabel(transaction.date));
      }

      if (category) {
        details.push(category.name);
      } else if (APP.model.classify(transaction) !== "income") {
        details.push("Unassigned");
      }

      if (type !== "Expense") {
        details.push(type);
      }

      if (transaction.notes) {
        details.push(transaction.notes);
      }

      row.type = "button";
      row.dataset.action = "edit-transaction";
      row.dataset.id = transaction.id;

      main.appendChild(APP.dom.el("strong", "", transaction.description || "Untitled"));
      main.appendChild(APP.dom.el("small", "", details.join(" · ")));

      var roundUp = transaction.roundUpId ? roundUpsById[transaction.roundUpId] : null;

      if (roundUp) {
        amount.appendChild(APP.dom.el("small", "round-up-note",
          "+" + APP.utils.currency(roundUp.amount) + " rounded up"));
      }

      row.appendChild(APP.dom.el("span", "transaction-item-dot"));
      row.appendChild(main);
      row.appendChild(amount);
      group.appendChild(row);
    });

    return list;
  };

  // "Today", "Yesterday", or e.g. "Mon, Oct 27" (with the year when it isn't this year).
  APP.tables.dayLabel = function (isoDate) {
    var parts = String(isoDate || "").split("-");

    if (parts.length !== 3) {
      return isoDate || "No date";
    }

    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var today = new Date();
    var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return date.toLocaleDateString("en-US", date.getFullYear() === today.getFullYear() ?
      { weekday: "short", month: "short", day: "numeric" } :
      { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };
}());