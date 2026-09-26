(function () {
  "use strict";

  var APP = window.APP;
  APP.model = {};

  APP.model.seedCategories = function () {
    return APP.seedCategories.map(function (seed) {
      return {
        id: APP.utils.id("cat"),
        group: seed[0],
        name: seed[1],
        isSavingsFund: Boolean(seed[2]),
        isDebtCategory: Boolean(seed[3]),
        isTemporary: false,
        archived: false,
        openingBalance: 0,
        openingBalanceEffectiveMonth: "",
        eventualSavingsGoal: 0,
        eventualSavingsGoalDate: "",
        createdAt: new Date().toISOString()
      };
    });
  };

  APP.model.ensureFreeMoneyFund = function () {
    var exists = APP.state.categories.some(function (category) {
      return APP.utils.header(category.name) === "free money";
    });

    if (exists) {
      return;
    }

    APP.state.categories.push({
      id: APP.utils.id("cat"),
      group: "Savings and Funds",
      name: "Free Money",
      isSavingsFund: true,
      isDebtCategory: false,
      isTemporary: false,
      archived: false,
      openingBalance: 0,
      openingBalanceEffectiveMonth: "",
      eventualSavingsGoal: 0,
      eventualSavingsGoalDate: "",
      createdAt: new Date().toISOString()
    });
  };

  APP.model.normalizeDebtAllocations = function (transaction) {
    if (!Array.isArray(transaction.debtAllocations)) {
      transaction.debtAllocations = transaction.debtId ? [{
        debtId: transaction.debtId,
        amount: APP.utils.money(transaction.amount)
      }] : [];
    }

    transaction.debtAllocations = transaction.debtAllocations
      .filter(function (allocation) {
        return allocation && allocation.debtId;
      })
      .map(function (allocation) {
        return {
          debtId: allocation.debtId,
          amount: APP.utils.money(allocation.amount)
        };
      });

    delete transaction.debtId;
  };

  APP.model.initialize = function () {
    if (!Array.isArray(APP.state.categories) || !APP.state.categories.length) {
      APP.state.categories = APP.model.seedCategories();
    }

    APP.state.categories.forEach(function (category) {
      category.group = APP.utils.text(category.group) || "Other";
      category.name = APP.utils.text(category.name);
      category.isSavingsFund = Boolean(category.isSavingsFund);
      category.isDebtCategory = Boolean(category.isDebtCategory);
      category.isTemporary = Boolean(category.isTemporary);
      category.archived = Boolean(category.archived);
      category.openingBalance = APP.utils.money(category.openingBalance);
      category.openingBalanceEffectiveMonth =
        category.openingBalanceEffectiveMonth || "";
      category.eventualSavingsGoal =
        APP.utils.money(category.eventualSavingsGoal);
      category.eventualSavingsGoalDate =
        category.eventualSavingsGoalDate || "";
      category.createdAt =
        category.createdAt || new Date().toISOString();
    });

    APP.model.ensureFreeMoneyFund();

    APP.state.transactions = Array.isArray(APP.state.transactions) ?
      APP.state.transactions :
      [];

    APP.state.transactions.forEach(function (transaction) {
      APP.model.normalizeDebtAllocations(transaction);
    });

    APP.state.budgets = Array.isArray(APP.state.budgets) ?
      APP.state.budgets :
      [];

    APP.state.savingsGoals = Array.isArray(APP.state.savingsGoals) ?
      APP.state.savingsGoals :
      [];

    APP.state.debts = Array.isArray(APP.state.debts) ?
      APP.state.debts :
      [];

    APP.state.debts.forEach(function (debt) {
      debt.name = APP.utils.text(debt.name);

      debt.confirmedBalance = APP.utils.money(
        debt.confirmedBalance !== undefined ?
          debt.confirmedBalance :
          debt.currentBalance
      );

      debt.balanceAsOfDate =
        debt.balanceAsOfDate ||
        APP.utils.isoDate(new Date());

      debt.categoryId = debt.categoryId || "";
      debt.apr = APP.utils.money(debt.apr);

      debt.minimumMonthlyPayment =
        APP.utils.money(debt.minimumMonthlyPayment);

      debt.archived = Boolean(debt.archived);
      debt.notes = APP.utils.text(debt.notes);
      debt.createdAt =
        debt.createdAt || new Date().toISOString();

      delete debt.currentBalance;
    });

    APP.state.auditLog = Array.isArray(APP.state.auditLog) ?
      APP.state.auditLog :
      [];
  };

  APP.model.categories = function () {
    var byId = {};
    var byName = {};

    APP.state.categories.forEach(function (category) {
      byId[category.id] = category;

      var normalizedName = APP.utils.header(category.name);

      if (!byName[normalizedName]) {
        byName[normalizedName] = [];
      }

      byName[normalizedName].push(category);
    });

    return {
      byId: byId,
      byName: byName
    };
  };

  APP.model.debts = function () {
    var byId = {};

    APP.state.debts.forEach(function (debt) {
      byId[debt.id] = debt;
    });

    return {
      byId: byId,
      active: APP.state.debts.filter(function (debt) {
        return !debt.archived;
      })
    };
  };

  APP.model.categoryForName = function (name) {
    var matches = APP.model.categories().byName[
      APP.utils.header(name)
    ] || [];

    return matches.length === 1 ? matches[0] : null;
  };

  APP.model.activeCategories = function () {
    return APP.state.categories.filter(function (category) {
      return !category.archived;
    });
  };

  APP.model.activeSavingsFunds = function () {
    return APP.state.categories.filter(function (category) {
      return category.isSavingsFund && !category.archived;
    });
  };

  APP.model.debtsForCategory = function (categoryId) {
    return APP.model.debts().active.filter(function (debt) {
      return debt.categoryId === categoryId;
    });
  };

  APP.model.migrateTransactions = function () {
    APP.state.transactions.forEach(function (transaction) {
      if ([
        "operating_expense",
        "debt_payment",
        "savings_withdrawal"
      ].indexOf(transaction.type) !== -1) {
        transaction.type = "expense";
      }

      if (transaction.type === "savings_transfer") {
        transaction.type = "savings";
      }

      if (["income", "expense", "savings"].indexOf(transaction.type) === -1) {
        transaction.type = "expense";
      }

      if (!transaction.month && transaction.date) {
        var date = APP.utils.parseDate(transaction.date);
        transaction.month = date ? APP.utils.month(date) : "";
      }

      transaction.amount = APP.utils.money(transaction.amount);
      transaction.description = APP.utils.text(transaction.description);
      transaction.notes = APP.utils.text(transaction.notes);

      APP.model.normalizeDebtAllocations(transaction);

      delete transaction.savingsAction;
    });
  };

  APP.model.attachImportedCategories = function (transactions) {
    var unmatched = [];

    transactions.forEach(function (transaction) {
      var category = APP.model.categoryForName(transaction.categoryName);

      transaction.categoryId = category ? category.id : "";

      if (!category && transaction.categoryName) {
        unmatched.push(transaction.categoryName);
      }

      transaction.debtAllocations = [];
      delete transaction.categoryName;
    });

    return {
      transactions: transactions,
      unmatched: Array.from(new Set(unmatched))
    };
  };

  APP.model.validateTransaction = function (transaction) {
    var category = transaction.categoryId ?
      APP.model.categories().byId[transaction.categoryId] :
      null;

    var debtMap = APP.model.debts().byId;

    var allocations = Array.isArray(transaction.debtAllocations) ?
      transaction.debtAllocations :
      [];

    var allocatedTotal = allocations.reduce(function (total, allocation) {
      return total + APP.utils.money(allocation.amount);
    }, 0);

    var errors = [];

    if (!APP.utils.parseDate(transaction.date)) {
      errors.push("Enter a valid date.");
    }

    if (!APP.utils.text(transaction.description)) {
      errors.push("Enter a description.");
    }

    if (APP.utils.money(transaction.amount) <= 0) {
      errors.push("Enter a positive amount.");
    }

    if (["income", "expense", "savings"].indexOf(transaction.type) === -1) {
      errors.push("Select Income, Expense, or Savings.");
    }

    if (transaction.type !== "income" && !category) {
      errors.push("Select a category for Expense or Savings.");
    }

    if (transaction.type === "savings" &&
        (!category || !category.isSavingsFund)) {
      errors.push(
        "Savings contributions require a savings-fund category."
      );
    }

    if (allocations.length &&
        transaction.type !== "expense") {
      errors.push(
        "Debt allocations require an Expense transaction."
      );
    }

    allocations.forEach(function (allocation) {
      var debt = debtMap[allocation.debtId];

      if (!debt) {
        errors.push(
          "One or more selected debt accounts are invalid."
        );
        return;
      }

      if (debt.categoryId &&
          debt.categoryId !== transaction.categoryId) {
        errors.push(
          debt.name +
          " does not match the selected payment category."
        );
      }

      if (APP.utils.money(allocation.amount) < 0) {
        errors.push(
          "Debt allocation amounts cannot be negative."
        );
      }
    });

    if (allocatedTotal > APP.utils.money(transaction.amount)) {
      errors.push(
        "Debt allocations cannot exceed the transaction payment amount."
      );
    }

    return errors;
  };

  APP.model.classify = function (transaction) {
    var category = APP.model.categories().byId[transaction.categoryId];

    var allocations = Array.isArray(transaction.debtAllocations) ?
      transaction.debtAllocations :
      [];

    if (transaction.type === "income") {
      return "income";
    }

    if (transaction.type === "savings") {
      return "savingsContribution";
    }

    if (allocations.length) {
      return "debtPayment";
    }

    if (category && category.isSavingsFund) {
      return "savingsWithdrawal";
    }

    if (category && category.isDebtCategory) {
      return "debtPayment";
    }

    return "operatingExpense";
  };

  APP.model.monthTransactions = function (month) {
    return APP.state.transactions.filter(function (transaction) {
      return transaction.month === month;
    });
  };

  APP.model.budget = function (month, create) {
    var budget = APP.state.budgets.filter(function (item) {
      return item.month === month;
    })[0];

    if (!budget && create) {
      budget = {
        id: APP.utils.id("budget"),
        month: month,
        expectedIncome: 0,
        items: []
      };

      APP.state.budgets.push(budget);
    }

    return budget || {
      id: "",
      month: month,
      expectedIncome: 0,
      items: []
    };
  };

  APP.model.budgetItem = function (budget, categoryId) {
    return (budget.items || []).filter(function (item) {
      return item.categoryId === categoryId;
    })[0] || null;
  };

  APP.model.savingsBalance = function (categoryId, throughMonth) {
    var category = APP.model.categories().byId[categoryId];

    if (!category || !category.isSavingsFund) {
      return 0;
    }

    var balance = 0;

    if (category.openingBalanceEffectiveMonth &&
        category.openingBalanceEffectiveMonth <= throughMonth) {
      balance = APP.utils.money(category.openingBalance);
    }

    APP.state.transactions.forEach(function (transaction) {
      if (transaction.categoryId !== categoryId ||
          transaction.month > throughMonth) {
        return;
      }

      if (transaction.type === "savings") {
        balance += APP.utils.money(transaction.amount);
      }

      if (transaction.type === "expense") {
        balance -= APP.utils.money(transaction.amount);
      }
    });

    return APP.utils.money(balance);
  };

  APP.model.debtPayments = function (debtId, afterDate, throughDate) {
    var payments = [];

    APP.state.transactions.forEach(function (transaction) {
      if (
        transaction.type !== "expense" ||
        (afterDate && transaction.date <= afterDate) ||
        (throughDate && transaction.date > throughDate)
      ) {
        return;
      }

      (transaction.debtAllocations || []).forEach(function (allocation) {
        if (allocation.debtId === debtId) {
          payments.push({
            transactionId: transaction.id,
            date: transaction.date,
            description: transaction.description,
            amount: APP.utils.money(allocation.amount)
          });
        }
      });
    });

    return payments;
  };

  APP.model.monthDifference = function (fromDate, toDate) {
    var first = APP.utils.parseDate(fromDate);
    var second = APP.utils.parseDate(toDate);

    if (!first || !second || second < first) {
      return 0;
    }

    return Math.max(
      0,
      (second.getFullYear() - first.getFullYear()) * 12 +
      (second.getMonth() - first.getMonth())
    );
  };

  APP.model.debtProjection = function (debtId, throughDate) {
    var debt = APP.model.debts().byId[debtId];

    if (!debt) {
      return null;
    }

    var cutoff = throughDate || APP.utils.isoDate(new Date());

    var confirmedBalance =
      APP.utils.money(debt.confirmedBalance);

    var monthlyInterest =
      confirmedBalance *
      (APP.utils.money(debt.apr) / 100) /
      12;

    var monthsSinceConfirmed = APP.model.monthDifference(
      debt.balanceAsOfDate,
      cutoff
    );

    var estimatedInterest =
      monthlyInterest * monthsSinceConfirmed;

    var payments = APP.model.debtPayments(
      debt.id,
      debt.balanceAsOfDate,
      cutoff
    );

    var paymentTotal = payments.reduce(function (total, payment) {
      return total + APP.utils.money(payment.amount);
    }, 0);

    return {
      debt: debt,
      confirmedBalance: confirmedBalance,
      balanceAsOfDate: debt.balanceAsOfDate,
      monthlyInterest: monthlyInterest,
      estimatedInterestSinceConfirmed: estimatedInterest,
      paymentTotalSinceConfirmed: paymentTotal,
      projectedBalance: Math.max(
        0,
        confirmedBalance + estimatedInterest - paymentTotal
      ),
      payments: payments
    };
  };
}());