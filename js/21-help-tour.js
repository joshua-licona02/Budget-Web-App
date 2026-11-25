(function () {
  "use strict";

  // First-time guided tour, the Help panel (the ? button in the top bar) and the Settings
  // shortcuts to both. The tour shows once per device; Help can replay it any time.
  var APP = window.APP;
  var help = APP.help = {};

  var SEEN_KEY = "personalBudgetDashboard.tourSeen";

  function storage(action, value) {
    try {
      if (action === "get") {
        return window.localStorage.getItem(SEEN_KEY);
      }
      window.localStorage.setItem(SEEN_KEY, value);
    } catch (error) {
      // Storage blocked: the tour may show again next visit.
    }
    return null;
  }

  function isPhone() {
    return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
  }

  // Each step can switch to a page and point at one element. target may be a function so a
  // step can pick a different element on phones, where the sidebar is hidden.
  help.steps = [
    {
      title: "Welcome to your budget",
      body: "This quick tour shows where everything is. It takes about a minute, and you can replay it any time from the ? button."
    },
    {
      view: "dashboard",
      target: ".month-control",
      title: "One month at a time",
      body: "Every page shows the month picked here. The app always opens on the current month; change it to look back at an earlier one."
    },
    {
      target: "#quick-add-transaction",
      title: "Add a transaction",
      body: "Record income, spending or money you're saving, from any page. You can split a purchase across categories (say, a store run that was part groceries) and round purchases up to save the change."
    },
    {
      target: function () {
        return isPhone() ? "#mobile-menu-button" : "#app-sidebar .nav-list";
      },
      title: "Move between pages",
      body: function () {
        return (isPhone() ? "Tap the menu button to open the list of pages. " : "") +
          "The next steps walk through each page in order.";
      }
    },
    {
      view: "dashboard",
      target: "#dashboard-summary",
      title: "Dashboard",
      body: "Your month at a glance: income, spending, savings and what's left. Green is good news, red needs a look."
    },
    {
      view: "dashboard",
      target: "#dashboard-toolbar",
      title: "Charts, by topic",
      body: "Charts are grouped into tabs like Spending, Savings and Debt. Add your own charts or rearrange them with Customize dashboard. Long charts scroll inside their box."
    },
    {
      view: "transactions",
      target: "#view-transactions .transaction-toolbar",
      title: "Transactions",
      body: "Search everything you've recorded, narrow it with Filters, or open Full view. Tap a transaction to edit or delete it. Import brings in a CSV or Excel file from your bank."
    },
    {
      view: "budget",
      target: "#view-budget .panel-heading",
      title: "Monthly Plan",
      body: "Set the income you expect and a target for each category. Spending targets are limits; savings and debt targets are amounts to put in. Changes save as you type."
    },
    {
      view: "savings",
      target: "#view-savings .panel-heading",
      title: "Savings & Goals",
      body: "Each savings fund shows its balance, this month's progress and how far it is from its goal. Give a fund a target date and the app works out how much to save each month, and fills that in when you add a savings transaction."
    },
    {
      view: "debts",
      target: "#view-debts .panel-heading",
      title: "Debts",
      body: "Add each loan or card with its balance, interest rate and minimum payment. Record payments as expenses in the debt's payment category, and the estimated balance goes down."
    },
    {
      view: "accounts",
      target: "#view-accounts .panel-heading",
      title: "Accounts",
      body: "Enter the balances your bank and card show, and the app checks they match what your transactions and funds say, so mistakes don't go unnoticed."
    },
    {
      view: "advisor",
      target: "#view-advisor .advisor-engine",
      title: "Advisor",
      body: "Ask questions about your budget in plain words. It runs privately on your own device, either through Ollama on a computer or a small model in the browser. It's planning help, not professional advice."
    },
    {
      view: "settings",
      target: "#view-settings .panel-heading",
      title: "Settings",
      body: "Manage your categories, theme and round-up preferences, and download backups of your data. If you sign in, your budget syncs across your devices."
    },
    {
      view: "dashboard",
      target: "#help-button",
      title: "Help is always here",
      body: "Tap ? for quick answers about every page, or to take this tour again. That's it, enjoy budgeting!"
    }
  ];

  // ---- The tour

  var tour = null;

  function resolve(value) {
    return typeof value === "function" ? value() : value;
  }

  function build() {
    var layer = APP.dom.el("div", "tour-layer");
    var spot = APP.dom.el("div", "tour-spot");
    var card = APP.dom.el("section", "tour-card");

    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "tour-title");

    // The layer catches clicks so the page underneath can't be changed mid-tour.
    layer.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    layer.appendChild(spot);
    layer.appendChild(card);
    document.body.appendChild(layer);
    return { layer: layer, spot: spot, card: card };
  }

  function place() {
    if (!tour) {
      return;
    }

    var step = help.steps[tour.index];
    var selector = resolve(step.target);
    var target = selector ? document.querySelector(selector) : null;
    var rect = target ? target.getBoundingClientRect() : null;
    var card = tour.parts.card;
    var spot = tour.parts.spot;
    var phone = isPhone();

    if (!rect || !rect.width || !rect.height) {
      // Nothing to point at: a centered card over a dimmed page.
      tour.parts.layer.classList.add("tour-centered");
      spot.hidden = true;
      card.style.left = card.style.top = card.style.bottom = "";
      return;
    }

    tour.parts.layer.classList.remove("tour-centered");
    spot.hidden = false;

    var pad = 6;
    var top = Math.max(4, rect.top - pad);
    var left = Math.max(4, rect.left - pad);
    var bottom = Math.min(window.innerHeight - 4, rect.bottom + pad);
    var right = Math.min(window.innerWidth - 4, rect.right + pad);

    spot.style.top = top + "px";
    spot.style.left = left + "px";
    spot.style.width = Math.max(0, right - left) + "px";
    spot.style.height = Math.max(0, bottom - top) + "px";

    if (phone) {
      // Docked to the bottom of the screen (see CSS).
      card.style.left = card.style.top = "";
      return;
    }

    var cardRect = card.getBoundingClientRect();
    var below = bottom + 12;
    var cardTop = below + cardRect.height <= window.innerHeight - 12 ?
      below :
      Math.max(12, top - 12 - cardRect.height);

    // Beside the target when it fills the height (e.g. the sidebar).
    if (cardTop + cardRect.height > window.innerHeight - 12 || (bottom - top) > window.innerHeight * 0.6) {
      cardTop = Math.max(12, Math.min(window.innerHeight - cardRect.height - 12, top));
      card.style.left = Math.min(window.innerWidth - cardRect.width - 12, right + 16) + "px";
    } else {
      card.style.left = Math.max(12, Math.min(window.innerWidth - cardRect.width - 12,
        left + (right - left) / 2 - cardRect.width / 2)) + "px";
    }

    card.style.top = cardTop + "px";
  }

  function renderCard() {
    var step = help.steps[tour.index];
    var card = tour.parts.card;
    var last = tour.index === help.steps.length - 1;
    var first = tour.index === 0;

    APP.dom.clear(card);

    card.appendChild(APP.dom.el("p", "tour-count", first ? "Quick tour" : tour.index + " of " + (help.steps.length - 1)));

    var title = APP.dom.el("h3", "", resolve(step.title));
    title.id = "tour-title";
    card.appendChild(title);
    card.appendChild(APP.dom.el("p", "tour-body", resolve(step.body)));

    var actions = APP.dom.el("div", "tour-actions");
    var skip = APP.ui.button(first ? "Skip for now" : "End tour", "button-quiet tour-skip");
    var back = APP.ui.button("Back");
    var next = APP.ui.button(first ? "Start the tour" : last ? "Finish" : "Next", "button-primary");

    skip.addEventListener("click", help.endTour);
    back.addEventListener("click", function () {
      go(tour.index - 1);
    });
    next.addEventListener("click", function () {
      if (last) {
        help.endTour();
      } else {
        go(tour.index + 1);
      }
    });

    actions.appendChild(skip);

    if (!first) {
      actions.appendChild(back);
    }

    actions.appendChild(next);
    card.appendChild(actions);
    next.focus({ preventScroll: true });
  }

  function go(index) {
    if (!tour || index < 0 || index >= help.steps.length) {
      return;
    }

    tour.index = index;

    var step = help.steps[index];

    if (step.view && APP.state.settings.activeView !== step.view) {
      APP.controller.switchView(step.view);
    }

    renderCard();

    var selector = resolve(step.target);
    var target = selector ? document.querySelector(selector) : null;

    if (target) {
      // On phones the card covers the bottom of the screen, so keep the target near the top.
      target.scrollIntoView({ block: isPhone() ? "start" : "center" });

      if (isPhone()) {
        window.scrollBy(0, -70);
      }
    } else {
      window.scrollTo(0, 0);
    }

    // Place now, and again once smooth scrolling or late layout has settled.
    place();
    window.setTimeout(place, 120);
  }

  function onKey(event) {
    if (!tour) {
      return;
    }

    if (event.key === "Escape") {
      help.endTour();
    } else if (event.key === "ArrowRight") {
      go(tour.index + 1);
    } else if (event.key === "ArrowLeft") {
      go(tour.index - 1);
    }
  }

  help.startTour = function () {
    if (tour) {
      return;
    }

    APP.ui.closeModal();
    APP.controller.setSidebar(false);

    tour = { index: 0, parts: build(), returnView: APP.state.settings.activeView };
    document.body.classList.add("tour-open");
    storage("set", "1");

    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", onKey);

    go(0);
  };

  help.endTour = function () {
    if (!tour) {
      return;
    }

    tour.parts.layer.remove();
    tour = null;
    document.body.classList.remove("tour-open");
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, true);
    document.removeEventListener("keydown", onKey);

    APP.controller.switchView("dashboard");
    window.scrollTo(0, 0);
  };

  // ---- Help panel

  help.topics = [
    ["Getting started", [
      "Check your categories in Settings, and add or rename any you need.",
      "Open Monthly Plan and enter the income you expect and a target for each category.",
      "Add transactions as you spend and get paid with + Transaction.",
      "Check the Dashboard to see how the month is going."
    ]],
    ["Adding transactions", [
      "Tap + Transaction on any page, choose Expense, Income or Savings, then enter the amount, a description and a category.",
      "Refunds: choose Income, then Refund, and pick the category it goes back to. It lowers that category's spending.",
      "Split a purchase: after picking a spending category, tap Split across categories to move part of it to other categories. The rest stays in the first one.",
      "Round-ups: tick the round-up option to save the change from rounding a purchase up to the next dollar.",
      "To fix or remove a transaction, tap it in Transactions."
    ]],
    ["Monthly Plan", [
      "Enter the income you expect, then a target for each category. Spending targets are limits; savings and debt targets are amounts to put in.",
      "Changes save as you type. Each month has its own plan; pick the month at the top."
    ]],
    ["Savings & Goals", [
      "Add a fund for each thing you're saving toward, with an optional goal and target date.",
      "When you add a Savings transaction and pick a fund, the amount fills in with what's left of that fund's monthly goal.",
      "Spending paid from savings comes out of its fund and isn't counted as normal spending."
    ]],
    ["Debts", [
      "Add each loan or card with its balance, the date that balance was correct, the interest rate and the minimum payment.",
      "Record a payment as an expense in the debt's payment category. The form lets you divide it between debts.",
      "Update the balance from your statement now and then with Edit."
    ]],
    ["Accounts", [
      "Enter each bank account and card with the balance it shows today, and say which savings funds are kept where.",
      "Enter balances when you check your bank; the app tells you if anything doesn't add up."
    ]],
    ["Dashboard and charts", [
      "The cards at the top summarize the month. Charts are grouped into tabs by topic.",
      "Use + Add visual or Customize dashboard to choose and arrange charts. Long charts scroll inside their box."
    ]],
    ["Advisor", [
      "Ask questions about your budget in plain words. Choose where it runs: Ollama on a computer, or This device to run a small model in the browser (a one-time download).",
      "Answers are planning help only, not professional financial advice."
    ]],
    ["Syncing and backups", [
      "Signed in, your budget syncs to every device you sign in on. The sidebar shows whether it's synced.",
      "Download a full backup any time from Settings."
    ]]
  ];

  help.open = function () {
    var content = APP.dom.el("div", "help-panel");
    var tourButton = APP.ui.button("Take the tour", "button-primary");

    tourButton.addEventListener("click", function () {
      APP.ui.closeModal();
      help.startTour();
    });

    var intro = APP.dom.el("div", "help-intro");
    intro.appendChild(APP.dom.el("p", "", "New here, or want a refresher? The tour walks through every page in about a minute."));
    intro.appendChild(tourButton);
    content.appendChild(intro);

    help.topics.forEach(function (topic, index) {
      var details = APP.dom.el("details", "help-topic");
      var list = APP.dom.el(index === 0 ? "ol" : "ul");

      details.open = index === 0;
      details.appendChild(APP.dom.el("summary", "", topic[0]));
      topic[1].forEach(function (line) {
        list.appendChild(APP.dom.el("li", "", line));
      });
      details.appendChild(list);
      content.appendChild(details);
    });

    APP.ui.modal("Help", content, { size: "sheet" });
  };

  // ---- Settings section

  help.settingsSection = function () {
    var section = APP.pages.settings.section(
      "Help & tour",
      "Quick answers about each page, or a walk-through of the whole app."
    );
    var row = APP.dom.el("div", "button-row");
    var replay = APP.ui.button("Replay the tour", "button-primary");
    var open = APP.ui.button("Open help");

    replay.addEventListener("click", help.startTour);
    open.addEventListener("click", help.open);
    row.appendChild(replay);
    row.appendChild(open);
    section.appendChild(row);
    return section;
  };

  // ---- First visit

  // Waits until the app is usable: signed in if cloud sync is on, data loaded, and no
  // dialog open, so the tour never starts behind the sign-in screen.
  function startWhenReady(tries) {
    var cloud = APP.cloud || {};
    var blocked = document.body.classList.contains("cloud-locked") ||
      cloud.status === "connecting" ||
      APP.dom.refs.modalRoot.children.length > 0;

    if (storage("get")) {
      return;
    }

    if (blocked) {
      if (tries < 600) {
        window.setTimeout(function () {
          startWhenReady(tries + 1);
        }, 500);
      }
      return;
    }

    help.startTour();
  }

  function init() {
    var button = document.getElementById("help-button");

    if (button) {
      button.addEventListener("click", help.open);
    }

    // Give cloud sync a moment to show its sign-in screen first.
    window.setTimeout(function () {
      startWhenReady(0);
    }, 1500);
  }

  if (APP.ready) {
    init();
  } else {
    window.addEventListener("app:ready", init, { once: true });
  }
}());
