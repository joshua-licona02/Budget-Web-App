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
    return { root: label, input: input };
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

  APP.ui.modal = function (title, content) {
    var overlay = APP.dom.el("div", "modal-overlay");
    var modal = APP.dom.el("section", "modal");
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
  };

  APP.ui.closeModal = function () {
    APP.dom.clear(APP.dom.refs.modalRoot);
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