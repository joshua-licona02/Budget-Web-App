(function () {
  "use strict";

  var APP = window.APP;
  APP.clean = {};

  APP.clean.type = function (value) {
    var text = APP.utils.header(value);

    if (["income", "credit", "deposit", "paycheck", "salary"].indexOf(text) !== -1) {
      return "income";
    }

    if ([
      "savings",
      "savings contribution",
      "savings transfer",
      "transfer to savings",
      "deposit to savings"
    ].indexOf(text) !== -1) {
      return "savings";
    }

    return "expense";
  };

  APP.clean.transaction = function (record) {
    var warnings = [];
    var date = APP.utils.parseDate(record.date);
    var amount = APP.utils.number(record.amount);

    if (!date) {
      warnings.push("Unparseable date.");
    }

    if (!Number.isFinite(amount) || amount === 0) {
      warnings.push("Amount is missing, zero, or invalid.");
    }

    if (amount < 0) {
      amount = Math.abs(amount);
      warnings.push("Negative amount converted to a positive transaction amount.");
    }

    if (!APP.utils.text(record.description)) {
      warnings.push("Description is missing.");
    }

    return {
      sourceRow: record.sourceRow,
      valid: warnings.length === 0,
      warnings: warnings,
      value: {
        id: APP.utils.id("txn"),
        date: date ? APP.utils.isoDate(date) : "",
        month: date ? APP.utils.month(date) : "",
        description: APP.utils.text(record.description),
        categoryName: APP.utils.text(record.category),
        type: APP.clean.type(record.type),
        amount: APP.utils.money(amount),
        notes: APP.utils.text(record.notes),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  };

  APP.clean.transactions = function (records) {
    var valid = [];
    var invalid = [];
    var warnings = [];

    (records || []).forEach(function (record) {
      var cleaned = APP.clean.transaction(record);

      if (cleaned.valid) {
        valid.push(cleaned.value);
      } else {
        invalid.push(cleaned);
        warnings.push(
          "Row " + (record.sourceRow || "?") + ": " + cleaned.warnings.join(" ")
        );
      }
    });

    return {
      valid: valid,
      invalid: invalid,
      warnings: warnings
    };
  };
}());