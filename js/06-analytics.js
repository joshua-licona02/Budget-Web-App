(function () {
  "use strict";

  var APP = window.APP;
  APP.analytics = {};

  APP.analytics.month = function (month) {
    var totals = {
      income: 0,
      operating: 0,
      savingsContributions: 0,
      savingsWithdrawals: 0,
      debtPayments: 0,
      cashOutflow: 0,
      netCashFlow: 0
    };

    APP.model.monthTransactions(month).forEach(function (transaction) {
      var amount = APP.utils.money(transaction.amount);
      var kind = APP.model.classify(transaction);

      if (kind === "income") {
        totals.income += amount;
      }

      if (kind === "operatingExpense") {
        totals.operating += amount;
      }

      if (kind === "savingsContribution") {
        totals.savingsContributions += amount;
      }

      if (kind === "savingsWithdrawal") {
        totals.savingsWithdrawals += amount;
      }

      if (kind === "debtPayment") {
        totals.debtPayments += amount;
      }
    });

    totals.cashOutflow =
      totals.operating +
      totals.savingsContributions +
      totals.debtPayments;

    totals.netCashFlow =
      totals.income - totals.cashOutflow;

    return totals;
  };

  APP.analytics.categoryActivity = function (month) {
    var values = {};

    APP.model.monthTransactions(month).forEach(function (transaction) {
      if (!transaction.categoryId) {
        return;
      }

      if (!values[transaction.categoryId]) {
        values[transaction.categoryId] = {
          operating: 0,
          contributions: 0,
          withdrawals: 0,
          debt: 0
        };
      }

      var activity = values[transaction.categoryId];
      var amount = APP.utils.money(transaction.amount);
      var kind = APP.model.classify(transaction);

      if (kind === "operatingExpense") {
        activity.operating += amount;
      }

      if (kind === "savingsContribution") {
        activity.contributions += amount;
      }

      if (kind === "savingsWithdrawal") {
        activity.withdrawals += amount;
      }

      if (kind === "debtPayment") {
        activity.debt += amount;
      }
    });

    return values;
  };

  APP.analytics.addMonths = function (month, months) {
    if (!/^\d{4}-\d{2}$/.test(month) ||
        !Number.isFinite(months)) {
      return "";
    }

    var parts = month.split("-");

    var date = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1 + Math.ceil(months),
      1
    );

    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0");
  };

  APP.analytics.savingsFunds = function (month) {
    var budget = APP.model.budget(month, false);
    var activity = APP.analytics.categoryActivity(month);

    return APP.state.categories.filter(function (category) {
      return category.isSavingsFund;
    }).map(function (category) {
      var item = APP.model.budgetItem(budget, category.id);
      var values = activity[category.id] || {};

      var monthlyGoal = item ?
        APP.utils.money(item.dollarTarget) :
        0;

      var deposits = APP.utils.money(values.contributions);
      var withdrawals = APP.utils.money(values.withdrawals);
      var remainingMonthly = Math.max(0, monthlyGoal - deposits);

      var balance = APP.model.savingsBalance(
        category.id,
        month
      );

      var eventualGoal =
        APP.utils.money(category.eventualSavingsGoal);

      var remainingEventual =
        Math.max(0, eventualGoal - balance);

      var monthsRemaining = monthlyGoal > 0 ?
        remainingEventual / monthlyGoal :
        null;

      return {
        category: category,
        balance: balance,
        deposits: deposits,
        withdrawals: withdrawals,
        monthlyGoal: monthlyGoal,
        remainingMonthly: remainingMonthly,
        projectedMonthlyBalance:
          balance + remainingMonthly,
        eventualGoal: eventualGoal,
        remainingEventual: remainingEventual,
        eventualProgress: eventualGoal > 0 ?
          balance / eventualGoal * 100 :
          0,
        estimatedMonthsRemaining: monthsRemaining,
        estimatedCompletionMonth: monthsRemaining === null ?
          "" :
          APP.analytics.addMonths(month, monthsRemaining)
      };
    });
  };

  APP.analytics.debtPaymentsForMonth = function (debtId, month) {
    var total = 0;

    APP.state.transactions.forEach(function (transaction) {
      if (
        transaction.month !== month ||
        transaction.type !== "expense"
      ) {
        return;
      }

      (transaction.debtAllocations || []).forEach(function (allocation) {
        if (allocation.debtId === debtId) {
          total += APP.utils.money(allocation.amount);
        }
      });
    });

    return total;
  };

  APP.analytics.debtAllocationTotal = function (transaction) {
    return (transaction.debtAllocations || []).reduce(function (
      total,
      allocation
    ) {
      return total + APP.utils.money(allocation.amount);
    }, 0);
  };

  APP.analytics.debtUnallocatedAmount = function (transaction) {
    return Math.max(
      0,
      APP.utils.money(transaction.amount) -
      APP.analytics.debtAllocationTotal(transaction)
    );
  };

  APP.analytics.debts = function (throughDate) {
    var cutoff = throughDate ||
      APP.utils.isoDate(new Date());

    return APP.model.debts().active.map(function (debt) {
      var projection = APP.model.debtProjection(
        debt.id,
        cutoff
      );

      var paymentThisMonth =
        APP.analytics.debtPaymentsForMonth(
          debt.id,
          APP.state.settings.selectedMonth
        );

      return {
        debt: debt,
        confirmedBalance: projection.confirmedBalance,
        balanceAsOfDate: projection.balanceAsOfDate,
        estimatedMonthlyInterest: projection.monthlyInterest,
        estimatedInterestSinceConfirmed:
          projection.estimatedInterestSinceConfirmed,
        paymentsSinceConfirmed:
          projection.paymentTotalSinceConfirmed,
        paymentThisMonth: paymentThisMonth,
        projectedBalance: projection.projectedBalance,
        paymentHistory: projection.payments,

        principalEstimate: Math.max(
          0,
          APP.utils.money(debt.minimumMonthlyPayment) -
          projection.monthlyInterest
        ),

        minimumPaymentRisk:
          projection.confirmedBalance > 0 &&
          APP.utils.money(debt.minimumMonthlyPayment) <=
          projection.monthlyInterest
      };
    });
  };

  APP.analytics.salary = function () {
    var salary = APP.state.salary || {};

    var annual =
      APP.utils.money(salary.annualGrossSalary);

    var periods = Math.max(
      1,
      Math.round(
        APP.utils.number(salary.payPeriodsPerYear) || 26
      )
    );

    var grossPaycheck = annual / periods;

    var percent =
      (APP.utils.number(salary.federalWithholdingPct) || 0) +
      (APP.utils.number(salary.stateWithholdingPct) || 0) +
      (APP.utils.number(salary.retirementContributionPct) || 0);

    var withholding =
      grossPaycheck * percent / 100;

    var fixed =
      APP.utils.money(salary.fixedDeductionsPerPaycheck);

    var netPaycheck = Math.max(
      0,
      grossPaycheck - withholding - fixed
    );

    return {
      grossMonthly: annual / 12,
      netMonthly: netPaycheck * periods / 12,
      grossPaycheck: grossPaycheck,
      netPaycheck: netPaycheck,
      withholding: withholding,
      fixed: fixed
    };
  };
}());