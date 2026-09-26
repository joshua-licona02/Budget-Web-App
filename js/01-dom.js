(function () {
  "use strict";

  var APP = window.APP;
  APP.dom = {};

  APP.dom.init = function () {
    var byId = function (id) {
      return document.getElementById(id);
    };

    APP.dom.refs = {
      sidebar: byId("app-sidebar"),
      menuButton: byId("mobile-menu-button"),
      title: byId("view-title"),
      eyebrow: byId("view-eyebrow"),
      month: byId("selected-month"),
      nav: Array.prototype.slice.call(
        document.querySelectorAll(".nav-item")
      ),
      views: Array.prototype.slice.call(
        document.querySelectorAll(".app-view")
      ),
      modalRoot: byId("modal-root"),
      toastRoot: byId("toast-root"),
      audit: byId("audit-log"),
      clearAudit: byId("clear-audit-log-button"),
      addTransaction: byId("add-transaction-button"),
      quickTransaction: byId("quick-add-transaction"),
      importButton: byId("import-transactions-button"),
      importInput: byId("transaction-import-input"),

      dashboard: {
        summary: byId("dashboard-summary"),
        toolbar: byId("dashboard-toolbar"),
        visuals: byId("dashboard-visuals")
      },

      pages: {
        transactions: byId("transactions-workspace"),
        budget: byId("budget-workspace"),
        savings: byId("savings-workspace"),
        debts: byId("debts-workspace"),
        salary: byId("salary-workspace"),
        advisor: byId("advisor-workspace"),
        settings: byId("settings-workspace")
      }
    };
  };

  APP.dom.el = function (tag, className, text) {
    var node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined && text !== null) {
      node.textContent = text;
    }

    return node;
  };

  APP.dom.clear = function (node) {
    if (node) {
      node.replaceChildren();
    }
  };

  APP.dom.toast = function (message, type) {
    var toast = APP.dom.el(
      "div",
      "toast " + (type || ""),
      message
    );

    APP.dom.refs.toastRoot.appendChild(toast);

    window.setTimeout(function () {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
  };

  APP.dom.audit = function () {
    var root = APP.dom.refs.audit;

    APP.dom.clear(root);

    (APP.state.auditLog || []).forEach(function (entry) {
      root.appendChild(APP.dom.el(
        "div",
        "audit-row " + entry.level,
        new Date(entry.timestamp).toLocaleString() +
        " — " +
        entry.message
      ));
    });
  };
}());