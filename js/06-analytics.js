(function () {
  "use strict";

  var APP = window.APP;
  APP.analytics = {};

  APP.analytics.month = function (month) {
    var totals = {
      income: 0,
      operating: 0,
      refunds: 0,
      savingsContributions: 0,
      freeMoney: 0,
      roundUps: 0,
      savingsWithdrawals: 0,
      debtPayments: 0,
      cashOutflow: 0,
      netCashFlow: 0,
      incomeByType: {}
    };

    APP.model.monthTransactions(month).forEach(function (transaction) {
      var amount = APP.utils.money(transaction.amount);
      var kind = APP.model.classify(transaction);

      if (kind === "income") {
        var type = transaction.incomeType || "paycheck";
        totals.income += amount;
        totals.incomeByType[type] = (totals.incomeByType[type] || 0) + amount;
      }

      // Operating spending is net of refunds; refunds are also kept on their own.
      totals.operating += APP.model.kindAmount(transaction, "operatingExpense");

      if (kind === "refund") {
        totals.refunds += amount;
      }

      if (kind === "savingsContribution") {
        totals.savingsContributions += amount;
      }

      if (kind === "freeMoneyContribution") {
        totals.freeMoney += amount;
      }

      if (kind === "roundUpContribution") {
        totals.roundUps += amount;
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
      totals.freeMoney +
      totals.roundUps +
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
          refunds: 0,
          contributions: 0,
          withdrawals: 0,
          debt: 0
        };
      }

      var activity = values[transaction.categoryId];
      var amount = APP.utils.money(transaction.amount);
      var kind = APP.model.classify(transaction);

      // Refunds lower the category's operating spending.
      activity.operating += APP.model.kindAmount(transaction, "operatingExpense");

      if (kind === "refund") {
        activity.refunds += amount;
      }

      if (kind === "savingsContribution" || kind === "freeMoneyContribution" ||
          kind === "roundUpContribution") {
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

  // Months from one YYYY-MM to another, counting both (Oct to Dec is 3).
  APP.analytics.monthsBetween = function (from, to) {
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}/.test(to)) {
      return 0;
    }

    return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
      Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
  };

  // What to save each month, starting this month, to reach a goal by its target month.
  // Returns null without a goal or date; months is 0 when the date has passed.
  APP.analytics.goalPlan = function (remaining, targetMonth, fromMonth) {
    if (!(remaining > 0) || !targetMonth) {
      return null;
    }

    var months = APP.analytics.monthsBetween(fromMonth, String(targetMonth).slice(0, 7));

    return {
      targetMonth: String(targetMonth).slice(0, 7),
      months: Math.max(0, months),
      perMonth: months > 0 ? Math.ceil(remaining / months * 100) / 100 : remaining
    };
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
          APP.analytics.addMonths(month, monthsRemaining),
        // With a target date: what to save each month from now (deposits already made
        // this month count toward this month's amount).
        targetPlan: APP.analytics.goalPlan(
          remainingEventual + deposits,
          category.eventualSavingsGoalDate,
          APP.utils.month(new Date()) > month ? APP.utils.month(new Date()) : month
        )
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

  // ---- Pay engine
  // Paychecks are generated from the pay settings: hourly pay counts the weekdays in each
  // pay period (so a twice-a-month check is 80, 88 or 96 hours at 8 hours a day), salary
  // pay splits the annual amount evenly. Retirement comes out before income taxes; Social
  // Security and Medicare apply to the full gross.

  APP.analytics.paySchedules = {
    semimonthly: { label: "Twice a month (15th and last day)", perYear: 24 },
    biweekly: { label: "Every 2 weeks", perYear: 26 },
    weekly: { label: "Every week", perYear: 52 },
    monthly: { label: "Once a month", perYear: 12 }
  };

  // Fills in defaults and converts older salary settings (annual salary and pay periods).
  APP.analytics.paySettings = function (source) {
    var salary = source || APP.state.salary || {};
    var periods = Math.round(APP.utils.number(salary.payPeriodsPerYear) || 24);
    var schedule = salary.schedule ||
      (periods === 26 ? "biweekly" : periods === 52 ? "weekly" : periods === 12 ? "monthly" : "semimonthly");

    return {
      payType: salary.payType === "hourly" ? "hourly" : "salary",
      hourlyRate: APP.utils.money(salary.hourlyRate),
      hoursPerDay: APP.utils.number(salary.hoursPerDay) || 8,
      annualGrossSalary: APP.utils.money(salary.annualGrossSalary),
      schedule: APP.analytics.paySchedules[schedule] ? schedule : "semimonthly",
      payAnchorDate: salary.payAnchorDate || "",
      federalWithholdingPct: APP.utils.number(salary.federalWithholdingPct) || 0,
      stateWithholdingPct: APP.utils.number(salary.stateWithholdingPct) || 0,
      ficaPct: APP.utils.number(salary.ficaPct) || 0,
      retirementContributionPct: APP.utils.number(salary.retirementContributionPct) || 0,
      fixedDeductionsPerPaycheck: APP.utils.money(salary.fixedDeductionsPerPaycheck)
    };
  };

  APP.analytics.weekdays = function (start, end) {
    var count = 0;
    var day = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    while (day <= end) {
      if (day.getDay() !== 0 && day.getDay() !== 6) {
        count += 1;
      }

      day.setDate(day.getDate() + 1);
    }

    return count;
  };

  // A payday that falls on a weekend moves to the Friday before.
  APP.analytics.businessPayday = function (date) {
    var day = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    while (day.getDay() === 0 || day.getDay() === 6) {
      day.setDate(day.getDate() - 1);
    }

    return day;
  };

  APP.analytics.payPeriods = function (settings, from, to) {
    var periods = [];
    var cursor;

    function add(start, end, payday) {
      if (payday >= from && payday <= to) {
        periods.push({ start: start, end: end, payDate: APP.analytics.businessPayday(payday) });
      }
    }

    if (settings.schedule === "semimonthly" || settings.schedule === "monthly") {
      cursor = new Date(from.getFullYear(), from.getMonth() - 1, 1);

      while (cursor <= to) {
        var year = cursor.getFullYear();
        var month = cursor.getMonth();
        var last = new Date(year, month + 1, 0);

        if (settings.schedule === "monthly") {
          add(new Date(year, month, 1), last, last);
        } else {
          add(new Date(year, month, 1), new Date(year, month, 15), new Date(year, month, 15));
          add(new Date(year, month, 16), last, last);
        }

        cursor = new Date(year, month + 1, 1);
      }

      return periods;
    }

    // Weekly and every-2-weeks schedules count from a known payday.
    var length = settings.schedule === "weekly" ? 7 : 14;
    var anchor = APP.utils.parseDate(settings.payAnchorDate) || (function () {
      var friday = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      while (friday.getDay() !== 5) {
        friday.setDate(friday.getDate() + 1);
      }
      return friday;
    }());

    var offset = Math.floor((from - anchor) / 86400000 / length) - 1;
    cursor = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + offset * length);

    while (cursor <= to) {
      var periodEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      var periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate() - length + 1);
      add(periodStart, periodEnd, periodEnd);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + length);
    }

    return periods;
  };

  APP.analytics.paycheck = function (settings, period) {
    var hours = settings.payType === "hourly" ?
      APP.analytics.weekdays(period.start, period.end) * settings.hoursPerDay :
      null;
    var gross = settings.payType === "hourly" ?
      hours * settings.hourlyRate :
      settings.annualGrossSalary / APP.analytics.paySchedules[settings.schedule].perYear;
    var retirement = gross * settings.retirementContributionPct / 100;
    var taxable = gross - retirement;
    var federal = taxable * settings.federalWithholdingPct / 100;
    var state = taxable * settings.stateWithholdingPct / 100;
    var fica = gross * settings.ficaPct / 100;
    var fixed = gross > 0 ? settings.fixedDeductionsPerPaycheck : 0;

    return {
      payDate: APP.utils.isoDate(period.payDate),
      start: APP.utils.isoDate(period.start),
      end: APP.utils.isoDate(period.end),
      hours: hours,
      gross: gross,
      retirement: retirement,
      federal: federal,
      state: state,
      fica: fica,
      fixed: fixed,
      net: Math.max(0, gross - retirement - federal - state - fica - fixed)
    };
  };

  // Paychecks paid between two dates (inclusive).
  APP.analytics.paychecks = function (from, to, source) {
    var settings = APP.analytics.paySettings(source);

    return APP.analytics.payPeriods(settings, from, to).map(function (period) {
      return APP.analytics.paycheck(settings, period);
    }).sort(function (a, b) {
      return a.payDate < b.payDate ? -1 : 1;
    });
  };

  APP.analytics.sumPaychecks = function (checks) {
    return checks.reduce(function (total, check) {
      Object.keys(total).forEach(function (key) {
        total[key] += check[key] || 0;
      });
      return total;
    }, { gross: 0, net: 0, hours: 0, retirement: 0, federal: 0, state: 0, fica: 0, fixed: 0 });
  };

  // Pay landing in one month (YYYY-MM).
  APP.analytics.salaryForMonth = function (month, source) {
    var start = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1);
    var end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    var checks = APP.analytics.paychecks(start, end, source);

    return Object.assign(APP.analytics.sumPaychecks(checks), { paychecks: checks });
  };

  // Averages over the next 12 months, for places that need one typical figure.
  APP.analytics.salary = function (source) {
    var today = new Date();
    var start = new Date(today.getFullYear(), today.getMonth(), 1);
    var end = new Date(today.getFullYear() + 1, today.getMonth(), 0);
    var checks = APP.analytics.paychecks(start, end, source);
    var totals = APP.analytics.sumPaychecks(checks);
    var count = checks.length || 1;

    return {
      grossMonthly: totals.gross / 12,
      netMonthly: totals.net / 12,
      grossYearly: totals.gross,
      netYearly: totals.net,
      grossPaycheck: totals.gross / count,
      netPaycheck: totals.net / count,
      withholding: (totals.federal + totals.state + totals.fica + totals.retirement) / count,
      fixed: totals.fixed / count,
      paychecksPerYear: checks.length
    };
  };

  // ---- Account balance check
  // Compares what the transactions say you should have with the balances you enter.
  // Total money = bank balances minus card balances. From the day tracking starts, the
  // expected total moves only with income (+), refunds (+) and expenses (-). Moving money
  // into a fund is a transfer, so it doesn't change it. A card balance is simply
  // subtracted from the spending account.
  // Each savings account should hold its funds; checking minus the cards should hold the
  // funds kept in checking plus available cash (money not assigned to any fund).

  APP.analytics.fundBalanceNow = function (categoryId) {
    return APP.model.savingsBalance(categoryId, "9999-12");
  };

  APP.analytics.accountsCheck = function () {
    var accounts = APP.state.accounts || [];
    var reconcile = APP.state.reconcile || {};
    var banks = accounts.filter(function (account) {
      return account.kind !== "credit";
    });
    var cards = accounts.filter(function (account) {
      return account.kind === "credit";
    });
    var spending = banks.filter(function (account) {
      return account.holdsSpending;
    })[0] || banks.filter(function (account) {
      return account.kind === "checking";
    })[0] || banks[0] || null;

    var funds = APP.state.categories.filter(function (category) {
      return category.isSavingsFund && !category.archived;
    });
    var placed = {};

    banks.forEach(function (account) {
      (account.fundIds || []).forEach(function (fundId) {
        placed[fundId] = account.id;
      });
    });

    // Funds not placed in any account are assumed to sit in the spending account.
    var unplaced = funds.filter(function (fund) {
      return !placed[fund.id];
    });

    var fundBalance = {};
    var totalFunds = 0;

    funds.forEach(function (fund) {
      fundBalance[fund.id] = APP.analytics.fundBalanceNow(fund.id);
      totalFunds += fundBalance[fund.id];
    });

    var flows = 0;
    var started = Boolean(reconcile.baselineDate);

    if (started) {
      APP.state.transactions.forEach(function (transaction) {
        if (!transaction.date || transaction.date <= reconcile.baselineDate) {
          return;
        }

        if (transaction.type === "income") {
          flows += APP.utils.money(transaction.amount);
        }

        if (transaction.type === "expense") {
          flows -= APP.utils.money(transaction.amount);
        }
      });
    }

    var cashAdjustments = (reconcile.cashAdjustments || []).reduce(function (total, item) {
      return total + APP.utils.money(item.amount);
    }, 0);

    var actualLiquid = banks.reduce(function (total, account) {
      return total + APP.utils.money(account.balance);
    }, 0) - cards.reduce(function (total, card) {
      return total + APP.utils.money(card.balance);
    }, 0);

    var expectedLiquid = APP.utils.money(reconcile.baselineLiquid) + flows + cashAdjustments;
    var availableCash = expectedLiquid - totalFunds;
    var cardTotal = cards.reduce(function (total, card) {
      return total + APP.utils.money(card.balance);
    }, 0);

    var rows = banks.map(function (account) {
      var isSpending = spending && account.id === spending.id;
      var accountFunds = funds.filter(function (fund) {
        return placed[fund.id] === account.id || (isSpending && !placed[fund.id]);
      }).map(function (fund) {
        return { id: fund.id, name: fund.name, balance: fundBalance[fund.id], unplaced: !placed[fund.id] };
      });
      var fundsTotal = accountFunds.reduce(function (total, fund) {
        return total + fund.balance;
      }, 0);
      var actual = APP.utils.money(account.balance) - (isSpending ? cardTotal : 0);
      var expected = fundsTotal + (isSpending ? availableCash : 0);

      return {
        account: account,
        isSpending: isSpending,
        funds: accountFunds,
        fundsTotal: fundsTotal,
        cardTotal: isSpending ? cardTotal : 0,
        availableCash: isSpending ? availableCash : 0,
        actual: actual,
        expected: expected,
        difference: Math.round((actual - expected) * 100) / 100
      };
    });

    var offBy = rows.reduce(function (total, row) {
      return total + Math.abs(row.difference);
    }, 0);

    return {
      started: started,
      baselineDate: reconcile.baselineDate || "",
      banks: banks,
      cards: cards,
      spending: spending,
      rows: rows,
      unplaced: unplaced,
      actualLiquid: actualLiquid,
      expectedLiquid: expectedLiquid,
      totalFunds: totalFunds,
      availableCash: availableCash,
      difference: Math.round((actualLiquid - expectedLiquid) * 100) / 100,
      balanced: started && offBy < 0.01,
      lastUpdated: accounts.reduce(function (latest, account) {
        return account.balanceDate && account.balanceDate > latest ? account.balanceDate : latest;
      }, "")
    };
  };
}());
