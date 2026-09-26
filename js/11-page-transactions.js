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
      return item.id !== transactionId;
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

  APP.pages.transactions.openFullView = function () {
    var filters = APP.pages.transactions.filters;
    var rows = APP.pages.transactions.filteredRows();
    var content = APP.dom.el("div", "transaction-full-view");

    var header = APP.dom.el("p", "muted");
    header.textContent =
      rows.length + " filtered transaction(s) shown in full view.";

    var close = APP.ui.button("Close", "button-secondary");

    close.addEventListener("click", APP.ui.closeModal);

    content.appendChild(header);
    content.appendChild(
      APP.tables.transactions(rows, { fullView: true })
    );
    content.appendChild(close);

    content.addEventListener(
      "click",
      APP.pages.transactions.handleTableAction
    );

    APP.ui.modal("Transaction Full View", content);
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
      amount: "",
      notes: "",
      debtAllocations: []
    };

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
          label: category.name +
            (category.isSavingsFund ? " [Savings Fund]" : "")
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
      "Total payment amount",
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
      transaction.categoryId,
      {
        options: categoryOptions
      }
    );

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

        amountControl.appendChild(input);

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

    function updateCategoryField() {
      var isIncome = type.input.value === "income";

      category.root.style.display = isIncome ? "none" : "";
      category.input.required = !isIncome;

      if (isIncome) {
        category.input.value = "";
        allocationPanel.style.display = "none";
      } else {
        renderDebtAllocations(!existing);
      }
    }

    type.input.addEventListener("change", updateCategoryField);

        category.input.addEventListener("change", function () {
      if (
        type.input.value === "savings" &&
        category.input.value === "__new_savings_fund__"
      ) {
        APP.pages.savings.openFundModal(function (fund) {
          var option = APP.dom.el(
            "option",
            "",
            fund.name + " [Savings Fund]"
          );

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

    [
      date,
      amount,
      description,
      type,
      category,
      notes
    ].forEach(function (field) {
      form.appendChild(field.root);
    });

    form.appendChild(allocationPanel);

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

      var candidate = {
        id: existing ? existing.id : APP.utils.id("txn"),
        date: parsedDate ? APP.utils.isoDate(parsedDate) : "",
        month: parsedDate ? APP.utils.month(parsedDate) : "",
        description: APP.utils.text(description.input.value),
        categoryId: category.input.value || "",
        type: type.input.value,
        amount: APP.utils.money(amount.input.value),
        notes: APP.utils.text(notes.input.value),
        debtAllocations: allocations,
        createdAt: existing ?
          existing.createdAt :
          new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      var errors = APP.model.validateTransaction(candidate);

      if (errors.length) {
        APP.dom.toast(errors.join(" "), "danger");
        return;
      }

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

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    APP.ui.modal(
      existing ? "Edit transaction" : "Add transaction",
      form
    );
  };

  APP.pages.transactions.render = function () {
    var root = APP.dom.refs.pages.transactions;
    var filters = APP.pages.transactions.filters;
    var allRows = APP.pages.transactions.filteredRows();

    var pageSize = Math.max(1, Number(filters.pageSize || 50));
    var pageCount = Math.max(1, Math.ceil(allRows.length / pageSize));

    if (filters.page > pageCount) {
      filters.page = pageCount;
    }

    var start = (filters.page - 1) * pageSize;
    var end = Math.min(start + pageSize, allRows.length);
    var visibleRows = allRows.slice(start, end);

    var controls = APP.dom.el("div", "button-row");
    var exportButton = APP.ui.button("Export filtered CSV");
    var fullViewButton = APP.ui.button("Full View");
    var filterGrid = APP.dom.el("div", "transaction-filter-grid");
    var pagination = APP.dom.el("div", "transaction-pagination");

    var search = APP.ui.field(
      "Search",
      "search",
      "search",
      filters.search,
      {
        placeholder: "Description, notes, or category"
      }
    );

    var type = APP.ui.field(
      "Transaction type",
      "type",
      "select",
      filters.type,
      {
        options: [
          { value: "", label: "All types" },
          { value: "income", label: "Income" },
          { value: "operatingExpense", label: "Expense" },
          { value: "savingsContribution", label: "Savings contribution" },
          { value: "savingsWithdrawal", label: "Savings-funded expense" },
          { value: "debtPayment", label: "Debt payment" }
        ]
      }
    );

    var category = APP.ui.field(
      "Category",
      "category",
      "select",
      filters.categoryId,
      {
        options: APP.pages.transactions.categoryOptions()
      }
    );

    var period = APP.ui.field(
      "Date range",
      "period",
      "select",
      filters.period,
      {
        options: [
          { value: "selectedMonth", label: "Selected reporting month" },
          { value: "last3Months", label: "Last 3 months" },
          { value: "last6Months", label: "Last 6 months" },
          { value: "currentYear", label: "Selected calendar year" },
          { value: "all", label: "All dates" }
        ]
      }
    );

    var fromDate = APP.ui.field(
      "From date",
      "fromDate",
      "date",
      filters.fromDate
    );

    var toDate = APP.ui.field(
      "To date",
      "date",
      filters.toDate
    );

    var minimum = APP.ui.field(
      "Minimum amount",
      "minimum",
      "number",
      filters.minAmount,
      {
        min: "0",
        step: "0.01"
      }
    );

    var maximum = APP.ui.field(
  "Maximum amount",
  "maximum",
  "number",
  filters.maxAmount,
      {
        min: "0",
        step: "0.01"
      }
    );

    var sort = APP.ui.field(
      "Sort by",
      "sort",
      "select",
      filters.sort,
      {
        options: [
          { value: "newest", label: "Newest date" },
          { value: "oldest", label: "Oldest date" },
          { value: "highest", label: "Highest amount" },
          { value: "lowest", label: "Lowest amount" },
          { value: "description", label: "Description" },
          { value: "category", label: "Category" }
        ]
      }
    );

    var pageSizeField = APP.ui.field(
      "Rows per page",
      "pageSize",
      "select",
      String(pageSize),
      {
        options: [
          { value: "25", label: "25" },
          { value: "50", label: "50" },
          { value: "100", label: "100" }
        ]
      }
    );

    var clearFilters = APP.ui.button("Clear filters");

    function refreshFilters() {
      filters.search = search.input.value;
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

      APP.pages.transactions.render();
    }

    [
      search.input,
      type.input,
      category.input,
      period.input,
      fromDate.input,
      toDate.input,
      minimum.input,
      maximum.input,
      sort.input,
      pageSizeField.input
    ].forEach(function (input) {
      input.addEventListener(
        input.type === "search" ? "input" : "change",
        refreshFilters
      );
    });

    clearFilters.addEventListener("click", function () {
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

      APP.pages.transactions.render();
    });

    exportButton.addEventListener("click", function () {
      APP.exports.download(
        "transactions-filtered.csv",
        "text/csv;charset=utf-8",
        APP.exports.transactionsCsv(allRows)
      );
    });

    fullViewButton.addEventListener("click", function () {
      APP.pages.transactions.openFullView();
    });

    [
      search,
      type,
      category,
      period,
      fromDate,
      toDate,
      minimum,
      maximum,
      sort,
      pageSizeField
    ].forEach(function (field) {
      filterGrid.appendChild(field.root);
    });

    controls.appendChild(exportButton);
    controls.appendChild(fullViewButton);
    controls.appendChild(clearFilters);

    var previous = APP.ui.button("Previous");
    var next = APP.ui.button("Next");

    previous.disabled = filters.page <= 1;
    next.disabled = filters.page >= pageCount;

    previous.addEventListener("click", function () {
      filters.page = Math.max(1, filters.page - 1);
      APP.pages.transactions.render();
    });

    next.addEventListener("click", function () {
      filters.page = Math.min(pageCount, filters.page + 1);
      APP.pages.transactions.render();
    });

    pagination.appendChild(APP.dom.el(
      "span",
      "muted",
      allRows.length ?
        "Showing " + (start + 1) + "–" + end +
        " of " + allRows.length + " transactions" :
        "Showing 0 transactions"
    ));

    pagination.appendChild(previous);
    pagination.appendChild(APP.dom.el(
      "span",
      "muted",
      "Page " + filters.page + " of " + pageCount
    ));
    pagination.appendChild(next);

    APP.dom.clear(root);

    root.appendChild(APP.ui.panelHeader(
      "Transactions",
      "Use filters to search transaction history without changing the dashboard reporting month.",
      controls
    ));

       var transactionTable = APP.tables.transactions(visibleRows);

    transactionTable.addEventListener(
      "click",
      APP.pages.transactions.handleTableAction
    );

    root.appendChild(filterGrid);
    root.appendChild(transactionTable);
    root.appendChild(pagination);
  };
}());