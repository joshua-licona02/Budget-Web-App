(function () {
  "use strict";

  window.APP = window.APP || {};
  var APP = window.APP;

  APP.config = {
    storageKey: "personalBudgetDashboard.v2",
    schemaVersion: 2,
    currency: "USD",
    transactionTypes: { income: "income", expense: "expense", savings: "savings" },
    maxAuditEntries: 300
  };

  APP.seedCategories = [
    ["Housing and Utilities", "Mortgage", false, false],
    ["Housing and Utilities", "Phone", false, false],
    ["Housing and Utilities", "Internet", false, false],
    ["Housing and Utilities", "Electric", false, false],
    ["Housing and Utilities", "House Essentials", false, false],
    ["Food and Household", "Groceries", false, false],
    ["Food and Household", "Restaurant", false, false],
    ["Food and Household", "Misc", false, false],
    ["Transportation", "Gas", false, false],
    ["Transportation", "Car Maintenance", false, false],
    ["Insurance and Health", "Insurance", false, false],
    ["Insurance and Health", "Vision Care", false, false],
    ["Giving and Debt", "Tithe", false, false],
    ["Giving and Debt", "Student Loans", false, true],
    ["Giving and Debt", "Credit Card Payment", false, true],
    ["Savings and Funds", "Emergency Fund", true, false],
    ["Savings and Funds", "Grad School Savings", true, false],
    ["Savings and Funds", "House Fund", true, false],
    ["Savings and Funds", "Health Fund", true, false],
    ["Savings and Funds", "Car Maintenance Fund", true, false],
    ["Savings and Funds", "Credit Card Fee Savings", true, false],
    ["Savings and Funds", "Free Money", true, false],
    ["Lifestyle and Personal", "Haircut", false, false],
    ["Lifestyle and Personal", "Subscriptions", false, false],
    ["Lifestyle and Personal", "Golf", false, false],
    ["Lifestyle and Personal", "Shopping", false, false],
    ["Lifestyle and Personal", "Firearm", false, false],
    ["Lifestyle and Personal", "Rock Climbing", false, false]
  ];

  APP.createDefaultState = function () {
    var now = new Date();
    var month = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

    return {
      schemaVersion: APP.config.schemaVersion,
      settings: {
        currency: "USD",
        selectedMonth: month,
        activeView: "dashboard",
        dashboardVisuals: [],
        ollama: { endpoint: "", model: "", timeoutMs: 30000 }
      },
      categories: [],
      transactions: [],
      budgets: [],
      savingsGoals: [],
      debts: [],
      salary: {
        annualGrossSalary: 0,
        payPeriodsPerYear: 26,
        federalWithholdingPct: 0,
        stateWithholdingPct: 0,
        retirementContributionPct: 0,
        fixedDeductionsPerPaycheck: 0
      },
      auditLog: []
    };
  };

  APP.state = APP.createDefaultState();

  APP.store = {
    load: function () {
      try {
        var raw = window.localStorage.getItem(APP.config.storageKey);
        APP.state = raw ? JSON.parse(raw) : APP.createDefaultState();
      } catch (error) {
        APP.state = APP.createDefaultState();
      }
      return APP.state;
    },

    save: function () {
      try {
        window.localStorage.setItem(APP.config.storageKey, JSON.stringify(APP.state));
        return true;
      } catch (error) {
        return false;
      }
    },

    reset: function () {
      APP.state = APP.createDefaultState();
      window.localStorage.removeItem(APP.config.storageKey);
    },

    log: function (level, message) {
      APP.state.auditLog = Array.isArray(APP.state.auditLog) ? APP.state.auditLog : [];
      APP.state.auditLog.unshift({
        id: "audit_" + Date.now() + "_" + Math.random().toString(16).slice(2),
        timestamp: new Date().toISOString(),
        level: level || "info",
        message: String(message || "")
      });
      APP.state.auditLog = APP.state.auditLog.slice(0, APP.config.maxAuditEntries);
    }
  };
}());