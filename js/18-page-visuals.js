(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.visuals = {};

  APP.pages.visuals.profiles = {
    line: {
      topics: [
        ["monthly_spending_pace", "Spending pace this month vs. budget"],
        ["year_over_year_spending", "Spending this year vs. last year"],
        ["savings_rate_trend", "Savings rate (% of income)"],
        ["debt_balance_trend", "Debt balances over time"],
        ["debt_strategy_comparison", "Debt payoff: avalanche vs. snowball"],
        ["income_trend", "Income trend"],
        ["operating_spending_trend", "Operating-spending trend"],
        ["total_outflow_trend", "Total cash-outflow trend"],
        ["net_cash_flow_trend", "Net-cash-flow trend"],
        ["savings_contribution_trend", "Savings-contribution trend"],
        ["savings_balance_trend", "Savings-fund balance growth"]
      ],
      timelines: [
        ["daily_selected_month", "Daily view for selected month"],
        ["calendar_year_monthly", "Month-by-month for selected year"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["rolling_12_months", "Rolling 12 months"]
      ],
      categories: "multiple"
    },

    bar: {
      topics: [
        ["category_budget_status", "Budget vs. actual by category"],
        ["savings_contribution_vs_goal", "Savings contributions vs. monthly goal"],
        ["debt_payoff_timeline", "Estimated payoff date by debt"],
        ["income_vs_outflow", "Income versus cash outflow"],
        ["monthly_totals", "Monthly totals"],
        ["operating_category_comparison", "Operating spending by category"],
        ["savings_fund_comparison", "Savings contributions by fund"],
        ["debt_category_comparison", "Debt payments by category"]
      ],
      timelines: [
        ["daily_selected_month", "Daily view for selected month"],
        ["selected_month", "Selected reporting month"],
        ["calendar_year_monthly", "Month-by-month for selected year"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["rolling_12_months", "Rolling 12 months"]
      ],
      categories: "multiple"
    },

    pie: {
      topics: [
        ["operating_category_allocation", "Operating spending allocation"],
        ["savings_fund_allocation", "Savings allocation by fund"],
        ["debt_payment_allocation", "Debt-payment allocation"],
        ["total_outflow_allocation", "Total cash-outflow allocation"]
      ],
      timelines: [
        ["selected_month", "Selected reporting month"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["rolling_12_months", "Rolling 12 months"],
        ["calendar_year_monthly", "Selected calendar year"]
      ],
      categories: "multiple"
    },

    doughnut: {
      topics: [
        ["operating_category_allocation", "Operating spending allocation"],
        ["savings_fund_allocation", "Savings allocation by fund"],
        ["debt_payment_allocation", "Debt-payment allocation"],
        ["total_outflow_allocation", "Total cash-outflow allocation"]
      ],
      timelines: [
        ["selected_month", "Selected reporting month"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["rolling_12_months", "Rolling 12 months"],
        ["calendar_year_monthly", "Selected calendar year"]
      ],
      categories: "multiple"
    },

    stackedBar: {
      topics: [
        ["operating_category_stacked", "Operating spending categories by month"],
        ["savings_fund_stacked", "Savings-fund contributions by month"],
        ["cash_outflow_stacked", "Cash-outflow allocation by month"],
        ["debt_interest_vs_principal", "Debt payments: interest vs. principal"]
      ],
      timelines: [
        ["calendar_year_monthly", "Month-by-month for selected year"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["rolling_12_months", "Rolling 12 months"]
      ],
      categories: "multiple"
    },

    area: {
      topics: [
        ["monthly_spending_pace", "Spending pace this month vs. budget"],
        ["year_over_year_spending", "Spending this year vs. last year"],
        ["savings_rate_trend", "Savings rate (% of income)"],
        ["debt_balance_trend", "Debt balances over time"],
        ["income_trend", "Income trend"],
        ["operating_spending_trend", "Operating-spending trend"],
        ["net_cash_flow_trend", "Net-cash-flow trend"],
        ["savings_contribution_trend", "Savings-contribution trend"],
        ["cumulative_savings_growth", "Cumulative savings growth"],
        ["cumulative_operating_spending", "Cumulative operating spending"]
      ],
      timelines: [
        ["daily_selected_month", "Daily view for selected month"],
        ["calendar_year_monthly", "Month-by-month for selected year"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["rolling_12_months", "Rolling 12 months"]
      ],
      categories: "multiple"
    },

    scatter: {
      topics: [
        ["transaction_amount_by_day", "Transaction amount by day"],
        ["transaction_amount_sequence", "Transaction amount by transaction sequence"],
        ["daily_spending_frequency", "Daily spending total versus transaction count"],
        ["category_transaction_patterns", "Category transaction patterns"]
      ],
      timelines: [
        ["daily_selected_month", "Selected reporting month"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["rolling_12_months", "Rolling 12 months"]
      ],
      categories: "multiple"
    },

    heatmap: {
      topics: [
        ["operating_category_heatmap", "Operating spending by category and month"],
        ["savings_fund_heatmap", "Savings contributions by fund and month"],
        ["debt_category_heatmap", "Debt payments by category and month"]
      ],
      timelines: [
        ["rolling_6_months", "Last 6 months"],
        ["rolling_12_months", "Last 12 months"],
        ["calendar_year_monthly", "Selected calendar year"]
      ],
      categories: "multiple"
    },

    calendarHeatmap: {
      topics: [
        ["daily_operating_spending", "Daily operating spending"],
        ["daily_savings_contributions", "Daily savings contributions"],
        ["daily_cash_outflow", "Daily total cash outflow"],
        ["daily_income", "Daily income"]
      ],
      timelines: [
        ["daily_selected_month", "Selected reporting month"]
      ],
      categories: "multiple"
    },

    progress: {
      topics: [
        ["monthly_spending_vs_budget", "Spending vs. budget this month (spent and left)"],
        ["debt_total_paydown", "Total debt paid down"],
        ["monthly_budget_completion", "Planned budget vs. expected income"],
        ["savings_monthly_completion", "Savings-fund monthly contribution completion"],
        ["savings_eventual_completion", "Savings-fund eventual-goal completion"],
        ["savings_goal_completion", "Savings-goal completion"],
        ["debt_payoff_completion", "Debt payoff progress"]
      ],
      timelines: [
        ["selected_month", "Selected reporting month"],
        ["current_balance", "Current balance or progress"]
      ],
      categories: "single"
    },

    gauge: {
      topics: [
        ["monthly_spending_vs_budget", "Spending vs. budget this month (spent and left)"],
        ["debt_total_paydown", "Total debt paid down"],
        ["savings_fund_rings", "All savings funds: goal progress rings"],
        ["monthly_budget_completion", "Planned budget vs. expected income"],
        ["savings_monthly_completion", "Savings-fund monthly contribution completion"],
        ["savings_eventual_completion", "Savings-fund eventual-goal completion"],
        ["savings_goal_completion", "Savings-goal completion"],
        ["debt_payoff_completion", "Debt payoff progress"]
      ],
      timelines: [
        ["selected_month", "Selected reporting month"],
        ["current_balance", "Current balance or progress"]
      ],
      categories: "single"
    },

    waterfall: {
      topics: [
        ["income_to_net_cash_flow", "Income to net cash flow"],
        ["selected_category_cash_flow", "Income to selected operating categories"]
      ],
      timelines: [
        ["selected_month", "Selected reporting month"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["calendar_year_monthly", "Selected calendar year"]
      ],
      categories: "multiple"
    },

    sankey: {
      topics: [
        ["income_allocation", "Income allocation"],
        ["selected_category_allocation", "Income allocation to selected categories"]
      ],
      timelines: [
        ["selected_month", "Selected reporting month"],
        ["rolling_3_months", "Rolling 3 months"],
        ["rolling_6_months", "Rolling 6 months"],
        ["calendar_year_monthly", "Selected calendar year"]
      ],
      categories: "multiple"
    }
  };

  APP.pages.visuals.topicLabel = function (visual) {
    var profile = APP.pages.visuals.profiles[visual.chartType];
    var match = profile && profile.topics.filter(function (topic) {
      return topic[0] === visual.topic;
    })[0];

    return match ? match[1] : String(visual.topic || "")
      .replace(/_/g, " ")
      .replace(/^\w/, function (letter) {
        return letter.toUpperCase();
      });
  };

  // Topics whose category requirement differs from their chart type's default:
  // "none" needs no category, "multiple" allows any number.
  APP.pages.visuals.topicCategories = {
    monthly_spending_vs_budget: "none",
    monthly_budget_completion: "none",
    debt_total_paydown: "none",
    debt_balance_trend: "none",
    debt_interest_vs_principal: "none",
    debt_payoff_timeline: "none",
    debt_strategy_comparison: "none",
    savings_rate_trend: "none",
    savings_fund_rings: "multiple"
  };

  APP.pages.visuals.categoryMode = function (chartType, topic) {
    return APP.pages.visuals.topicCategories[topic] ||
      APP.pages.visuals.profiles[chartType].categories;
  };

  // Built-in tabs. The preset only decides which recommended visuals a tab offers; names,
  // order and the tabs themselves are the user's to change.
  APP.pages.visuals.tabPresets = [
    ["overview", "Overview"],
    ["spending", "Spending"],
    ["savings", "Savings"],
    ["debt", "Debt"],
    ["trends", "Trends"]
  ];

  APP.pages.visuals.presetForVisual = function (visual) {
    var topic = visual.topic || "";

    if ([
      "monthly_spending_vs_budget",
      "monthly_budget_completion",
      "category_budget_status",
      "income_allocation",
      "selected_category_allocation",
      "income_to_net_cash_flow",
      "selected_category_cash_flow"
    ].indexOf(topic) !== -1) {
      return "overview";
    }

    if (/debt/.test(topic)) {
      return "debt";
    }

    if (/savings/.test(topic)) {
      return "savings";
    }

    if ([
      "income_trend",
      "net_cash_flow_trend",
      "total_outflow_trend",
      "income_vs_outflow",
      "monthly_totals",
      "year_over_year_spending"
    ].indexOf(topic) !== -1 || /rolling_12|calendar_year/.test(visual.timelineMode) &&
      /trend/.test(topic)) {
      return "trends";
    }

    return "spending";
  };

  APP.pages.visuals.tabs = function () {
    return APP.state.settings.dashboardTabs || [];
  };

  APP.pages.visuals.activeTab = function () {
    var tabs = APP.pages.visuals.tabs();

    return tabs.filter(function (tab) {
      return tab.id === APP.state.settings.activeDashboardTab;
    })[0] || tabs[0];
  };

  // Makes sure there is at least one tab, every visual sits on an existing tab, and the
  // active tab exists. Visuals without a tab go to the tab matching their topic.
  APP.pages.visuals.ensureTabs = function () {
    var settings = APP.state.settings;

    if (!Array.isArray(settings.dashboardTabs) || !settings.dashboardTabs.length) {
      settings.dashboardTabs = APP.pages.visuals.tabPresets.map(function (preset) {
        return { id: "tab_" + preset[0], name: preset[1], preset: preset[0] };
      });
    }

    var tabs = settings.dashboardTabs;
    var ids = tabs.map(function (tab) {
      return tab.id;
    });

    (settings.dashboardVisuals || []).forEach(function (visual) {
      if (ids.indexOf(visual.tabId) !== -1) {
        return;
      }

      var preset = APP.pages.visuals.presetForVisual(visual);
      var match = tabs.filter(function (tab) {
        return tab.preset === preset;
      })[0];

      visual.tabId = (match || tabs[0]).id;
    });

    if (ids.indexOf(settings.activeDashboardTab) === -1) {
      settings.activeDashboardTab = tabs[0].id;
    }
  };

  APP.pages.visuals.recommendedVisuals = function (preset) {
    function visual(title, chartType, topic, timelineMode, width, extra) {
      var item = {
        id: APP.utils.id("visual"),
        title: title,
        chartType: chartType,
        topic: topic,
        timelineMode: timelineMode,
        categoryScope: "all",
        categoryIds: [],
        displayMode: "currency",
        aggregationMode: "total",
        width: width,
        height: "normal",
        color: "#d95926",
        visible: true
      };

      Object.keys(extra || {}).forEach(function (name) {
        item[name] = extra[name];
      });

      return item;
    }

    var byCategory = { aggregationMode: "byCategory" };

    var layouts = {
      overview: [
        visual("Spending Budget This Month", "gauge", "monthly_spending_vs_budget", "selected_month", "normal"),
        visual("Budget by Category", "bar", "category_budget_status", "selected_month", "normal"),
        visual("Income Allocation", "sankey", "income_allocation", "selected_month", "wide", {
          aggregationMode: "byCategory",
          height: "tall"
        }),
        visual("Cash Flow This Month", "waterfall", "income_to_net_cash_flow", "selected_month", "wide")
      ],
      spending: [
        visual("Spending Pace", "area", "monthly_spending_pace", "daily_selected_month", "wide"),
        visual("Daily Spending", "calendarHeatmap", "daily_operating_spending", "daily_selected_month", "normal"),
        visual("Where the Money Went", "doughnut", "operating_category_allocation", "selected_month", "normal"),
        visual("Spending This Year", "stackedBar", "operating_category_stacked", "calendar_year_monthly", "wide"),
        visual("Category Heatmap", "heatmap", "operating_category_heatmap", "rolling_6_months", "wide")
      ],
      savings: [
        visual("Savings Goals", "gauge", "savings_fund_rings", "current_balance", "wide"),
        visual("Contributions vs. Goal", "bar", "savings_contribution_vs_goal", "selected_month", "normal"),
        visual("Savings Rate", "line", "savings_rate_trend", "rolling_12_months", "normal"),
        visual("Savings Balances", "line", "savings_balance_trend", "rolling_12_months", "wide", byCategory)
      ],
      debt: [
        visual("Debt Paid Down", "gauge", "debt_total_paydown", "current_balance", "normal"),
        visual("Payoff Dates", "bar", "debt_payoff_timeline", "selected_month", "normal"),
        visual("Avalanche vs. Snowball", "line", "debt_strategy_comparison", "rolling_12_months", "wide"),
        visual("Debt Balances", "line", "debt_balance_trend", "rolling_12_months", "normal", byCategory),
        visual("Interest vs. Principal", "stackedBar", "debt_interest_vs_principal", "rolling_12_months", "normal")
      ],
      trends: [
        visual("Income vs. Outflow", "bar", "income_vs_outflow", "rolling_12_months", "wide"),
        visual("Net Cash Flow", "line", "net_cash_flow_trend", "rolling_12_months", "normal", { color: "#3987e5" }),
        visual("Spending by Category", "area", "operating_spending_trend", "rolling_12_months", "normal", byCategory),
        visual("This Year vs. Last Year", "line", "year_over_year_spending", "calendar_year_monthly", "wide")
      ]
    };

    return layouts[preset] || [];
  };

  APP.pages.visuals.defaultVisuals = function () {
    APP.pages.visuals.ensureTabs();

    return APP.pages.visuals.tabs().reduce(function (list, tab) {
      return list.concat(APP.pages.visuals.recommendedVisuals(tab.preset).map(function (visual) {
        visual.tabId = tab.id;
        return visual;
      }));
    }, []);
  };

  // Puts any recommended visual that a tab does not already have (same chart type, topic
  // and timeline) at the top of that tab, keeping everything else. Returns the number added.
  APP.pages.visuals.addRecommended = function (tabId) {
    var tab = APP.pages.visuals.tabs().filter(function (item) {
      return item.id === tabId;
    })[0];

    if (!tab) {
      return 0;
    }

    var existing = APP.state.settings.dashboardVisuals || [];
    var missing = APP.pages.visuals.recommendedVisuals(tab.preset).filter(function (candidate) {
      return !existing.some(function (visual) {
        return visual.tabId === tab.id &&
          visual.chartType === candidate.chartType &&
          visual.topic === candidate.topic &&
          visual.timelineMode === candidate.timelineMode;
      });
    }).map(function (visual) {
      visual.tabId = tab.id;
      return visual;
    });

    APP.state.settings.dashboardVisuals = missing.concat(existing);
    return missing.length;
  };

  APP.pages.visuals.optionList = function (items) {
    return items.map(function (item) {
      return {
        value: item[0],
        label: item[1]
      };
    });
  };

  APP.pages.visuals.categoryChecklist = function (selectedIds) {
    var container = APP.dom.el("div", "category-checklist");
    var selected = selectedIds || [];

    APP.state.categories
      .filter(function (category) {
        return !category.archived;
      })
      .forEach(function (category) {
        var label = APP.dom.el("label", "category-option");
        var checkbox = APP.dom.el("input");
        var text = category.name;

        checkbox.type = "checkbox";
        checkbox.value = category.id;
        checkbox.checked = selected.indexOf(category.id) !== -1;

        label.appendChild(checkbox);
        label.appendChild(APP.dom.el("span", "", text));
        container.appendChild(label);
      });

    return container;
  };

  APP.pages.visuals.checkedCategoryIds = function (checklist) {
    return Array.prototype.slice.call(
      checklist.querySelectorAll("input[type='checkbox']:checked")
    ).map(function (checkbox) {
      return checkbox.value;
    });
  };

  APP.pages.visuals.openModal = function (visualId) {
    var existing = APP.state.settings.dashboardVisuals.filter(function (visual) {
      return visual.id === visualId;
    })[0];

    APP.pages.visuals.ensureTabs();

    var visual = existing || {
      tabId: APP.pages.visuals.activeTab().id,
      title: "New Dashboard Visual",
      chartType: "line",
      topic: "income_trend",
      timelineMode: "rolling_6_months",
      categoryScope: "all",
      categoryIds: [],
      width: "normal",
      height: "normal",
      color: "#60a5fa",
      visible: true
    };

    var form = APP.dom.el("form", "form-grid");
    var chartOptions = Object.keys(APP.pages.visuals.profiles).map(function (key) {
      return {
        value: key,
        label: APP.pages.visuals.profiles[key].topics ?
          APP.pages.visuals.profiles[key].topics.length ?
            key.replace(/([A-Z])/g, " $1") :
            key :
          key
      };
    });

    chartOptions = [
      { value: "line", label: "Line graph" },
      { value: "bar", label: "Bar chart" },
      { value: "pie", label: "Pie chart" },
      { value: "doughnut", label: "Donut chart" },
      { value: "stackedBar", label: "Stacked bar chart" },
      { value: "area", label: "Area chart" },
      { value: "scatter", label: "Scatter plot" },
      { value: "heatmap", label: "Heatmap" },
      { value: "calendarHeatmap", label: "Calendar heatmap" },
      { value: "progress", label: "Progress bar" },
      { value: "gauge", label: "Gauge" },
      { value: "waterfall", label: "Waterfall chart" },
      { value: "sankey", label: "Sankey diagram" }
    ];

    var title = APP.ui.field(
      "Visual title",
      "title",
      "text",
      visual.title,
      { required: true, full: true }
    );

    var chartType = APP.ui.field(
      "Chart type",
      "chartType",
      "select",
      visual.chartType,
      { options: chartOptions }
    );

    var topic = APP.ui.field(
      "What would you like to see?",
      "topic",
      "select",
      visual.topic,
      { options: [] }
    );

    var timeline = APP.ui.field(
      "Timeline view",
      "timeline",
      "select",
      visual.timelineMode,
      { options: [] }
    );

    var scope = APP.ui.field(
      "Category scope",
      "scope",
      "select",
      visual.categoryScope,
      {
        options: [
          { value: "all", label: "All relevant categories" },
          { value: "selected", label: "Select categories" }
        ]
      }
    );

    var width = APP.ui.field(
      "Dashboard width",
      "width",
      "select",
      visual.width,
      {
        options: [
          { value: "normal", label: "Standard width" },
          { value: "wide", label: "Wide" }
        ]
      }
    );

    var color = APP.ui.field(
      "Display color",
      "color",
      "color",
      visual.color
    );

    var tab = APP.ui.field(
      "Dashboard tab",
      "tab",
      "select",
      visual.tabId,
      {
        options: APP.pages.visuals.tabs().map(function (item) {
          return { value: item.id, label: item.name };
        })
      }
    );

    var checklistLabel = APP.dom.el("div", "form-field full");
    var checklistTitle = APP.dom.el("span", "", "Select categories");
    var checklist = APP.pages.visuals.categoryChecklist(visual.categoryIds);

    checklistLabel.appendChild(checklistTitle);
    checklistLabel.appendChild(checklist);

    function replaceSelectOptions(field, options, selectedValue) {
      field.input.replaceChildren();

      options.forEach(function (optionData) {
        var option = APP.dom.el("option", "", optionData.label);
        option.value = optionData.value;
        option.selected = optionData.value === selectedValue;
        field.input.appendChild(option);
      });

      if (!field.input.value && options.length) {
        field.input.value = options[0].value;
      }
    }

        function updateConfigurationOptions(preserveCurrentSelection) {
      var profile = APP.pages.visuals.profiles[chartType.input.value];

      var desiredTopic = preserveCurrentSelection ?
        visual.topic :
        topic.input.value;

      var desiredTimeline = preserveCurrentSelection ?
        visual.timelineMode :
        timeline.input.value;

      var topicValid = profile.topics.some(function (item) {
        return item[0] === desiredTopic;
      });

      var timelineValid = profile.timelines.some(function (item) {
        return item[0] === desiredTimeline;
      });

      replaceSelectOptions(
        topic,
        APP.pages.visuals.optionList(profile.topics),
        topicValid ? desiredTopic : profile.topics[0][0]
      );

      replaceSelectOptions(
        timeline,
        APP.pages.visuals.optionList(profile.timelines),
        timelineValid ? desiredTimeline : profile.timelines[0][0]
      );

      updateCategoryFields();
    }

    function updateCategoryFields() {
      var mode = APP.pages.visuals.categoryMode(chartType.input.value, topic.input.value);

      if (mode === "none") {
        scope.root.style.display = "none";
        checklistLabel.style.display = "none";
      } else if (mode === "single") {
        scope.root.style.display = "none";
        checklistLabel.style.display = "";
        checklistTitle.textContent =
          "Select one category, savings fund, goal, or debt";
      } else {
        scope.root.style.display = "";
        checklistLabel.style.display =
          scope.input.value === "selected" ? "" : "none";

        checklistTitle.textContent = "Select categories";
      }
    }

    chartType.input.addEventListener("change", updateConfigurationOptions);
    topic.input.addEventListener("change", updateCategoryFields);
    scope.input.addEventListener("change", updateCategoryFields);

    [
      title,
      chartType,
      topic,
      timeline,
      tab,
      scope,
      width,
      color
    ].forEach(function (field) {
      form.appendChild(field.root);
    });

    form.appendChild(checklistLabel);
    updateConfigurationOptions(true);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var mode = APP.pages.visuals.categoryMode(chartType.input.value, topic.input.value);
      var selectedIds = APP.pages.visuals.checkedCategoryIds(checklist);
      var categoryScope = mode === "none" ?
        "all" :
        mode === "single" ?
          "selected" :
          scope.input.value;

      if (mode === "single" && selectedIds.length > 1) {
        APP.dom.toast(
          "Choose only one category, savings fund, goal, or debt for this visual.",
          "danger"
        );
        return;
      }

      if (categoryScope === "selected" && !selectedIds.length) {
        APP.dom.toast(
          "Select at least one category or choose All relevant categories.",
          "danger"
        );
        return;
      }

      // Start from the existing visual so settings this form doesn't show (height,
      // By Category, Currency/Percent) survive an edit.
      var record = {};

      Object.keys(existing || {}).forEach(function (name) {
        record[name] = existing[name];
      });

      record.id = existing ? existing.id : APP.utils.id("visual");
      record.title = APP.utils.text(title.input.value);
      record.chartType = chartType.input.value;
      record.topic = topic.input.value;
      record.timelineMode = timeline.input.value;
      record.tabId = tab.input.value;
      record.categoryScope = categoryScope;
      record.categoryIds = categoryScope === "selected" ? selectedIds : [];
      record.width = width.input.value;
      record.color = color.input.value || "#60a5fa";
      record.visible = existing ? existing.visible : true;
      record.height = record.height || "normal";
      record.displayMode = record.displayMode || "currency";
      record.aggregationMode = record.aggregationMode || "total";

      if (existing) {
        delete APP.controller.visualRuntime[record.id];
      }

      if (existing) {
        APP.state.settings.dashboardVisuals =
          APP.state.settings.dashboardVisuals.map(function (item) {
            return item.id === record.id ? record : item;
          });
      } else {
        APP.state.settings.dashboardVisuals.push(record);
      }

      // Show the tab the visual was saved to.
      APP.state.settings.activeDashboardTab = record.tabId;

      APP.ui.closeModal();
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var cancel = APP.ui.button("Cancel");
    var save = APP.ui.button(
      existing ? "Save visual" : "Add visual",
      "button-primary"
    );

    save.type = "submit";
    cancel.addEventListener("click", APP.ui.closeModal);

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    APP.ui.modal(
      existing ? "Edit dashboard visual" : "Create dashboard visual",
      form
    );
  };

  APP.pages.visuals.render = function () {
    var root = APP.dom.refs.pages.visuals;
    var controls = APP.dom.el("div", "button-row");
    var add = APP.ui.button("+ Add visual", "button-primary");
    var restore = APP.ui.button("Restore defaults");

    APP.dom.clear(root);

    add.addEventListener("click", function () {
      APP.pages.visuals.openModal();
    });

    restore.addEventListener("click", function () {
      APP.state.settings.dashboardVisuals =
        APP.pages.visuals.defaultVisuals();

      APP.controller.commit();
    });

    controls.appendChild(add);
    controls.appendChild(restore);

    root.appendChild(APP.ui.panelHeader(
      "Dashboard visual designer",
      "Choose a chart type first. Available topics, timeline views, and category controls adjust automatically.",
      controls
    ));

    APP.state.settings.dashboardVisuals.forEach(function (visual) {
      var card = APP.dom.el("article", "fund-card");
      var actions = APP.dom.el("div", "button-row");
      var edit = APP.ui.button("Edit");
      var toggle = APP.ui.button(visual.visible ? "Hide" : "Show");
      var remove = APP.ui.button("Remove");

      card.appendChild(APP.dom.el("h3", "", visual.title));

      card.appendChild(APP.dom.el(
        "p",
        "muted",
        visual.chartType +
        " · " +
        visual.topic.replace(/_/g, " ") +
        " · " +
        visual.timelineMode.replace(/_/g, " ")
      ));

      card.appendChild(APP.dom.el(
        "p",
        "muted",
        visual.categoryScope === "all" ?
          "All relevant categories" :
          visual.categoryIds.length + " selected category item(s)"
      ));

      edit.addEventListener("click", function () {
        APP.pages.visuals.openModal(visual.id);
      });

      toggle.addEventListener("click", function () {
        visual.visible = !visual.visible;
        APP.controller.commit();
      });

      remove.addEventListener("click", function () {
        APP.state.settings.dashboardVisuals =
          APP.state.settings.dashboardVisuals.filter(function (item) {
            return item.id !== visual.id;
          });

        APP.controller.commit();
      });

      actions.appendChild(edit);
      actions.appendChild(toggle);
      actions.appendChild(remove);

      card.appendChild(actions);
      root.appendChild(card);
    });

    if (!APP.state.settings.dashboardVisuals.length) {
      root.appendChild(APP.ui.empty(
        "No dashboard visuals are configured. Add one or restore the defaults."
      ));
    }
  };
}());