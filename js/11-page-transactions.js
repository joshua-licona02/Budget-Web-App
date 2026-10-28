(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.transactions = {};

  APP.pages.transactions.filters = {
    search: "",
    type: "",
    categoryId: "",
    period: "selectedMonth",
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: "",
    sort: "newest",
    page: 1,
    pageSize: 50
  };

  APP.pages.transactions.categoryOptions = function () {
    return [{
      value: "",
      label: "All categories"
    }].concat(APP.state.categories
      .filter(function (category) {
        return !category.archived;
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      })
      .map(function (category) {
        return {
          value: category.id,
          label: category.name
        };
      }));
  };

  APP.pages.transactions.monthShift = function (month, offset) {
    var parts = month.split("-");
    var date = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1 + offset,
      1
    );

    return date.getFullYear() + "-" +
      String(date.getMonth() + 1).padStart(2, "0");
  };

  APP.pages.transactions.periodRange = function (period) {
    var month = APP.state.settings.selectedMonth;
    var year = month.slice(0, 4);

    if (period === "all") {
      return { from: "", to: "" };
    }

    if (period === "currentYear") {
      return {
        from: year + "-01-01",
        to: year + "-12-31"
      };
    }

    if (period === "last3Months") {
      return {
        from: APP.pages.transactions.monthShift(month, -2) + "-01",
        to: month + "-31"
      };
    }

    if (period === "last6Months") {
      return {
        from: APP.pages.transactions.monthShift(month, -5) + "-01",
        to: month + "-31"
      };
    }

    return {
      from: month + "-01",
      to: month + "-31"
    };
  };

  APP.pages.transactions.filteredRows = function () {
    var filters = APP.pages.transactions.filters;
    var categoryMap = APP.model.categories().byId;
    var dateRange = APP.pages.transactions.periodRange(filters.period);

    var from = filters.fromDate || dateRange.from;
    var to = filters.toDate || dateRange.to;
    var search = APP.utils.header(filters.search);

    var rows = APP.state.transactions.filter(function (transaction) {
      var category = categoryMap[transaction.categoryId];
      var kind = APP.model.classify(transaction);
      var searchable = APP.utils.header(
        transaction.description + " " +
        transaction.notes + " " +
        (category ? category.name : "")
      );

      if (search && searchable.indexOf(search) === -1) {
        return false;
      }

      if (filters.type && kind !== filters.type) {
        return false;
      }

      if (filters.categoryId &&
          transaction.categoryId !== filters.categoryId) {
        return false;
      }

      if (from && transaction.date < from) {
        return false;
      }

      if (to && transaction.date > to) {
        return false;
      }

      if (filters.minAmount !== "" &&
          APP.utils.money(transaction.amount) <
          APP.utils.money(filters.minAmount)) {
        return false;
      }

      if (filters.maxAmount !== "" &&
          APP.utils.money(transaction.amount) >
          APP.utils.money(filters.maxAmount)) {
        return false;
      }

      return true;
    });

    rows.sort(function (first, second) {
      if (filters.sort === "oldest") {
        return first.date.localeCompare(second.date);
      }

      if (filters.sort === "highest") {
        return APP.utils.money(second.amount) -
          APP.utils.money(first.amount);
      }

      if (filters.sort === "lowest") {
        return APP.utils.money(first.amount) -
          APP.utils.money(second.amount);
      }

      if (filters.sort === "description") {
        return first.description.localeCompare(second.description);
      }

      if (filters.sort === "category") {
        var firstCategory = categoryMap[first.categoryId];
        var secondCategory = categoryMap[second.categoryId];

        return (firstCategory ? firstCategory.name : "")
          .localeCompare(secondCategory ? secondCategory.name : "");
      }

      return second.date.localeCompare(first.date);
    });

    return rows;
  };

  APP.pages.transactions.deleteTransaction = function (transactionId) {
    var transaction = APP.state.transactions.filter(function (item) {
      return item.id === transactionId;
    })[0];

    if (!transaction ||
        !window.confirm("Delete this transaction?")) {
      return;
    }

    APP.state.transactions = APP.state.transactions.filter(function (item) {
      return item.id !== transactionId && item.roundUpFor !== transactionId;
    });

    APP.store.log(
      "warning",
      "Deleted transaction: " + transaction.description + "."
    );

    APP.controller.commit();
  };

  APP.pages.transactions.handleTableAction = function (event) {
    var button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    if (button.dataset.action === "edit-transaction") {
      APP.pages.transactions.openModal(button.dataset.id);
    }

    if (button.dataset.action === "delete-transaction") {
      APP.pages.transactions.deleteTransaction(button.dataset.id);
    }
  };

  APP.pages.transactions.openModal = function (transactionId) {
    var existing = APP.state.transactions.filter(function (transaction) {
      return transaction.id === transactionId;
    })[0];

    var transaction = existing || {
      date: APP.utils.isoDate(new Date()),
      description: "",
      categoryId: "",
      type: "expense",
      incomeType: "paycheck",
      amount: "",
      notes: "",
      debtAllocations: []
    };

    var roundUpSettings = APP.pages.transactions.roundUpSettings();
    var linkedRoundUp = existing && existing.roundUpId ?
      APP.state.transactions.filter(function (item) {
        return item.id === existing.roundUpId;
      })[0] :
      null;

    var categoryOptions = [{
      value: "",
      label: "Select category"
    }].concat(APP.state.categories
      .filter(function (category) {
        return !category.archived;
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      })
            .map(function (category) {
        return {
          value: category.id,
          label: category.name
        };
      })
    ).concat([
      {
        value: "__new_savings_fund__",
        label: "+ Create new savings fund"
      }
    ]);

    var form = APP.dom.el("form", "form-grid");

    var date = APP.ui.field(
      "Date",
      "date",
      "date",
      transaction.date,
      { required: true }
    );

    var amount = APP.ui.field(
      "Amount",
      "amount",
      "number",
      transaction.amount,
      {
        required: true,
        min: "0.01",
        step: "0.01"
      }
    );

    var description = APP.ui.field(
      "Description",
      "description",
      "text",
      transaction.description,
      {
        required: true,
        placeholder: "Merchant, paycheck, or description"
      }
    );

    var type = APP.ui.field(
      "Transaction type",
      "type",
      "select",
      transaction.type,
      {
        options: [
          { value: "income", label: "Income" },
          { value: "expense", label: "Expense" },
          { value: "savings", label: "Savings contribution" }
        ]
      }
    );

    var category = APP.ui.field(
      "Category",
      "categoryId",
      "select",
      transaction.type === "income" ? "" : transaction.categoryId,
      {
        options: categoryOptions
      }
    );

    var incomeType = APP.ui.field(
      "Kind of income",
      "incomeType",
      "select",
      transaction.incomeType || "paycheck",
      {
        options: APP.model.incomeTypes.map(function (item) {
          return { value: item[0], label: item[1] };
        })
      }
    );

    // A refund goes back to a spending category and lowers that category's spending.
    var refundCategory = APP.ui.field(
      "Refunded to category",
      "refundCategoryId",
      "select",
      transaction.type === "income" ? transaction.categoryId : "",
      {
        options: [{ value: "", label: "Select the category it goes back to" }].concat(
          APP.state.categories.filter(function (item) {
            return !item.archived && !item.isSavingsFund && !item.isDebtCategory;
          }).sort(function (a, b) {
            return a.name.localeCompare(b.name);
          }).map(function (item) {
            return { value: item.id, label: item.name };
          })
        )
      }
    );

    // Round-up: save the change from rounding an expense up to the next dollar.
    var roundUp = APP.dom.el("label", "round-up-option full");
    var roundUpCheck = APP.dom.el("input");
    var roundUpText = APP.dom.el("span");

    roundUpCheck.type = "checkbox";
    roundUpCheck.checked = existing ? Boolean(linkedRoundUp) : roundUpSettings.defaultOn;
    roundUp.appendChild(roundUpCheck);
    roundUp.appendChild(roundUpText);

    var notes = APP.ui.field(
      "Notes",
      "notes",
      "text",
      transaction.notes,
      {
        full: true,
        placeholder: "Optional notes"
      }
    );

    var allocationPanel = APP.dom.el(
      "div",
      "debt-allocation-panel full"
    );

    var allocationRows = APP.dom.el(
      "div",
      "debt-allocation-rows"
    );

    var allocationSummary = APP.dom.el(
      "div",
      "debt-allocation-summary"
    );

    allocationPanel.appendChild(APP.dom.el(
      "h3",
      "",
      "Debt Payment Allocation"
    ));

    allocationPanel.appendChild(APP.dom.el(
      "p",
      "muted",
      "Minimum payments are prefilled. Adjust each allocation to direct excess payment where you choose."
    ));

    allocationPanel.appendChild(allocationRows);
    allocationPanel.appendChild(allocationSummary);

    var allocationInputs = [];

    function allocationTotal() {
      return allocationInputs.reduce(function (total, item) {
        return total + APP.utils.money(item.input.value);
      }, 0);
    }

    function updateAllocationSummary() {
      var paymentAmount = APP.utils.money(amount.input.value);
      var allocated = allocationTotal();
      var excess = paymentAmount - allocated;

      APP.dom.clear(allocationSummary);

      allocationSummary.appendChild(APP.dom.el(
        "p",
        "muted",
        "Transaction total: " +
        APP.utils.currency(paymentAmount)
      ));

      allocationSummary.appendChild(APP.dom.el(
        "p",
        allocated > paymentAmount ? "danger" : "money-expense",
        "Allocated total: −" +
        APP.utils.currency(allocated)
      ));

      allocationSummary.appendChild(APP.dom.el(
        "p",
        excess < 0 ? "danger" :
          excess > 0 ? "money-income" :
            "muted",
        excess < 0 ?
          "Over-allocated by: " +
          APP.utils.currency(Math.abs(excess)) :
          "Unallocated excess: " +
          APP.utils.currency(excess)
      ));
    }

        function renderDebtAllocations(prefillMinimums) {
      var selectedCategory = APP.model.categories().byId[
        category.input.value
      ];

      var eligibleDebts = selectedCategory &&
        selectedCategory.isDebtCategory ?
        APP.model.debtsForCategory(selectedCategory.id) :
        [];

      allocationInputs = [];
      APP.dom.clear(allocationRows);

      if (
        type.input.value !== "expense" ||
        !selectedCategory ||
        !selectedCategory.isDebtCategory ||
        !eligibleDebts.length
      ) {
        allocationPanel.style.display = "none";
        return;
      }

      allocationPanel.style.display = "";

      var existingAllocations = {};
      (transaction.debtAllocations || []).forEach(function (allocation) {
        existingAllocations[allocation.debtId] =
          APP.utils.money(allocation.amount);
      });

      eligibleDebts.forEach(function (debt) {
                var row = APP.dom.el("div", "debt-allocation-row");
        var label = APP.dom.el("div", "debt-allocation-debt");
        var amountControl = APP.dom.el(
          "label",
          "debt-allocation-control"
        );

        var input = APP.dom.el("input");

        var initialAmount = existing ?
          (existingAllocations[debt.id] || 0) :
          (prefillMinimums ?
            APP.utils.money(debt.minimumMonthlyPayment) :
            0);

                input.type = "number";
        input.min = "0";
        input.step = "0.01";
        input.value = initialAmount;
        input.className = "debt-allocation-input";
        input.disabled = false;
        input.readOnly = false;

        input.addEventListener("input", updateAllocationSummary);
        input.addEventListener("change", updateAllocationSummary);

               var projection = APP.model.debtProjection(
          debt.id,
          APP.utils.isoDate(new Date())
        );

        var currentBalance = projection ?
          projection.projectedBalance :
          debt.confirmedBalance;

        label.appendChild(APP.dom.el(
          "strong",
          "",
          debt.name
        ));

        label.appendChild(APP.dom.el(
          "span",
          "muted",
          "Current projected balance: " +
          APP.utils.currency(currentBalance)
        ));

        label.appendChild(APP.dom.el(
          "span",
          "muted",
          "Minimum payment: " +
          APP.utils.currency(debt.minimumMonthlyPayment)
        ));

                amountControl.appendChild(APP.dom.el(
          "span",
          "",
          "Allocate payment"
        ));

        amountControl.appendChild(APP.ui.moneyInput(input));

        row.appendChild(label);
        row.appendChild(amountControl);
        allocationRows.appendChild(row);

        allocationInputs.push({
          debtId: debt.id,
          input: input
        });
      });

      if (!existing && prefillMinimums) {
        var minimumTotal = allocationTotal();

        if (
          APP.utils.money(amount.input.value) === 0 ||
          APP.utils.text(amount.input.value) === ""
        ) {
          amount.input.value = minimumTotal;
        }
      }

      updateAllocationSummary();
    }

    function roundUpAmount() {
      var value = APP.utils.money(amount.input.value);
      return value > 0 ? Math.round((Math.ceil(value) - value) * 100) / 100 : 0;
    }

    function updateRoundUp() {
      var selected = APP.model.categories().byId[category.input.value];
      var extra = roundUpAmount();
      var eligible = type.input.value === "expense" &&
        !(selected && selected.isSavingsFund) && extra > 0;

      roundUp.style.display = eligible ? "" : "none";
      roundUpText.textContent = "Round up to " +
        APP.utils.currency(APP.utils.money(amount.input.value) + extra) + " and save " +
        APP.utils.currency(extra) + " to " + APP.pages.transactions.roundUpFundName();
    }

    function updateCategoryField() {
      var isIncome = type.input.value === "income";
      var isRefund = isIncome && incomeType.input.value === "refund";

      category.root.style.display = isIncome ? "none" : "";
      incomeType.root.style.display = isIncome ? "" : "none";
      refundCategory.root.style.display = isRefund ? "" : "none";

      if (isIncome) {
        category.input.value = "";
        allocationPanel.style.display = "none";
      } else {
        renderDebtAllocations(!existing);
      }

      updateRoundUp();
    }

    type.input.addEventListener("change", updateCategoryField);
    incomeType.input.addEventListener("change", updateCategoryField);
    amount.input.addEventListener("input", updateRoundUp);
    category.input.addEventListener("change", updateRoundUp);

        category.input.addEventListener("change", function () {
      if (
        type.input.value === "savings" &&
        category.input.value === "__new_savings_fund__"
      ) {
        APP.pages.savings.openFundModal(function (fund) {
          var option = APP.dom.el(
            "option",
            "",
            fund.name
          );

          option.dataset.group = "Savings fund";

          option.value = fund.id;
          option.selected = true;

          category.input.appendChild(option);
          category.input.value = fund.id;

          renderDebtAllocations(false);
        });

        return;
      }

      transaction.debtAllocations = [];
      renderDebtAllocations(true);
    });

    amount.input.addEventListener("input", updateAllocationSummary);

    updateCategoryField();

    // Type as a row of buttons (the select stays, hidden, for the existing logic).
    type.root.hidden = true;
    form.classList.add("transaction-form");
    form.appendChild(APP.ui.segmented(type.input, [
      { value: "expense", label: "Expense", tone: "tone-expense" },
      { value: "income", label: "Income", tone: "tone-income" },
      { value: "savings", label: "Savings", tone: "tone-savings" }
    ]));
    amount.root.classList.add("full", "amount-hero");
    description.root.classList.add("full");

    [
      amount,
      description,
      type,
      category,
      incomeType,
      refundCategory,
      date,
      notes
    ].forEach(function (field) {
      form.appendChild(field.root);
    });

    form.appendChild(roundUp);
    form.appendChild(allocationPanel);

    APP.ui.tagCategoryOptions(category.input);
    APP.ui.tagCategoryOptions(refundCategory.input);
    APP.ui.searchSelect(category.input, { placeholder: "Search categories" });
    APP.ui.searchSelect(refundCategory.input, { placeholder: "Search categories" });
    updateCategoryField();

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var parsedDate = APP.utils.parseDate(date.input.value);

      var allocations = allocationInputs
        .map(function (item) {
          return {
            debtId: item.debtId,
            amount: APP.utils.money(item.input.value)
          };
        })
        .filter(function (allocation) {
          return allocation.amount > 0;
        });

      var isIncome = type.input.value === "income";
      var isRefund = isIncome && incomeType.input.value === "refund";

      var candidate = {
        id: existing ? existing.id : APP.utils.id("txn"),
        date: parsedDate ? APP.utils.isoDate(parsedDate) : "",
        month: parsedDate ? APP.utils.month(parsedDate) : "",
        description: APP.utils.text(description.input.value),
        categoryId: isRefund ? refundCategory.input.value || "" :
          isIncome ? "" : category.input.value || "",
        type: type.input.value,
        incomeType: isIncome ? incomeType.input.value : undefined,
        amount: APP.utils.money(amount.input.value),
        notes: APP.utils.text(notes.input.value),
        debtAllocations: allocations,
        createdAt: existing ?
          existing.createdAt :
          new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existing && existing.roundUpFor) {
        candidate.roundUpFor = existing.roundUpFor;
      }

      var errors = APP.model.validateTransaction(candidate);

      if (errors.length) {
        APP.dom.toast(errors.join(" "), "danger");
        return;
      }

      APP.pages.transactions.applyRoundUp(
        candidate,
        roundUp.style.display !== "none" && roundUpCheck.checked ? roundUpAmount() : 0
      );

      if (existing) {
        APP.state.transactions = APP.state.transactions.map(function (item) {
          return item.id === candidate.id ? candidate : item;
        });

        APP.store.log(
          "success",
          "Updated transaction: " +
          candidate.description + "."
        );
      } else {
        APP.state.transactions.push(candidate);

        APP.store.log(
          "success",
          "Added transaction: " +
          candidate.description + "."
        );
      }

      APP.ui.closeModal();
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var cancel = APP.ui.button("Cancel");
    var save = APP.ui.button(
      existing ? "Save changes" : "Add transaction",
      "button-primary"
    );

    save.type = "submit";

    cancel.addEventListener("click", APP.ui.closeModal);

    if (existing) {
      var remove = APP.ui.button("Delete", "button-quiet danger modal-delete");

      remove.addEventListener("click", function () {
        APP.pages.transactions.deleteTransaction(existing.id);

        if (!APP.state.transactions.some(function (item) { return item.id === existing.id; })) {
          APP.ui.closeModal();
        }
      });
      actions.appendChild(remove);
    }

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    APP.ui.modal(
      existing ? "Edit transaction" : "Add transaction",
      form,
      { size: "sheet" }
    );
  };

  // Round-up preferences live in settings so every device and person shares them.
  APP.pages.transactions.roundUpSettings = function () {
    var settings = APP.state.settings.roundUp || {};

    return {
      defaultOn: Boolean(settings.defaultOn),
      fundId: settings.fundId || ""
    };
  };

  APP.pages.transactions.roundUpFund = function (create) {
    var settings = APP.pages.transactions.roundUpSettings();
    var fund = APP.state.categories.filter(function (category) {
      return category.id === settings.fundId && category.isSavingsFund && !category.archived;
    })[0];

    if (fund || !create) {
      return fund || null;
    }

    fund = APP.state.categories.filter(function (category) {
      return category.isSavingsFund && !category.archived &&
        APP.utils.header(category.name) === "round up savings";
    })[0];

    if (!fund) {
      fund = {
        id: APP.utils.id("cat"),
        group: "Savings and Funds",
        name: "Round-Up Savings",
        isSavingsFund: true,
        isDebtCategory: false,
        isTemporary: false,
        archived: false,
        openingBalance: 0,
        openingBalanceEffectiveMonth: "",
        eventualSavingsGoal: 0,
        eventualSavingsGoalDate: "",
        createdAt: new Date().toISOString()
      };
      APP.state.categories.push(fund);
      APP.store.log("success", "Created the Round-Up Savings fund.");
    }

    APP.state.settings.roundUp = { defaultOn: settings.defaultOn, fundId: fund.id };
    return fund;
  };

  APP.pages.transactions.roundUpFundName = function () {
    var fund = APP.pages.transactions.roundUpFund(false);
    return fund ? fund.name : "Round-Up Savings";
  };

  // Creates, updates or removes the savings transaction that holds an expense's
  // round-up. extra is the amount to save (0 removes it).
  APP.pages.transactions.applyRoundUp = function (expense, extra) {
    var previous = APP.state.transactions.filter(function (item) {
      return item.roundUpFor === expense.id;
    })[0];

    if (!extra || expense.type !== "expense") {
      if (previous) {
        APP.state.transactions = APP.state.transactions.filter(function (item) {
          return item !== previous;
        });
      }

      delete expense.roundUpId;
      return;
    }

    var fund = APP.pages.transactions.roundUpFund(true);
    var saved = {
      id: previous ? previous.id : APP.utils.id("txn"),
      date: expense.date,
      month: expense.month,
      description: "Round-up: " + expense.description,
      categoryId: fund.id,
      type: "savings",
      amount: extra,
      notes: "",
      debtAllocations: [],
      roundUpFor: expense.id,
      createdAt: previous ? previous.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (previous) {
      APP.state.transactions = APP.state.transactions.map(function (item) {
        return item === previous ? saved : item;
      });
    } else {
      APP.state.transactions.push(saved);
    }

    expense.roundUpId = saved.id;
  };

  APP.pages.transactions.defaultFilters = function () {
    return {
      search: "",
      type: "",
      categoryId: "",
      period: "selectedMonth",
      fromDate: "",
      toDate: "",
      minAmount: "",
      maxAmount: "",
      sort: "newest",
      page: 1,
      pageSize: 50
    };
  };

  // How many filters (other than search, sort and page size) differ from the defaults.
  APP.pages.transactions.activeFilterCount = function () {
    var filters = APP.pages.transactions.filters;
    var defaults = APP.pages.transactions.defaultFilters();

    return ["type", "categoryId", "period", "fromDate", "toDate", "minAmount", "maxAmount"]
      .filter(function (key) {
        return String(filters[key]) !== String(defaults[key]);
      }).length;
  };

  // The table on wide screens and the grouped list on phones; CSS shows the right one.
  APP.pages.transactions.results = function (rows, options) {
    var sort = APP.pages.transactions.filters.sort;
    var box = APP.dom.el("div", "transaction-results");

    box.appendChild(APP.tables.transactions(rows, options));
    box.appendChild(APP.tables.transactionList(rows, {
      grouped: sort === "newest" || sort === "oldest"
    }));
    box.addEventListener("click", APP.pages.transactions.handleTableAction);
    return box;
  };

  APP.pages.transactions.periodLabel = function () {
    var filters = APP.pages.transactions.filters;

    if (filters.fromDate || filters.toDate) {
      return (filters.fromDate || "…") + " to " + (filters.toDate || "…");
    }

    return {
      selectedMonth: APP.controller.monthName(APP.state.settings.selectedMonth),
      last3Months: "Last 3 months",
      last6Months: "Last 6 months",
      currentYear: APP.state.settings.selectedMonth.slice(0, 4),
      all: "All dates"
    }[filters.period] || "";
  };

  APP.pages.transactions.openFullView = function () {
    var rows = APP.pages.transactions.filteredRows();
    var content = APP.dom.el("div", "transaction-full-view");

    content.appendChild(APP.dom.el("p", "muted transaction-full-count",
      rows.length + (rows.length === 1 ? " transaction" : " transactions") + " · " +
      APP.pages.transactions.periodLabel()));
    content.appendChild(APP.pages.transactions.results(rows, { fullView: true }));

    APP.ui.modal("All transactions", content, { size: "full" });
  };

  APP.pages.transactions.render = function () {
    var root = APP.dom.refs.pages.transactions;
    var filters = APP.pages.transactions.filters;
    var page = APP.pages.transactions;

    // ---- Toolbar: search, filters toggle, full view

    var toolbar = APP.dom.el("div", "transaction-toolbar");
    var searchWrap = APP.dom.el("label", "transaction-search");
    var search = APP.dom.el("input");
    var filterToggle = APP.ui.button("Filters", "button-secondary filter-toggle");
    var fullViewButton = APP.ui.button("Full view", "button-secondary");
    var activeCount = page.activeFilterCount();

    search.type = "search";
    search.value = filters.search;
    search.placeholder = "Search transactions";
    search.setAttribute("aria-label", "Search transactions");
    searchWrap.appendChild(APP.dom.el("span", "transaction-search-icon", "⌕"));
    searchWrap.appendChild(search);

    filterToggle.setAttribute("aria-expanded", page.filtersOpen ? "true" : "false");

    if (activeCount) {
      filterToggle.appendChild(APP.dom.el("span", "filter-count", String(activeCount)));
    }

    toolbar.appendChild(searchWrap);
    toolbar.appendChild(filterToggle);
    toolbar.appendChild(fullViewButton);

    // ---- Filters panel (collapsed until opened)

    var filterPanel = APP.dom.el("div", "transaction-filter-panel");
    var filterGrid = APP.dom.el("div", "transaction-filter-grid");

    filterPanel.hidden = !page.filtersOpen;

    var type = APP.ui.field("Type", "type", "select", filters.type, {
      options: [
        { value: "", label: "All types" },
        { value: "income", label: "Income" },
        { value: "refund", label: "Refund" },
        { value: "operatingExpense", label: "Expense" },
        { value: "savingsContribution", label: "Savings contribution" },
        { value: "freeMoneyContribution", label: "Moved to Free Money" },
        { value: "savingsWithdrawal", label: "Savings-funded expense" },
        { value: "debtPayment", label: "Debt payment" }
      ]
    });

    var category = APP.ui.field("Category", "category", "select", filters.categoryId, {
      options: page.categoryOptions()
    });

    var period = APP.ui.field("Date range", "period", "select", filters.period, {
      options: [
        { value: "selectedMonth", label: "Selected reporting month" },
        { value: "last3Months", label: "Last 3 months" },
        { value: "last6Months", label: "Last 6 months" },
        { value: "currentYear", label: "Selected calendar year" },
        { value: "all", label: "All dates" }
      ]
    });

    var fromDate = APP.ui.field("From", "fromDate", "date", filters.fromDate);
    var toDate = APP.ui.field("To", "toDate", "date", filters.toDate);
    var minimum = APP.ui.field("Min amount", "minimum", "number", filters.minAmount, { min: "0", step: "0.01" });
    var maximum = APP.ui.field("Max amount", "maximum", "number", filters.maxAmount, { min: "0", step: "0.01" });

    var sort = APP.ui.field("Sort by", "sort", "select", filters.sort, {
      options: [
        { value: "newest", label: "Newest first" },
        { value: "oldest", label: "Oldest first" },
        { value: "highest", label: "Highest amount" },
        { value: "lowest", label: "Lowest amount" },
        { value: "description", label: "Description" },
        { value: "category", label: "Category" }
      ]
    });

    var pageSizeField = APP.ui.field("Per page", "pageSize", "select", String(filters.pageSize || 50), {
      options: [
        { value: "25", label: "25" },
        { value: "50", label: "50" },
        { value: "100", label: "100" }
      ]
    });

    [type, category, period, sort, fromDate, toDate, minimum, maximum, pageSizeField].forEach(function (field) {
      filterGrid.appendChild(field.root);
    });

    APP.ui.tagCategoryOptions(category.input);
    APP.ui.searchSelect(category.input, { placeholder: "All categories" });

    var filterActions = APP.dom.el("div", "transaction-filter-actions");
    var clearFilters = APP.ui.button("Clear filters", "button-quiet");
    var exportButton = APP.ui.button("Export CSV", "button-quiet");

    filterActions.appendChild(clearFilters);
    filterActions.appendChild(exportButton);
    filterPanel.appendChild(filterGrid);
    filterPanel.appendChild(filterActions);

    // ---- Results: redrawn on their own so typing in search keeps focus

    var summary = APP.dom.el("p", "transaction-summary");
    var resultsHolder = APP.dom.el("div");
    var pagination = APP.dom.el("div", "transaction-pagination");
    var rows = [];

    function renderResults() {
      rows = page.filteredRows();

      var pageSize = Math.max(1, Number(filters.pageSize || 50));
      var pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

      filters.page = Math.min(Math.max(1, filters.page), pageCount);

      var start = (filters.page - 1) * pageSize;
      var end = Math.min(start + pageSize, rows.length);
      var totals = { income: 0, out: 0 };

      rows.forEach(function (transaction) {
        var tone = APP.tables.transactionTone(transaction);
        totals[tone.typeClass === "transaction-income" ? "income" : "out"] += APP.utils.money(transaction.amount);
      });

      APP.dom.clear(summary);
      summary.appendChild(APP.dom.el("span", "", rows.length + (rows.length === 1 ? " transaction" : " transactions") +
        " · " + page.periodLabel()));

      if (rows.length) {
        summary.appendChild(APP.dom.el("span", "money-income", "+" + APP.utils.currency(totals.income) + " in"));
        summary.appendChild(APP.dom.el("span", "money-expense", "−" + APP.utils.currency(totals.out) + " out"));
      }

      APP.dom.clear(resultsHolder);
      resultsHolder.appendChild(page.results(rows.slice(start, end)));

      APP.dom.clear(pagination);
      pagination.hidden = pageCount <= 1;

      if (pageCount > 1) {
        var previous = APP.ui.button("‹ Previous");
        var next = APP.ui.button("Next ›");

        previous.disabled = filters.page <= 1;
        next.disabled = filters.page >= pageCount;
        previous.addEventListener("click", function () {
          filters.page -= 1;
          renderResults();
          summary.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        next.addEventListener("click", function () {
          filters.page += 1;
          renderResults();
          summary.scrollIntoView({ block: "start", behavior: "smooth" });
        });

        pagination.appendChild(previous);
        pagination.appendChild(APP.dom.el("span", "muted",
          (start + 1) + "–" + end + " of " + rows.length));
        pagination.appendChild(next);
      }
    }

    function updateFilterCount() {
      var count = page.activeFilterCount();
      var badge = filterToggle.querySelector(".filter-count");

      if (!count && badge) {
        badge.remove();
      } else if (count) {
        if (!badge) {
          badge = APP.dom.el("span", "filter-count");
          filterToggle.appendChild(badge);
        }
        badge.textContent = String(count);
      }
    }

    function refreshFilters() {
      filters.type = type.input.value;
      filters.categoryId = category.input.value;
      filters.period = period.input.value;
      filters.fromDate = fromDate.input.value;
      filters.toDate = toDate.input.value;
      filters.minAmount = minimum.input.value;
      filters.maxAmount = maximum.input.value;
      filters.sort = sort.input.value;
      filters.pageSize = Number(pageSizeField.input.value);
      filters.page = 1;

      updateFilterCount();
      renderResults();
    }

    search.addEventListener("input", function () {
      filters.search = search.value;
      filters.page = 1;
      renderResults();
    });

    [type, category, period, fromDate, toDate, minimum, maximum, sort, pageSizeField].forEach(function (field) {
      field.input.addEventListener("change", refreshFilters);
    });

    filterToggle.addEventListener("click", function () {
      page.filtersOpen = !page.filtersOpen;
      filterPanel.hidden = !page.filtersOpen;
      filterToggle.setAttribute("aria-expanded", page.filtersOpen ? "true" : "false");
    });

    clearFilters.addEventListener("click", function () {
      page.filters = page.defaultFilters();
      page.render();
    });

    exportButton.addEventListener("click", function () {
      APP.exports.download(
        "transactions-filtered.csv",
        "text/csv;charset=utf-8",
        APP.exports.transactionsCsv(rows)
      );
    });

    fullViewButton.addEventListener("click", page.openFullView);

    // Re-rendering (e.g. after a save) rebuilds the search box; keep typing where it was.
    var hadFocus = document.activeElement && document.activeElement.classList &&
      document.activeElement.dataset.role === "transaction-search";

    search.dataset.role = "transaction-search";

    APP.dom.clear(root);
    root.appendChild(toolbar);
    root.appendChild(filterPanel);
    root.appendChild(summary);
    root.appendChild(resultsHolder);
    root.appendChild(pagination);
    renderResults();

    if (hadFocus) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  };
}());
