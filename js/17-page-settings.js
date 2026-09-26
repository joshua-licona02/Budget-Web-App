(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.settings = {};

  APP.pages.settings.createFileInput = function () {
    var input = APP.dom.el("input");
    input.type = "file";
    input.accept = ".json";
    input.hidden = true;
    return input;
  };

  APP.pages.settings.exportButton = function (label, handler) {
    var button = APP.ui.button(label);
    button.addEventListener("click", handler);
    return button;
  };

  APP.pages.settings.importEntity = function (entityName, file) {
    APP.exports.readJson(file).then(function (payload) {
      if (
        !payload ||
        payload.exportType !== entityName ||
        !Array.isArray(payload.data)
      ) {
        throw new Error(
          "This file is not a valid " + entityName + " export."
        );
      }

      if (!window.confirm(
        "Replace current " + entityName +
        " data with " + payload.data.length +
        " imported record(s)?"
      )) {
        return;
      }

      if (entityName === "transactions") {
        APP.state.transactions = payload.data;
      }

      if (entityName === "monthlyPlans") {
        APP.state.budgets = payload.data;
      }

      if (entityName === "savingsFunds") {
        APP.state.categories =
          APP.state.categories.filter(function (category) {
            return !category.isSavingsFund;
          }).concat(payload.data);
      }

      if (entityName === "debts") {
        APP.state.debts = payload.data;
      }

      if (entityName === "categories") {
        APP.state.categories = payload.data;
      }

      if (entityName === "dashboardVisuals") {
        APP.state.settings.dashboardVisuals = payload.data;
      }

      APP.model.initialize();
      APP.model.migrateTransactions();

      APP.store.log(
        "success",
        "Imported " + payload.data.length +
        " " + entityName + " record(s)."
      );

      APP.controller.commit();
    }).catch(function (error) {
      APP.dom.toast(error.message, "danger");
    });
  };

  APP.pages.settings.section = function (
    title,
    subtitle
  ) {
    var section = APP.dom.el(
      "section",
      "settings-data-section"
    );

    section.appendChild(APP.ui.panelHeader(
      title,
      subtitle
    ));

    return section;
  };
  APP.pages.settings.importWorkbook = function (file) {
    APP.exports.readWorkbook(file).then(function (workbookData) {
      var summary = APP.exports.workbookSummary(workbookData);

      var lines = summary.map(function (sheet) {
        return sheet.name + ": " + sheet.count + " row(s)";
      });

      if (!window.confirm(
        "Workbook sheets found:\n\n" +
        lines.join("\n") +
        "\n\nImport available sheets? Existing collections with matching sheets will be replaced."
      )) {
        return;
      }

      var rows = APP.exports.workbookRowsToState(workbookData);
      var categoryByName = {};

      if (rows.categories.length) {
        APP.state.categories = rows.categories.map(function (row) {
          return {
            id: APP.utils.id("cat"),
            name: APP.utils.text(row.Name),
            group: APP.utils.text(row.OrganizationGroup) || "Other",
            isSavingsFund: String(row.SavingsFund).toLowerCase() === "yes",
            isDebtCategory: String(row.DebtCategory).toLowerCase() === "yes",
            isTemporary: String(row.Temporary).toLowerCase() === "yes",
            archived: String(row.Status).toLowerCase() === "archived",
            openingBalance: APP.utils.money(row.OpeningBalance),
            openingBalanceEffectiveMonth:
              row.OpeningBalanceEffectiveMonth || "",
            eventualSavingsGoal:
              APP.utils.money(row.EventualSavingsGoal),
            eventualSavingsGoalDate:
              row.EventualSavingsGoalDate || "",
            createdAt: new Date().toISOString()
          };
        });
      }

      APP.state.categories.forEach(function (category) {
        categoryByName[APP.utils.header(category.name)] = category;
      });

      if (rows.savingsFunds.length && !rows.categories.length) {
        rows.savingsFunds.forEach(function (row) {
          var existing = categoryByName[
            APP.utils.header(row.Name)
          ];

          if (existing) {
            existing.isSavingsFund = true;
            existing.openingBalance =
              APP.utils.money(row.OpeningBalance);
            existing.openingBalanceEffectiveMonth =
              row.OpeningBalanceEffectiveMonth || "";
            existing.eventualSavingsGoal =
              APP.utils.money(row.EventualSavingsGoal);
            existing.eventualSavingsGoalDate =
              row.EventualSavingsGoalDate || "";
          }
        });
      }

      if (rows.debts.length) {
        APP.state.debts = rows.debts.map(function (row) {
          var category = categoryByName[
            APP.utils.header(row.PaymentCategory)
          ];

          return {
            id: APP.utils.id("debt"),
            name: APP.utils.text(row.Name),
            categoryId: category ? category.id : "",
            confirmedBalance:
              APP.utils.money(row.ConfirmedBalance),
            balanceAsOfDate: row.BalanceAsOfDate || "",
            apr: APP.utils.money(row.APR),
            minimumMonthlyPayment:
              APP.utils.money(row.MinimumMonthlyPayment),
            notes: APP.utils.text(row.Notes),
            archived:
              String(row.Status).toLowerCase() === "archived",
            createdAt: new Date().toISOString()
          };
        });
      }

      if (rows.monthlyPlans.length) {
        var budgetsByMonth = {};

        rows.monthlyPlans.forEach(function (row) {
          var month = row.BudgetMonth;
          var category = categoryByName[
            APP.utils.header(row.Category)
          ];

          if (!month || !category) {
            return;
          }

          if (!budgetsByMonth[month]) {
            budgetsByMonth[month] = {
              id: APP.utils.id("budget"),
              month: month,
              expectedIncome:
                APP.utils.money(row.ExpectedIncome),
              items: []
            };
          }

          budgetsByMonth[month].items.push({
            categoryId: category.id,
            dollarTarget:
              APP.utils.money(row.DollarTarget)
          });
        });

        APP.state.budgets = Object.keys(budgetsByMonth)
          .map(function (month) {
            return budgetsByMonth[month];
          });
      }

      if (rows.transactions.length) {
        APP.state.transactions = rows.transactions.map(function (row) {
          var category = categoryByName[
            APP.utils.header(row.Category)
          ];

          var rawType = APP.utils.header(row.Type);
          var type = rawType === "income" ?
            "income" :
            rawType === "savings contribution" ?
              "savings" :
              "expense";

          var parsedDate = APP.utils.parseDate(row.Date);

          return {
            id: APP.utils.id("txn"),
            date: parsedDate ?
              APP.utils.isoDate(parsedDate) :
              "",
            month: parsedDate ?
              APP.utils.month(parsedDate) :
              "",
            description: APP.utils.text(row.Description),
            categoryId: category ? category.id : "",
            type: type,
            amount: APP.utils.money(row.Amount),
            notes: APP.utils.text(row.Notes),
            debtAllocations: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
      }

      if (rows.dashboardVisuals.length) {
        APP.state.settings.dashboardVisuals =
          rows.dashboardVisuals;
      }

      if (rows.salarySettings.length) {
        var salary = rows.salarySettings[0];

        APP.state.salary = {
          annualGrossSalary:
            APP.utils.money(salary.AnnualGrossSalary),
          payPeriodsPerYear:
            APP.utils.money(salary.PayPeriodsPerYear),
          federalWithholdingPct:
            APP.utils.money(salary.FederalWithholdingPct),
          stateWithholdingPct:
            APP.utils.money(salary.StateWithholdingPct),
          retirementContributionPct:
            APP.utils.money(salary.RetirementContributionPct),
          fixedDeductionsPerPaycheck:
            APP.utils.money(salary.FixedDeductionsPerPaycheck)
        };
      }

      APP.model.initialize();
      APP.model.migrateTransactions();

      APP.store.log(
        "success",
        "Imported available Excel workbook sheets."
      );

      APP.controller.commit();
    }).catch(function (error) {
      APP.dom.toast(error.message, "danger");
    });
  };
  APP.pages.settings.render = function () {
    var root = APP.dom.refs.pages.settings;
    var ollama = APP.state.settings.ollama;
    var backupInput =
      APP.pages.settings.createFileInput();
        var workbookInput =
      APP.dom.el("input");

    workbookInput.type = "file";
    workbookInput.accept = ".xlsx";
    workbookInput.hidden = true;
    APP.dom.clear(root);

    var page = APP.dom.el(
      "section",
      "settings-page"
    );

    page.appendChild(APP.ui.panelHeader(
      "Settings",
      "Manage preferences, categories, Ollama connection, local backups, and portable data exports."
    ));

    var overview = APP.dom.el(
      "div",
      "fund-hero settings-summary-grid"
    );

    overview.appendChild(APP.ui.currencyCard(
      "Stored transactions",
      APP.state.transactions.length
    ));

    overview.appendChild(APP.ui.currencyCard(
      "Savings funds",
      APP.state.categories.filter(function (category) {
        return category.isSavingsFund;
      }).length
    ));

    overview.appendChild(APP.ui.currencyCard(
      "Tracked debts",
      APP.state.debts.filter(function (debt) {
        return !debt.archived;
      }).length
    ));

    var currencyCard = APP.dom.el(
      "article",
      "summary-card"
    );

    currencyCard.appendChild(APP.dom.el(
      "span",
      "",
      "Currency"
    ));

    currencyCard.appendChild(APP.dom.el(
      "strong",
      "",
      APP.state.settings.currency || "USD"
    ));

    overview.appendChild(currencyCard);
    page.appendChild(overview);

    var preferences =
      APP.pages.settings.section(
        "Application Preferences",
        "Changes are saved locally in this browser."
      );

    var currency = APP.ui.field(
      "Currency code",
      "currency",
      "text",
      APP.state.settings.currency || "USD",
      { placeholder: "USD" }
    );

    currency.input.addEventListener("change", function () {
      APP.state.settings.currency =
        APP.utils.text(currency.input.value).toUpperCase() || "USD";

      APP.controller.commit();
    });

    preferences.appendChild(currency.root);
    page.appendChild(preferences);

    var ollamaSection =
      APP.pages.settings.section(
        "Ollama Connection",
        "The configured endpoint receives advisor questions and a minimized financial summary. Do not use a remote endpoint unless you trust it."
      );

    var ollamaForm = APP.dom.el(
      "form",
      "form-grid"
    );

    var endpoint = APP.ui.field(
      "Ollama endpoint",
      "endpoint",
      "url",
      ollama.endpoint,
      {
        full: true,
        placeholder: "http://localhost:11434"
      }
    );

    var model = APP.ui.field(
      "Model name",
      "model",
      "text",
      ollama.model,
      { placeholder: "qwen3:8b" }
    );

    var timeout = APP.ui.field(
      "Stall timeout in milliseconds (max pause between streamed words)",
      "timeout",
      "number",
      ollama.timeoutMs,
      { min: "1000", step: "1000" }
    );

    var contextLength = APP.ui.field(
      "Context window in tokens",
      "contextLength",
      "number",
      ollama.contextLength || 8192,
      { min: "2048", step: "1024" }
    );

    [endpoint, model, timeout, contextLength].forEach(function (field) {
      ollamaForm.appendChild(field.root);
    });

    var ollamaActions = APP.dom.el(
      "div",
      "modal-actions full"
    );

    var saveOllama = APP.ui.button(
      "Save Connection",
      "button-primary"
    );

    var testOllama = APP.ui.button(
      "Test Connection"
    );

    saveOllama.type = "submit";

    ollamaForm.addEventListener("submit", function (event) {
      event.preventDefault();

      ollama.endpoint =
        APP.utils.text(endpoint.input.value).replace(/\/$/, "");

      ollama.model = APP.utils.text(model.input.value);

      ollama.timeoutMs = Math.max(
        1000,
        APP.utils.number(timeout.input.value) || 30000
      );

      ollama.contextLength = Math.max(
        2048,
        APP.utils.number(contextLength.input.value) || 8192
      );

      APP.store.log("success", "Ollama settings saved.");
      APP.controller.commit();
    });

    testOllama.addEventListener("click", function () {
      var address =
        (APP.utils.text(endpoint.input.value) || APP.pages.advisor.defaultEndpoint).replace(/\/$/, "");

      var modelName = APP.utils.text(model.input.value);

      if (!address) {
        APP.dom.toast("Enter an Ollama endpoint first.", "danger");
        return;
      }

      testOllama.disabled = true;
      testOllama.textContent = "Testing...";

      fetch(address + "/api/tags")
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }

          return response.json();
        })
        .then(function (data) {
          var modelExists = (data.models || []).some(function (item) {
            return item.name === modelName ||
              item.model === modelName;
          });

          APP.dom.toast(
            modelExists ?
              "Endpoint reachable and configured model available." :
              "Endpoint reachable, but configured model was not found.",
            modelExists ? "success" : "danger"
          );
        })
        .catch(function () {
          APP.dom.toast(
            "Endpoint unreachable or blocked by CORS. Verify Ollama is running, the endpoint is correct, and browser access is allowed.",
            "danger"
          );
        })
        .finally(function () {
          testOllama.disabled = false;
          testOllama.textContent = "Test Connection";
        });
    });

    ollamaActions.appendChild(testOllama);
    ollamaActions.appendChild(saveOllama);
    ollamaForm.appendChild(ollamaActions);
    ollamaSection.appendChild(ollamaForm);
    page.appendChild(ollamaSection);

       var categories =
      APP.pages.settings.section(
        "Categories",
        "Manage categories, savings funds, debt categories, temporary categories, and organization groups."
      );

    categories.classList.add("settings-category-section");

    APP.pages.categories.render(categories);
    page.appendChild(categories);

    var backup =
      APP.pages.settings.section(
        "Full Local Backup",
        "Use a full backup before moving data or making major changes."
      );

    var backupControls = APP.dom.el(
      "div",
      "button-row"
    );

    var exportBackup = APP.pages.settings.exportButton(
      "Export Full Backup",
      function () {
        APP.exports.download(
          "budget-dashboard-backup.json",
          "application/json",
          APP.exports.backup()
        );

        APP.store.log("success", "Full backup exported.");
        APP.controller.commit();
      }
    );

    var importBackup = APP.pages.settings.exportButton(
      "Import Full Backup",
      function () {
        backupInput.click();
      }
    );

    backupInput.addEventListener("change", function () {
      var file = backupInput.files[0];

      if (!file) {
        return;
      }

      APP.exports.readBackup(file).then(function (data) {
        if (!window.confirm(
          "Replace all current local dashboard data with this backup?"
        )) {
          return;
        }

        APP.state = data;
        APP.model.initialize();
        APP.model.migrateTransactions();

        APP.store.log("success", "Full backup restored.");
        APP.controller.commit();
      }).catch(function (error) {
        APP.dom.toast(error.message, "danger");
      });
    });

      var exportWorkbook = APP.pages.settings.exportButton(
      "Export Excel Workbook",
      function () {
        try {
          APP.exports.exportWorkbook();

          APP.store.log(
            "success",
            "Multi-tab Excel workbook exported."
          );

          APP.controller.commit();
        } catch (error) {
          APP.dom.toast(error.message, "danger");
        }
      }
    );

        var importWorkbook = APP.pages.settings.exportButton(
      "Import Excel Workbook",
      function () {
        workbookInput.click();
      }
    );

    workbookInput.addEventListener("change", function () {
      var file = workbookInput.files[0];

      if (file) {
        APP.pages.settings.importWorkbook(file);
      }

      workbookInput.value = "";
    });

    backupControls.appendChild(exportBackup);
    backupControls.appendChild(exportWorkbook);
    backupControls.appendChild(importBackup);
    backupControls.appendChild(importWorkbook);
    backupControls.appendChild(backupInput);
    backupControls.appendChild(workbookInput);

    backup.appendChild(backupControls);
    page.appendChild(backup);
    var portability =
      APP.pages.settings.section(
        "Focused Data Portability",
        "Export individual collections for backup or moving data between devices. Focused imports replace only the selected collection."
      );

    var tableWrap = APP.dom.el(
      "div",
      "table-wrap settings-portability-wrap"
    );

    var table = APP.dom.el(
      "table",
      "data-table settings-portability-table"
    );

    var head = APP.dom.el("thead");
    var body = APP.dom.el("tbody");
    var heading = APP.dom.el("tr");

    [
      "Data Set",
      "CSV Export",
      "JSON Export",
      "JSON Import"
    ].forEach(function (label) {
      heading.appendChild(APP.dom.el("th", "", label));
    });

    head.appendChild(heading);

    var dataSets = [
      {
        label: "Transactions",
        key: "transactions",
        csv: function () {
          APP.exports.download(
            "budget-transactions.csv",
            "text/csv;charset=utf-8",
            APP.exports.transactionsCsv(APP.state.transactions)
          );
        }
      },
      {
        label: "Monthly Plans",
        key: "monthlyPlans",
        csv: function () {
          APP.exports.download(
            "budget-monthly-plans.csv",
            "text/csv;charset=utf-8",
            APP.exports.monthlyPlansCsv()
          );
        }
      },
      {
        label: "Savings Funds",
        key: "savingsFunds",
        csv: function () {
          APP.exports.download(
            "budget-savings-funds.csv",
            "text/csv;charset=utf-8",
            APP.exports.savingsFundsCsv()
          );
        }
      },
      {
        label: "Debts",
        key: "debts",
        csv: function () {
          APP.exports.download(
            "budget-debts.csv",
            "text/csv;charset=utf-8",
            APP.exports.debtsCsv()
          );
        }
      },
      {
        label: "Categories",
        key: "categories",
        csv: function () {
          APP.exports.download(
            "budget-categories.csv",
            "text/csv;charset=utf-8",
            APP.exports.categoriesCsv()
          );
        }
      },
      {
        label: "Dashboard Visuals",
        key: "dashboardVisuals",
        csv: null
      }
    ];

    dataSets.forEach(function (dataSet) {
      var row = APP.dom.el("tr");
      var csvCell = APP.dom.el("td");
      var jsonCell = APP.dom.el("td");
      var importCell = APP.dom.el("td");

      var jsonExport = APP.ui.button("Export JSON");
      var importButton = APP.ui.button("Import JSON");
      var importInput =
        APP.pages.settings.createFileInput();

      jsonExport.addEventListener("click", function () {
        APP.exports.exportEntityJson(dataSet.key);

        APP.store.log(
          "success",
          "Exported " + dataSet.label + " JSON."
        );

        APP.controller.commit();
      });

      importButton.addEventListener("click", function () {
        importInput.click();
      });

      importInput.addEventListener("change", function () {
        var file = importInput.files[0];

        if (file) {
          APP.pages.settings.importEntity(
            dataSet.key,
            file
          );
        }

        importInput.value = "";
      });

      row.appendChild(APP.dom.el("td", "", dataSet.label));

      if (dataSet.csv) {
        var csvExport = APP.ui.button("Export CSV");

        csvExport.addEventListener("click", dataSet.csv);
        csvCell.appendChild(csvExport);
      } else {
        csvCell.appendChild(APP.dom.el(
          "span",
          "muted",
          "JSON only"
        ));
      }

      jsonCell.appendChild(jsonExport);
      importCell.appendChild(importButton);
      importCell.appendChild(importInput);

      row.appendChild(csvCell);
      row.appendChild(jsonCell);
      row.appendChild(importCell);

      body.appendChild(row);
    });

    table.appendChild(head);
    table.appendChild(body);
    tableWrap.appendChild(table);
    portability.appendChild(tableWrap);

    page.appendChild(portability);

    var reset =
      APP.pages.settings.section(
        "Reset Local Data",
        "This permanently removes all Budget Dashboard data stored in this browser."
      );

    var resetButton = APP.ui.button(
      "Reset all local data",
      "button-secondary"
    );

    resetButton.addEventListener("click", function () {
      if (window.prompt(
        "Type RESET to permanently remove all local data."
      ) !== "RESET") {
        return;
      }

      APP.store.reset();
      APP.model.initialize();

      APP.store.log(
        "warning",
        "All locally stored dashboard data was reset."
      );

      APP.controller.commit();
    });

    reset.appendChild(resetButton);
    page.appendChild(reset);

    root.appendChild(page);
  };
}());