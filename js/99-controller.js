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

  // One series per category over arbitrary periods. keyField is "month" or "date";
  // transactions without a category are grouped as "Uncategorized".
  APP.controller.categoryPeriodSeries = function (visual, keys, keyField, kinds) {
    var buckets = {};

    APP.state.transactions.forEach(function (transaction) {
      var index = keys.indexOf(transaction[keyField]);

      if (
        index === -1 ||
        kinds.indexOf(APP.model.classify(transaction)) === -1 ||
        !APP.controller.matchesCategoryScope(transaction, visual)
      ) {
        return;
      }

      var id = transaction.categoryId || "uncategorized";

      if (!buckets[id]) {
        buckets[id] = keys.map(function () {
          return 0;
        });
      }

      buckets[id][index] += APP.utils.money(transaction.amount);
    });

    var series = APP.state.categories.filter(function (category) {
      return buckets[category.id];
    }).map(function (category) {
      return {
        id: category.id,
        label: category.name,
        values: buckets[category.id]
      };
    });

    if (buckets.uncategorized) {
      series.push({
        id: "uncategorized",
        label: "Uncategorized",
        values: buckets.uncategorized
      });
    }

    return series;
  };

  // Savings-fund balances at the end of each period. Daily periods start from the
  // balance at the end of the previous month.
  APP.controller.savingsBalanceSeries = function (visual, keys, isDaily, selectedMonth) {
    var funds = APP.state.categories.filter(function (category) {
      return category.isSavingsFund &&
        !category.archived &&
        (visual.categoryScope !== "selected" ||
          visual.categoryIds.indexOf(category.id) !== -1);
    });

    return funds.map(function (category) {
      var values;

      if (!isDaily) {
        values = keys.map(function (month) {
          return APP.model.savingsBalance(category.id, month);
        });
      } else {
        var running = APP.model.savingsBalance(
          category.id,
          APP.controller.shiftMonth(selectedMonth, -1)
        );

        if (category.openingBalanceEffectiveMonth === selectedMonth) {
          running += APP.utils.money(category.openingBalance);
        }

        values = keys.map(function (date) {
          APP.state.transactions.forEach(function (transaction) {
            if (transaction.categoryId !== category.id || transaction.date !== date) {
              return;
            }

            if (transaction.type === "savings") {
              running += APP.utils.money(transaction.amount);
            }

            if (transaction.type === "expense") {
              running -= APP.utils.money(transaction.amount);
            }
          });

          return running;
        });
      }

      return { id: category.id, label: category.name, values: values };
    }).filter(function (item) {
      return item.values.some(function (value) {
        return value !== 0;
      });
    });
  };

  // "Jul" for months in one year; "Jul 25" once a range crosses a year boundary.
  APP.controller.monthLabels = function (months) {
    var years = months.map(function (month) {
      return month.slice(0, 4);
    });
    var mixed = years.some(function (year) {
      return year !== years[0];
    });

    return months.map(function (month) {
      var name = new Date(month + "-01T00:00:00").toLocaleString(undefined, { month: "short" });
      return mixed ? name + " " + month.slice(2, 4) : name;
    });
  };

  APP.controller.cumulative = function (values) {
    var running = 0;

    return values.map(function (value) {
      running += APP.utils.money(value);
      return running;
    });
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

  APP.controller.trendTopics = {
    income_trend: { field: "income", kinds: ["income"] },
    operating_spending_trend: { field: "operating", kinds: ["operatingExpense"] },
    total_outflow_trend: {
      field: "outflow",
      kinds: ["operatingExpense", "savingsContribution", "debtPayment"]
    },
    net_cash_flow_trend: { field: "net", kinds: null },
    savings_contribution_trend: { field: "savings", kinds: ["savingsContribution"] },
    cumulative_operating_spending: {
      field: "operating",
      kinds: ["operatingExpense"],
      cumulative: true
    },
    cumulative_savings_growth: {
      field: "savings",
      kinds: ["savingsContribution"],
      cumulative: true
    },
    savings_balance_trend: { balance: true }
  };

  APP.controller.renderTrend = function (root, key, visual, selectedMonth) {
    var isDaily = visual.timelineMode === "daily_selected_month";
    var topic = APP.controller.trendTopics[visual.topic];
    var isArea = visual.chartType === "area";
    var isPercent = visual.displayMode === "percent";

    var keys = isDaily ?
      APP.controller.timelineDays(selectedMonth) :
      APP.controller.timelineMonths(visual.timelineMode, selectedMonth);

    var labels = isDaily ?
      keys.map(function (item) {
        return String(Number(item.slice(8)));
      }) :
      APP.controller.monthLabels(keys);

    var series = [];
    var totals;

    if (topic.balance) {
      series = APP.controller.savingsBalanceSeries(visual, keys, isDaily, selectedMonth);
      totals = keys.map(function (item, index) {
        return series.reduce(function (sum, fund) {
          return sum + fund.values[index];
        }, 0);
      });
    } else {
      var periods = isDaily ?
        APP.controller.dailyTotals(visual, selectedMonth) :
        APP.controller.monthlyTotals(visual, keys);

      totals = periods.map(function (item) {
        return item[topic.field];
      });

      if (visual.aggregationMode === "byCategory" && topic.kinds) {
        series = APP.controller.categoryPeriodSeries(
          visual,
          keys,
          isDaily ? "date" : "month",
          topic.kinds
        );
      }
    }

    if (topic.cumulative) {
      totals = APP.controller.cumulative(totals);
      series.forEach(function (item) {
        item.values = APP.controller.cumulative(item.values);
      });
    }

    var byCategory = visual.aggregationMode === "byCategory" && series.length > 0;
    var datasets = [];

    // Percent mode: the total shows each period's share of the whole timeline; category
    // lines show each category's share of that period's total, so the total line is dropped.
    if (!byCategory || !isPercent) {
      datasets.push({
        label: byCategory ? "Total" : visual.title,
        data: APP.controller.valuesForDisplay(totals, visual),
        borderColor: byCategory ? APP.charts.totalColor : visual.color,
        backgroundColor: byCategory ?
          APP.charts.alpha(APP.charts.totalColor, 0) :
          isArea ? APP.charts.alpha(visual.color, 0.25) : visual.color,
        borderWidth: byCategory ? 2.5 : 2,
        borderDash: byCategory ? [6, 4] : [],
        fill: isArea && !byCategory ? "origin" : false,
        pointRadius: 3,
        pointHoverRadius: 5,
        cubicInterpolationMode: "monotone",
        order: 0
      });
    }

    if (byCategory) {
      APP.charts.limitSeries(series).forEach(function (item) {
        datasets.push({
          label: item.label,
          data: isPercent ?
            item.values.map(function (value, index) {
              return totals[index] ? value / totals[index] * 100 : 0;
            }) :
            item.values,
          borderColor: item.color,
          backgroundColor: isArea ? APP.charts.alpha(item.color, 0.12) : item.color,
          borderWidth: 2,
          fill: isArea ? "origin" : false,
          pointRadius: 3,
          pointHoverRadius: 5,
        cubicInterpolationMode: "monotone",
          order: 1
        });
      });
    }

    var options = APP.controller.chartOptions(visual, false, isArea);

    options.interaction = { mode: "index", intersect: false };
    options.plugins.tooltip.itemSort = function (a, b) {
      return b.raw - a.raw;
    };

    if (byCategory && isPercent) {
      options.plugins.tooltip.callbacks.label = function (context) {
        return context.dataset.label + ": " +
          APP.utils.money(context.raw).toFixed(1) + "% of period total";
      };
    }

    APP.charts.chart(root, key, {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: options
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

    var datasets = [
      {
        label: "Income",
        data: APP.controller.valuesForDisplay(
          incomeValues,
          visual
        ),
        backgroundColor: APP.charts.flow.income,
        stack: "income"
      }
    ];

    var outflowSeries = visual.aggregationMode === "byCategory" ?
      APP.controller.categoryPeriodSeries(
        visual,
        periods.map(function (item) {
          return isDaily ? item.date : item.month;
        }),
        isDaily ? "date" : "month",
        ["operatingExpense", "savingsContribution", "debtPayment"]
      ) :
      [];

    if (outflowSeries.length) {
      // Segments share the outflow total's percent base so the stack matches the total bar.
      var outflowTotal = outflowValues.reduce(function (sum, value) {
        return sum + value;
      }, 0) || 1;

      APP.charts.limitSeries(outflowSeries).forEach(function (item) {
        datasets.push({
          label: item.label,
          data: visual.displayMode === "percent" ?
            item.values.map(function (value) {
              return value / outflowTotal * 100;
            }) :
            item.values,
          backgroundColor: item.color,
          stack: "outflow"
        });
      });
    } else {
      datasets.push({
        label: "Cash outflow",
        data: APP.controller.valuesForDisplay(
          outflowValues,
          visual
        ),
        backgroundColor: APP.charts.flow.spending,
        stack: "outflow"
      });
    }

    APP.charts.chart(root, key, {
      type: "bar",
      data: {
        labels: isDaily ?
          periods.map(function (item) {
            return item.label;
          }) :
          APP.controller.monthLabels(periods.map(function (item) {
            return item.month;
          })),
        datasets: datasets
      },
      options: APP.controller.chartOptions(
        visual,
        outflowSeries.length > 0,
        false
      )
    });
  };

  APP.controller.flowColorForTopic = function (topic) {
    if (/savings/.test(topic)) {
      return APP.charts.flow.savings;
    }

    if (/debt/.test(topic)) {
      return APP.charts.flow.debt;
    }

    return APP.charts.flow.spending;
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

    if (/savings_fund/.test(visual.topic)) {
      kinds = ["savingsContribution"];
    }

    if (/debt_(payment|category)/.test(visual.topic)) {
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

    if (!items.length) {
      APP.charts.message(root, "No activity for this period.");
      return;
    }

    var total = items.reduce(function (sum, item) {
      return sum + item.value;
    }, 0);

    var isRound = visual.chartType === "pie" || visual.chartType === "doughnut";

    function display(value) {
      return visual.displayMode === "percent" && total > 0 ?
        value / total * 100 :
        value;
    }

    if (isRound) {
      var slices = APP.charts.limitSeries(items.map(function (item) {
        return { id: item.categoryId, label: item.label, values: [item.value] };
      }));

      APP.charts.chart(root, key, {
        type: visual.chartType,
        data: {
          labels: slices.map(function (slice) {
            return slice.label;
          }),
          datasets: [{
            label: visual.title,
            data: slices.map(function (slice) {
              return display(slice.values[0]);
            }),
            backgroundColor: slices.map(function (slice) {
              return slice.color;
            }),
            hoverOffset: 6
          }]
        },
        plugins: visual.chartType === "doughnut" ?
          [APP.charts.centerLabel("Total", APP.charts.compact(total))] :
          [],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: visual.chartType === "doughnut" ? "68%" : 0,
          layout: { padding: 6 },
          plugins: {
            legend: {
              position: "right",
              labels: {
                generateLabels: function (chart) {
                  return window.Chart.overrides.doughnut.plugins.legend.labels
                    .generateLabels(chart).map(function (item) {
                      var value = slices[item.index].values[0];
                      item.text = item.text + "  " + (total > 0 ?
                        Math.round(value / total * 100) + "%" : "");
                      return item;
                    });
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  var value = slices[context.dataIndex].values[0];

                  return " " + context.label + ": " + APP.utils.currency(value) +
                    " (" + (total > 0 ? (value / total * 100).toFixed(1) : 0) + "%)";
                }
              }
            }
          }
        }
      });
      return;
    }

    // Bars compare one measure across categories: a single hue, sorted, horizontal so the
    // category names stay readable.
    var color = APP.controller.flowColorForTopic(visual.topic);
    var options = APP.controller.chartOptions(visual, false, false);

    options.indexAxis = "y";
    options.plugins.legend = { display: false };
    options.scales = {
      x: {
        beginAtZero: true,
        border: { display: false },
        ticks: {
          maxTicksLimit: 6,
          callback: function (value) {
            return visual.displayMode === "percent" ? value + "%" : APP.charts.compact(value);
          }
        }
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: "#c9d6e6" }
      }
    };

    APP.charts.chart(root, key, {
      type: "bar",
      data: {
        labels: items.map(function (item) {
          return item.label;
        }),
        datasets: [{
          label: visual.title,
          data: items.map(function (item) {
            return display(item.value);
          }),
          backgroundColor: color,
          maxBarThickness: 18
        }]
      },
      options: options
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
        labels: APP.controller.monthLabels(months),
        datasets: APP.charts.limitSeries(series).map(function (item) {
          return {
            label: item.label,
            data: visual.displayMode === "percent" ?
              APP.controller.percentValues(item.values) :
              item.values,

            backgroundColor: item.color,
            borderColor: APP.charts.surface,
            borderWidth: { top: 2 },
            borderRadius: 0,
            borderSkipped: false
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

    var datasets = [{
      label: visual.title,
      backgroundColor: visual.color,
      data: points
    }];

    if (
      visual.aggregationMode === "byCategory" &&
      visual.topic !== "daily_spending_frequency" &&
      points.length
    ) {
      var categories = APP.model.categories().byId;
      var groups = {};
      var order = [];

      transactions.forEach(function (transaction, index) {
        var id = transaction.categoryId || "uncategorized";

        if (!groups[id]) {
          groups[id] = [];
          order.push(id);
        }

        groups[id].push(points[index]);
      });

      // Scatter marks overlap freely, so each category keeps its own points rather than
      // folding into "Other"; past the palette size the extra categories share a neutral color.
      order.sort(function (a, b) {
        return groups[b].length - groups[a].length;
      });

      datasets = order.map(function (id, index) {
        return {
          label: categories[id] ? categories[id].name : "Uncategorized",
          backgroundColor: APP.charts.categoryPalette[index] || APP.charts.otherColor,
          pointRadius: 4,
          pointHoverRadius: 6,
          data: groups[id]
        };
      });
    }

    APP.charts.chart(root, key, {
      type: "scatter",
      data: {
        datasets: datasets
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

    var monthNames = months.map(function (month) {
      return new Date(month + "-01T00:00:00").toLocaleString(undefined, { month: "short" });
    });

    APP.charts.matrix(
      root,
      APP.controller.categoryPeriodSeries(visual, months, "month", kinds),
      monthNames,
      APP.controller.flowColorForTopic(visual.topic)
    );
  };

  APP.controller.renderCalendarHeatmap = function (
    root,
    visual,
    selectedMonth
  ) {
    var days = APP.controller.timelineDays(selectedMonth);

    var kinds = ["operatingExpense"];
    var color = APP.charts.flow.spending;

    if (visual.topic === "daily_savings_contributions") {
      kinds = ["savingsContribution"];
      color = APP.charts.flow.savings;
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
      color = APP.charts.flow.income;
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
    }), color);
  };
  // Spending budget for a month: operating categories only (savings funds and debt
  // categories have their own visuals), with pace based on how much of the month is over.
  // "left" is the smaller of what the budget allows and the cash actually left, because a
  // budget can't be spent with money that already went to savings or debt, or never came in.
  APP.controller.budgetPace = function (month) {
    var budget = APP.model.budget(month, false);
    var categories = APP.model.categories().byId;
    var targets = { spending: 0, savings: 0, debt: 0 };

    (budget.items || []).forEach(function (item) {
      var category = categories[item.categoryId];

      if (!category) {
        return;
      }

      var kind = category.isSavingsFund ? "savings" :
        category.isDebtCategory ? "debt" :
          "spending";

      targets[kind] += APP.utils.money(item.dollarTarget);
    });

    var planned = targets.spending;
    var totals = APP.analytics.month(month);
    var spent = totals.operating;
    var days = APP.controller.timelineDays(month).length;
    var currentMonth = APP.utils.month(new Date());
    var day = month === currentMonth ? new Date().getDate() : month < currentMonth ? days : 0;
    var expected = planned * day / days;
    var budgetLeft = planned - spent;
    var daysLeft = month === currentMonth ? days - day + 1 : month > currentMonth ? days : 0;

    // While the month is still running, expected income that hasn't arrived yet still
    // counts; once it's over, only the income that actually came in does.
    var expectedIncome = APP.utils.money(budget.expectedIncome);
    var monthOpen = month >= currentMonth;
    var pendingIncome = monthOpen ? Math.max(0, expectedIncome - totals.income) : 0;
    var cashLeft = totals.income + pendingIncome - spent -
      totals.savingsContributions - totals.debtPayments;
    var limited = cashLeft < budgetLeft - 0.005;
    var remaining = limited ? cashLeft : budgetLeft;

    // Why cash is short of the budget. Each item is one part of the gap; parts that go the
    // other way (saving less than planned, say) are left out.
    var reasons = [];
    var offsets = [];

    if (limited) {
      var savedExtra = totals.savingsContributions - targets.savings;
      var debtExtra = totals.debtPayments - targets.debt;
      var incomeShort = monthOpen ? 0 : expectedIncome - totals.income;
      var overPlanned = targets.spending + targets.savings + targets.debt - expectedIncome;

      if (savedExtra >= 0.01) {
        reasons.push("you saved " + APP.utils.currency(savedExtra) + " more than planned");
      }

      if (debtExtra >= 0.01) {
        reasons.push("you paid " + APP.utils.currency(debtExtra) + " more toward debt than planned");
      }

      if (incomeShort >= 0.01) {
        reasons.push("income came in " + APP.utils.currency(incomeShort) + " under the expected amount");
      }

      if (expectedIncome > 0 && overPlanned >= 0.01) {
        reasons.push("the Monthly Plan assigns " + APP.utils.currency(overPlanned) +
          " more than your expected income");
      }

      if (!expectedIncome) {
        reasons.push("no expected income is set in the Monthly Plan");
      }

      // Parts that shrink the gap, so the listed reasons add up to the difference shown.
      if (savedExtra <= -0.01) {
        offsets.push("saving " + APP.utils.currency(-savedExtra) + " less than planned");
      }

      if (debtExtra <= -0.01) {
        offsets.push("paying " + APP.utils.currency(-debtExtra) + " less toward debt than planned");
      }

      if (incomeShort <= -0.01) {
        offsets.push("income coming in " + APP.utils.currency(-incomeShort) + " over expected");
      }
    }

    var status = "good";
    var message = "";

    if (remaining < 0) {
      status = "critical";
      message = limited && spent <= planned ?
        "Spending is within budget, but outflow is " + APP.utils.currency(-cashLeft) +
          " more than this month's income." :
        "Over budget by " + APP.utils.currency(-remaining) + ".";
    } else if (spent > expected * 1.05 && day < days) {
      status = "warning";
      message = "Ahead of pace by " + APP.utils.currency(spent - expected) + ".";
    } else if (day < days) {
      message = "On track: " + APP.utils.currency(Math.max(0, expected - spent)) + " under pace.";
    } else {
      message = "Finished " + APP.utils.currency(remaining) + " under budget.";
    }

    return {
      budget: planned,
      targets: targets,
      spent: spent,
      budgetLeft: budgetLeft,
      cashLeft: cashLeft,
      pendingIncome: pendingIncome,
      limited: limited,
      reasons: reasons,
      offsets: offsets,
      remaining: remaining,
      expected: expected,
      day: day,
      days: days,
      daysLeft: daysLeft,
      perDay: daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0,
      status: status,
      message: message
    };
  };

  APP.controller.renderBudgetPace = function (root, key, visual, selectedMonth) {
    var pace = APP.controller.budgetPace(selectedMonth);

    if (!pace.budget) {
      APP.charts.message(root, "Set spending budgets in Monthly Plan to track how much is left this month.");
      return;
    }

    var color = APP.charts.status[pace.status];
    var used = Math.round(pace.spent / pace.budget * 100);
    var headline = pace.remaining >= 0 ?
      APP.utils.currency(pace.remaining) + " left" :
      APP.utils.currency(-pace.remaining) + " over";

    // The arc shows how much of the budget is used up, counting cash that's no longer
    // available as used.
    var consumed = Math.max(0, pace.budget - pace.remaining);

    var stats = APP.charts.statRow([
      ["Spent", APP.utils.currency(pace.spent)],
      pace.limited ?
        ["Budget left", APP.utils.currency(pace.budgetLeft), "Cash left: " + APP.utils.currency(pace.cashLeft)] :
        ["Budget", APP.utils.currency(pace.budget)],
      pace.remaining < 0 ?
        ["Over by", APP.utils.currency(-pace.remaining)] :
        pace.daysLeft ?
          ["Per day left", APP.utils.currency(pace.perDay)] :
          ["Left", APP.utils.currency(pace.remaining)]
    ]);

    var notes = [pace.message + (pace.daysLeft ? " Day " + pace.day + " of " + pace.days + "." : "")];

    if (pace.limited) {
      notes.push("Only " + APP.utils.currency(pace.cashLeft) + " of cash is left, " +
        APP.utils.currency(pace.budgetLeft - pace.cashLeft) + " less than your budget allows" +
        (pace.reasons.length ? ", because " + pace.reasons.join(" and ") : "") +
        (pace.offsets.length ? ", partly offset by " + pace.offsets.join(" and ") : "") + ".");
    }

    if (pace.pendingIncome > 0.005) {
      notes.push("Counts " + APP.utils.currency(pace.pendingIncome) +
        " of expected income that hasn't arrived yet.");
    }

    var detail = pace.limited ?
      "Limited by cash on hand" :
      used + "% of spending budget used";

    if (visual.chartType === "gauge") {
      APP.charts.gauge(root, key, consumed, pace.budget, color, {
        valueText: headline,
        detailText: detail,
        note: notes.join(" "),
        extra: stats
      });
      return;
    }

    APP.charts.progress(root, consumed, pace.budget, "Spending budget", {
      color: color,
      marker: pace.day < pace.days ? pace.expected : undefined,
      markerLabel: "On pace: " + APP.utils.currency(pace.expected),
      valueText: headline,
      detailText: APP.utils.currency(pace.spent) + " of " +
        APP.utils.currency(pace.budget) + " spent (" + used + "%)",
      note: notes.join(" ") + (pace.day < pace.days ? " The tick marks where spending would be on pace." : ""),
      extra: stats
    });
  };

  APP.controller.renderProgress = function (
    root,
    key,
    visual,
    selectedMonth
  ) {
    if (visual.topic === "monthly_spending_vs_budget") {
      APP.controller.renderBudgetPace(root, key, visual, selectedMonth);
      return;
    }

    var selectedId = (visual.categoryIds || [])[0];
    var current = 0;
    var target = 0;
    var label = visual.title;
    var color = visual.color;
    var detail = "";

    if (visual.topic === "monthly_budget_completion") {
      var budget = APP.model.budget(selectedMonth, false);

      current = APP.utils.sum(budget.items, function (item) {
        return item.dollarTarget;
      });

      target = APP.utils.money(budget.expectedIncome);
      label = "Planned category goals";
      color = APP.charts.flow.debt;
      detail = APP.utils.currency(current) + " planned of " +
        APP.utils.currency(target) + " expected income";
    }

    if (
      visual.topic === "savings_monthly_completion" ||
      visual.topic === "savings_eventual_completion" ||
      visual.topic === "savings_goal_completion"
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

      var monthly = visual.topic === "savings_monthly_completion";

      current = monthly ? fund.deposits : fund.balance;
      target = monthly ? fund.monthlyGoal : fund.eventualGoal;
      label = fund.category.name;
      color = APP.charts.flow.savings;
      detail = fund.category.name + ": " + APP.utils.currency(current) +
        " of " + APP.utils.currency(target) + (monthly ? " this month" : " goal");

      if (!monthly && fund.estimatedCompletionMonth) {
        detail += " · on track for " + fund.estimatedCompletionMonth;
      }
    }

    if (visual.topic === "debt_payoff_completion") {
      var debts = APP.model.debts();
      var debt = debts.byId[selectedId] || debts.active[0];

      if (!debt) {
        APP.charts.message(
          root,
          "Add a debt account to track payoff progress."
        );
        return;
      }

      var projection = APP.model.debtProjection(debt.id, APP.utils.isoDate(new Date()));

      current = APP.utils.money(projection.paymentTotalSinceConfirmed);
      target = APP.utils.money(debt.confirmedBalance);
      label = debt.name;
      color = APP.charts.flow.debt;
      detail = debt.name + ": " + APP.utils.currency(current) + " paid of " +
        APP.utils.currency(target) + " since the balance was confirmed";
    }

    if (target <= 0) {
      APP.charts.message(root, "Set a target amount to track progress for " + label + ".");
      return;
    }

    if (visual.chartType === "gauge") {
      APP.charts.gauge(root, key, current, target, color, { detailText: detail });
    } else {
      APP.charts.progress(root, current, target, label, { color: color, detailText: detail });
    }
  };

  // Folds a category breakdown to at most `limit` items, the rest as "Other".
  APP.controller.foldBreakdown = function (items, limit) {
    if (items.length <= limit) {
      return items;
    }

    var kept = items.slice(0, limit - 1);
    var rest = items.slice(limit - 1);

    kept.push({
      categoryId: "other",
      label: "Other (" + rest.length + ")",
      value: rest.reduce(function (sum, item) {
        return sum + item.value;
      }, 0)
    });

    return kept;
  };

  APP.controller.flowTotals = function (visual, months) {
    var scoped = APP.controller.transactionsForVisual(visual, months);
    var all = APP.state.transactions.filter(function (transaction) {
      return months.indexOf(transaction.month) !== -1;
    });

    // Income usually has no category, so it is never narrowed by the category scope.
    return {
      income: APP.controller.sumTransactions(all, ["income"]),
      spending: APP.controller.sumTransactions(scoped, ["operatingExpense"]),
      savings: APP.controller.sumTransactions(scoped, ["savingsContribution"]),
      debt: APP.controller.sumTransactions(scoped, ["debtPayment"])
    };
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

    var totals = APP.controller.flowTotals(visual, months);
    var steps = [{ label: "Income", value: totals.income, kind: "income" }];

    if (visual.aggregationMode === "byCategory") {
      APP.controller.foldBreakdown(
        APP.controller.categoryBreakdown(visual, months, ["operatingExpense"]),
        7
      ).forEach(function (item) {
        steps.push({ label: item.label, value: -item.value, kind: "spending" });
      });
    } else {
      steps.push({ label: "Spending", value: -totals.spending, kind: "spending" });
    }

    steps.push({ label: "Savings", value: -totals.savings, kind: "savings" });
    steps.push({ label: "Debt payments", value: -totals.debt, kind: "debt" });

    steps = steps.filter(function (step) {
      return step.kind === "income" || step.value !== 0;
    });

    steps.push({
      label: "Net cash flow",
      value: totals.income - totals.spending - totals.savings - totals.debt,
      kind: "total"
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

    var totals = APP.controller.flowTotals(visual, months);
    var outflow = totals.spending + totals.savings + totals.debt;
    var byCategory = visual.aggregationMode === "byCategory";

    function children(kinds) {
      return byCategory ?
        APP.controller.foldBreakdown(
          APP.controller.categoryBreakdown(visual, months, kinds),
          6
        ) :
        [];
    }

    var sources = [{ label: "Income", value: totals.income, color: APP.charts.flow.income }];

    if (outflow > totals.income) {
      sources.push({
        label: "Shortfall",
        value: outflow - totals.income,
        color: APP.charts.flow.shortfall
      });
    }

    APP.charts.sankey(root, {
      base: totals.income || outflow,
      sources: sources,
      groups: [
        {
          label: "Spending",
          value: totals.spending,
          color: APP.charts.flow.spending,
          children: children(["operatingExpense"])
        },
        {
          label: "Savings",
          value: totals.savings,
          color: APP.charts.flow.savings,
          children: children(["savingsContribution"])
        },
        {
          label: "Debt payments",
          value: totals.debt,
          color: APP.charts.flow.debt,
          children: children(["debtPayment"])
        },
        {
          label: "Leftover cash",
          value: Math.max(0, totals.income - outflow),
          color: APP.charts.flow.remaining,
          children: []
        }
      ]
    }, visual.displayMode);
  };

  // Cumulative spending through the selected month against an even budget pace and the
  // previous month, so it is clear whether spending is running hot.
  APP.controller.renderSpendingPace = function (root, key, visual, selectedMonth) {
    var days = APP.controller.timelineDays(selectedMonth);
    var previousMonth = APP.controller.shiftMonth(selectedMonth, -1);
    var previousDays = APP.controller.timelineDays(previousMonth);
    var today = APP.utils.isoDate(new Date());
    var pace = APP.controller.budgetPace(selectedMonth);

    function dailyCumulative(dates) {
      var byDate = {};

      APP.state.transactions.forEach(function (transaction) {
        if (
          dates.indexOf(transaction.date) === -1 ||
          APP.model.classify(transaction) !== "operatingExpense" ||
          !APP.controller.matchesCategoryScope(transaction, visual)
        ) {
          return;
        }

        byDate[transaction.date] =
          (byDate[transaction.date] || 0) + APP.utils.money(transaction.amount);
      });

      return APP.controller.cumulative(dates.map(function (date) {
        return byDate[date] || 0;
      }));
    }

    var current = dailyCumulative(days).map(function (value, index) {
      return days[index] > today ? null : value;
    });

    var previous = dailyCumulative(previousDays);
    var previousAligned = days.map(function (date, index) {
      return previous[Math.min(index, previous.length - 1)];
    });

    var datasets = [{
      label: "This month",
      data: current,
      borderColor: APP.charts.flow.spending,
      backgroundColor: APP.charts.alpha(APP.charts.flow.spending, 0.12),
      fill: visual.chartType === "area" ? "origin" : false,
      borderWidth: 2.5,
      order: 0
    }];

    if (pace.budget) {
      datasets.push({
        label: "Budget pace",
        data: days.map(function (date, index) {
          return pace.budget * (index + 1) / days.length;
        }),
        borderColor: APP.charts.totalColor,
        backgroundColor: APP.charts.totalColor,
        borderDash: [6, 4],
        borderWidth: 1.5,
        fill: false,
        order: 1
      });
    }

    datasets.push({
      label: "Last month",
      data: previousAligned,
      borderColor: APP.charts.otherColor,
      backgroundColor: APP.charts.otherColor,
      borderWidth: 1.5,
      fill: false,
      order: 2
    });

    var options = APP.controller.chartOptions(visual, false, false);

    options.plugins.tooltip.itemSort = function (a, b) {
      return a.dataset.order - b.dataset.order;
    };

    APP.charts.chart(root, key, {
      type: "line",
      data: {
        labels: days.map(function (date) {
          return String(Number(date.slice(8)));
        }),
        datasets: datasets
      },
      options: options
    });
  };

  APP.controller.renderCategoryBudgets = function (root, visual, selectedMonth) {
    var budget = APP.model.budget(selectedMonth, false);
    var activity = APP.analytics.categoryActivity(selectedMonth);

    var items = APP.state.categories.filter(function (category) {
      return !category.archived &&
        !category.isSavingsFund &&
        (visual.categoryScope !== "selected" ||
          visual.categoryIds.indexOf(category.id) !== -1);
    }).map(function (category) {
      var item = APP.model.budgetItem(budget, category.id);
      var values = activity[category.id] || {};

      return {
        label: category.name,
        kind: category.isDebtCategory ? "debt" : "spending",
        budget: item ? APP.utils.money(item.dollarTarget) : 0,
        spent: APP.utils.money(values.operating) + APP.utils.money(values.debt)
      };
    }).filter(function (item) {
      return item.budget > 0 || item.spent > 0;
    });

    // Most-used spending budgets first; debt rows and unbudgeted spending sink lower.
    function rank(item) {
      if (!item.budget) {
        return -1;
      }

      return item.kind === "debt" ? item.spent / item.budget / 10 : item.spent / item.budget;
    }

    items.sort(function (a, b) {
      return rank(b) - rank(a);
    });

    APP.charts.budgetRows(root, items);
  };


  APP.controller.monthEnd = function (month) {
    var days = APP.controller.timelineDays(month);
    return days[days.length - 1];
  };

  APP.controller.monthName = function (month) {
    return new Date(month + "-01T00:00:00").toLocaleString(undefined, {
      month: "short",
      year: "numeric"
    });
  };

  // Each active debt with today's estimated balance and the payment assumed going forward:
  // the average allocated payment over the last three months, never below the minimum.
  APP.controller.debtPlan = function () {
    var today = APP.utils.isoDate(new Date());
    var start = APP.controller.monthEnd(APP.controller.shiftMonth(APP.utils.month(new Date()), -3));

    return APP.model.debts().active.map(function (debt) {
      var projection = APP.model.debtProjection(debt.id, today);
      var recent = APP.model.debtPayments(debt.id, start, today).reduce(function (sum, payment) {
        return sum + payment.amount;
      }, 0);

      return {
        id: debt.id,
        name: debt.name,
        balance: APP.utils.money(projection.projectedBalance),
        confirmed: APP.utils.money(projection.confirmedBalance),
        apr: APP.utils.money(debt.apr),
        minimum: APP.utils.money(debt.minimumMonthlyPayment),
        payment: Math.max(APP.utils.money(debt.minimumMonthlyPayment), recent / 3),
        monthlyInterest: APP.utils.money(projection.monthlyInterest)
      };
    }).filter(function (item) {
      return item.balance > 0;
    });
  };

  // Month-by-month payoff simulation. strategy: "each" (every debt pays its own payment),
  // "minimums" (every debt pays only its minimum), or "avalanche" / "snowball" (the same
  // total pool, with money freed up by paid-off debts rolling to the next target).
  APP.controller.simulatePayoff = function (plan, strategy) {
    var debts = plan.map(function (item) {
      return {
        id: item.id,
        balance: item.balance,
        apr: item.apr,
        minimum: item.minimum,
        payment: strategy === "minimums" ? item.minimum : item.payment,
        paidOffMonth: 0,
        interest: 0
      };
    });

    var pool = debts.reduce(function (sum, debt) {
      return sum + debt.payment;
    }, 0);

    var totals = [];
    var totalInterest = 0;
    var month = 0;
    var limit = 600;

    function open() {
      return debts.filter(function (debt) {
        return debt.balance > 0.005;
      });
    }

    while (open().length && month < limit) {
      month += 1;

      open().forEach(function (debt) {
        var interest = debt.balance * debt.apr / 1200;
        debt.balance += interest;
        debt.interest += interest;
        totalInterest += interest;
      });

      if (strategy === "each" || strategy === "minimums") {
        open().forEach(function (debt) {
          debt.balance -= Math.min(debt.payment, debt.balance);
        });
      } else {
        var available = pool;

        open().forEach(function (debt) {
          var paid = Math.min(debt.minimum, debt.balance);
          debt.balance -= paid;
          available -= paid;
        });

        open().sort(function (a, b) {
          return strategy === "avalanche" ?
            b.apr - a.apr || a.balance - b.balance :
            a.balance - b.balance || b.apr - a.apr;
        }).forEach(function (debt) {
          var extra = Math.min(Math.max(0, available), debt.balance);
          debt.balance -= extra;
          available -= extra;
        });
      }

      debts.forEach(function (debt) {
        if (debt.balance <= 0.005 && !debt.paidOffMonth) {
          debt.balance = 0;
          debt.paidOffMonth = month;
        }
      });

      totals.push(debts.reduce(function (sum, debt) {
        return sum + debt.balance;
      }, 0));
    }

    return {
      months: open().length ? null : month,
      totals: totals,
      interest: totalInterest,
      debts: debts
    };
  };

  APP.controller.renderDebtPaydown = function (root, key, visual) {
    var plan = APP.controller.debtPlan();
    var confirmed = APP.model.debts().active.reduce(function (sum, debt) {
      return sum + APP.utils.money(debt.confirmedBalance);
    }, 0);

    if (!confirmed) {
      APP.charts.message(root, "Add debt accounts with a confirmed balance to track payoff.");
      return;
    }

    var left = plan.reduce(function (sum, item) {
      return sum + item.balance;
    }, 0);
    var paidDown = Math.max(0, confirmed - left);
    var monthlyInterest = plan.reduce(function (sum, item) {
      return sum + item.balance * item.apr / 1200;
    }, 0);
    var payments = plan.reduce(function (sum, item) {
      return sum + item.payment;
    }, 0);
    var simulation = APP.controller.simulatePayoff(plan, "avalanche");
    var debtFree = !left ?
      "Debt free!" :
      simulation.months ?
        "Debt-free estimate: " + APP.controller.monthName(
          APP.controller.shiftMonth(APP.utils.month(new Date()), simulation.months)
        ) + " at your current payments." :
        "At current payments these balances won't be paid off. Raising payments above the interest is the first step.";

    var stats = APP.charts.statRow([
      ["Left to pay", APP.utils.currency(left)],
      ["Interest / month", APP.utils.currency(monthlyInterest)],
      ["Paying / month", APP.utils.currency(payments)]
    ]);

    var options = {
      valueText: APP.utils.currency(paidDown) + " paid down",
      detailText: Math.round(paidDown / confirmed * 100) + "% of " +
        APP.utils.currency(confirmed) + " since balances were confirmed",
      note: debtFree,
      extra: stats,
      color: APP.charts.flow.debt
    };

    if (visual.chartType === "gauge") {
      APP.charts.gauge(root, key, paidDown, confirmed, APP.charts.flow.debt, options);
    } else {
      APP.charts.progress(root, paidDown, confirmed, "Debt paid down", options);
    }
  };

  APP.controller.renderDebtBalances = function (root, key, visual, selectedMonth) {
    var months = APP.controller.timelineMonths(visual.timelineMode, selectedMonth);
    var currentMonth = APP.utils.month(new Date());
    var debts = APP.model.debts().active;

    if (!debts.length) {
      APP.charts.message(root, "Add debt accounts to see balances over time.");
      return;
    }

    // A balance is only known from the month it was confirmed through the current month.
    var series = debts.map(function (debt) {
      var from = String(debt.balanceAsOfDate || "").slice(0, 7);

      return {
        id: debt.id,
        label: debt.name,
        values: months.map(function (month) {
          if (month < from || month > currentMonth) {
            return null;
          }

          var through = month === currentMonth ?
            APP.utils.isoDate(new Date()) :
            APP.controller.monthEnd(month);

          return APP.model.debtProjection(debt.id, through).projectedBalance;
        })
      };
    });

    var totals = months.map(function (month, index) {
      var known = series.filter(function (item) {
        return item.values[index] !== null;
      });

      return known.length ? known.reduce(function (sum, item) {
        return sum + item.values[index];
      }, 0) : null;
    });

    var byDebt = visual.aggregationMode === "byCategory" && series.length > 1;
    var isArea = visual.chartType === "area";
    var datasets = [{
      label: byDebt ? "Total" : "Total debt",
      data: totals,
      borderColor: byDebt ? APP.charts.totalColor : APP.charts.flow.debt,
      backgroundColor: byDebt ?
        APP.charts.alpha(APP.charts.totalColor, 0) :
        APP.charts.alpha(APP.charts.flow.debt, 0.14),
      borderDash: byDebt ? [6, 4] : [],
      fill: isArea && !byDebt ? "origin" : false,
      pointRadius: 3,
      spanGaps: false,
      order: 0
    }];

    if (byDebt) {
      APP.charts.limitSeries(series).forEach(function (item) {
        datasets.push({
          label: item.label,
          data: item.values,
          borderColor: item.color,
          backgroundColor: isArea ? APP.charts.alpha(item.color, 0.12) : item.color,
          fill: isArea ? "origin" : false,
          pointRadius: 3,
          order: 1
        });
      });
    }

    var options = APP.controller.chartOptions(visual, false, isArea);
    options.plugins.tooltip.itemSort = function (a, b) {
      return b.raw - a.raw;
    };

    APP.charts.chart(root, key, {
      type: "line",
      data: { labels: APP.controller.monthLabels(months), datasets: datasets },
      options: options
    });
  };

  APP.controller.renderDebtInterest = function (root, key, visual, selectedMonth) {
    var months = APP.controller.timelineMonths(visual.timelineMode, selectedMonth);
    var currentMonth = APP.utils.month(new Date());
    var debts = APP.model.debts().active;

    var interest = months.map(function (month) {
      if (month > currentMonth) {
        return 0;
      }

      var startOfMonth = APP.controller.monthEnd(APP.controller.shiftMonth(month, -1));

      return debts.reduce(function (sum, debt) {
        if (month < String(debt.balanceAsOfDate || "").slice(0, 7)) {
          return sum;
        }

        var balance = APP.model.debtProjection(debt.id, startOfMonth).projectedBalance;
        return sum + balance * APP.utils.money(debt.apr) / 1200;
      }, 0);
    });

    var payments = APP.controller.monthlyTotals(visual, months).map(function (item) {
      return item.debt;
    });

    // Payments cover the month's interest first; only the rest reduces the balance.
    var interestPaid = payments.map(function (paid, index) {
      return Math.min(paid, interest[index]);
    });
    var principal = payments.map(function (paid, index) {
      return Math.max(0, paid - interest[index]);
    });

    if (!payments.some(Boolean)) {
      APP.charts.message(root, "No debt payments in this period yet.");
      return;
    }

    var options = APP.controller.chartOptions(visual, true, false);
    options.plugins.tooltip.callbacks.footer = function (items) {
      var index = items[0].dataIndex;
      return "Total paid: " + APP.utils.currency(payments[index]);
    };

    APP.charts.chart(root, key, {
      type: "bar",
      data: {
        labels: APP.controller.monthLabels(months),
        datasets: [
          {
            label: "Principal (paid down)",
            data: principal,
            backgroundColor: APP.charts.flow.debt,
            borderColor: APP.charts.surface,
            borderWidth: { top: 2 },
            borderRadius: 0,
            borderSkipped: false
          },
          {
            label: "Interest (estimated)",
            data: interestPaid,
            backgroundColor: APP.charts.status.warning,
            borderColor: APP.charts.surface,
            borderWidth: { top: 2 },
            borderRadius: 0,
            borderSkipped: false
          }
        ]
      },
      options: options
    });
  };

  APP.controller.renderDebtPayoffRows = function (root) {
    var plan = APP.controller.debtPlan();
    var simulation = APP.controller.simulatePayoff(plan, "each");
    var currentMonth = APP.utils.month(new Date());

    var items = plan.map(function (item, index) {
      var result = simulation.debts[index];

      return {
        label: item.name,
        balance: item.balance,
        apr: item.apr,
        payment: item.payment,
        months: result.paidOffMonth,
        never: !result.paidOffMonth,
        interest: result.interest,
        payoffLabel: result.paidOffMonth ?
          APP.controller.monthName(APP.controller.shiftMonth(currentMonth, result.paidOffMonth)) :
          ""
      };
    }).sort(function (a, b) {
      return (a.never ? Infinity : a.months) - (b.never ? Infinity : b.months);
    });

    APP.charts.payoffRows(root, items);
  };

  APP.controller.renderDebtStrategy = function (root, key, visual) {
    var plan = APP.controller.debtPlan();

    if (!plan.length) {
      APP.charts.message(root, "Add debt accounts with balances to compare payoff strategies.");
      return;
    }

    var currentMonth = APP.utils.month(new Date());
    var avalanche = APP.controller.simulatePayoff(plan, "avalanche");
    var snowball = APP.controller.simulatePayoff(plan, "snowball");
    var minimums = APP.controller.simulatePayoff(plan, "minimums");
    var start = plan.reduce(function (sum, item) {
      return sum + item.balance;
    }, 0);

    var length = Math.max(
      avalanche.totals.length,
      snowball.totals.length,
      Math.min(minimums.totals.length, Math.max(avalanche.totals.length, snowball.totals.length) * 2)
    );

    function line(result) {
      var values = [start];

      for (var index = 0; index < length; index += 1) {
        values.push(index < result.totals.length ? result.totals[index] : 0);
      }

      return values;
    }

    function finish(result) {
      return result.months ?
        APP.controller.monthName(APP.controller.shiftMonth(currentMonth, result.months)) :
        "Never";
    }

    var saved = snowball.interest - avalanche.interest;
    var wrap = APP.dom.el("div", "strategy-visual");

    wrap.appendChild(APP.charts.statRow([
      ["Avalanche (highest APR first)", finish(avalanche), APP.utils.currency(avalanche.interest) + " interest"],
      ["Snowball (smallest balance first)", finish(snowball), APP.utils.currency(snowball.interest) + " interest"],
      ["Minimums only", finish(minimums), minimums.months ?
        APP.utils.currency(minimums.interest) + " interest" :
        "Minimums don't cover interest"]
    ]));

    wrap.appendChild(APP.dom.el("p", "progress-note", Math.abs(saved) < 1 ?
      "Both strategies cost about the same here; snowball's quick wins may be worth it." :
      (saved > 0 ?
        "Avalanche saves about " + APP.utils.currency(saved) + " in interest versus snowball." :
        "Snowball saves about " + APP.utils.currency(-saved) + " in interest here.") +
      " Both use your current total of " + APP.utils.currency(plan.reduce(function (sum, item) {
        return sum + item.payment;
      }, 0)) + "/month."));

    var chartBox = APP.dom.el("div", "strategy-chart");
    wrap.appendChild(chartBox);
    APP.dom.clear(root);
    root.appendChild(wrap);

    var labels = [];
    for (var index = 0; index <= length; index += 1) {
      labels.push(APP.controller.monthName(APP.controller.shiftMonth(currentMonth, index)));
    }

    var options = APP.controller.chartOptions(visual, false, false);
    options.scales.x.ticks = { maxTicksLimit: 8, maxRotation: 0 };

    APP.charts.chart(chartBox, key, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Avalanche",
            data: line(avalanche),
            borderColor: APP.charts.flow.debt,
            backgroundColor: APP.charts.flow.debt,
            order: 0
          },
          {
            label: "Snowball",
            data: line(snowball),
            borderColor: APP.charts.flow.spending,
            backgroundColor: APP.charts.flow.spending,
            order: 1
          },
          {
            label: "Minimums only",
            data: line(minimums),
            borderColor: APP.charts.otherColor,
            backgroundColor: APP.charts.otherColor,
            borderDash: [6, 4],
            order: 2
          }
        ]
      },
      options: options
    });
  };

  APP.controller.renderSavingsRings = function (root, visual, selectedMonth) {
    // Funds with no goal and no money yet are left out so they don't crowd the grid.
    var funds = APP.analytics.savingsFunds(selectedMonth).filter(function (fund) {
      return !fund.category.archived &&
        (fund.eventualGoal > 0 || fund.monthlyGoal > 0 || fund.balance > 0) &&
        (visual.categoryScope !== "selected" ||
          visual.categoryIds.indexOf(fund.category.id) !== -1);
    });

    APP.charts.rings(root, funds.map(function (fund) {
      var hasGoal = fund.eventualGoal > 0;
      var monthlyOnly = !hasGoal && fund.monthlyGoal > 0;

      return {
        label: fund.category.name,
        current: monthlyOnly ? fund.deposits : fund.balance,
        target: hasGoal ? fund.eventualGoal : fund.monthlyGoal,
        detail: hasGoal ?
          (fund.balance >= fund.eventualGoal ?
            "Goal reached" :
            fund.estimatedCompletionMonth ?
              "On track for " + APP.controller.monthName(fund.estimatedCompletionMonth) :
              "Set a monthly goal to get a date") :
          monthlyOnly ? "This month's contribution goal" : "Set a goal in Savings & Goals"
      };
    }), "Add savings funds in Savings & Goals to track their progress.");
  };

  APP.controller.renderSavingsVsGoal = function (root, visual, selectedMonth) {
    var funds = APP.analytics.savingsFunds(selectedMonth).filter(function (fund) {
      return !fund.category.archived &&
        (fund.monthlyGoal > 0 || fund.deposits > 0) &&
        (visual.categoryScope !== "selected" ||
          visual.categoryIds.indexOf(fund.category.id) !== -1);
    });

    APP.charts.budgetRows(root, funds.map(function (fund) {
      return {
        label: fund.category.name,
        spent: fund.deposits,
        budget: fund.monthlyGoal,
        kind: "savings"
      };
    }), "Set monthly savings goals in Monthly Plan to track contributions.");
  };

  APP.controller.renderSavingsRate = function (root, key, visual, selectedMonth) {
    var months = APP.controller.timelineMonths(visual.timelineMode, selectedMonth);
    var totals = APP.controller.monthlyTotals({ categoryScope: "all" }, months);
    var rates = totals.map(function (item) {
      return item.income > 0 ? item.savings / item.income * 100 : null;
    });
    var known = rates.filter(function (value) {
      return value !== null;
    });
    var average = known.length ? known.reduce(function (sum, value) {
      return sum + value;
    }, 0) / known.length : 0;

    var options = APP.controller.chartOptions(visual, false, visual.chartType === "area");
    options.scales.y.ticks.callback = function (value) {
      return value + "%";
    };
    options.plugins.tooltip.callbacks.label = function (context) {
      return " " + context.dataset.label + ": " + (context.raw === null ? "no income" :
        APP.utils.money(context.raw).toFixed(1) + "%");
    };

    APP.charts.chart(root, key, {
      type: "line",
      data: {
        labels: APP.controller.monthLabels(months),
        datasets: [
          {
            label: "Savings rate",
            data: rates,
            borderColor: APP.charts.flow.savings,
            backgroundColor: APP.charts.alpha(APP.charts.flow.savings, 0.14),
            fill: visual.chartType === "area" ? "origin" : false,
            pointRadius: 3,
            order: 0
          },
          {
            label: "Average " + average.toFixed(1) + "%",
            data: months.map(function () {
              return average;
            }),
            borderColor: APP.charts.otherColor,
            backgroundColor: APP.charts.otherColor,
            borderDash: [6, 4],
            borderWidth: 1.5,
            order: 1
          }
        ]
      },
      options: options
    });
  };

  APP.controller.renderYearOverYear = function (root, key, visual, selectedMonth) {
    var year = Number(selectedMonth.slice(0, 4));
    var thisYear = APP.controller.calendarYearMonths(String(year));
    var lastYear = APP.controller.calendarYearMonths(String(year - 1));
    var currentMonth = APP.utils.month(new Date());
    var current = APP.controller.monthlyTotals(visual, thisYear).map(function (item) {
      return item.month > currentMonth ? null : item.operating;
    });
    var previous = APP.controller.monthlyTotals(visual, lastYear).map(function (item) {
      return item.operating;
    });

    var options = APP.controller.chartOptions(visual, false, visual.chartType === "area");

    options.plugins.tooltip.callbacks.footer = function (items) {
      var index = items[0].dataIndex;

      if (current[index] === null || !previous[index]) {
        return "";
      }

      var change = (current[index] - previous[index]) / previous[index] * 100;
      return (change >= 0 ? "+" : "") + change.toFixed(0) + "% vs. last year";
    };

    APP.charts.chart(root, key, {
      type: "line",
      data: {
        labels: APP.controller.monthLabels(thisYear),
        datasets: [
          {
            label: String(year),
            data: current,
            borderColor: APP.charts.flow.spending,
            backgroundColor: APP.charts.alpha(APP.charts.flow.spending, 0.12),
            fill: visual.chartType === "area" ? "origin" : false,
            pointRadius: 3,
            borderWidth: 2.5,
            order: 0
          },
          {
            label: String(year - 1),
            data: previous,
            borderColor: APP.charts.otherColor,
            backgroundColor: APP.charts.otherColor,
            pointRadius: 3,
            order: 1
          }
        ]
      },
      options: options
    });
  };

  APP.controller.customRenderers = {
    debt_total_paydown: function (root, key, visual) {
      APP.controller.renderDebtPaydown(root, key, visual);
    },
    debt_balance_trend: function (root, key, visual, month) {
      APP.controller.renderDebtBalances(root, key, visual, month);
    },
    debt_interest_vs_principal: function (root, key, visual, month) {
      APP.controller.renderDebtInterest(root, key, visual, month);
    },
    debt_payoff_timeline: function (root) {
      APP.controller.renderDebtPayoffRows(root);
    },
    debt_strategy_comparison: function (root, key, visual) {
      APP.controller.renderDebtStrategy(root, key, visual);
    },
    savings_fund_rings: function (root, key, visual, month) {
      APP.controller.renderSavingsRings(root, visual, month);
    },
    savings_contribution_vs_goal: function (root, key, visual, month) {
      APP.controller.renderSavingsVsGoal(root, visual, month);
    },
    savings_rate_trend: function (root, key, visual, month) {
      APP.controller.renderSavingsRate(root, key, visual, month);
    },
    year_over_year_spending: function (root, key, visual, month) {
      APP.controller.renderYearOverYear(root, key, visual, month);
    },
    monthly_spending_pace: function (root, key, visual, month) {
      APP.controller.renderSpendingPace(root, key, visual, month);
    },
    category_budget_status: function (root, key, visual, month) {
      APP.controller.renderCategoryBudgets(root, visual, month);
    }
  };

  // Which inline switches each custom visual responds to. Topics not listed here use the
  // chart-type defaults in createVisualControls.
  APP.controller.customControls = {
    debt_total_paydown: {},
    debt_balance_trend: { aggregation: true },
    debt_interest_vs_principal: {},
    debt_payoff_timeline: {},
    debt_strategy_comparison: {},
    savings_fund_rings: { scope: true },
    savings_contribution_vs_goal: { scope: true },
    savings_rate_trend: {},
    year_over_year_spending: { scope: true },
    monthly_spending_pace: { scope: true },
    category_budget_status: { scope: true },
    monthly_spending_vs_budget: {},
    monthly_budget_completion: {}
  };

  // Custom visuals whose content is a list or grid that sizes itself.
  APP.controller.fitContentTopics = [
    "category_budget_status",
    "debt_payoff_timeline",
    "debt_strategy_comparison",
    "savings_fund_rings",
    "savings_contribution_vs_goal"
  ];

  APP.controller.renderVisual = function (
    root,
    savedVisual,
    selectedMonth
  ) {
    var visual = APP.controller.effectiveVisual(savedVisual);
    var key = visual.id;

    if (APP.controller.customRenderers[visual.topic]) {
      APP.controller.customRenderers[visual.topic](root, key, visual, selectedMonth);
      return;
    }

    if ([
      "income_trend",
      "operating_spending_trend",
      "total_outflow_trend",
      "net_cash_flow_trend",
      "savings_contribution_trend",
      "cumulative_operating_spending",
      "cumulative_savings_growth",
      "savings_balance_trend"
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
      "monthly_spending_vs_budget",
      "savings_monthly_completion",
      "savings_eventual_completion",
      "savings_goal_completion",
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

    // Only offer the switches a visual actually responds to.
    var type = savedVisual.chartType;
    var topic = savedVisual.topic;
    var custom = APP.controller.customControls[topic];

    var usesDisplay = custom ? Boolean(custom.display) : [
      "line", "area", "bar", "pie", "doughnut", "stackedBar", "sankey"
    ].indexOf(type) !== -1;

    var usesAggregation = custom ? Boolean(custom.aggregation) : (
      ["line", "area", "scatter", "waterfall", "sankey"].indexOf(type) !== -1 ||
      topic === "income_vs_outflow"
    ) && topic !== "net_cash_flow_trend";

    var usesScope = custom ? Boolean(custom.scope) : [
      "gauge", "progress"
    ].indexOf(type) === -1;

    if (usesDisplay) {
      controls.appendChild(valueMode);
    }

    if (usesAggregation) {
      controls.appendChild(aggregation);
    }

    if (usesScope) {
      controls.appendChild(categoryMode);
      controls.appendChild(chooseCategories);
    }

    if (!controls.children.length) {
      return;
    }

    controls.appendChild(saveDefault);
    toolbarRoot.appendChild(controls);
  };
  APP.controller.dashboardCustomizeMode = false;

  APP.controller.setDashboardTab = function (tabId) {
    APP.state.settings.activeDashboardTab = tabId;
    APP.store.save();
    APP.controller.renderDashboard();
  };

  APP.controller.renderDashboardTabs = function (activeTab) {
    var bar = APP.dom.el("div", "dashboard-tabs");
    var tabs = APP.pages.visuals.tabs();

    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Dashboard tabs");

    tabs.forEach(function (tab, index) {
      var count = APP.state.settings.dashboardVisuals.filter(function (visual) {
        return visual.tabId === tab.id && visual.visible;
      }).length;

      var button = APP.dom.el("button", "dashboard-tab" + (tab.id === activeTab.id ? " active" : ""));
      button.type = "button";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", tab.id === activeTab.id ? "true" : "false");
      button.tabIndex = tab.id === activeTab.id ? 0 : -1;
      button.appendChild(APP.dom.el("span", "", tab.name));
      button.appendChild(APP.dom.el("small", "", String(count)));

      button.addEventListener("click", function () {
        APP.controller.setDashboardTab(tab.id);
      });

      button.addEventListener("keydown", function (event) {
        var step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;

        if (!step) {
          return;
        }

        event.preventDefault();
        APP.controller.setDashboardTab(tabs[(index + step + tabs.length) % tabs.length].id);

        var next = document.querySelector(".dashboard-tab.active");
        if (next) {
          next.focus();
        }
      });

      bar.appendChild(button);
    });

    if (APP.controller.dashboardCustomizeMode) {
      var add = APP.dom.el("button", "dashboard-tab dashboard-tab-add", "+ Tab");
      add.type = "button";
      add.title = "Add a tab";

      add.addEventListener("click", function () {
        var tab = { id: APP.utils.id("tab"), name: "New tab", preset: "" };

        APP.state.settings.dashboardTabs.push(tab);
        APP.state.settings.activeDashboardTab = tab.id;
        APP.store.log("success", "Added dashboard tab.");
        APP.controller.commit();

        var input = document.querySelector(".tab-editor input");
        if (input) {
          input.focus();
          input.select();
        }
      });

      bar.appendChild(add);
    }

    return bar;
  };

  // Rename, reorder and delete controls for the active tab, shown in customize mode.
  APP.controller.renderTabEditor = function (activeTab) {
    var tabs = APP.state.settings.dashboardTabs;
    var index = tabs.indexOf(activeTab);
    var editor = APP.dom.el("div", "tab-editor");
    var label = APP.dom.el("label", "tab-editor-name");
    var name = APP.dom.el("input");

    label.appendChild(APP.dom.el("span", "", "Tab name"));
    name.value = activeTab.name;
    name.maxLength = 40;
    label.appendChild(name);

    name.addEventListener("change", function () {
      activeTab.name = APP.utils.text(name.value) || activeTab.name;
      APP.store.log("success", "Renamed dashboard tab to " + activeTab.name + ".");
      APP.controller.commit();
    });

    name.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        name.blur();
      }
    });

    function move(offset) {
      var target = index + offset;

      if (target < 0 || target >= tabs.length) {
        return;
      }

      tabs.splice(index, 1);
      tabs.splice(target, 0, activeTab);
      APP.controller.commit();
    }

    var left = APP.ui.button("← Move left", "button-quiet");
    var right = APP.ui.button("Move right →", "button-quiet");
    var remove = APP.ui.button("Delete tab", "button-quiet danger");

    left.disabled = index === 0;
    right.disabled = index === tabs.length - 1;
    remove.disabled = tabs.length === 1;
    left.addEventListener("click", function () {
      move(-1);
    });
    right.addEventListener("click", function () {
      move(1);
    });

    remove.addEventListener("click", function () {
      var fallback = tabs[index === 0 ? 1 : 0];
      var moving = APP.state.settings.dashboardVisuals.filter(function (visual) {
        return visual.tabId === activeTab.id;
      });

      if (!window.confirm(
        "Delete the \"" + activeTab.name + "\" tab?" + (moving.length ?
          " Its " + moving.length + " visual(s) will move to \"" + fallback.name + "\"." :
          "")
      )) {
        return;
      }

      moving.forEach(function (visual) {
        visual.tabId = fallback.id;
      });

      APP.state.settings.dashboardTabs = tabs.filter(function (tab) {
        return tab.id !== activeTab.id;
      });
      APP.state.settings.activeDashboardTab = fallback.id;
      APP.store.log("success", "Deleted dashboard tab " + activeTab.name + ".");
      APP.controller.commit();
    });

    editor.appendChild(label);
    editor.appendChild(left);
    editor.appendChild(right);
    editor.appendChild(remove);

    return editor;
  };

  APP.controller.moveToTabSelect = function (visual) {
    var select = APP.dom.el("select", "visual-control-select visual-move-select");

    select.title = "Move this visual to another tab";
    select.appendChild(APP.dom.el("option", "", "Move to…"));
    select.options[0].value = "";

    APP.pages.visuals.tabs().forEach(function (tab) {
      if (tab.id === visual.tabId) {
        return;
      }

      var option = APP.dom.el("option", "", tab.name);
      option.value = tab.id;
      select.appendChild(option);
    });

    select.addEventListener("change", function () {
      if (!select.value) {
        return;
      }

      visual.tabId = select.value;
      APP.store.log("success", "Moved " + visual.title + " to another tab.");
      APP.controller.commit();
    });

    return select;
  };

  APP.controller.emptyTabCard = function (tab) {
    var card = APP.dom.el("article", "panel visual-card wide dashboard-empty");
    var actions = APP.dom.el("div", "button-row");
    var add = APP.ui.button("+ Add visual", "button-primary");

    card.appendChild(APP.dom.el("h3", "", tab.name + " has no visuals yet"));
    card.appendChild(APP.dom.el("p", "muted",
      "Add a visual here, or move one from another tab using Customize dashboard."));

    add.addEventListener("click", function () {
      APP.pages.visuals.openModal();
    });
    actions.appendChild(add);

    if (APP.pages.visuals.recommendedVisuals(tab.preset).length) {
      var recommended = APP.ui.button("Add recommended visuals");

      recommended.addEventListener("click", function () {
        APP.pages.visuals.addRecommended(tab.id);
        APP.controller.commit();
      });

      actions.appendChild(recommended);
    }

    card.appendChild(actions);
    return card;
  };

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

    var monthBudget = APP.model.budget(month, false);
    var pace = APP.controller.budgetPace(month);
    var savingsGoal = APP.analytics.savingsFunds(month).reduce(function (sum, fund) {
      return sum + fund.monthlyGoal;
    }, 0);
    var debtBalance = APP.analytics.debts().reduce(function (sum, item) {
      return sum + Math.max(0, APP.utils.money(item.projectedBalance));
    }, 0);

    function percentOf(value, base) {
      return base > 0 ? Math.round(value / base * 100) + "%" : "";
    }

    // Tones say whether a number is good news, not what kind of money it is: debt payments
    // are progress, and spending only turns red once it is over budget.
    [
      [
        "Total income",
        totals.income,
        "success",
        monthBudget.expectedIncome ?
          percentOf(totals.income, monthBudget.expectedIncome) + " of " +
            APP.charts.compact(monthBudget.expectedIncome) + " expected" :
          ""
      ],
      [
        "Operating spending",
        totals.operating,
        pace.budget && totals.operating > pace.budget ? "danger" : "",
        pace.budget ?
          percentOf(totals.operating, pace.budget) + " of " +
            APP.charts.compact(pace.budget) + " budget" :
          ""
      ],
      [
        "Savings contributions",
        totals.savingsContributions,
        "success",
        savingsGoal ?
          percentOf(totals.savingsContributions, savingsGoal) + " of " +
            APP.charts.compact(savingsGoal) + " goal" :
          ""
      ],
      [
        "Debt payments",
        totals.debtPayments,
        "paydown",
        debtBalance ? APP.charts.compact(debtBalance) + " left to pay off" : ""
      ],
      [
        "Total cash outflow",
        totals.cashOutflow,
        "",
        totals.income ? percentOf(totals.cashOutflow, totals.income) + " of income" : ""
      ],
      [
        "Net cash flow",
        totals.netCashFlow,
        totals.netCashFlow < 0 ? "danger" : "success",
        totals.income ?
          (totals.netCashFlow < 0 ? "Spent more than earned" :
            percentOf(totals.netCashFlow, totals.income) + " of income kept") :
          ""
      ]
    ].forEach(function (item) {
      summaryRoot.appendChild(
        APP.ui.currencyCard(item[0], item[1], item[2], item[3])
      );
    });

    APP.pages.visuals.ensureTabs();

    var activeTab = APP.pages.visuals.activeTab();
    var customizing = APP.controller.dashboardCustomizeMode;

    toolbarRoot.classList.toggle("dashboard-customizing", customizing);
    toolbarRoot.appendChild(APP.controller.renderDashboardTabs(activeTab));

    visuals = visuals.filter(function (visual) {
      return visual.tabId === activeTab.id;
    });

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

    if (APP.controller.dashboardCustomizeMode) {
      var recommended = APP.ui.button(
        "Add recommended visuals",
        "button-secondary"
      );

      recommended.addEventListener("click", function () {
        var added = APP.pages.visuals.addRecommended(activeTab.id);

        APP.dom.toast(
          added ?
            "Added " + added + " recommended visual(s) to the top of " + activeTab.name + "." :
            "All recommended visuals for this tab are already here.",
          "success"
        );

        APP.controller.commit();
      });

      // Only the built-in tabs come with recommendations.
      if (APP.pages.visuals.recommendedVisuals(activeTab.preset).length) {
        toolbarRoot.appendChild(recommended);
      }
    }

    toolbarRoot.appendChild(customize);

    if (customizing) {
      toolbarRoot.appendChild(APP.controller.renderTabEditor(activeTab));
    }

    if (!visuals.length) {
      visualsRoot.appendChild(APP.controller.emptyTabCard(activeTab));
    }

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

        cardActions.appendChild(APP.controller.moveToTabSelect(visual));
        cardActions.appendChild(up);
        cardActions.appendChild(down);
        cardActions.appendChild(resize);
        cardActions.appendChild(remove);
      }

      card.appendChild(APP.ui.panelHeader(
        visual.title,
        APP.pages.visuals.topicLabel(visual),
        cardActions
      ));

      APP.controller.createVisualControls(
        visual,
        card
      );

      var chartRoot = APP.dom.el("div", "visual-chart-area");
      var fitsContent = [
        "heatmap",
        "calendarHeatmap",
        "progress"
      ].indexOf(visual.chartType) !== -1 ||
        APP.controller.fitContentTopics.indexOf(visual.topic) !== -1;

      // Canvas charts need a fixed height; DOM visuals size to their content.
      if (fitsContent) {
        chartRoot.classList.add("visual-chart-fit");
      } else if (visual.chartType === "sankey") {
        chartRoot.style.height = visual.height === "tall" ? "560px" : "440px";
      } else if (visual.chartType === "gauge") {
        chartRoot.style.height = visual.height === "tall" ? "420px" : "300px";
      } else {
        chartRoot.style.height = visual.height === "tall" ? "470px" : "260px";
      }

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

    // Layout version 3 introduced dashboard tabs: existing visuals are sorted onto the tab
    // matching their topic, then each built-in tab gets any recommended visuals it lacks.
    APP.pages.visuals.ensureTabs();

    if ((APP.state.settings.dashboardLayoutVersion || 1) < 3) {
      APP.pages.visuals.tabs().forEach(function (tab) {
        APP.pages.visuals.addRecommended(tab.id);
      });

      APP.state.settings.dashboardLayoutVersion = 3;
    }

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