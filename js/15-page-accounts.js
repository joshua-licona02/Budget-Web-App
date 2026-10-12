(function () {
  "use strict";

  var APP = window.APP;
  APP.pages = APP.pages || {};
  APP.pages.accounts = {};

  APP.pages.accounts.kinds = [
    ["checking", "Checking"],
    ["savings", "Savings"],
    ["credit", "Credit card"]
  ];

  APP.pages.accounts.kindLabel = function (kind) {
    var match = APP.pages.accounts.kinds.filter(function (item) {
      return item[0] === kind;
    })[0];

    return match ? match[1] : "Account";
  };

  APP.pages.accounts.today = function () {
    return APP.utils.isoDate(new Date());
  };

  // What an account adds to your total: a bank balance counts up, a card balance down.
  APP.pages.accounts.signedBalance = function (account) {
    return (account.kind === "credit" ? -1 : 1) * APP.utils.money(account.balance);
  };

  // Adding or removing an account after the check has started changes which money is
  // tracked, not how much you have, so the starting total moves with it.
  APP.pages.accounts.shiftBaseline = function (amount) {
    if (APP.state.reconcile.baselineDate) {
      APP.state.reconcile.baselineLiquid = APP.utils.money(APP.state.reconcile.baselineLiquid) + amount;
    }
  };

  APP.pages.accounts.signed = function (value) {
    return (value > 0.004 ? "+" : value < -0.004 ? "−" : "") + APP.utils.currency(Math.abs(value));
  };

  // ---- Add / edit an account

  APP.pages.accounts.openModal = function (accountId) {
    var existing = (APP.state.accounts || []).filter(function (account) {
      return account.id === accountId;
    })[0];
    var account = existing || { name: "", kind: "checking", balance: "", fundIds: [], holdsSpending: false };
    var form = APP.dom.el("form", "form-grid");

    var name = APP.ui.field("Account name", "name", "text", account.name, {
      required: true,
      placeholder: "Example: Checking, House Savings, Visa"
    });
    var kind = APP.ui.field("Type", "kind", "select", account.kind, {
      options: APP.pages.accounts.kinds.map(function (item) {
        return { value: item[0], label: item[1] };
      })
    });
    var balance = APP.ui.field("Current balance", "balance", "number", account.balance, { money: true });

    // Funds can live in only one account; funds already placed elsewhere are labelled.
    var placedElsewhere = {};
    (APP.state.accounts || []).forEach(function (other) {
      if (other.id !== account.id) {
        (other.fundIds || []).forEach(function (fundId) {
          placedElsewhere[fundId] = other.name;
        });
      }
    });

    var fundsField = APP.dom.el("div", "form-field full account-funds");
    var fundList = APP.dom.el("div", "category-checklist");

    fundsField.appendChild(APP.dom.el("span", "", "Savings funds kept in this account"));
    APP.state.categories.filter(function (category) {
      return category.isSavingsFund && !category.archived;
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    }).forEach(function (fund) {
      var label = APP.dom.el("label", "category-option");
      var box = APP.dom.el("input");

      box.type = "checkbox";
      box.value = fund.id;
      box.checked = (account.fundIds || []).indexOf(fund.id) !== -1;
      label.appendChild(box);
      label.appendChild(APP.dom.el("span", "", fund.name +
        (placedElsewhere[fund.id] ? " (now in " + placedElsewhere[fund.id] + ")" : "")));
      fundList.appendChild(label);
    });
    fundsField.appendChild(fundList);

    var spendingLabel = APP.dom.el("label", "settings-check full");
    var spendingBox = APP.dom.el("input");
    spendingBox.type = "checkbox";
    spendingBox.checked = Boolean(account.holdsSpending) ||
      (!existing && !(APP.state.accounts || []).some(function (other) {
        return other.holdsSpending;
      }));
    spendingLabel.appendChild(spendingBox);
    spendingLabel.appendChild(APP.dom.el("span", "",
      "This is my everyday spending account (income lands here; money not in a fund is kept here)"));

    function updateKind() {
      var credit = kind.input.value === "credit";

      balance.root.querySelector("span").textContent = credit ? "Amount owed on the card" : "Current balance";
      fundsField.style.display = credit ? "none" : "";
      spendingLabel.style.display = credit ? "none" : "";
    }

    kind.input.addEventListener("change", updateKind);

    [name, kind, balance].forEach(function (field) {
      form.appendChild(field.root);
    });
    form.appendChild(fundsField);
    form.appendChild(spendingLabel);
    updateKind();

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var credit = kind.input.value === "credit";
      var fundIds = credit ? [] : Array.prototype.slice.call(
        fundList.querySelectorAll("input:checked")
      ).map(function (box) {
        return box.value;
      });
      var record = Object.assign({}, existing || { id: APP.utils.id("acct") }, {
        name: APP.utils.text(name.input.value),
        kind: kind.input.value,
        balance: APP.utils.money(balance.input.value),
        balanceDate: APP.pages.accounts.today(),
        fundIds: fundIds,
        holdsSpending: !credit && spendingBox.checked
      });

      delete record.paymentCategoryId;

      if (!record.name) {
        APP.dom.toast("Give the account a name.", "danger");
        return;
      }

      // A fund lives in one account, and only one account holds spending money.
      (APP.state.accounts || []).forEach(function (other) {
        if (other.id === record.id) {
          return;
        }

        other.fundIds = (other.fundIds || []).filter(function (fundId) {
          return fundIds.indexOf(fundId) === -1;
        });

        if (record.holdsSpending) {
          other.holdsSpending = false;
        }
      });

      if (existing) {
        APP.state.accounts = APP.state.accounts.map(function (item) {
          return item.id === record.id ? record : item;
        });

        // Switching an account between bank and card changes its sign in the total.
        if ((existing.kind === "credit") !== (record.kind === "credit")) {
          APP.pages.accounts.shiftBaseline(
            APP.pages.accounts.signedBalance(Object.assign({}, existing, { balance: record.balance })) * -1 +
            APP.pages.accounts.signedBalance(record)
          );
        }
      } else {
        APP.state.accounts.push(record);
        APP.pages.accounts.shiftBaseline(APP.pages.accounts.signedBalance(record));
      }

      APP.pages.accounts.startIfReady();
      APP.store.log("success", (existing ? "Updated" : "Added") + " account: " + record.name + ".");
      APP.ui.closeModal();
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var cancel = APP.ui.button("Cancel");
    var save = APP.ui.button(existing ? "Save account" : "Add account", "button-primary");

    save.type = "submit";
    cancel.addEventListener("click", APP.ui.closeModal);

    if (existing) {
      var remove = APP.ui.button("Delete account", "button-quiet danger");

      remove.addEventListener("click", function () {
        if (!window.confirm("Delete the account \"" + existing.name + "\"? Its funds stay; they'll count as kept in your spending account.")) {
          return;
        }

        APP.state.accounts = APP.state.accounts.filter(function (item) {
          return item.id !== existing.id;
        });
        APP.pages.accounts.shiftBaseline(-APP.pages.accounts.signedBalance(existing));
        APP.store.log("warning", "Deleted account: " + existing.name + ".");
        APP.ui.closeModal();
        APP.controller.commit();
      });
      actions.appendChild(remove);
    }

    actions.appendChild(cancel);
    actions.appendChild(save);
    form.appendChild(actions);

    APP.ui.modal(existing ? "Edit account" : "Add account", form);
  };

  // Tracking starts the first time balances are saved: the total at that moment is the
  // starting point, and later transactions move the expected total from there.
  APP.pages.accounts.startIfReady = function () {
    var reconcile = APP.state.reconcile;

    if (reconcile.baselineDate || !(APP.state.accounts || []).length) {
      return;
    }

    reconcile.baselineDate = APP.pages.accounts.today();
    reconcile.baselineLiquid = APP.analytics.accountsCheck().actualLiquid;
    APP.store.log("info", "Started the account balance check.");
  };

  // Starting over takes today's balances as the new starting point.
  APP.pages.accounts.restart = function () {
    if (!window.confirm("Start the balance check over from today's balances? Past adjustments to available cash are cleared; fund adjustments stay.")) {
      return;
    }

    APP.state.reconcile = {
      baselineDate: APP.pages.accounts.today(),
      baselineLiquid: APP.analytics.accountsCheck().actualLiquid,
      cashAdjustments: []
    };
    APP.store.log("info", "Restarted the account balance check.");
    APP.controller.commit();
  };

  // ---- Fixing a difference

  APP.pages.accounts.openFix = function (row, check) {
    var content = APP.dom.el("form", "form-grid");
    var difference = row.difference;
    var options = [];

    if (!row.isSpending) {
      // A savings account holds only its funds, so a fund absorbs the difference.
      options = row.funds.map(function (fund) {
        return { value: fund.id, label: fund.name + " (" + APP.utils.currency(fund.balance) + ")" };
      });
    } else {
      options = [{ value: "__cash__", label: "Available cash: income or spending I didn't log" }];
    }

    content.appendChild(APP.dom.el("p", "full",
      row.account.name + " has " + APP.utils.currency(Math.abs(difference)) +
      (difference > 0 ? " more than the budget expects." : " less than the budget expects.")));

    var otherOff = check.rows.filter(function (other) {
      return other !== row && Math.abs(other.difference) >= 0.01;
    });

    if (row.isSpending && otherOff.length) {
      content.appendChild(APP.dom.el("p", "notice notice-warning full",
        "Fix " + otherOff.map(function (other) {
          return other.account.name;
        }).join(" and ") + " first: a savings account that's off usually shows up here as the opposite amount."));
    }

    if (!options.length) {
      content.appendChild(APP.dom.el("p", "danger full",
        "This account has no funds to adjust. Edit it to choose which savings funds live here."));
    }

    var target = APP.ui.field("Put the difference into", "target", "select", options[0] ? options[0].value : "", {
      full: true,
      options: options
    });
    var amount = APP.ui.field(difference > 0 ? "Amount to add" : "Amount to remove", "amount", "number",
      Math.abs(difference), { money: true });
    var note = APP.ui.field("Note", "note", "text", "", {
      full: true,
      placeholder: row.isSpending ? "Example: card interest, cash spending, forgotten paycheck" : "Example: interest earned"
    });

    if (options.length) {
      content.appendChild(target.root);
      content.appendChild(amount.root);
      content.appendChild(note.root);
    }

    content.appendChild(APP.dom.el("p", "field-hint full",
      "Adjustments correct balances without counting as spending or saving in your monthly numbers."));

    content.addEventListener("submit", function (event) {
      event.preventDefault();

      var value = APP.utils.money(amount.input.value) * (difference > 0 ? 1 : -1);
      var entry = {
        id: APP.utils.id("adj"),
        date: APP.pages.accounts.today(),
        amount: value,
        note: APP.utils.text(note.input.value),
        account: row.account.name
      };

      if (!value) {
        return;
      }

      if (target.input.value === "__cash__") {
        APP.state.reconcile.cashAdjustments.push(entry);
      } else {
        var fund = APP.model.categories().byId[target.input.value];
        fund.adjustments = fund.adjustments || [];
        fund.adjustments.push(entry);
      }

      APP.store.log("success", "Balance check adjustment of " + APP.utils.currency(value) + " recorded.");
      APP.ui.closeModal();
      APP.controller.commit();
    });

    var actions = APP.dom.el("div", "modal-actions full");
    var cancel = APP.ui.button("Cancel");
    var apply = APP.ui.button("Apply adjustment", "button-primary");

    apply.type = "submit";
    apply.disabled = !options.length;
    cancel.addEventListener("click", APP.ui.closeModal);
    actions.appendChild(cancel);
    actions.appendChild(apply);
    content.appendChild(actions);

    APP.ui.modal("Fix " + row.account.name, content);
  };

  APP.pages.accounts.adjustmentHistory = function () {
    var items = [];

    APP.state.categories.forEach(function (category) {
      (category.adjustments || []).forEach(function (entry) {
        items.push({ entry: entry, where: category.name, owner: category });
      });
    });

    (APP.state.reconcile.cashAdjustments || []).forEach(function (entry) {
      items.push({ entry: entry, where: "Available cash", owner: null });
    });

    return items.sort(function (a, b) {
      return a.entry.date < b.entry.date ? 1 : -1;
    });
  };

  APP.pages.accounts.removeAdjustment = function (item) {
    if (!window.confirm("Undo this adjustment?")) {
      return;
    }

    if (item.owner) {
      item.owner.adjustments = item.owner.adjustments.filter(function (entry) {
        return entry.id !== item.entry.id;
      });
    } else {
      APP.state.reconcile.cashAdjustments = APP.state.reconcile.cashAdjustments.filter(function (entry) {
        return entry.id !== item.entry.id;
      });
    }

    APP.controller.commit();
  };

  // ---- Page

  APP.pages.accounts.statusBanner = function (check) {
    var banner = APP.dom.el("div", "accounts-status");
    var title = APP.dom.el("strong");
    var detail = APP.dom.el("span");

    if (!check.banks.length) {
      banner.classList.add("is-info");
      title.textContent = "Add your accounts to start";
      detail.textContent = "List each bank account and credit card with today's balance, and say which savings funds live where.";
    } else if (check.balanced) {
      banner.classList.add("is-good");
      title.textContent = "✓ Your budget matches your accounts";
      detail.textContent = "As of " + (check.lastUpdated ? APP.pages.salary.dateLabel(check.lastUpdated) : "today") +
        ". Update balances whenever you check your bank.";
    } else {
      var off = check.rows.filter(function (row) {
        return Math.abs(row.difference) >= 0.01;
      });

      banner.classList.add("is-off");
      title.textContent = off.length === 1 ?
        off[0].account.name + " is off by " + APP.utils.currency(Math.abs(off[0].difference)) :
        off.length + " accounts don't match";
      detail.textContent = Math.abs(check.difference) >= 0.01 ?
        "In total you have " + APP.utils.currency(Math.abs(check.difference)) +
          (check.difference > 0 ? " more" : " less") +
          " than your transactions explain: probably income or spending that isn't logged yet." :
        "Your total matches; the money is just sitting in different accounts than your funds say. Fix the savings accounts first.";
    }

    banner.appendChild(title);
    banner.appendChild(detail);
    return banner;
  };

  APP.pages.accounts.balancesForm = function (check) {
    var form = APP.dom.el("form", "accounts-balances");
    var inputs = [];

    check.banks.concat(check.cards).forEach(function (account) {
      var field = APP.ui.field(
        account.kind === "credit" ? account.name + " (owed)" : account.name,
        "balance_" + account.id,
        "number",
        account.balance,
        { money: true }
      );

      inputs.push({ account: account, input: field.input });
      form.appendChild(field.root);
    });

    var save = APP.ui.button(check.started ? "Save balances and check" : "Save balances and start", "button-primary");
    save.type = "submit";
    form.appendChild(save);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      inputs.forEach(function (item) {
        item.account.balance = APP.utils.money(item.input.value);
        item.account.balanceDate = APP.pages.accounts.today();
      });

      APP.pages.accounts.startIfReady();
      APP.store.log("info", "Account balances updated.");
      APP.controller.commit();
    });

    return form;
  };

  APP.pages.accounts.accountCard = function (row, check) {
    var card = APP.dom.el("article", "account-card" + (Math.abs(row.difference) >= 0.01 ? " is-off" : ""));
    var head = APP.dom.el("div", "account-card-head");
    var edit = APP.ui.button("Edit", "button-quiet");

    edit.addEventListener("click", function () {
      APP.pages.accounts.openModal(row.account.id);
    });

    var title = APP.dom.el("div");
    title.appendChild(APP.dom.el("strong", "", row.account.name));
    title.appendChild(APP.dom.el("small", "", APP.pages.accounts.kindLabel(row.account.kind) +
      (row.isSpending ? " · everyday spending" : "")));
    head.appendChild(title);
    head.appendChild(edit);
    card.appendChild(head);

    var lines = APP.dom.el("div", "account-lines");

    function line(label, value, className) {
      var item = APP.dom.el("div", "account-line " + (className || ""));
      item.appendChild(APP.dom.el("span", "", label));
      item.appendChild(APP.dom.el("span", "", value));
      lines.appendChild(item);
    }

    // What's really there.
    if (row.isSpending && row.cardTotal) {
      line("Bank balance", APP.utils.currency(row.account.balance));
      line("Owed on cards", "−" + APP.utils.currency(row.cardTotal));
    }

    line("You have", APP.utils.currency(row.actual), "account-line-strong");

    // What the budget says should be there.
    // Funds not placed in an account are listed only when they hold money.
    row.funds.filter(function (fund) {
      return !fund.unplaced || Math.abs(fund.balance) >= 0.005;
    }).forEach(function (fund) {
      line(fund.name + (fund.unplaced ? " *" : ""), APP.utils.currency(fund.balance), "account-line-fund");
    });

    if (row.isSpending) {
      line("Available cash (not in a fund)", APP.utils.currency(row.availableCash), "account-line-fund");
    }

    line("Budget expects", APP.utils.currency(row.expected), "account-line-strong");

    var diff = APP.dom.el("div", "account-difference");

    if (Math.abs(row.difference) < 0.01) {
      diff.appendChild(APP.dom.el("span", "success", "✓ Matches"));
    } else {
      diff.appendChild(APP.dom.el("span", "account-off", "Off by " + APP.pages.accounts.signed(row.difference)));

      var fix = APP.ui.button("Fix", "button-secondary");
      fix.addEventListener("click", function () {
        APP.pages.accounts.openFix(row, check);
      });
      diff.appendChild(fix);
    }

    card.appendChild(lines);
    card.appendChild(diff);
    return card;
  };

  APP.pages.accounts.render = function () {
    var root = APP.dom.refs.pages.accounts;
    var check = APP.analytics.accountsCheck();

    APP.dom.clear(root);

    var add = APP.ui.button("+ Add account", "button-primary");
    add.addEventListener("click", function () {
      APP.pages.accounts.openModal();
    });

    var headerActions = APP.dom.el("div", "button-row");
    headerActions.appendChild(add);

    root.appendChild(APP.ui.panelHeader(
      "Accounts",
      "Check that your budget matches the money that's really in your accounts. Enter balances from your bank and card, and the app compares them with what your transactions and funds say.",
      headerActions
    ));

    root.appendChild(APP.pages.accounts.statusBanner(check));

    if (check.banks.length) {
      var balances = APP.dom.el("section", "accounts-section");
      balances.appendChild(APP.dom.el("h3", "", "Today's balances"));
      balances.appendChild(APP.dom.el("p", "muted accounts-help", check.started ?
        "Tracking since " + APP.pages.salary.dateLabel(check.baselineDate) +
          ". Transactions dated after that day are compared with these balances." :
        "Saving balances starts the check: today's total becomes the starting point, and transactions dated after today move it."));
      balances.appendChild(APP.pages.accounts.balancesForm(check));
      root.appendChild(balances);

      var grid = APP.dom.el("div", "account-grid");
      check.rows.forEach(function (row) {
        grid.appendChild(APP.pages.accounts.accountCard(row, check));
      });

      check.cards.forEach(function (card) {
        var cardEl = APP.dom.el("article", "account-card account-card-credit");
        var head = APP.dom.el("div", "account-card-head");
        var edit = APP.ui.button("Edit", "button-quiet");
        var title = APP.dom.el("div");

        edit.addEventListener("click", function () {
          APP.pages.accounts.openModal(card.id);
        });
        title.appendChild(APP.dom.el("strong", "", card.name));
        title.appendChild(APP.dom.el("small", "", "Credit card · subtracted from " +
          (check.spending ? check.spending.name : "your spending account")));
        head.appendChild(title);
        head.appendChild(edit);
        cardEl.appendChild(head);
        cardEl.appendChild(APP.dom.el("p", "account-owed", APP.utils.currency(card.balance) + " owed"));
        cardEl.appendChild(APP.dom.el("p", "muted accounts-help",
          "The amount owed is subtracted from " +
          (check.spending ? check.spending.name : "your spending account") +
          ", so what's left is what you really have after everything you've charged."));
        grid.appendChild(cardEl);
      });

      root.appendChild(grid);

      var unplacedWithMoney = check.unplaced.filter(function (fund) {
        return Math.abs(APP.analytics.fundBalanceNow(fund.id)) >= 0.005;
      });

      if (unplacedWithMoney.length) {
        root.appendChild(APP.dom.el("p", "muted accounts-help",
          "* Not assigned to an account yet, so counted in " + (check.spending ? check.spending.name : "your spending account") +
          ". Edit an account to place " + unplacedWithMoney.map(function (fund) {
            return fund.name;
          }).join(", ") + "."));
      }

      var history = APP.pages.accounts.adjustmentHistory();

      if (history.length) {
        var historySection = APP.dom.el("section", "accounts-section");
        var list = APP.dom.el("div", "budget-rows");

        historySection.appendChild(APP.dom.el("h3", "", "Adjustments"));
        history.slice(0, 20).forEach(function (item) {
          var rowEl = APP.dom.el("div", "adjustment-row");
          var undo = APP.ui.button("Undo", "button-quiet");

          undo.addEventListener("click", function () {
            APP.pages.accounts.removeAdjustment(item);
          });
          rowEl.appendChild(APP.dom.el("span", "", APP.pages.salary.shortDate(item.entry.date)));
          rowEl.appendChild(APP.dom.el("span", "", item.where + (item.entry.note ? " · " + item.entry.note : "")));
          rowEl.appendChild(APP.dom.el("strong", "", APP.pages.accounts.signed(item.entry.amount)));
          rowEl.appendChild(undo);
          list.appendChild(rowEl);
        });
        historySection.appendChild(list);
        root.appendChild(historySection);
      }

      if (check.started) {
        var restart = APP.ui.button("Start the check over from today", "button-quiet");
        restart.addEventListener("click", APP.pages.accounts.restart);
        root.appendChild(restart);
      }
    } else {
      var how = APP.dom.el("ol", "accounts-steps");
      [
        "Add each bank account (checking, savings) and credit card with today's balance.",
        "For each bank account, pick the savings funds that live in it, for example Free Money and Health Fund in checking, House Fund in House Savings.",
        "Save. From then on, enter balances when you check your bank; the app tells you if anything doesn't add up and helps you fix it."
      ].forEach(function (text) {
        how.appendChild(APP.dom.el("li", "", text));
      });
      root.appendChild(how);
    }

    var pay = APP.dom.el("section", "accounts-section");
    pay.appendChild(APP.dom.el("h3", "", "Paycheck estimate"));
    pay.appendChild(APP.dom.el("p", "muted accounts-help",
      "Used for the Monthly Plan's expected income. Hourly pay counts the weekdays in each pay period."));
    APP.pages.salary.renderSection(pay);
    root.appendChild(pay);
  };
}());
