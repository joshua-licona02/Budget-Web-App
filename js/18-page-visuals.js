(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.visuals = {};

  APP.pages.visuals.profiles = {
    line: {
      topics: [
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
        ["cash_outflow_stacked", "Cash-outflow allocation by month"]
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
        ["monthly_budget_completion", "Monthly budget completion"],
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
        ["monthly_budget_completion", "Monthly budget completion"],
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

  APP.pages.visuals.defaultVisuals = function () {
    return [
      {
        id: APP.utils.id("visual"),
        title: "Six-Month Cash Flow",
        chartType: "line",
        topic: "net_cash_flow_trend",
        timelineMode: "rolling_6_months",
        categoryScope: "all",
        categoryIds: [],
        width: "wide",
        height: "normal",
        color: "#60a5fa",
        visible: true
      },
      {
        id: APP.utils.id("visual"),
        title: "Operating Spending Allocation",
        chartType: "doughnut",
        topic: "operating_category_allocation",
        timelineMode: "selected_month",
        categoryScope: "all",
        categoryIds: [],
        width: "normal",
        height: "normal",
        color: "#4ade80",
        visible: true
      },
      {
        id: APP.utils.id("visual"),
        title: "Income Allocation",
        chartType: "sankey",
        topic: "income_allocation",
        timelineMode: "selected_month",
        categoryScope: "all",
        categoryIds: [],
        width: "wide",
        height: "normal",
        color: "#a78bfa",
        visible: true
      }
    ];
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

    var visual = existing || {
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

      if (profile.categories === "single") {
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

    scope.input.addEventListener("change", function () {
      var profile = APP.pages.visuals.profiles[chartType.input.value];

      if (profile.categories !== "single") {
        checklistLabel.style.display =
          scope.input.value === "selected" ? "" : "none";
      }
    });

    [
      title,
      chartType,
      topic,
      timeline,
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

      var profile = APP.pages.visuals.profiles[chartType.input.value];
      var selectedIds = APP.pages.visuals.checkedCategoryIds(checklist);
      var categoryScope = profile.categories === "single" ?
        "selected" :
        scope.input.value;

      if (profile.categories === "single" && selectedIds.length > 1) {
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

      var record = {
        id: existing ? existing.id : APP.utils.id("visual"),
        title: APP.utils.text(title.input.value),
        chartType: chartType.input.value,
        topic: topic.input.value,
        timelineMode: timeline.input.value,
        categoryScope: categoryScope,
        categoryIds: categoryScope === "selected" ? selectedIds : [],
        width: width.input.value,
        color: color.input.value || "#60a5fa",
        visible: existing ? existing.visible : true
      };

      if (existing) {
        APP.state.settings.dashboardVisuals =
          APP.state.settings.dashboardVisuals.map(function (item) {
            return item.id === record.id ? record : item;
          });
      } else {
        APP.state.settings.dashboardVisuals.push(record);
      }

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