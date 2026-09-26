(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.budget = {};

  APP.pages.budget.previousMonth = function (month) {
    var parts = month.split("-");
    var date = new Date(Number(parts[0]), Number(parts[1]) - 2, 1);

    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0");
  };

  APP.pages.budget.actualForCategory = function (category, activity) {
    if (category.isSavingsFund) {
      return APP.utils.money(activity.contributions);
    }

    return APP.utils.money(activity.operating) +
      APP.utils.money(activity.debt);
  };

  APP.pages.budget.copyPreviousMonth = function (budget, month) {
    var priorMonth = APP.pages.budget.previousMonth(month);
    var priorBudget = APP.model.budget(priorMonth, false);

    if (!priorBudget.id && !priorBudget.items.length) {
      APP.dom.toast(
        "No monthly plan exists for " + priorMonth + ".",
        "danger"
      );
      return;
    }

    if (!window.confirm(
      "Copy budget targets from " + priorMonth + " into " + month + "?"
    )) {
      return;
    }

    budget.expectedIncome = APP.utils.money(priorBudget.expectedIncome);

    budget.items = (priorBudget.items || []).map(function (item) {
      return {
        categoryId: item.categoryId,
        dollarTarget: APP.utils.money(item.dollarTarget)
      };
    });

    APP.store.log(
      "success",
      "Copied monthly plan from " + priorMonth + " to " + month + "."
    );

    APP.controller.commit();
  };

  // View state that survives the re-render after every edit: search text, filter, which
  // groups are collapsed, and which input should get focus back.
  APP.pages.budget.view = {
    query: "",
    filter: "all",
    collapsed: {},
    focusKey: ""
  };

  APP.pages.budget.kindOf = function (category) {
    return category.isSavingsFund ? "savings" :
      category.isDebtCategory ? "debt" :
        "spending";
  };

  // Saves after the browser has moved focus (Tab, click), then puts focus back on the same
  // input in the re-rendered page so editing can continue without hunting for your place.
  APP.pages.budget.commitKeepingFocus = function (focusKey) {
    window.setTimeout(function () {
      var active = document.activeElement;

      APP.pages.budget.view.focusKey = focusKey !== undefined ?
        focusKey :
        active && active.dataset ? active.dataset.planFocus || "" : "";

      APP.controller.commit();
    }, 0);
  };

  APP.pages.budget.restoreFocus = function (root) {
    var key = APP.pages.budget.view.focusKey;

    APP.pages.budget.view.focusKey = "";

    if (!key || APP.state.settings.activeView !== "budget") {
      return;
    }

    var target = root.querySelector('[data-plan-focus="' + key + '"]');

    if (target) {
      target.focus();

      if (target.select && target.type !== "search") {
        target.select();
      }
    }
  };

  APP.pages.budget.rowStatus = function (kind, target, actual) {
    var difference = target - actual;

    if (!target) {
      return { key: "none", label: actual > 0 ? "No target" : "—", tone: "muted" };
    }

    if (kind === "savings") {
      return difference > 0 ?
        { key: "under", label: APP.utils.currency(difference) + " to go", tone: "muted" } :
        { key: "met", label: difference < 0 ? "Ahead by " + APP.utils.currency(-difference) : "Goal met", tone: "success" };
    }

    if (kind === "debt") {
      return difference > 0 ?
        { key: "under", label: APP.utils.currency(difference) + " to pay", tone: "muted" } :
        { key: "met", label: difference < 0 ? APP.utils.currency(-difference) + " extra paid" : "Paid", tone: "success" };
    }

    if (difference < 0) {
      return { key: "over", label: "Over by " + APP.utils.currency(-difference), tone: "danger" };
    }

    return difference === 0 ?
      { key: "met", label: "Fully used", tone: "warning" } :
      { key: "under", label: APP.utils.currency(difference) + " left", tone: actual / target >= 0.9 ? "warning" : "success" };
  };

  APP.pages.budget.barColor = function (kind, status) {
    if (kind === "savings") {
      return APP.charts.flow.savings;
    }

    if (kind === "debt") {
      return APP.charts.flow.debt;
    }

    return status.tone === "danger" ? APP.charts.status.critical :
      status.tone === "warning" ? APP.charts.status.warning :
        APP.charts.status.good;
  };

  // Shows or hides rows and group headers for the current search and filter, without
  // re-rendering, so typing in the search box stays smooth.
  APP.pages.budget.applyFilters = function (root) {
    var view = APP.pages.budget.view;
    var query = view.query.trim().toLowerCase();
    var searching = Boolean(query) || view.filter !== "all";
    var shown = 0;

    Array.prototype.slice.call(root.querySelectorAll(".plan-group")).forEach(function (group) {
      var rows = Array.prototype.slice.call(group.querySelectorAll(".plan-row"));
      var matches = 0;

      rows.forEach(function (row) {
        var match = (!query || row.dataset.name.indexOf(query) !== -1) &&
          (view.filter === "all" ||
            view.filter === "over" && row.dataset.status === "over" ||
            view.filter === "none" && row.dataset.status === "none" ||
            view.filter === "activity" && row.dataset.activity === "1");

        row.hidden = !match || (!searching && view.collapsed[group.dataset.group]);
        matches += match ? 1 : 0;
      });

      group.hidden = searching && !matches;
      group.classList.toggle("is-collapsed", !searching && Boolean(view.collapsed[group.dataset.group]));
      shown += matches;
    });

    var empty = root.querySelector(".plan-no-results");

    if (empty) {
      empty.hidden = shown > 0;
    }
  };

  APP.pages.budget.render = function () {
    var root = APP.dom.refs.pages.budget;
    var view = APP.pages.budget.view;
    var month = APP.state.settings.selectedMonth;
    var budget = APP.model.budget(month, true);
    var activity = APP.analytics.categoryActivity(month);
    var salary = APP.analytics.salary();
    var expected = APP.utils.money(budget.expectedIncome);
    var byKind = { spending: 0, savings: 0, debt: 0 };

    var categories = APP.state.categories.filter(function (category) {
      return !category.archived;
    });

    categories.forEach(function (category) {
      var item = APP.model.budgetItem(budget, category.id);
      byKind[APP.pages.budget.kindOf(category)] += item ? APP.utils.money(item.dollarTarget) : 0;
    });

    var totalGoals = byKind.spending + byKind.savings + byKind.debt;
    var incomeAfterGoals = expected - totalGoals;

    APP.dom.clear(root);

    var page = APP.dom.el("section", "panel monthly-plan-page");
    var actionRow = APP.dom.el("div", "button-row");
    var useSalary = APP.ui.button("Use salary estimate");
    var copyPrior = APP.ui.button("Copy prior month");

    useSalary.addEventListener("click", function () {
      budget.expectedIncome = APP.utils.money(salary.netMonthly);
      APP.store.log("success", "Estimated net monthly salary copied to the monthly plan.");
      APP.controller.commit();
    });

    copyPrior.addEventListener("click", function () {
      APP.pages.budget.copyPreviousMonth(budget, month);
    });

    actionRow.appendChild(useSalary);
    actionRow.appendChild(copyPrior);

    page.appendChild(APP.ui.panelHeader(
      "Monthly Plan · " + APP.controller.monthName(month),
      "Give every dollar of expected income a job. Spending targets are limits; savings and debt targets are amounts to put in. Changes save automatically.",
      actionRow
    ));

    // Income and where it is assigned.
    var overview = APP.dom.el("div", "plan-overview");
    var incomeBox = APP.dom.el("div", "plan-income");
    var expectedIncome = APP.ui.field("Expected monthly income", "expectedIncome", "number", budget.expectedIncome, {
      min: "0",
      step: "0.01"
    });

    expectedIncome.input.dataset.planFocus = "expectedIncome";
    expectedIncome.input.addEventListener("change", function () {
      budget.expectedIncome = APP.utils.money(expectedIncome.input.value);
      APP.store.log("info", "Expected monthly income updated for " + month + ".");
      APP.pages.budget.commitKeepingFocus();
    });

    incomeBox.appendChild(expectedIncome.root);
    incomeBox.appendChild(APP.dom.el("small", "muted", "Salary estimate: " + APP.utils.currency(salary.netMonthly)));
    overview.appendChild(incomeBox);

    var allocation = APP.dom.el("div", "plan-allocation");
    var allocationHead = APP.dom.el("div", "plan-allocation-head");
    var leftLabel = incomeAfterGoals >= 0 ? "Left to assign" : "Over-assigned";

    allocationHead.appendChild(APP.dom.el("strong", incomeAfterGoals < 0 ? "danger" : "",
      APP.utils.currency(Math.abs(incomeAfterGoals)) + " " + leftLabel.toLowerCase()));
    allocationHead.appendChild(APP.dom.el("span", "muted",
      APP.utils.currency(totalGoals) + " assigned of " + APP.utils.currency(expected) +
      (expected > 0 ? " (" + (totalGoals / expected * 100).toFixed(1) + "%)" : "")));
    allocation.appendChild(allocationHead);

    var bar = APP.dom.el("div", "plan-allocation-bar");
    var legend = APP.dom.el("div", "plan-allocation-legend");
    var base = Math.max(expected, totalGoals) || 1;

    [
      ["Spending", byKind.spending, APP.charts.flow.spending],
      ["Savings", byKind.savings, APP.charts.flow.savings],
      ["Debt", byKind.debt, APP.charts.flow.debt],
      [leftLabel, Math.abs(incomeAfterGoals), incomeAfterGoals < 0 ? APP.charts.status.critical : APP.charts.track]
    ].forEach(function (part) {
      if (part[1] <= 0) {
        return;
      }

      var segment = APP.dom.el("span");
      segment.style.width = part[1] / base * 100 + "%";
      segment.style.background = part[2];
      segment.title = part[0] + ": " + APP.utils.currency(part[1]);
      bar.appendChild(segment);

      var key = APP.dom.el("span", "plan-legend-item");
      var swatch = APP.dom.el("i");
      swatch.style.background = part[2];
      key.appendChild(swatch);
      key.appendChild(document.createTextNode(part[0] + " " + APP.utils.currency(part[1])));
      legend.appendChild(key);
    });

    allocation.appendChild(bar);
    allocation.appendChild(legend);
    overview.appendChild(allocation);
    page.appendChild(overview);

    // Group categories by their group, in the order groups first appear in the category list.
    var groups = [];
    var groupMap = {};

    categories.forEach(function (category) {
      var name = category.group || "Other";

      if (!groupMap[name]) {
        groupMap[name] = [];
        groups.push(name);
      }

      groupMap[name].push(category);
    });

    // Search, filters and quick links.
    var tools = APP.dom.el("div", "plan-tools");
    var search = APP.dom.el("input", "plan-search");

    search.type = "search";
    search.placeholder = "Find a category…";
    search.value = view.query;
    search.setAttribute("aria-label", "Find a category");
    search.dataset.planFocus = "search";
    search.addEventListener("input", function () {
      view.query = search.value;
      APP.pages.budget.applyFilters(page);
    });
    tools.appendChild(search);

    var filters = APP.dom.el("div", "plan-filters");
    [
      ["all", "All"],
      ["over", "Over budget"],
      ["none", "No target"],
      ["activity", "Has activity"]
    ].forEach(function (item) {
      var chip = APP.dom.el("button", "plan-chip" + (view.filter === item[0] ? " active" : ""), item[1]);

      chip.type = "button";
      chip.setAttribute("aria-pressed", view.filter === item[0] ? "true" : "false");
      chip.addEventListener("click", function () {
        view.filter = item[0];
        Array.prototype.slice.call(filters.children).forEach(function (other) {
          other.classList.toggle("active", other === chip);
          other.setAttribute("aria-pressed", other === chip ? "true" : "false");
        });
        APP.pages.budget.applyFilters(page);
      });
      filters.appendChild(chip);
    });
    tools.appendChild(filters);

    var toggleAll = APP.ui.button(
      groups.every(function (name) { return view.collapsed[name]; }) ? "Expand all" : "Collapse all",
      "button-quiet"
    );
    toggleAll.addEventListener("click", function () {
      var collapse = toggleAll.textContent === "Collapse all";

      groups.forEach(function (name) {
        view.collapsed[name] = collapse;
      });
      toggleAll.textContent = collapse ? "Expand all" : "Collapse all";
      APP.pages.budget.applyFilters(page);
    });
    tools.appendChild(toggleAll);
    page.appendChild(tools);

    var jump = APP.dom.el("nav", "plan-jump");
    jump.setAttribute("aria-label", "Jump to category group");
    groups.forEach(function (name, index) {
      var link = APP.dom.el("button", "plan-jump-link", name);

      link.type = "button";
      link.addEventListener("click", function () {
        view.collapsed[name] = false;
        APP.pages.budget.applyFilters(page);

        var target = page.querySelector('[data-group-index="' + index + '"]');
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      jump.appendChild(link);
    });
    page.appendChild(jump);

    // The plan table: one tbody per group, with a clickable subtotal header row.
    var wrap = APP.dom.el("div", "table-wrap monthly-plan-table-wrap");
    var table = APP.dom.el("table", "data-table monthly-plan-table");
    var head = APP.dom.el("thead");
    var headerRow = APP.dom.el("tr");

    ["Category", "Target", "% Income", "Actual", "Progress"].forEach(function (label) {
      headerRow.appendChild(APP.dom.el("th", "", label));
    });

    head.appendChild(headerRow);
    table.appendChild(head);

    var focusOrder = [];

    groups.forEach(function (name, groupIndex) {
      var body = APP.dom.el("tbody", "plan-group");
      var members = groupMap[name].slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      var subtotal = { target: 0, actual: 0, over: 0 };

      body.dataset.group = name;
      body.dataset.groupIndex = String(groupIndex);

      var groupRow = APP.dom.el("tr", "plan-group-row");
      var groupCell = APP.dom.el("th");
      var groupButton = APP.dom.el("button", "plan-group-toggle");

      groupCell.colSpan = 5;
      groupCell.scope = "rowgroup";
      groupButton.type = "button";
      groupButton.setAttribute("aria-expanded", view.collapsed[name] ? "false" : "true");
      groupButton.addEventListener("click", function () {
        view.collapsed[name] = !view.collapsed[name];
        groupButton.setAttribute("aria-expanded", view.collapsed[name] ? "false" : "true");
        APP.pages.budget.applyFilters(page);
      });

      groupCell.appendChild(groupButton);
      groupRow.appendChild(groupCell);
      body.appendChild(groupRow);

      members.forEach(function (category) {
        var kind = APP.pages.budget.kindOf(category);
        var currentItem = APP.model.budgetItem(budget, category.id);
        var target = currentItem ? APP.utils.money(currentItem.dollarTarget) : 0;
        var actual = APP.pages.budget.actualForCategory(category, activity[category.id] || {});
        var status = APP.pages.budget.rowStatus(kind, target, actual);
        var percent = expected > 0 ? target / expected * 100 : 0;
        var row = APP.dom.el("tr", "plan-row");

        subtotal.target += target;
        subtotal.actual += actual;
        subtotal.over += kind === "spending" && status.key === "over" ? 1 : 0;

        row.dataset.name = category.name.toLowerCase() + " " + name.toLowerCase();
        row.dataset.status = kind === "spending" ? status.key : status.key === "none" ? "none" : "ok";
        row.dataset.activity = actual > 0 ? "1" : "0";

        var nameCell = APP.dom.el("td", "plan-name");
        nameCell.appendChild(APP.dom.el("span", "", category.name));

        if (kind !== "spending") {
          nameCell.appendChild(APP.dom.el("small", "plan-kind plan-kind-" + kind, kind === "savings" ? "Savings" : "Debt"));
        }

        row.appendChild(nameCell);

        function input(field, value, step) {
          var element = APP.dom.el("input", "monthly-target-input");

          element.type = "number";
          element.min = "0";
          element.step = step;
          element.value = value;
          element.defaultValue = value;
          element.dataset.planFocus = category.id + ":" + field;
          element.setAttribute("aria-label", category.name + (field === "target" ? " target" : " percent of income"));
          focusOrder.push(element.dataset.planFocus);

          return element;
        }

        var targetInput = input("target", target, "0.01");
        var percentInput = input("percent", percent.toFixed(1), "0.1");

        function saveTarget(value, focusKey) {
          var budgetItem = APP.model.budgetItem(budget, category.id);

          if (!budgetItem) {
            budgetItem = { categoryId: category.id, dollarTarget: 0 };
            budget.items.push(budgetItem);
          }

          budgetItem.dollarTarget = APP.utils.money(value);
          APP.store.log("info", "Updated target for " + category.name + ".");
          APP.pages.budget.commitKeepingFocus(focusKey);
        }

        function percentToDollars() {
          if (expected <= 0) {
            APP.dom.toast("Set expected monthly income before entering a percentage target.", "danger");
            return null;
          }

          return expected * APP.utils.number(percentInput.value) / 100;
        }

        targetInput.addEventListener("change", function () {
          saveTarget(targetInput.value);
        });

        percentInput.addEventListener("change", function () {
          var dollars = percentToDollars();

          if (dollars !== null) {
            saveTarget(dollars);
          }
        });

        // Enter saves and jumps to the same field on the next visible row.
        [[targetInput, "target"], [percentInput, "percent"]].forEach(function (pair) {
          pair[0].addEventListener("keydown", function (event) {
            if (event.key !== "Enter") {
              return;
            }

            event.preventDefault();

            var visible = Array.prototype.slice.call(
              page.querySelectorAll(".plan-row:not([hidden]) input[data-plan-focus$=':" + pair[1] + "']")
            );
            var next = visible[visible.indexOf(pair[0]) + 1];
            var nextKey = next ? next.dataset.planFocus : pair[0].dataset.planFocus;
            var changed = pair[0].value !== String(pair[0].defaultValue);

            if (!changed) {
              if (next) {
                next.focus();
                next.select();
              }
              return;
            }

            if (pair[1] === "target") {
              saveTarget(targetInput.value, nextKey);
            } else {
              var dollars = percentToDollars();

              if (dollars !== null) {
                saveTarget(dollars, nextKey);
              }
            }
          });
        });

        var targetCell = APP.dom.el("td");
        var percentCell = APP.dom.el("td");
        targetCell.appendChild(targetInput);
        percentCell.appendChild(percentInput);
        row.appendChild(targetCell);
        row.appendChild(percentCell);

        row.appendChild(APP.dom.el("td", actual > 0 ? "plan-actual" : "plan-actual money-zero",
          APP.utils.currency(actual)));

        var progressCell = APP.dom.el("td", "plan-progress");
        var track = APP.dom.el("div", "budget-track");
        var fill = APP.dom.el("span", "budget-fill");
        var scale = Math.max(target, actual) || 1;

        fill.style.width = (target || actual ? Math.min(100, actual / scale * 100) : 0) + "%";
        fill.style.background = APP.pages.budget.barColor(kind, status);
        track.appendChild(fill);

        if (target && actual > target && kind === "spending") {
          var mark = APP.dom.el("span", "budget-mark");
          mark.style.left = target / scale * 100 + "%";
          track.appendChild(mark);
        }

        progressCell.appendChild(track);
        progressCell.appendChild(APP.dom.el("span", "plan-status " + status.tone, status.label));
        row.appendChild(progressCell);
        body.appendChild(row);
      });

      groupButton.appendChild(APP.dom.el("span", "plan-caret", "▾"));
      groupButton.appendChild(APP.dom.el("span", "plan-group-name", name));
      groupButton.appendChild(APP.dom.el("span", "plan-group-count", members.length + (members.length === 1 ? " category" : " categories")));
      groupButton.appendChild(APP.dom.el("span", "plan-group-total",
        APP.utils.currency(subtotal.actual) + " of " + APP.utils.currency(subtotal.target)));

      if (subtotal.over) {
        groupButton.appendChild(APP.dom.el("span", "plan-group-alert", subtotal.over + " over"));
      }

      table.appendChild(body);
    });

    wrap.appendChild(table);
    page.appendChild(wrap);
    page.appendChild(APP.dom.el("p", "muted plan-no-results", "No categories match. Clear the search or pick another filter."));
    root.appendChild(page);

    APP.pages.budget.applyFilters(page);
    APP.pages.budget.restoreFocus(page);
  };
}());