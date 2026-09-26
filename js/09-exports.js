(function () {
  "use strict";

  var APP = window.APP;
  APP.exports = {};

  APP.exports.download = function (filename, type, content) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = APP.dom.el("a");

    link.href = url;
    link.download = filename;
    link.click();

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  APP.exports.json = function (filename, data) {
    APP.exports.download(
      filename,
      "application/json",
      JSON.stringify(data, null, 2)
    );
  };

  APP.exports.backup = function () {
    return JSON.stringify(APP.state, null, 2);
  };

  APP.exports.csv = function (headers, rows) {
    var lines = [];

    lines.push(headers.map(APP.utils.csv).join(","));

    rows.forEach(function (row) {
      lines.push(row.map(APP.utils.csv).join(","));
    });

    return lines.join("\n");
  };

  APP.exports.transactionsCsv = function (transactions) {
    var categories = APP.model.categories().byId;

    var rows = transactions.map(function (transaction) {
      var category = categories[transaction.categoryId];

      var allocationText = (transaction.debtAllocations || [])
        .map(function (allocation) {
          var debt = APP.model.debts().byId[allocation.debtId];

          return (debt ? debt.name : "Unknown debt") +
            ": " +
            APP.utils.money(allocation.amount);
        })
        .join(" | ");

      return [
        transaction.date,
        transaction.description,
        category ? category.name : "",
        APP.tables.transactionType(transaction),
        transaction.amount,
        allocationText,
        transaction.notes || ""
      ];
    });

    return APP.exports.csv(
      [
        "Date",
        "Description",
        "Category",
        "Type",
        "Amount",
        "Debt Allocations",
        "Notes"
      ],
      rows
    );
  };

  APP.exports.monthlyPlansCsv = function () {
    var categories = APP.model.categories().byId;
    var rows = [];

    APP.state.budgets.forEach(function (budget) {
      (budget.items || []).forEach(function (item) {
        var category = categories[item.categoryId];

        rows.push([
          budget.month,
          budget.expectedIncome,
          category ? category.name : "Archived category",
          item.dollarTarget
        ]);
      });
    });

    return APP.exports.csv(
      [
        "Budget Month",
        "Expected Income",
        "Category",
        "Dollar Target"
      ],
      rows
    );
  };

  APP.exports.savingsFundsCsv = function () {
    var rows = APP.state.categories
      .filter(function (category) {
        return category.isSavingsFund;
      })
      .map(function (category) {
        return [
          category.name,
          category.group,
          category.openingBalance,
          category.openingBalanceEffectiveMonth,
          category.eventualSavingsGoal,
          category.eventualSavingsGoalDate,
          category.archived ? "Archived" : "Active"
        ];
      });

    return APP.exports.csv(
      [
        "Savings Fund",
        "Organization Group",
        "Opening Balance",
        "Opening Balance Effective Month",
        "Eventual Savings Goal",
        "Eventual Goal Date",
        "Status"
      ],
      rows
    );
  };

  APP.exports.debtsCsv = function () {
    var categories = APP.model.categories().byId;

    var rows = APP.state.debts.map(function (debt) {
      var category = categories[debt.categoryId];

      return [
        debt.name,
        category ? category.name : "",
        debt.confirmedBalance,
        debt.balanceAsOfDate,
        debt.apr,
        debt.minimumMonthlyPayment,
        debt.notes || "",
        debt.archived ? "Archived" : "Active"
      ];
    });

    return APP.exports.csv(
      [
        "Debt Name",
        "Payment Category",
        "Confirmed Balance",
        "Balance As Of Date",
        "APR",
        "Minimum Monthly Payment",
        "Notes",
        "Status"
      ],
      rows
    );
  };

  APP.exports.categoriesCsv = function () {
    var rows = APP.state.categories.map(function (category) {
      return [
        category.name,
        category.group,
        category.isSavingsFund ? "Yes" : "No",
        category.isDebtCategory ? "Yes" : "No",
        category.isTemporary ? "Yes" : "No",
        category.openingBalance,
        category.openingBalanceEffectiveMonth,
        category.eventualSavingsGoal,
        category.eventualSavingsGoalDate,
        category.archived ? "Archived" : "Active"
      ];
    });

    return APP.exports.csv(
      [
        "Category",
        "Organization Group",
        "Savings Fund",
        "Debt Category",
        "Temporary",
        "Opening Balance",
        "Opening Balance Effective Month",
        "Eventual Savings Goal",
        "Eventual Goal Date",
        "Status"
      ],
      rows
    );
  };

  APP.exports.readJson = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("The selected JSON file could not be read."));
      };

      reader.onload = function (event) {
        try {
          resolve(JSON.parse(String(event.target.result || "")));
        } catch (error) {
          reject(new Error("The selected file is not valid JSON."));
        }
      };

      reader.readAsText(file);
    });
  };

  APP.exports.readBackup = function (file) {
    return APP.exports.readJson(file).then(function (data) {
      if (
        !data ||
        !Array.isArray(data.categories) ||
        !Array.isArray(data.transactions)
      ) {
        throw new Error(
          "The selected file is not a valid Budget Dashboard backup."
        );
      }

      return data;
    });
  };

  APP.exports.exportTransactionsXlsx = function (transactions) {
    if (!window.XLSX) {
      throw new Error(
        "XLSX export is unavailable because SheetJS did not load."
      );
    }

    var categories = APP.model.categories().byId;

    var rows = transactions.map(function (transaction) {
      var category = categories[transaction.categoryId];

      return {
        Date: transaction.date,
        Description: transaction.description,
        Category: category ? category.name : "",
        Type: APP.tables.transactionType(transaction),
        Amount: transaction.amount,
        Notes: transaction.notes || ""
      };
    });

    var workbook = window.XLSX.utils.book_new();
    var sheet = window.XLSX.utils.json_to_sheet(rows);

    window.XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      "Transactions"
    );

    window.XLSX.writeFile(
      workbook,
      "budget-transactions.xlsx"
    );
  };

  APP.exports.entityJson = function (entityName) {
    var map = {
      transactions: APP.state.transactions,
      monthlyPlans: APP.state.budgets,
      savingsFunds: APP.state.categories.filter(function (category) {
        return category.isSavingsFund;
      }),
      debts: APP.state.debts,
      categories: APP.state.categories,
      dashboardVisuals: APP.state.settings.dashboardVisuals
    };

    return {
      exportType: entityName,
      exportedAt: new Date().toISOString(),
      schemaVersion: APP.state.schemaVersion,
      data: map[entityName] || []
    };
  };

  APP.exports.exportEntityJson = function (entityName) {
    APP.exports.json(
      "budget-" + entityName + ".json",
      APP.exports.entityJson(entityName)
    );
  };
    APP.exports.exportWorkbook = function () {
    if (!window.XLSX) {
      throw new Error(
        "Excel workbook export is unavailable because SheetJS did not load."
      );
    }

    var categories = APP.model.categories().byId;
    var debts = APP.model.debts().byId;

    var workbook = window.XLSX.utils.book_new();

    function addSheet(sheetName, rows) {
      var sheet = window.XLSX.utils.json_to_sheet(rows || []);
      window.XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        sheetName
      );
    }

    addSheet("Transactions", APP.state.transactions.map(function (
      transaction
    ) {
      var category = categories[transaction.categoryId];

      return {
        Date: transaction.date,
        Description: transaction.description,
        Category: category ? category.name : "",
        Type: APP.tables.transactionType(transaction),
        Amount: transaction.amount,
        DebtAllocations: (transaction.debtAllocations || [])
          .map(function (allocation) {
            var debt = debts[allocation.debtId];

            return (debt ? debt.name : "Unknown debt") +
              ": " +
              APP.utils.money(allocation.amount);
          })
          .join(" | "),
        Notes: transaction.notes || ""
      };
    }));

    addSheet("Monthly Plans", APP.state.budgets.reduce(function (
      rows,
      budget
    ) {
      (budget.items || []).forEach(function (item) {
        var category = categories[item.categoryId];

        rows.push({
          BudgetMonth: budget.month,
          ExpectedIncome: budget.expectedIncome,
          Category: category ? category.name : "Archived category",
          DollarTarget: item.dollarTarget
        });
      });

      return rows;
    }, []));

    addSheet("Savings Funds", APP.state.categories
      .filter(function (category) {
        return category.isSavingsFund;
      })
      .map(function (category) {
        return {
          Name: category.name,
          OrganizationGroup: category.group,
          OpeningBalance: category.openingBalance,
          OpeningBalanceEffectiveMonth:
            category.openingBalanceEffectiveMonth,
          EventualSavingsGoal: category.eventualSavingsGoal,
          EventualSavingsGoalDate:
            category.eventualSavingsGoalDate,
          Status: category.archived ? "Archived" : "Active"
        };
      }));

    addSheet("Debts", APP.state.debts.map(function (debt) {
      var category = categories[debt.categoryId];

      return {
        Name: debt.name,
        PaymentCategory: category ? category.name : "",
        ConfirmedBalance: debt.confirmedBalance,
        BalanceAsOfDate: debt.balanceAsOfDate,
        APR: debt.apr,
        MinimumMonthlyPayment: debt.minimumMonthlyPayment,
        Notes: debt.notes || "",
        Status: debt.archived ? "Archived" : "Active"
      };
    }));

    addSheet("Categories", APP.state.categories.map(function (
      category
    ) {
      return {
        Name: category.name,
        OrganizationGroup: category.group,
        SavingsFund: category.isSavingsFund ? "Yes" : "No",
        DebtCategory: category.isDebtCategory ? "Yes" : "No",
        Temporary: category.isTemporary ? "Yes" : "No",
        OpeningBalance: category.openingBalance,
        OpeningBalanceEffectiveMonth:
          category.openingBalanceEffectiveMonth,
        EventualSavingsGoal: category.eventualSavingsGoal,
        EventualSavingsGoalDate:
          category.eventualSavingsGoalDate,
        Status: category.archived ? "Archived" : "Active"
      };
    }));

    addSheet(
      "Dashboard Visuals",
      APP.state.settings.dashboardVisuals || []
    );

    addSheet("Salary Settings", [{
      AnnualGrossSalary: APP.state.salary.annualGrossSalary,
      PayPeriodsPerYear: APP.state.salary.payPeriodsPerYear,
      FederalWithholdingPct:
        APP.state.salary.federalWithholdingPct,
      StateWithholdingPct:
        APP.state.salary.stateWithholdingPct,
      RetirementContributionPct:
        APP.state.salary.retirementContributionPct,
      FixedDeductionsPerPaycheck:
        APP.state.salary.fixedDeductionsPerPaycheck
    }]);

    window.XLSX.writeFile(
      workbook,
      "budget-dashboard-export.xlsx"
    );
  };
    APP.exports.readWorkbook = function (file) {
    return new Promise(function (resolve, reject) {
      if (!window.XLSX) {
        reject(new Error(
          "Excel workbook import is unavailable because SheetJS did not load."
        ));
        return;
      }

      if (!file) {
        reject(new Error("Select an Excel workbook first."));
        return;
      }

      var reader = new FileReader();

      reader.onerror = function () {
        reject(new Error(
          "The selected Excel workbook could not be read."
        ));
      };

      reader.onload = function (event) {
        try {
          var workbook = window.XLSX.read(
            event.target.result,
            {
              type: "array",
              cellDates: true
            }
          );

          var sheets = {};

          workbook.SheetNames.forEach(function (sheetName) {
            sheets[sheetName] =
              window.XLSX.utils.sheet_to_json(
                workbook.Sheets[sheetName],
                {
                  defval: ""
                }
              );
          });

          resolve({
            sheetNames: workbook.SheetNames,
            sheets: sheets
          });
        } catch (error) {
          reject(new Error(
            "The selected file could not be parsed as an Excel workbook."
          ));
        }
      };

      reader.readAsArrayBuffer(file);
    });
  };

  APP.exports.workbookSummary = function (workbookData) {
    return workbookData.sheetNames.map(function (sheetName) {
      return {
        name: sheetName,
        count: (workbookData.sheets[sheetName] || []).length
      };
    });
  };

  APP.exports.workbookRowsToState = function (workbookData) {
    var sheets = workbookData.sheets || {};

    return {
      transactions: sheets.Transactions || [],
      monthlyPlans: sheets["Monthly Plans"] || [],
      savingsFunds: sheets["Savings Funds"] || [],
      debts: sheets.Debts || [],
      categories: sheets.Categories || [],
      dashboardVisuals: sheets["Dashboard Visuals"] || [],
      salarySettings: sheets["Salary Settings"] || []
    };
  };
}());