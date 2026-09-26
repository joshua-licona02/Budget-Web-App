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

    form.appendChild(flags);

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
      form
    );
  };

  APP.pages.categories.toggleArchive = function (categoryId) {
    APP.state.categories.forEach(function (category) {
      if (category.id === categoryId) {
        category.archived = !category.archived;

        APP.store.log(
          "info",
          (category.archived ? "Archived" : "Restored") +
          " category: " + category.name + "."
        );
      }
    });

    APP.controller.commit();
  };

  APP.pages.categories.render = function (hostElement) {
  var root = hostElement || APP.dom.refs.pages.settings;
    var controls = APP.dom.el("div", "button-row");
    var add = APP.ui.button("+ Add category", "button-primary");

    APP.dom.clear(root);

    add.addEventListener("click", function () {
      APP.pages.categories.openModal();
    });

    controls.appendChild(add);

    root.appendChild(APP.ui.panelHeader(
  "Categories",
  "Manage categories, savings funds, debt categories, temporary categories, and organization groups. Category names remain simple in transactions and reports.",
  controls
));

    APP.state.categories.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    }).forEach(function (category) {
      var card = APP.dom.el("div", "category-settings-row");
var nameCell = APP.dom.el("div", "category-settings-name");
var groupCell = APP.dom.el("div", "category-settings-group");
var detailsCell = APP.dom.el("div", "category-settings-details");
var statusCell = APP.dom.el("div", "category-settings-status");
var actions = APP.dom.el("div", "category-settings-actions");

var edit = APP.ui.button("Edit");
var archive = APP.ui.button(
  category.archived ? "Restore" : "Archive"
);

nameCell.appendChild(APP.dom.el("strong", "", category.name));

groupCell.appendChild(APP.dom.el(
  "span",
  "muted",
  category.group
));

detailsCell.appendChild(APP.dom.el(
  "span",
  "muted",
  [
    category.isSavingsFund ? "Savings fund" : "",
    category.isDebtCategory ? "Debt category" : "",
    category.isTemporary ? "Temporary" : ""
  ].filter(Boolean).join(" · ") || "Standard expense"
));

if (category.isSavingsFund) {
  detailsCell.appendChild(APP.dom.el(
    "span",
    "muted",
    category.eventualSavingsGoal > 0 ?
      "Goal: " + APP.utils.currency(category.eventualSavingsGoal) :
      "No eventual savings goal"
  ));
}

statusCell.appendChild(APP.dom.el(
  "span",
  category.archived ? "danger" : "success",
  category.archived ? "Archived" : "Active"
));

edit.addEventListener("click", function () {
  APP.pages.categories.openModal(category.id);
});

archive.addEventListener("click", function () {
  APP.pages.categories.toggleArchive(category.id);
});

actions.appendChild(edit);
actions.appendChild(archive);

card.appendChild(nameCell);
card.appendChild(groupCell);
card.appendChild(detailsCell);
card.appendChild(statusCell);
card.appendChild(actions);

root.appendChild(card);
    });
  };
}());