(function () {
  "use strict";

  var APP = window.APP;
  APP.ui = {};

  APP.ui.button = function (text, className) {
    var button = APP.dom.el("button", "button " + (className || "button-secondary"), text);
    button.type = "button";
    return button;
  };

  APP.ui.field = function (labelText, name, type, value, options) {
    var config = options || {};
    var label = APP.dom.el("label", "form-field" + (config.full ? " full" : ""));
    var input = APP.dom.el(type === "select" ? "select" : "input");

    label.appendChild(APP.dom.el("span", "", labelText));
    input.name = name;

    if (type !== "select") {
      input.type = type || "text";
      input.value = value === undefined || value === null ? "" : value;
    }

    if (config.required) { input.required = true; }
    if (config.step) { input.step = config.step; }
    if (config.min !== undefined) { input.min = config.min; }
    if (config.placeholder) { input.placeholder = config.placeholder; }

    (config.options || []).forEach(function (optionData) {
      var option = APP.dom.el("option", "", optionData.label);
      option.value = optionData.value;
      option.selected = String(optionData.value) === String(value);
      input.appendChild(option);
    });

    label.appendChild(input);

    // Cent-precision number fields are dollar amounts unless marked as a percentage.
    if (config.money || (type === "number" && config.step === "0.01" && !config.percent)) {
      APP.ui.moneyInput(input);
    }

    return { root: label, input: input };
  };

  APP.ui.currencySymbol = function () {
    try {
      var part = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: APP.state.settings.currency || "USD"
      }).formatToParts(0).filter(function (item) {
        return item.type === "currency";
      })[0];

      return part ? part.value : "$";
    } catch (error) {
      return "$";
    }
  };

  APP.ui.formatMoneyText = function (value) {
    var text = String(value === undefined || value === null ? "" : value).trim();

    if (!text) {
      return "";
    }

    var number = APP.utils.number(text);

    return Number.isFinite(number) ?
      number.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
      text;
  };

  // Shows a number input as a dollar amount: a currency sign in front, thousands
  // separators once you leave the field, and the decimal keypad on phones. Values still
  // parse with APP.utils.money, which ignores the sign and commas.
  APP.ui.moneyInput = function (input) {
    var wrap = APP.dom.el("span", "money-field");
    var symbol = APP.dom.el("span", "money-symbol", APP.ui.currencySymbol());

    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.classList.add("money-input");
    input.removeAttribute("step");
    input.removeAttribute("min");
    input.value = APP.ui.formatMoneyText(input.value);
    input.defaultValue = input.value;
    symbol.setAttribute("aria-hidden", "true");

    if (input.parentNode) {
      input.parentNode.insertBefore(wrap, input);
    }

    wrap.appendChild(symbol);
    wrap.appendChild(input);

    input.addEventListener("input", function () {
      var cleaned = input.value.replace(/[^0-9.,-]/g, "");

      if (cleaned !== input.value) {
        input.value = cleaned;
      }
    });

    input.addEventListener("blur", function () {
      input.value = APP.ui.formatMoneyText(input.value);
    });

    return wrap;
  };

  // Turns a <select> into a type-to-filter combobox. The select stays in the DOM (hidden)
  // and keeps its value and change events, so code that reads or listens to it works as
  // before. An option's data-group shows as a small label beside it.
  APP.ui.searchSelect = function (select, options) {
    var config = options || {};
    var wrap = APP.dom.el("div", "search-select");
    var input = APP.dom.el("input", "search-select-input");
    var list = APP.dom.el("ul", "search-select-list");
    var listId = APP.utils.id("listbox");
    var active = -1;
    var shown = [];

    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = config.placeholder || "Search…";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);

    if (select.getAttribute("aria-label")) {
      input.setAttribute("aria-label", select.getAttribute("aria-label"));
    }

    list.id = listId;
    list.setAttribute("role", "listbox");
    list.hidden = true;

    // The hidden select can't show validation messages, so required checks move to the
    // form's own validation.
    select.required = false;
    select.hidden = true;
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(input);
    wrap.appendChild(list);
    wrap.appendChild(select);

    function selectedLabel() {
      var option = select.options[select.selectedIndex];
      return option && option.value ? option.textContent : "";
    }

    function sync() {
      input.value = selectedLabel();
      input.placeholder = select.value ? "" : (config.placeholder || "Search…");
      var first = select.options[0];

      if (!select.value && first && !first.value) {
        input.placeholder = first.textContent;
      }
    }

    function close() {
      list.hidden = true;
      active = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function highlight(index) {
      active = index;

      Array.prototype.slice.call(list.children).forEach(function (item, position) {
        var on = position === index;
        item.classList.toggle("active", on);
        item.setAttribute("aria-selected", on ? "true" : "false");

        if (on) {
          input.setAttribute("aria-activedescendant", item.id);
          item.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function render(query) {
      var text = APP.utils.header(query);

      APP.dom.clear(list);
      shown = Array.prototype.slice.call(select.options).filter(function (option) {
        return !text || APP.utils.header(option.textContent + " " + (option.dataset.group || ""))
          .indexOf(text) !== -1;
      });

      if (!shown.length) {
        list.appendChild(APP.dom.el("li", "search-select-empty", "No matches"));
      }

      shown.forEach(function (option, index) {
        var item = APP.dom.el("li", "search-select-option" + (option.value === select.value ? " selected" : ""));

        item.id = listId + "_" + index;
        item.setAttribute("role", "option");
        item.appendChild(APP.dom.el("span", "", option.textContent));

        if (option.dataset.group) {
          item.appendChild(APP.dom.el("small", "", option.dataset.group));
        }

        // mousedown keeps focus in the input so the list doesn't close before the click.
        item.addEventListener("mousedown", function (event) {
          event.preventDefault();
          choose(option);
        });
        list.appendChild(item);
      });

      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      highlight(text && shown.length ? 0 : shown.indexOf(select.options[select.selectedIndex]));
    }

    function choose(option) {
      var changed = select.value !== option.value;

      select.value = option.value;
      sync();
      close();

      if (changed) {
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    input.addEventListener("focus", function () {
      input.select();
      render("");
    });

    input.addEventListener("input", function () {
      render(input.value);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();

        if (list.hidden) {
          render("");
          return;
        }

        var step = event.key === "ArrowDown" ? 1 : -1;
        highlight(Math.max(0, Math.min(shown.length - 1, active + step)));
      } else if (event.key === "Enter") {
        if (!list.hidden && shown[active]) {
          event.preventDefault();
          choose(shown[active]);
        }
      } else if (event.key === "Escape") {
        if (!list.hidden) {
          event.preventDefault();
          event.stopPropagation();
          sync();
          close();
        }
      }
    });

    input.addEventListener("blur", function () {
      sync();
      close();
    });

    select.addEventListener("change", sync);

    // Options added later (for example a newly created savings fund) or values set in
    // code show up in the input.
    new MutationObserver(sync).observe(select, { childList: true });

    sync();

    return { root: wrap, input: input, sync: sync };
  };

  // A search box that filters a list of elements by their text.
  APP.ui.filterBox = function (placeholder, items) {
    var input = APP.dom.el("input", "filter-box");

    input.type = "search";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);
    input.addEventListener("input", function () {
      var text = APP.utils.header(input.value);

      items().forEach(function (item) {
        item.hidden = Boolean(text) && APP.utils.header(item.textContent).indexOf(text) === -1;
      });
    });

    return input;
  };

  // Adds category groups to a category <select>'s options so search can match them.
  APP.ui.tagCategoryOptions = function (select) {
    var categories = APP.model.categories().byId;

    Array.prototype.slice.call(select.options).forEach(function (option) {
      var category = categories[option.value];

      if (category) {
        option.dataset.group = category.isSavingsFund ? "Savings fund" :
          category.isDebtCategory ? "Debt" :
            category.group;
      }
    });
  };

  APP.ui.progress = function (current, target) {
    var percentage = target > 0 ? Math.min(100, Math.max(0, current / target * 100)) : 0;
    var root = APP.dom.el("div", "progress");
    var fill = APP.dom.el("span");
    fill.style.width = percentage + "%";
    root.appendChild(fill);
    return root;
  };

  APP.ui.panelHeader = function (title, subtitle, actions) {
    var header = APP.dom.el("div", "panel-heading");
    var copy = APP.dom.el("div");
    copy.appendChild(APP.dom.el("h2", "", title));
    if (subtitle) {
      copy.appendChild(APP.dom.el("p", "", subtitle));
    }
    header.appendChild(copy);

    if (actions) {
      header.appendChild(actions);
    }

    return header;
  };

  // options.size: "full" fills the whole screen; "sheet" is a form that fills a phone
  // screen with its buttons kept in view.
  APP.ui.modal = function (title, content, options) {
    var config = options || {};
    var overlay = APP.dom.el("div", "modal-overlay" + (config.size ? " modal-overlay-" + config.size : ""));
    var modal = APP.dom.el("section", "modal" + (config.size ? " modal-" + config.size : ""));
    var heading = APP.dom.el("div", "modal-head");
    var close = APP.ui.button("Close", "button-quiet");

    close.addEventListener("click", APP.ui.closeModal);
    heading.appendChild(APP.dom.el("h2", "", title));
    heading.appendChild(close);
    modal.appendChild(heading);
    modal.appendChild(content);
    overlay.appendChild(modal);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        APP.ui.closeModal();
      }
    });

    APP.dom.clear(APP.dom.refs.modalRoot);
    APP.dom.refs.modalRoot.appendChild(overlay);
    document.body.classList.add("modal-open");
  };

  APP.ui.closeModal = function () {
    APP.dom.clear(APP.dom.refs.modalRoot);
    document.body.classList.remove("modal-open");
  };

  // A row of buttons that picks one value for a (hidden) select, firing its change event.
  APP.ui.segmented = function (select, choices) {
    var group = APP.dom.el("div", "segmented full");

    group.setAttribute("role", "radiogroup");

    function sync() {
      Array.prototype.slice.call(group.children).forEach(function (button) {
        var on = button.dataset.value === select.value;
        button.classList.toggle("active", on);
        button.setAttribute("aria-checked", on ? "true" : "false");
      });
    }

    choices.forEach(function (choice) {
      var button = APP.dom.el("button", "segmented-option " + (choice.tone || ""), choice.label);

      button.type = "button";
      button.dataset.value = choice.value;
      button.setAttribute("role", "radio");
      button.addEventListener("click", function () {
        if (select.value !== choice.value) {
          select.value = choice.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        sync();
      });
      group.appendChild(button);
    });

    select.addEventListener("change", sync);
    sync();
    return group;
  };

  // A titled group of fields inside a form, to break long forms into readable parts.
  APP.ui.formSection = function (title, fields) {
    var section = APP.dom.el("fieldset", "form-section full");

    if (title) {
      section.appendChild(APP.dom.el("legend", "", title));
    }

    var grid = APP.dom.el("div", "form-grid");

    fields.forEach(function (field) {
      if (field) {
        grid.appendChild(field.root || field);
      }
    });

    section.appendChild(grid);
    return section;
  };

  // Small rounded label, e.g. a status.
  APP.ui.pill = function (text, tone) {
    return APP.dom.el("span", "pill " + (tone || ""), text);
  };

  // Label-and-value pair used on cards.
  APP.ui.stat = function (label, value, className) {
    var stat = APP.dom.el("div", "card-stat");
    stat.appendChild(APP.dom.el("span", "", label));
    stat.appendChild(APP.dom.el("strong", className || "", value));
    return stat;
  };

  APP.ui.empty = function (message) {
    return APP.dom.el("p", "muted", message);
  };

  APP.ui.currencyCard = function (label, value, tone, note) {
    var card = APP.dom.el("article", "summary-card " + (tone || ""));
    card.appendChild(APP.dom.el("span", "", label));
    card.appendChild(APP.dom.el("strong", "", APP.utils.currency(value)));
    if (note) {
      card.appendChild(APP.dom.el("small", "", note));
    }
    return card;
  };
}());