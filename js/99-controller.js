(function () {
  "use strict";

  var APP = window.APP;
  APP.controller = {};

  APP.controller.meta = {
    dashboard: ["Dashboard", "Financial overview"],
    transactions: ["Transactions", "Income, expenses, and savings activity"],
    budget: ["Monthly Plan", "Expected income and category targets"],
    savings: ["Savings & Goals", "Monthly contributions, eventual savings goals, and target progress"],
    debts: ["Debt Tracking", "Confirmed balances, projected balances, and allocated payment history"],
    salary: ["Salary Planner", "Manual payroll and withholding estimates"],
    advisor: ["Ollama Advisor", "Optional local financial-planning analysis"],
    settings: ["Settings", "Local data and optional Ollama connection"]
  };

  APP.controller.visualRuntime = {};

  APP.controller.shiftMonth = function (month, offset) {
    var parts = String(month || "").split("-");

    if (parts.length !== 2) {
      return "";
    }

    var date = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1 + Number(offset || 0),
      1
    );

    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0");
  };

  APP.controller.calendarYearMonths = function (selectedMonth) {
    var year = String(selectedMonth || "").slice(0, 4);
    var months = [];

    for (var month = 1; month <= 12; month += 1) {
      months.push(year + "-" + String(month).padStart(2, "0"));
    }

    return months;
  };

  APP.controller.timelineMonths = function (mode, selectedMonth) {
    if (mode === "calendar_year_monthly") {
      return APP.controller.calendarYearMonths(selectedMonth);
    }

    if (mode === "rolling_3_months") {
      return [-2, -1, 0].map(function (offset) {
        return APP.controller.shiftMonth(selectedMonth, offset);
      });
    }

    if (mode === "rolling_6_months") {
      return [-5, -4, -3, -2, -1, 0].map(function (offset) {
        return APP.controller.shiftMonth(selectedMonth, offset);
      });
    }

    if (mode === "rolling_12_months") {
      var months = [];

      for (var offset = -11; offset <= 0; offset += 1) {
        months.push(APP.controller.shiftMonth(selectedMonth, offset));
      }

      return months;
    }

    return [selectedMonth];
  };

  APP.controller.timelineDays = function (selectedMonth) {
    var parts = selectedMonth.split("-");
    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;
    var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    var days = [];

    for (var day = 1; day <= daysInMonth; day += 1) {
      days.push(
        selectedMonth + "-" + String(day).padStart(2, "0")
      );
    }

    return days;
  };

  APP.controller.getVisualRuntime = function (visual) {
    if (!APP.controller.visualRuntime[visual.id]) {
      APP.controller.visualRuntime[visual.id] = {
        displayMode: visual.displayMode || "currency",
        aggregationMode: visual.aggregationMode || "total",
        categoryScope: visual.categoryScope || "all",
        categoryIds: Array.isArray(visual.categoryIds) ?
          visual.categoryIds.slice() :
          []
      };
    }

    return APP.controller.visualRuntime[visual.id];
  };

  APP.controller.effectiveVisual = function (visual) {
    var runtime = APP.controller.getVisualRuntime(visual);

    return {
      id: visual.id,
      title: visual.title,
      chartType: visual.chartType,
      topic: visual.topic,
      timelineMode: visual.timelineMode,
      width: visual.width,
      color: visual.color,
      visible: visual.visible,

      displayMode: runtime.displayMode,
      aggregationMode: runtime.aggregationMode,
      categoryScope: runtime.categoryScope,
      categoryIds: runtime.categoryIds
    };
  };

  APP.controller.matchesCategoryScope = function (transaction, visual) {
    if (visual.categoryScope !== "selected") {
      return true;
    }

    return (visual.categoryIds || []).indexOf(
      transaction.categoryId
    ) !== -1;
  };

  APP.controller.transactionsForVisual = function (visual, months) {
    return APP.state.transactions.filter(function (transaction) {
      return months.indexOf(transaction.month) !== -1 &&
        APP.controller.matchesCategoryScope(transaction, visual);
    });
  };

  APP.controller.sumTransactions = function (transactions, kinds) {
    return transactions.reduce(function (total, transaction) {
      var kind = APP.model.classify(transaction);

      return kinds.indexOf(kind) !== -1 ?
        total + APP.utils.money(transaction.amount) :
        total;
    }, 0);
  };

  APP.controller.monthlyTotals = function (visual, months) {
    return months.map(function (month) {
      var transactions = APP.controller.transactionsForVisual(
        visual,
        [month]
      );

      var totals = {
        month: month,
        income: APP.controller.sumTransactions(
          transactions,
          ["income"]
        ),

        operating: APP.controller.sumTransactions(
          transactions,
          ["operatingExpense"]
        ),

        savings: APP.controller.sumTransactions(
          transactions,
          ["savingsContribution"]
        ),

        debt: APP.controller.sumTransactions(
          transactions,
          ["debtPayment"]
        )
      };

      totals.outflow =
        totals.operating +
        totals.savings +
        totals.debt;

      totals.net =
        totals.income - totals.outflow;

      return totals;
    });
  };

  APP.controller.dailyTotals = function (visual, selectedMonth) {
    return APP.controller.timelineDays(selectedMonth).map(function (date) {
      var transactions = APP.state.transactions.filter(function (transaction) {
        return transaction.date === date &&
          APP.controller.matchesCategoryScope(transaction, visual);
      });

      var totals = {
        date: date,
        label: String(Number(date.slice(8))),

        income: APP.controller.sumTransactions(
          transactions,
          ["income"]
        ),

        operating: APP.controller.sumTransactions(
          transactions,
          ["operatingExpense"]
        ),

        savings: APP.controller.sumTransactions(
          transactions,
          ["savingsContribution"]
        ),

        debt: APP.controller.sumTransactions(
          transactions,
          ["debtPayment"]
        )
      };

      totals.outflow =
        totals.operating +
        totals.savings +
        totals.debt;

      totals.net =
        totals.income - totals.outflow;

      return totals;
    });
  };

  APP.controller.categoryBreakdown = function (visual, months, kinds) {
    var categories = APP.model.categories().byId;
    var values = {};

    APP.controller.transactionsForVisual(visual, months)
      .forEach(function (transaction) {
        var kind = APP.model.classify(transaction);

        if (
          kinds.indexOf(kind) === -1 ||
          !transaction.categoryId
        ) {
          return;
        }

        values[transaction.categoryId] =
          (values[transaction.categoryId] || 0) +
          APP.utils.money(transaction.amount);
      });

    return Object.keys(values).map(function (categoryId) {
      var category = categories[categoryId];

      return {
        categoryId: categoryId,
        label: category ?
          category.name :
          "Archived category",

        value: values[categoryId]
      };
    }).sort(function (first, second) {
      return second.value - first.value;
    });
  };

  APP.controller.categorySeries = function (visual, months, kinds) {
    var categoryMap = APP.model.categories().byId;

    var categoryIds = visual.categoryScope === "selected" ?
      visual.categoryIds :
      APP.state.categories.filter(function (category) {
        return !category.archived;
      }).map(function (category) {
        return category.id;
      });

    return categoryIds.map(function (categoryId) {
      var category = categoryMap[categoryId];

      if (!category) {
        return null;
      }

      return {
        id: categoryId,
        label: category.name,

        values: months.map(function (month) {
          return APP.state.transactions.reduce(function (
            total,
            transaction
          ) {
            if (
              transaction.month !== month ||
              transaction.categoryId !== categoryId ||
              kinds.indexOf(APP.model.classify(transaction)) === -1
            ) {
              return total;
            }

            return total + APP.utils.money(transaction.amount);
          }, 0);
        })
      };
    }).filter(Boolean);
  };

  APP.controller.percentValues = function (values) {
    var total = values.reduce(function (sum, value) {
      return sum + APP.utils.money(value);
    }, 0);

    if (total <= 0) {
      return values.map(function () {
        return 0;
      });
    }

    return values.map(function (value) {
      return APP.utils.money(value) / total * 100;
    });
  };

  APP.controller.formatVisualValue = function (value, displayMode) {
    if (displayMode === "percent") {
      return APP.utils.money(value).toFixed(1) + "%";
    }

    return APP.utils.currency(value);
  };
  APP.controller.chartOptions = function (visual, stacked, area) {
    var options = APP.charts.moneyOptions(stacked, area);

    if (visual.displayMode === "percent") {
      options.plugins.tooltip.callbacks.label = function (context) {
        return context.dataset.label + ": " +
          APP.utils.money(context.raw).toFixed(1) + "%";
      };

      options.scales.y.ticks.callback = function (value) {
        return value + "%";
      };
    }

    return options;
  };

  APP.controller.valuesForDisplay = function (values, visual) {
    if (visual.displayMode === "percent") {
      return APP.controller.percentValues(values);
    }

    return values;
  };

  APP.controller.renderTrend = function (root, key, visual, selectedMonth) {
    var isDaily = visual.timelineMode === "daily_selected_month";

    var periods = isDaily ?
      APP.controller.dailyTotals(visual, selectedMonth) :
      APP.controller.monthlyTotals(
        visual,
        APP.controller.timelineMonths(
          visual.timelineMode,
          selectedMonth
        )
      );

    var labels = periods.map(function (item) {
      return isDaily ? item.label : item.month;
    });

    var fieldMap = {
      income_trend: "income",
      operating_spending_trend: "operating",
      total_outflow_trend: "outflow",
      net_cash_flow_trend: "net",
      savings_contribution_trend: "savings"
    };

    var field = fieldMap[visual.topic];
    var values = periods.map(function (item) {
      return item[field];
    });

    APP.charts.chart(root, key, {
      type: visual.chartType === "area" ? "line" : visual.chartType,
      data: {
        labels: labels,
        datasets: [{
          label: visual.title,
          data: APP.controller.valuesForDisplay(values, visual),
          borderColor: visual.color,
          backgroundColor: visual.color
        }]
      },
      options: APP.controller.chartOptions(
        visual,
        false,
        visual.chartType === "area"
      )
    });
  };

  APP.controller.renderIncomeVsOutflow = function (
    root,
    key,
    visual,
    selectedMonth
  ) {
    var isDaily = visual.timelineMode === "daily_selected_month";

    var periods = isDaily ?
      APP.controller.dailyTotals(visual, selectedMonth) :
      APP.controller.monthlyTotals(
        visual,
        APP.controller.timelineMonths(
          visual.timelineMode,
          selectedMonth
        )
      );

    var incomeValues = periods.map(function (item) {
      return item.income;
    });

    var outflowValues = periods.map(function (item) {
      return item.outflow;
    });

    APP.charts.chart(root, key, {
      type: "bar",
      data: {
        labels: periods.map(function (item) {
          return isDaily ? item.label : item.month;
        }),
        datasets: [
          {
            label: "Income",
            data: APP.controller.valuesForDisplay(
              incomeValues,
              visual
            ),
            backgroundColor: "#4ade80"
          },
          {
            label: "Cash outflow",
            data: APP.controller.valuesForDisplay(
              outflowValues,
              visual
            ),
            backgroundColor: "#fb7185"
          }
        ]
      },
      options: APP.controller.chartOptions(visual, false, false)
    });
  };

  APP.controller.renderCategoryAllocation = function (
    root,
    key,
    visual,
    selectedMonth
  ) {
    var months = APP.controller.timelineMonths(
      visual.timelineMode,
      selectedMonth
    );

    var kinds = ["operatingExpense"];

    if (visual.topic === "savings_fund_allocation") {
      kinds = ["savingsContribution"];
    }

    if (visual.topic === "debt_payment_allocation") {
      kinds = ["debtPayment"];
    }

    if (visual.topic === "total_outflow_allocation") {
      kinds = [
        "operatingExpense",
        "savingsContribution",
        "debtPayment"
      ];
    }

    var items = APP.controller.categoryBreakdown(
      visual,
      months,
      kinds
    );

    var values = items.map(function (item) {
      return item.value;
    });

    values = APP.controller.valuesForDisplay(values, visual);

    APP.charts.chart(root, key, {
      type: visual.chartType === "pie" ?
        "pie" :
        visual.chartType === "doughnut" ?
          "doughnut" :
          "bar",

      data: {
        labels: items.length ?
          items.map(function (item) {
            return item.label;
          }) :
          ["No activity"],

        datasets: [{
          label: visual.title,
          data: items.length ? values : [0],
          backgroundColor: [
            "#60a5fa",
            "#4ade80",
            "#fbbf24",
            "#fb7185",
            "#a78bfa",
            "#22d3ee",
            "#f97316",
            "#e879f9"
          ]
        }]
      },

      options: (
        visual.chartType === "pie" ||
        visual.chartType === "doughnut"
      ) ? {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#dbeafe" }
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.label + ": " +
                  APP.controller.formatVisualValue(
                    context.raw,
                    visual.displayMode
                  );
              }
            }
          }
        }
      } : APP.controller.chartOptions(visual, false, false)
    });
  };

  APP.controller.renderStacked = function (
    root,
    key,
    visual,
    selectedMonth
  ) {
    var months = APP.controller.timelineMonths(
      visual.timelineMode,
      selectedMonth
    );

    var kinds = visual.topic === "savings_fund_stacked" ?
      ["savingsContribution"] :
      visual.topic === "cash_outflow_stacked" ?
        [
          "operatingExpense",
          "savingsContribution",
          "debtPayment"
        ] :
        ["operatingExpense"];

    var series = APP.controller.categorySeries(
      visual,
      months,
      kinds
    ).filter(function (item) {
      return item.values.some(function (value) {
        return value > 0;
      });
    });

    APP.charts.chart(root, key, {
      type: "bar",
      data: {
        labels: months,
        datasets: series.map(function (item, index) {
          return {
            label: item.label,
            data: visual.displayMode === "percent" ?
              APP.controller.percentValues(item.values) :
              item.values,

            backgroundColor: [
              "#60a5fa",
              "#4ade80",
              "#fbbf24",
              "#fb7185",
              "#a78bfa",
              "#22d3ee",
              "#f97316",
              "#e879f9"
            ][index % 8]
          };
        })
      },
      options: APP.controller.chartOptions(visual, true, false)
    });
  };

  APP.controller.renderScatter = function (
    root,
    key,
    visual,
    selectedMonth
  ) {
    var months = APP.controller.timelineMonths(
      visual.timelineMode,
      selectedMonth
    );

    var transactions = APP.controller.transactionsForVisual(
      visual,
      months
    ).filter(function (transaction) {
      return APP.model.classify(transaction) ===
        "operatingExpense";
    });

    var points = [];

    if (visual.topic === "daily_spending_frequency") {
      var daily = {};

      transactions.forEach(function (transaction) {
        if (!daily[transaction.date]) {
          daily[transaction.date] = {
            total: 0,
            count: 0
          };
        }

        daily[transaction.date].total +=
          APP.utils.money(transaction.amount);

        daily[transaction.date].count += 1;
      });

      points = Object.keys(daily).map(function (date) {
        return {
          x: daily[date].count,
          y: daily[date].total
        };
      });
    } else {
      points = transactions.map(function (transaction, index) {
        return {
          x: visual.topic === "transaction_amount_by_day" ?
            Number(transaction.date.slice(8)) :
            index + 1,

          y: APP.utils.money(transaction.amount)
        };
      });
    }

    APP.charts.chart(root, key, {
      type: "scatter",
      data: {
        datasets: [{
          label: visual.title,
          backgroundColor: visual.color,
          data: points
        }]
      },
      options: APP.charts.moneyOptions(false, false)
    });
  };

  APP.controller.renderHeatmap = function (
    root,
    visual,
    selectedMonth
  ) {
    var months = APP.controller.timelineMonths(
      visual.timelineMode,
      selectedMonth
    );

    var kinds = visual.topic === "savings_fund_heatmap" ?
      ["savingsContribution"] :
      visual.topic === "debt_category_heatmap" ?
        ["debtPayment"] :
        ["operatingExpense"];

    var series = APP.controller.categorySeries(
      visual,
      months,
      kinds
    );

    var cells = [];

    series.forEach(function (item) {
      months.forEach(function (month, index) {
        cells.push({
          label: item.label + " · " + month,
          shortLabel:
            item.label.slice(0, 10) + " " + month.slice(5),
          value: item.values[index]
        });
      });
    });

    APP.charts.heatmap(root, cells);
  };

  APP.controller.renderCalendarHeatmap = function (
    root,
    visual,
    selectedMonth
  ) {
    var days = APP.controller.timelineDays(selectedMonth);

    var kinds = ["operatingExpense"];

    if (visual.topic === "daily_savings_contributions") {
      kinds = ["savingsContribution"];
    }

    if (visual.topic === "daily_cash_outflow") {
      kinds = [
        "operatingExpense",
        "savingsContribution",
        "debtPayment"
      ];
    }

    if (visual.topic === "daily_income") {
      kinds = ["income"];
    }

    var values = {};

    APP.state.transactions.forEach(function (transaction) {
      if (
        transaction.month !== selectedMonth ||
        kinds.indexOf(APP.model.classify(transaction)) === -1 ||
        !APP.controller.matchesCategoryScope(transaction, visual)
      ) {
        return;
      }

      values[transaction.date] =
        (values[transaction.date] || 0) +
        APP.utils.money(transaction.amount);
    });

    APP.charts.calendar(root, days.map(function (date) {
      return {
        date: date,
        day: Number(date.slice(8)),
        value: values[date] || 0
      };
    }));
  };
  APP.controller.renderProgress = function (
    root,
    key,
    visual,
    selectedMonth
  ) {
    var selectedId = (visual.categoryIds || [])[0];
    var current = 0;
    var target = 0;
    var label = visual.title;

    if (visual.topic === "monthly_budget_completion") {
      var budget = APP.model.budget(selectedMonth, false);

      current = APP.utils.sum(budget.items, function (item) {
        return item.dollarTarget;
      });

      target = APP.utils.money(budget.expectedIncome);
      label = "Planned category goals";
    }

    if (
      visual.topic === "savings_monthly_completion" ||
      visual.topic === "savings_eventual_completion"
    ) {
      var fund = APP.analytics.savingsFunds(selectedMonth)
        .filter(function (item) {
          return !selectedId ||
            item.category.id === selectedId;
        })[0];

      if (!fund) {
        APP.charts.message(
          root,
          "Select a savings fund for this visual."
        );
        return;
      }

      current = visual.topic === "savings_monthly_completion" ?
        fund.deposits :
        fund.balance;

      target = visual.topic === "savings_monthly_completion" ?
        fund.monthlyGoal :
        fund.eventualGoal;

      label = fund.category.name;
    }

    if (visual.topic === "debt_payoff_completion") {
      var debt = APP.model.debts().byId[selectedId];

      if (!debt) {
        APP.charts.message(
          root,
          "Select a debt account for this visual."
        );
        return;
      }

      current = 0;
      target = APP.utils.money(debt.confirmedBalance);
      label = debt.name + " payoff progress";
    }

    if (visual.chartType === "gauge") {
      APP.charts.gauge(root, key, current, target, visual.color);
    } else {
      APP.charts.progress(root, current, target, label);
    }
  };

  APP.controller.renderWaterfall = function (
    root,
    key,
    visual,
    selectedMonth
  ) {
    var months = APP.controller.timelineMonths(
      visual.timelineMode,
      selectedMonth
    );

    var transactions = APP.controller.transactionsForVisual(
      visual,
      months
    );

    var income = APP.controller.sumTransactions(
      transactions,
      ["income"]
    );

    var savings = APP.controller.sumTransactions(
      transactions,
      ["savingsContribution"]
    );

    var debt = APP.controller.sumTransactions(
      transactions,
      ["debtPayment"]
    );

    var steps = [{
      label: "Income",
      value: income
    }];

    if (visual.aggregationMode === "byCategory") {
      APP.controller.categoryBreakdown(
        visual,
        months,
        ["operatingExpense"]
      ).forEach(function (item) {
        steps.push({
          label: item.label,
          value: -item.value
        });
      });
    } else {
      steps.push({
        label: "Operating expenses",
        value: -APP.controller.sumTransactions(
          transactions,
          ["operatingExpense"]
        )
      });
    }

    steps.push({
      label: "Savings contributions",
      value: -savings
    });

    steps.push({
      label: "Debt payments",
      value: -debt
    });

    APP.charts.waterfall(root, key, steps);
  };

  APP.controller.renderSankey = function (
    root,
    visual,
    selectedMonth
  ) {
    var months = APP.controller.timelineMonths(
      visual.timelineMode,
      selectedMonth
    );

    var transactions = APP.controller.transactionsForVisual(
      visual,
      months
    );

    var income = APP.controller.sumTransactions(
      transactions,
      ["income"]
    );

    var flows = [];

    if (visual.aggregationMode === "byCategory") {
      APP.controller.categoryBreakdown(
        visual,
        months,
        ["operatingExpense"]
      ).forEach(function (item, index) {
        flows.push({
          label: item.label,
          value: item.value,
          color: [
            "#fb7185",
            "#f97316",
            "#fbbf24",
            "#a78bfa",
            "#60a5fa",
            "#22d3ee"
          ][index % 6]
        });
      });
    } else {
      flows.push({
        label: "Operating expenses",
        value: APP.controller.sumTransactions(
          transactions,
          ["operatingExpense"]
        ),
        color: "#fb7185"
      });
    }

    flows.push({
      label: "Savings contributions",
      value: APP.controller.sumTransactions(
        transactions,
        ["savingsContribution"]
      ),
      color: "#4ade80"
    });

    flows.push({
      label: "Debt payments",
      value: APP.controller.sumTransactions(
        transactions,
        ["debtPayment"]
      ),
      color: "#fbbf24"
    });

    var allocated = flows.reduce(function (total, flow) {
      return total + APP.utils.money(flow.value);
    }, 0);

    flows.push({
      label: "Remaining cash",
      value: Math.max(0, income - allocated),
      color: visual.color
    });

    if (visual.displayMode === "percent") {
      var totalIncome = income || 1;

      flows = flows.map(function (flow) {
        return {
          label: flow.label,
          color: flow.color,
          value: flow.value / totalIncome * 100
        };
      });
    }

        APP.charts.sankey(
      root,
      flows,
      visual.displayMode === "percent" ?
        "Income (100%)" :
        "Income",
      visual.displayMode
    );
  };

  APP.controller.renderVisual = function (
    root,
    savedVisual,
    selectedMonth
  ) {
    var visual = APP.controller.effectiveVisual(savedVisual);
    var key = visual.id;

    if ([
      "income_trend",
      "operating_spending_trend",
      "total_outflow_trend",
      "net_cash_flow_trend",
      "savings_contribution_trend"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderTrend(root, key, visual, selectedMonth);
      return;
    }

    if ([
      "income_vs_outflow",
      "monthly_totals"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderIncomeVsOutflow(
        root,
        key,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "operating_category_comparison",
      "debt_category_comparison",
      "savings_fund_comparison",
      "operating_category_allocation",
      "savings_fund_allocation",
      "debt_payment_allocation",
      "total_outflow_allocation"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderCategoryAllocation(
        root,
        key,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "operating_category_stacked",
      "savings_fund_stacked",
      "cash_outflow_stacked"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderStacked(
        root,
        key,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "transaction_amount_by_day",
      "transaction_amount_sequence",
      "daily_spending_frequency",
      "category_transaction_patterns"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderScatter(
        root,
        key,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "operating_category_heatmap",
      "savings_fund_heatmap",
      "debt_category_heatmap"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderHeatmap(
        root,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "daily_operating_spending",
      "daily_savings_contributions",
      "daily_cash_outflow",
      "daily_income"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderCalendarHeatmap(
        root,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "monthly_budget_completion",
      "savings_monthly_completion",
      "savings_eventual_completion",
      "debt_payoff_completion"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderProgress(
        root,
        key,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "income_to_net_cash_flow",
      "selected_category_cash_flow"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderWaterfall(
        root,
        key,
        visual,
        selectedMonth
      );
      return;
    }

    if ([
      "income_allocation",
      "selected_category_allocation"
    ].indexOf(visual.topic) !== -1) {
      APP.controller.renderSankey(
        root,
        visual,
        selectedMonth
      );
      return;
    }

    APP.charts.message(
      root,
      "No renderer is available for this visual configuration."
    );
  };
  APP.controller.openVisualCategoryModal = function (
    savedVisual
  ) {
    var runtime = APP.controller.getVisualRuntime(savedVisual);
    var selectedIds = runtime.categoryIds.slice();

    var content = APP.dom.el(
      "div",
      "visual-category-modal"
    );

    content.appendChild(APP.dom.el(
      "p",
      "muted",
      "Select the categories to include in " +
      savedVisual.title + "."
    ));

    var list = APP.dom.el(
      "div",
      "visual-category-picker"
    );

    APP.state.categories
      .filter(function (category) {
        return !category.archived;
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      })
      .forEach(function (category) {
        var label = APP.dom.el(
          "label",
          "visual-category-option"
        );

        var checkbox = APP.dom.el("input");

        checkbox.type = "checkbox";
        checkbox.value = category.id;

        checkbox.checked =
          selectedIds.indexOf(category.id) !== -1;

        label.appendChild(checkbox);

        label.appendChild(APP.dom.el(
          "span",
          "",
          category.name
        ));

        list.appendChild(label);
      });

    var actions = APP.dom.el(
      "div",
      "modal-actions"
    );

    var all = APP.ui.button("Select all");
    var none = APP.ui.button("Clear selection");
    var cancel = APP.ui.button("Cancel");
    var apply = APP.ui.button(
      "Apply categories",
      "button-primary"
    );

    all.addEventListener("click", function () {
      Array.prototype.slice.call(
        list.querySelectorAll("input[type='checkbox']")
      ).forEach(function (checkbox) {
        checkbox.checked = true;
      });
    });

    none.addEventListener("click", function () {
      Array.prototype.slice.call(
        list.querySelectorAll("input[type='checkbox']")
      ).forEach(function (checkbox) {
        checkbox.checked = false;
      });
    });

    cancel.addEventListener("click", APP.ui.closeModal);

    apply.addEventListener("click", function () {
      var selected = Array.prototype.slice.call(
        list.querySelectorAll("input[type='checkbox']:checked")
      ).map(function (checkbox) {
        return checkbox.value;
      });

      if (!selected.length) {
        APP.dom.toast(
          "Select at least one category or switch the visual to All Categories.",
          "danger"
        );
        return;
      }

      runtime.categoryScope = "selected";
      runtime.categoryIds = selected;

      APP.ui.closeModal();
      APP.controller.renderDashboard();
    });

    actions.appendChild(all);
    actions.appendChild(none);
    actions.appendChild(cancel);
    actions.appendChild(apply);

    content.appendChild(list);
    content.appendChild(actions);

    APP.ui.modal(
      "Choose Categories",
      content
    );
  };
   APP.controller.createVisualControls = function (
    savedVisual,
    toolbarRoot
  ) {
    var runtime = APP.controller.getVisualRuntime(savedVisual);
    var controls = APP.dom.el(
      "div",
      "visual-inline-controls"
    );

    var valueMode = APP.dom.el(
      "select",
      "visual-control-select"
    );

    var aggregation = APP.dom.el(
      "select",
      "visual-control-select"
    );

    var categoryMode = APP.dom.el(
      "select",
      "visual-control-select"
    );

    var chooseCategories = APP.ui.button(
      "Choose Categories",
      "button-quiet"
    );

    var saveDefault = APP.ui.button(
      "Save Default",
      "button-quiet"
    );

    [
      ["currency", "Currency"],
      ["percent", "Percent"]
    ].forEach(function (item) {
      var option = APP.dom.el("option", "", item[1]);

      option.value = item[0];
      option.selected = item[0] === runtime.displayMode;

      valueMode.appendChild(option);
    });

    [
      ["total", "Total"],
      ["byCategory", "By Category"]
    ].forEach(function (item) {
      var option = APP.dom.el("option", "", item[1]);

      option.value = item[0];
      option.selected =
        item[0] === runtime.aggregationMode;

      aggregation.appendChild(option);
    });

    [
      ["all", "All Categories"],
      ["selected", "Selected Categories"]
    ].forEach(function (item) {
      var option = APP.dom.el("option", "", item[1]);

      option.value = item[0];
      option.selected =
        item[0] === runtime.categoryScope;

      categoryMode.appendChild(option);
    });

    function updateCategoryButton() {
      chooseCategories.style.display =
        runtime.categoryScope === "selected" ?
          "" :
          "none";

      chooseCategories.textContent =
        runtime.categoryScope === "selected" ?
          "Categories (" + runtime.categoryIds.length + ")" :
          "Choose Categories";
    }

    valueMode.addEventListener("change", function () {
      runtime.displayMode = valueMode.value;
      APP.controller.renderDashboard();
    });

    aggregation.addEventListener("change", function () {
      runtime.aggregationMode = aggregation.value;
      APP.controller.renderDashboard();
    });

    categoryMode.addEventListener("change", function () {
      runtime.categoryScope = categoryMode.value;

      if (runtime.categoryScope === "all") {
        runtime.categoryIds = [];
        APP.controller.renderDashboard();
        return;
      }

      APP.controller.openVisualCategoryModal(savedVisual);
      updateCategoryButton();
    });

    chooseCategories.addEventListener("click", function () {
      APP.controller.openVisualCategoryModal(savedVisual);
    });

    saveDefault.addEventListener("click", function () {
      savedVisual.displayMode = runtime.displayMode;
      savedVisual.aggregationMode = runtime.aggregationMode;
      savedVisual.categoryScope = runtime.categoryScope;
      savedVisual.categoryIds = runtime.categoryIds.slice();

      APP.store.log(
        "success",
        "Saved visual settings: " +
        savedVisual.title + "."
      );

      APP.controller.commit();
    });

    updateCategoryButton();

    controls.appendChild(valueMode);
    controls.appendChild(aggregation);
    controls.appendChild(categoryMode);
    controls.appendChild(chooseCategories);
    controls.appendChild(saveDefault);

    toolbarRoot.appendChild(controls);
  };
  APP.controller.dashboardCustomizeMode = false;

  APP.controller.renderDashboard = function () {
    var summaryRoot = APP.dom.refs.dashboard.summary;
    var toolbarRoot = APP.dom.refs.dashboard.toolbar;
    var visualsRoot = APP.dom.refs.dashboard.visuals;
    var month = APP.state.settings.selectedMonth;
    var totals = APP.analytics.month(month);
    var visuals = APP.state.settings.dashboardVisuals || [];

    APP.dom.clear(summaryRoot);
    APP.dom.clear(toolbarRoot);
    APP.dom.clear(visualsRoot);

    [
      ["Total income", totals.income, "success"],
      ["Operating spending", totals.operating, "danger"],
      ["Savings contributions", totals.savingsContributions, "success"],
      ["Debt payments", totals.debtPayments, "danger"],
      ["Total cash outflow", totals.cashOutflow, "danger"],
      [
        "Net cash flow",
        totals.netCashFlow,
        totals.netCashFlow < 0 ? "danger" : "success"
      ]
    ].forEach(function (item) {
      summaryRoot.appendChild(
        APP.ui.currencyCard(item[0], item[1], item[2])
      );
    });

    if (!visuals.length) {
      APP.state.settings.dashboardVisuals =
        APP.pages.visuals.defaultVisuals();

      visuals = APP.state.settings.dashboardVisuals;
    }

    if (APP.controller.dashboardCustomizeMode) {
      toolbarRoot.classList.add("dashboard-customizing");
    }

    var addVisual = APP.ui.button(
      "+ Add visual",
      "button-primary"
    );

    var customize = APP.ui.button(
      APP.controller.dashboardCustomizeMode ?
        "Done customizing" :
        "Customize dashboard",
      "button-secondary"
    );

    addVisual.addEventListener("click", function () {
      APP.pages.visuals.openModal();
    });

    customize.addEventListener("click", function () {
      APP.controller.dashboardCustomizeMode =
        !APP.controller.dashboardCustomizeMode;

      APP.controller.renderDashboard();
    });

    toolbarRoot.appendChild(addVisual);
    toolbarRoot.appendChild(customize);

    visuals.filter(function (visual) {
      return visual.visible || APP.controller.dashboardCustomizeMode;
    }).forEach(function (visual) {
           var visualHeight = visual.height || "normal";

      var card = APP.dom.el(
        "article",
        "panel visual-card " +
        visual.width +
        " visual-height-" +
        visualHeight
      );
            card.dataset.visualId = visual.id;

      if (APP.controller.dashboardCustomizeMode) {
        card.draggable = true;
        card.classList.add("visual-draggable");

        card.addEventListener("dragstart", function (event) {
          APP.controller.dragVisualId = visual.id;

          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", visual.id);

          card.classList.add("visual-dragging");
        });

        card.addEventListener("dragend", function () {
          APP.controller.dragVisualId = "";
          card.classList.remove("visual-dragging");

          Array.prototype.slice.call(
            visualsRoot.querySelectorAll(".visual-card")
          ).forEach(function (item) {
            item.classList.remove("visual-drop-target");
          });
        });

        card.addEventListener("dragover", function (event) {
          event.preventDefault();

          event.dataTransfer.dropEffect = "move";
          card.classList.add("visual-drop-target");
        });

        card.addEventListener("dragleave", function () {
          card.classList.remove("visual-drop-target");
        });

        card.addEventListener("drop", function (event) {
          event.preventDefault();

          var draggedId =
            event.dataTransfer.getData("text/plain") ||
            APP.controller.dragVisualId;

          card.classList.remove("visual-drop-target");

          if (!draggedId || draggedId === visual.id) {
            return;
          }

          var items = APP.state.settings.dashboardVisuals;
          var fromIndex = items.findIndex(function (item) {
            return item.id === draggedId;
          });

          var toIndex = items.findIndex(function (item) {
            return item.id === visual.id;
          });

          if (fromIndex < 0 || toIndex < 0) {
            return;
          }

          var moved = items.splice(fromIndex, 1)[0];
          items.splice(toIndex, 0, moved);

          APP.store.log(
            "success",
            "Dashboard visual order updated."
          );

          APP.controller.commit();
        });
      }

      if (!visual.visible) {
        card.classList.add("visual-hidden-preview");
      }

      var cardActions = APP.dom.el("div", "visual-card-actions");
      var edit = APP.ui.button("Edit", "button-quiet");
      var toggle = APP.ui.button(
        visual.visible ? "Hide" : "Show",
        "button-quiet"
      );

      var up = APP.ui.button("↑", "button-quiet");
      var down = APP.ui.button("↓", "button-quiet");
      var remove = APP.ui.button("Delete", "button-quiet danger");

      edit.addEventListener("click", function () {
        APP.pages.visuals.openModal(visual.id);
      });

      toggle.addEventListener("click", function () {
        visual.visible = !visual.visible;
        APP.controller.commit();
      });

      up.addEventListener("click", function () {
        var index = APP.state.settings.dashboardVisuals.indexOf(visual);

        if (index > 0) {
          var items = APP.state.settings.dashboardVisuals;
          var previous = items[index - 1];

          items[index - 1] = visual;
          items[index] = previous;

          APP.controller.commit();
        }
      });

      down.addEventListener("click", function () {
        var index = APP.state.settings.dashboardVisuals.indexOf(visual);
        var items = APP.state.settings.dashboardVisuals;

        if (index < items.length - 1) {
          var next = items[index + 1];

          items[index + 1] = visual;
          items[index] = next;

          APP.controller.commit();
        }
      });

      remove.addEventListener("click", function () {
        if (!window.confirm(
          "Delete dashboard visual: " + visual.title + "?"
        )) {
          return;
        }

        APP.state.settings.dashboardVisuals =
          APP.state.settings.dashboardVisuals.filter(function (item) {
            return item.id !== visual.id;
          });

        delete APP.controller.visualRuntime[visual.id];

        APP.controller.commit();
      });

      cardActions.appendChild(edit);
      cardActions.appendChild(toggle);

            if (APP.controller.dashboardCustomizeMode) {
        var resize = APP.ui.button(
          "↘",
          "button-quiet visual-resize-handle"
        );

        resize.title = "Resize visual";

        resize.addEventListener("click", function () {
          var currentWidth = visual.width || "normal";
          var currentHeight = visual.height || "normal";

          if (
            currentWidth === "normal" &&
            currentHeight === "normal"
          ) {
            visual.width = "wide";
            visual.height = "normal";
          } else if (
            currentWidth === "wide" &&
            currentHeight === "normal"
          ) {
            visual.width = "wide";
            visual.height = "tall";
          } else if (
            currentWidth === "wide" &&
            currentHeight === "tall"
          ) {
            visual.width = "normal";
            visual.height = "tall";
          } else {
            visual.width = "normal";
            visual.height = "normal";
          }

          APP.store.log(
            "success",
            "Resized dashboard visual: " +
            visual.title + "."
          );

          APP.controller.commit();
        });

        cardActions.appendChild(up);
        cardActions.appendChild(down);
        cardActions.appendChild(resize);
        cardActions.appendChild(remove);
      }

      card.appendChild(APP.ui.panelHeader(
        visual.title,
        visual.topic
          .replace(/_/g, " ")
          .replace(/\b\w/g, function (letter) {
            return letter.toUpperCase();
          }),
        cardActions
      ));

      APP.controller.createVisualControls(
        visual,
        card
      );

      var chartRoot = APP.dom.el("div", "visual-chart-area");

      chartRoot.style.height =
        visual.chartType === "sankey" ?
          (visual.height === "tall" ? "560px" : "440px") :
          "250px";

      card.appendChild(chartRoot);
      visualsRoot.appendChild(card);

      APP.controller.renderVisual(
        chartRoot,
        visual,
        month
      );
    });
  };

  APP.controller.commit = function () {
    APP.store.save();
    APP.dom.audit();
    APP.controller.renderAll();
  };

  APP.controller.renderAll = function () {
    APP.dom.refs.month.value = APP.state.settings.selectedMonth;

    APP.controller.renderDashboard();
    APP.pages.transactions.render();
    APP.pages.budget.render();
    APP.pages.savings.render();
    APP.pages.debts.render();
    APP.pages.salary.render();
    APP.pages.advisor.render();
    APP.pages.settings.render();
  };

  APP.controller.switchView = function (viewName) {
    var meta = APP.controller.meta[viewName] ||
      APP.controller.meta.dashboard;

    APP.state.settings.activeView = viewName;
    APP.dom.refs.title.textContent = meta[0];
    APP.dom.refs.eyebrow.textContent = meta[1];

    APP.dom.refs.nav.forEach(function (item) {
      item.classList.toggle(
        "active",
        item.dataset.view === viewName
      );
    });

    APP.dom.refs.views.forEach(function (view) {
      view.classList.toggle(
        "active-view",
        view.id === "view-" + viewName
      );
    });

    APP.dom.refs.sidebar.classList.remove("open");
    APP.store.save();
  };

  APP.controller.importTransactions = function (file) {
    APP.ingest.read(file).then(function (result) {
      var cleaned = APP.clean.transactions(result.records);
      var attached = APP.model.attachImportedCategories(cleaned.valid);

      attached.transactions.forEach(function (transaction) {
        APP.state.transactions.push(transaction);
      });

      result.warnings.concat(cleaned.warnings).forEach(function (warning) {
        APP.store.log("warning", warning);
      });

      if (attached.unmatched.length) {
        APP.store.log(
          "warning",
          "Imported transactions with unmatched categories: " +
          attached.unmatched.join(", ") + "."
        );
      }

      APP.store.log(
        "success",
        "Imported " + attached.transactions.length +
        " transaction(s); skipped " +
        cleaned.invalid.length + " invalid row(s)."
      );

      APP.controller.commit();
      APP.dom.toast("Transaction import completed.", "success");
    }).catch(function (error) {
      APP.store.log("error", error.message);
      APP.controller.commit();
      APP.dom.toast(error.message, "danger");
    });
  };

  APP.controller.migrateVisuals = function () {
    var oldMetricToTopic = {
      cashFlow: "net_cash_flow_trend",
      spendingByCategory: "operating_category_allocation",
      savingsByFund: "savings_fund_allocation",
      cashFlowTrend: "net_cash_flow_trend",
      incomeTrend: "income_trend",
      operatingTrend: "operating_spending_trend",
      savingsTrend: "savings_contribution_trend",
      categoryComparison: "operating_category_comparison",
      categoryBreakdown: "operating_category_allocation",
      categoryStackedTrend: "operating_category_stacked",
      transactionPattern: "transaction_amount_sequence",
      categoryMonthHeat: "operating_category_heatmap",
      dailyCalendarHeat: "daily_operating_spending",
      budgetProgress: "monthly_budget_completion",
      savingsMonthlyProgress: "savings_monthly_completion",
      savingsEventualProgress: "savings_eventual_completion",
      goalProgress: "savings_goal_completion",
      cashFlowWaterfall: "income_to_net_cash_flow",
      incomeAllocation: "income_allocation"
    };

    APP.state.settings.dashboardVisuals.forEach(function (visual) {
      if (!visual.topic) {
        visual.topic = oldMetricToTopic[visual.metric] ||
          "net_cash_flow_trend";
      }

      if (!visual.timelineMode) {
        visual.timelineMode = visual.rangeMonths === 12 ?
          "rolling_12_months" :
          visual.rangeMonths === 6 ?
            "rolling_6_months" :
            "selected_month";
      }

      if (!visual.categoryScope) {
        visual.categoryScope = visual.categoryId ? "selected" : "all";
      }

      if (!Array.isArray(visual.categoryIds)) {
        visual.categoryIds = visual.categoryId ?
          [visual.categoryId] :
          [];
      }

      if (!visual.displayMode) {
        visual.displayMode = "currency";
      }

      if (!visual.aggregationMode) {
        visual.aggregationMode = "total";
      }
            if (!visual.width) {
        visual.width = "normal";
      }

      if (!visual.height) {
        visual.height =
          visual.chartType === "sankey" ? "tall" : "normal";
      }

      if (
        visual.chartType === "sankey" &&
        visual.width === "normal"
      ) {
        visual.width = "wide";
      }
      delete visual.metric;
      delete visual.rangeMonths;
      delete visual.categoryId;
    });
  };

  APP.controller.bind = function () {
    APP.dom.refs.nav.forEach(function (item) {
      item.addEventListener("click", function () {
        APP.controller.switchView(item.dataset.view);
      });
    });

    APP.dom.refs.menuButton.addEventListener("click", function () {
      APP.dom.refs.sidebar.classList.toggle("open");
    });

    APP.dom.refs.month.addEventListener("change", function () {
      if (/^\d{4}-\d{2}$/.test(APP.dom.refs.month.value)) {
        APP.state.settings.selectedMonth =
          APP.dom.refs.month.value;

        APP.controller.commit();
      }
    });

    APP.dom.refs.quickTransaction.addEventListener("click", function () {
      APP.pages.transactions.openModal();
    });

    APP.dom.refs.addTransaction.addEventListener("click", function () {
      APP.pages.transactions.openModal();
    });

    APP.dom.refs.importButton.addEventListener("click", function () {
      APP.dom.refs.importInput.click();
    });

    APP.dom.refs.importInput.addEventListener("change", function () {
      var file = APP.dom.refs.importInput.files[0];

      if (file) {
        APP.controller.importTransactions(file);
      }

      APP.dom.refs.importInput.value = "";
    });

    APP.dom.refs.clearAudit.addEventListener("click", function () {
      APP.state.auditLog = [];
      APP.store.save();
      APP.dom.audit();
    });
  };

  APP.controller.init = function () {
    APP.dom.init();
    APP.store.load();
    APP.model.initialize();
    APP.model.migrateTransactions();

    if (!APP.state.settings.ollama) {
      APP.state.settings.ollama = {
        endpoint: "",
        model: "",
        timeoutMs: 30000
      };
    }

    if (!Array.isArray(APP.state.settings.dashboardVisuals)) {
      APP.state.settings.dashboardVisuals = [];
    }

    APP.controller.migrateVisuals();

    APP.store.log("info", "Budget dashboard initialized.");

    APP.controller.bind();
    APP.controller.commit();

    APP.controller.switchView(
      APP.state.settings.activeView || "dashboard"
    );
  };

  window.addEventListener(
    "DOMContentLoaded",
    APP.controller.init
  );
}());