(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.categories = {};

  APP.pages.categories.defaultGroups = [
    "Housing and Utilities",
    "Food and Household",
    "Transportation",
    "Insurance and Health",
    "Giving and Debt",
    "Savings and Funds",
    "Lifestyle and Personal",
    "Other"
  ];

  APP.pages.categories.availableGroups = function () {
    var groups = APP.pages.categories.defaultGroups.slice();

    APP.state.categories.forEach(function (category) {
      var group = APP.utils.text(category.group);

      if (group && groups.indexOf(group) === -1) {
        groups.push(group);
      }
    });

    return groups.sort();
  };

  APP.pages.categories.groupOptions = function () {
    return APP.pages.categories.availableGroups()
      .map(function (group) {
        return {
          value: group,
          label: group
        };
      })
      .concat([
        {
          value: "__new_group__",
          label: "+ Create new group"
        }
      ]);
  };

  APP.pages.categories.openModal = function (categoryId) {
    var existing = APP.state.categories.filter(function (category) {
      return category.id === categoryId;
    })[0];

    var category = existing || {
      group: "Other",
      name: "",
      isSavingsFund: false,
      isDebtCategory: false,
      isTemporary: false,
      archived: false,
      openingBalance: 0,
      openingBalanceEffectiveMonth: "",
      eventualSavingsGoal: 0,
      eventualSavingsGoalDate: ""
    };

    var knownGroups = APP.pages.categories.availableGroups();
    var groupValue = knownGroups.indexOf(category.group) !== -1 ?
      category.group :
      "__new_group__";

    var form = APP.dom.el("form", "form-grid");

    var name = APP.ui.field(
      "Category name",
      "name",
      "text",
      category.name,
      {
        required: true,
        full: true,
        placeholder: "Example: Groceries or Emergency Fund"
      }
    );

    var group = APP.ui.field(
      "Category group",
      "group",
      "select",
      groupValue,
      {
        options: APP.pages.categories.groupOptions()
      }
    );

    var newGroup = APP.ui.field(
      "New group name",
      "newGroup",
      "text",
      groupValue === "__new_group__" ? category.group : "",
      {
        placeholder: "Example: Pets or Travel"
      }
    );

    var openingBalance = APP.ui.field(
      "Savings-fund opening balance",
      "openingBalance",
      "number",
      category.openingBalance,
      {
        min: "0",
        step: "0.01"
      }
    );

    var openingMonth = APP.ui.field(
      "Opening-balance effective month",
      "openingBalanceEffectiveMonth",
      "month",
      category.openingBalanceEffectiveMonth
    );

    var eventualGoal = APP.ui.field(
      "Eventual savings goal",
      "eventualSavingsGoal",
      "number",
      category.eventualSavingsGoal,
      {
        min: "0",
        step: "0.01"
      }
    );

    var eventualDate = APP.ui.field(
      "Desired eventual-goal date",
      "eventualSavingsGoalDate",
      "month",
      category.eventualSavingsGoalDate
    );

    var flags = APP.dom.el("div", "form-field full");
    var savings = APP.dom.el("input");
    var debt = APP.dom.el("input");
    var temporary = APP.dom.el("input");

    savings.type = "checkbox";
    debt.type = "checkbox";
    temporary.type = "checkbox";

    savings.checked = Boolean(category.isSavingsFund);
    debt.checked = Boolean(category.isDebtCategory);
    temporary.checked = Boolean(category.isTemporary);

    function flag(labelText, input) {
      var label = APP.dom.el("label", "category-flag");
      label.appendChild(input);
      label.appendChild(APP.dom.el("span", "", " " + labelText));
      return label;
    }

    flags.appendChild(APP.dom.el("span", "", "Category options"));
    flags.appendChild(flag("Savings fund", savings));
    flags.appendChild(flag("Debt category", debt));
    flags.appendChild(flag("Temporary category", temporary));

    // A temporary category can end on a date; the day after, it archives itself.
    var endDate = APP.ui.field(
      "Ends on (optional)",
      "endDate",
      "date",
      category.endDate || "",
      { full: true }
    );
    var endHint = APP.dom.el("p", "field-hint full",
      "The day after this date, the category is archived automatically. Its transactions and history stay; it just leaves your category lists.");

    function updateEndDate() {
      endDate.root.style.display = temporary.checked ? "" : "none";
      endHint.style.display = temporary.checked ? "" : "none";
    }

    temporary.addEventListener("change", updateEndDate);
    updateEndDate();

    function updateGroupField() {
      newGroup.root.style.display =
        group.input.value === "__new_group__" ? "" : "none";
    }

    function updateSavingsFields() {
      var visible = savings.checked;

      [
        openingBalance.root,
        openingMonth.root,
        eventualGoal.root,
        eventualDate.root
      ].forEach(function (element) {
        element.style.display = visible ? "" : "none";
      });
    }

    group.input.addEventListener("change", updateGroupField);
    savings.addEventListener("change", updateSavingsFields);

    updateGroupField();
    updateSavingsFields();

    [
      name,
      group,
      newGroup,
      openingBalance,
      openingMonth,
      eventualGoal,
      eventualDate
    ].forEach(function (field) {
      form.appendChild(field.root);
    });

    // For savings funds, show what a target date means per month.
    var goalHint = APP.pages.savings.goalHint(
      eventualGoal,
      eventualDate,
      existing && existing.isSavingsFund ?
        APP.model.savingsBalance(existing.id, APP.utils.month(new Date())) :
        0
    );

    form.appendChild(goalHint);

    savings.addEventListener("change", function () {
      goalHint.style.display = savings.checked ? "" : "none";
    });
    goalHint.style.display = savings.checked ? "" : "none";

    form.appendChild(flags);
    form.appendChild(endDate.root);
    form.appendChild(endHint);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var selectedGroup = group.input.value === "__new_group__" ?
        APP.utils.text(newGroup.input.value) :
        APP.utils.text(group.input.value);

      var categoryName = APP.utils.text(name.input.value);

      var duplicate = APP.state.categories.some(function (item) {
        return item.id !== (existing ? existing.id : "") &&
          !item.archived &&
          APP.utils.header(item.name) === APP.utils.header(categoryName);
      });

      if (!categoryName) {
        APP.dom.toast("Enter a category name.", "danger");
        return;
      }

      if (!selectedGroup) {
        APP.dom.toast("Select an existing group or enter a new group name.", "danger");
        return;
      }

      if (duplicate) {
        APP.dom.toast(
          "Active category names must be unique. Use a more specific category name.",
          "danger"
        );
        return;
      }

      var record = {
        id: existing ? existing.id : APP.utils.id("cat"),
        group: selectedGroup,
        name: categoryName,
        isSavingsFund: savings.checked,
        isDebtCategory: debt.checked,
        isTemporary: temporary.checked,
        endDate: temporary.checked ? endDate.input.value || "" : "",
        archived: existing ? existing.archived : false,

        openingBalance: savings.checked ?
          APP.utils.money(openingBalance.input.value) :
          0,

        openingBalanceEffectiveMonth: savings.checked ?
          openingMonth.input.value :
          "",

        eventualSavingsGoal: savings.checked ?
          APP.utils.money(eventualGoal.input.value) :
          0,

        eventualSavingsGoalDate: savings.checked ?
          eventualDate.input.value :
          "",

        createdAt: existing ?
          existing.createdAt :
          new Date().toISOString()
      };

      if (existing) {
        APP.state.categories = APP.state.categories.map(function (item) {
          return item.id === record.id ? record : item;
        });
      } else {
        APP.state.categories.push(record);
      }

      APP.store.log(
        "success",
        (existing ? "Updated" : "Added") +
        " category: " + record.name + "."
      );

      APP.ui.closeModal();
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var cancel = APP.ui.button("Cancel");
    var save = APP.ui.button(
      existing ? "Save changes" : "Add category",
      "button-primary"
    );

    save.type = "submit";

    cancel.addEventListener("click", APP.ui.closeModal);

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    APP.ui.modal(
      existing ? "Edit category" : "Add category",
      form,
      { size: "sheet" }
    );
  };

  APP.pages.categories.toggleArchive = function (categoryId) {
    var today = APP.utils.isoDate(new Date());

    APP.state.categories.forEach(function (category) {
      if (category.id === categoryId) {
        category.archived = !category.archived;

        // Restoring a temporary category whose end date has passed clears the date, or it
        // would archive itself again straight away.
        if (!category.archived && category.endDate && category.endDate < today) {
          category.endDate = "";
          APP.dom.toast(category.name + " is restored. Its end date had passed, so it was cleared; set a new one with Edit.", "info");
        }

        APP.store.log(
          "info",
          (category.archived ? "Archived" : "Restored") +
          " category: " + category.name + "."
        );
      }
    });

    APP.controller.commit();
  };

  // Archives temporary categories whose end date has passed. Runs whenever the app loads or
  // takes in synced changes (from normalizeState), so it happens on whichever device is
  // opened first after the date. Returns the names archived.
  APP.pages.categories.autoArchive = function () {
    var today = APP.utils.isoDate(new Date());
    var archived = [];

    (APP.state.categories || []).forEach(function (category) {
      if (category.isTemporary && category.endDate && !category.archived && category.endDate < today) {
        category.archived = true;
        archived.push(category.name);
      }
    });

    if (archived.length) {
      APP.store.log("info", "Archived temporary categories that ended: " + archived.join(", ") + ".");

      if (APP.dom.toast) {
        APP.dom.toast(
          (archived.length === 1 ? archived[0] + " has" : archived.join(", ") + " have") +
            " ended and moved to Archived categories in Settings.",
          "info"
        );
      }
    }

    return archived;
  };

  // "Ends Dec 31" / "Ends today" / "Ended Nov 2", for a temporary category's end date.
  APP.pages.categories.endLabel = function (category) {
    if (!category.isTemporary || !category.endDate) {
      return "";
    }

    var today = APP.utils.isoDate(new Date());
    var date = APP.utils.parseDate(category.endDate);
    var text = date ? date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
    }) : category.endDate;

    if (category.endDate === today) {
      return "Ends today";
    }

    return (category.endDate < today ? "Ended " : "Ends ") + text;
  };

  // A category can be deleted only when nothing uses it: no transactions and no debts.
  // Budget targets and dashboard filters that mention it are cleaned up with it.
  APP.pages.categories.usage = function (categoryId) {
    return {
      transactions: APP.state.transactions.filter(function (transaction) {
        return transaction.categoryId === categoryId;
      }).length,
      debts: APP.state.debts.filter(function (debt) {
        return debt.categoryId === categoryId;
      }).length
    };
  };

  APP.pages.categories.remove = function (categoryId) {
    var category = APP.model.categories().byId[categoryId];
    var usage = APP.pages.categories.usage(categoryId);

    if (!category || usage.transactions || usage.debts) {
      return;
    }

    if (!window.confirm("Delete the category \"" + category.name + "\"? Its budget targets will be removed too.")) {
      return;
    }

    APP.state.categories = APP.state.categories.filter(function (item) {
      return item.id !== categoryId;
    });

    APP.state.budgets.forEach(function (budget) {
      budget.items = (budget.items || []).filter(function (item) {
        return item.categoryId !== categoryId;
      });
    });

    (APP.state.settings.dashboardVisuals || []).forEach(function (visual) {
      visual.categoryIds = (visual.categoryIds || []).filter(function (id) {
        return id !== categoryId;
      });
    });

    Object.keys(APP.controller.visualRuntime || {}).forEach(function (key) {
      var runtime = APP.controller.visualRuntime[key];
      runtime.categoryIds = (runtime.categoryIds || []).filter(function (id) {
        return id !== categoryId;
      });
    });

    if (APP.state.settings.roundUp && APP.state.settings.roundUp.fundId === categoryId) {
      APP.state.settings.roundUp.fundId = "";
    }

    APP.store.log("warning", "Deleted category: " + category.name + ".");
    APP.controller.commit();
  };

  // Search text and filter for the Settings category list. Kept outside render() so they
  // survive the re-render that follows every save.
  APP.pages.categories.view = { query: "", kind: "all", archivedOpen: false };

  APP.pages.categories.kinds = [
    ["all", "All"],
    ["spending", "Spending"],
    ["savings", "Savings funds"],
    ["debt", "Debt"],
    ["temporary", "Temporary"]
  ];

  APP.pages.categories.matches = function (category) {
    var view = APP.pages.categories.view;
    var query = APP.utils.header(view.query);
    var kind = view.kind;

    if (kind === "spending" && (category.isSavingsFund || category.isDebtCategory)) {
      return false;
    }

    if ((kind === "savings" && !category.isSavingsFund) ||
        (kind === "debt" && !category.isDebtCategory) ||
        (kind === "temporary" && !category.isTemporary)) {
      return false;
    }

    return !query || APP.utils.header(category.name + " " + category.group).indexOf(query) !== -1;
  };

  APP.pages.categories.row = function (category) {
    var card = APP.dom.el("div", "category-settings-row" + (category.archived ? " is-archived" : ""));
    var nameCell = APP.dom.el("div", "category-settings-name");
    var groupCell = APP.dom.el("div", "category-settings-group");
    var detailsCell = APP.dom.el("div", "category-settings-details");
    var actions = APP.dom.el("div", "category-settings-actions");
    var edit = APP.ui.button("Edit");
    var archive = APP.ui.button(category.archived ? "Restore" : "Archive");
    var ends = APP.pages.categories.endLabel(category);

    nameCell.appendChild(APP.dom.el("strong", "", category.name));

    if (ends) {
      nameCell.appendChild(APP.ui.pill(ends, category.archived ? "" : "pill-warn"));
    }

    groupCell.appendChild(APP.dom.el("span", "muted", category.group));

    detailsCell.appendChild(APP.dom.el("span", "muted", [
      category.isSavingsFund ? "Savings fund" : "",
      category.isDebtCategory ? "Debt category" : "",
      category.isTemporary ? "Temporary" : ""
    ].filter(Boolean).join(" · ") || "Standard expense"));

    if (category.isSavingsFund) {
      detailsCell.appendChild(APP.dom.el("span", "muted",
        category.eventualSavingsGoal > 0 ?
          "Goal: " + APP.utils.currency(category.eventualSavingsGoal) :
          "No eventual savings goal"));
    }

    edit.addEventListener("click", function () {
      APP.pages.categories.openModal(category.id);
    });

    archive.addEventListener("click", function () {
      APP.pages.categories.toggleArchive(category.id);
    });

    actions.appendChild(edit);
    actions.appendChild(archive);

    var usage = APP.pages.categories.usage(category.id);

    if (!usage.transactions && !usage.debts) {
      var remove = APP.ui.button("Delete", "button-quiet danger");

      remove.addEventListener("click", function () {
        APP.pages.categories.remove(category.id);
      });
      actions.appendChild(remove);
    } else {
      actions.title = "Used by " + (usage.transactions ?
        usage.transactions + " transaction(s)" :
        usage.debts + " debt(s)") + ", so it can be archived but not deleted.";
    }

    card.appendChild(nameCell);
    card.appendChild(groupCell);
    card.appendChild(detailsCell);
    card.appendChild(actions);
    return card;
  };

  APP.pages.categories.render = function (hostElement) {
    var root = hostElement || APP.dom.refs.pages.settings;
    var view = APP.pages.categories.view;
    var add = APP.ui.button("+ Add category", "button-primary");

    APP.dom.clear(root);

    add.addEventListener("click", function () {
      APP.pages.categories.openModal();
    });

    // Heading, search and filters stay pinned while the list scrolls under them.
    var top = APP.dom.el("div", "category-sticky");
    var toolbar = APP.dom.el("div", "category-toolbar");
    var search = APP.dom.el("input", "filter-box category-search");
    var chips = APP.dom.el("div", "category-chips");

    top.appendChild(APP.ui.panelHeader(
      "Categories",
      "Search, edit or archive categories. Archived ones keep their history and move to the bottom.",
      add
    ));

    search.type = "search";
    search.placeholder = "Search categories or groups";
    search.setAttribute("aria-label", "Search categories");
    search.value = view.query;
    toolbar.appendChild(search);

    APP.pages.categories.kinds.forEach(function (kind) {
      var chip = APP.dom.el("button", "category-chip" + (view.kind === kind[0] ? " active" : ""), kind[1]);

      chip.type = "button";
      chip.setAttribute("aria-pressed", view.kind === kind[0] ? "true" : "false");
      chip.addEventListener("click", function () {
        view.kind = kind[0];
        Array.prototype.slice.call(chips.children).forEach(function (item) {
          var on = item === chip;
          item.classList.toggle("active", on);
          item.setAttribute("aria-pressed", on ? "true" : "false");
        });
        paint();
      });
      chips.appendChild(chip);
    });

    toolbar.appendChild(chips);
    top.appendChild(toolbar);
    root.appendChild(top);

    var list = APP.dom.el("div", "category-list");
    root.appendChild(list);

    // Redraws only the list, so typing in the search box keeps focus.
    function paint() {
      var sorted = APP.state.categories.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      var active = sorted.filter(function (category) { return !category.archived; });
      var archived = sorted.filter(function (category) { return category.archived; });
      var shownActive = active.filter(APP.pages.categories.matches);
      var shownArchived = archived.filter(APP.pages.categories.matches);
      var filtering = Boolean(APP.utils.text(view.query)) || view.kind !== "all";

      APP.dom.clear(list);

      list.appendChild(APP.dom.el("p", "category-count",
        filtering ?
          "Showing " + shownActive.length + " of " + active.length + " active categories" :
          active.length + " active categories"));

      if (!shownActive.length) {
        list.appendChild(APP.dom.el("p", "category-empty",
          active.length ? "No active categories match." : "No active categories yet."));
      }

      // Grouped under their group names, groups in alphabetical order.
      var groups = {};

      shownActive.forEach(function (category) {
        (groups[category.group] = groups[category.group] || []).push(category);
      });

      Object.keys(groups).sort().forEach(function (name) {
        var section = APP.dom.el("div", "category-group");

        section.appendChild(APP.dom.el("h3", "category-group-title", name + " · " + groups[name].length));
        groups[name].forEach(function (category) {
          section.appendChild(APP.pages.categories.row(category));
        });
        list.appendChild(section);
      });

      if (archived.length) {
        var box = APP.dom.el("details", "category-archived");
        var summary = APP.dom.el("summary", "",
          "Archived categories (" + (filtering ? shownArchived.length + " of " : "") + archived.length + ")");

        // Opens by itself when a search finds only archived categories.
        box.open = view.archivedOpen || (filtering && !shownActive.length && shownArchived.length > 0);
        box.addEventListener("toggle", function () {
          view.archivedOpen = box.open;
        });

        box.appendChild(summary);
        box.appendChild(APP.dom.el("p", "muted category-archived-note",
          "Archived categories are hidden from your lists and pickers, but their transactions and history stay. Restore one to use it again."));

        if (!shownArchived.length) {
          box.appendChild(APP.dom.el("p", "category-empty", "No archived categories match."));
        }

        shownArchived.forEach(function (category) {
          box.appendChild(APP.pages.categories.row(category));
        });

        list.appendChild(box);
      }
    }

    search.addEventListener("input", function () {
      view.query = search.value;
      paint();
    });

    paint();
  };
}());
