(function () {
  "use strict";

  var APP = window.APP;
  APP.utils = {};

  APP.utils.id = function (prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" +
      Math.random().toString(36).slice(2, 9);
  };

  APP.utils.text = function (value) {
    return String(value === undefined || value === null ? "" : value)
      .trim().replace(/\s+/g, " ");
  };

  APP.utils.header = function (value) {
    return APP.utils.text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  };

  APP.utils.number = function (value) {
    if (typeof value === "number") { return value; }
    var text = APP.utils.text(value).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
    return Number(text);
  };

  APP.utils.money = function (value) {
    var number = APP.utils.number(value);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
  };

  APP.utils.currency = function (value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: APP.state.settings.currency || "USD"
    }).format(APP.utils.money(value));
  };

  APP.utils.month = function (date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  };

  APP.utils.isoDate = function (date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
      "-" + String(date.getDate()).padStart(2, "0");
  };

  APP.utils.parseDate = function (value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    if (typeof value === "number" && value > 20000) {
      var excel = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return new Date(excel.getUTCFullYear(), excel.getUTCMonth(), excel.getUTCDate());
    }

    var text = APP.utils.text(value);
    var match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text) ||
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);

    if (match) {
      var year = Number(match[1].length === 4 ? match[1] : (match[3].length === 2 ? "20" + match[3] : match[3]));
      var month = Number(match[1].length === 4 ? match[2] : match[1]) - 1;
      var day = Number(match[1].length === 4 ? match[3] : match[2]);
      var parsed = new Date(year, month, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    var fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null :
      new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
  };

  APP.utils.sum = function (items, callback) {
    return (items || []).reduce(function (total, item) {
      return total + APP.utils.money(callback(item));
    }, 0);
  };

  APP.utils.csv = function (value) {
    var text = String(value === undefined || value === null ? "" : value);
    return /[",\n]/.test(text) ? "\"" + text.replace(/"/g, "\"\"") + "\"" : text;
  };
}());