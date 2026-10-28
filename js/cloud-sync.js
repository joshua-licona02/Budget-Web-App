// Cloud sync: Google sign-in plus Firestore, so every device signed in to an allowed
// account sees the same budget. The app keeps working from its local copy while offline;
// Firestore queues writes and delivers them once the device is back online.
//
// Firestore layout (access limited to the allowed accounts in firestore.rules):
//   households/main/state/core      one JSON string field per section (settings, categories,
//                                   budgets, accounts, ...), so an edit to one section never
//                                   overwrites another device's edit to a different one
//   households/main/transactions/*  one document per transaction, so two people adding
//                                   transactions at once never overwrite each other
//
// Each device remembers what it last synced (the "base"). Comparing against it tells which
// changes were made on this device and which came from elsewhere, so edits that hadn't
// reached the cloud yet (offline, or the app closed right after an edit) are sent the next
// time it connects instead of being replaced by the cloud copy.
//
// Cloud sync is optional. It turns on only when js/cloud-config.js exists (copy
// js/cloud-config.example.js and fill in your Firebase project). Without it the app runs
// entirely in this browser and Firebase is never downloaded.
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/12.19.0/";

const APP = window.APP;

const HOUSEHOLD = "main";
const LINKED_KEY = "personalBudgetDashboard.cloudLinked";
const BASE_KEY = "personalBudgetDashboard.cloudBase";
// Older versions flagged offline edits with this instead of keeping a base.
const DIRTY_KEY = "personalBudgetDashboard.cloudDirty";

const SECTIONS = ["schemaVersion", "settings", "categories", "budgets", "savingsGoals", "debts", "salary", "accounts", "reconcile"];

// Settings that describe this device's view rather than the shared budget.
const LOCAL_SETTINGS = ["selectedMonth", "activeView", "activeDashboardTab", "ollama", "theme"];

// Firebase functions, loaded on demand in main().
let GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, doc, getDoc, getDocs, onSnapshot, writeBatch, serverTimestamp, deleteField;

let firebaseConfig = null;
let auth = null;
let db = null;
let coreRef = null;
let transactionsRef = null;

const cloud = APP.cloud = {
  user: null,
  status: "local",
  ready: false,
  enabled: false
};

// What the cloud is known to hold, so each save only writes what actually changed.
let syncedCore = {};
let syncedTransactions = new Map();
// The cloud copy is still in the old single-JSON format, or a save failed: the next save
// writes every section rather than only the changed ones.
let writeAllCore = false;
let unsubscribers = [];
let pushTimer = null;
let pendingCommits = 0;

function storage(action, key, value) {
  try {
    if (action === "get") {
      return window.localStorage.getItem(key);
    }

    if (action === "set") {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    // Private browsing or blocked storage: sync still works for this session.
  }

  return null;
}

// Short fingerprint of a transaction, so the base doesn't store every transaction twice.
function fingerprint(text) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36) + "." + text.length.toString(36);
}

// ---- Core sections

function sectionsFromState() {
  const sections = {};

  SECTIONS.forEach(function (key) {
    let value = APP.state[key];

    if (key === "settings") {
      value = {};
      Object.keys(APP.state.settings || {}).forEach(function (name) {
        if (LOCAL_SETTINGS.indexOf(name) === -1) {
          value[name] = APP.state.settings[name];
        }
      });
    }

    if (value !== undefined) {
      sections[key] = JSON.stringify(value);
    }
  });

  return sections;
}

// Reads the core document in either format: one string field per section, or the older
// single "json" field holding everything.
function sectionsFromDoc(data) {
  const sections = {};
  let legacy = false;

  SECTIONS.forEach(function (key) {
    if (typeof data[key] === "string") {
      sections[key] = data[key];
    }
  });

  if (!Object.keys(sections).length && typeof data.json === "string") {
    const core = JSON.parse(data.json);
    legacy = true;

    SECTIONS.forEach(function (key) {
      if (core[key] !== undefined) {
        sections[key] = JSON.stringify(core[key]);
      }
    });
  }

  return { sections: sections, legacy: legacy };
}

function applySection(key, json) {
  const value = JSON.parse(json);

  if (key !== "settings") {
    APP.state[key] = value;
    return;
  }

  const local = {};

  LOCAL_SETTINGS.forEach(function (name) {
    if (APP.state.settings && APP.state.settings[name] !== undefined) {
      local[name] = APP.state.settings[name];
    }
  });

  APP.state.settings = Object.assign({}, value || {}, local);
}

// ---- The base: what this device last confirmed the cloud holds

function saveBase() {
  const transactions = {};

  syncedTransactions.forEach(function (json, id) {
    transactions[id] = fingerprint(json);
  });

  storage("set", BASE_KEY, JSON.stringify({
    uid: cloud.user && cloud.user.uid,
    core: syncedCore,
    transactions: transactions
  }));
}

// Only record the base once nothing is waiting to be sent, so an edit that never reached
// the cloud is never recorded as synced.
function saveBaseIfSettled() {
  if (!pendingCommits && !pushTimer && cloud.ready) {
    saveBase();
  }
}

function loadBase(uid) {
  try {
    const base = JSON.parse(storage("get", BASE_KEY) || "null");
    return base && base.uid === uid && base.core && base.transactions ? base : null;
  } catch (error) {
    return null;
  }
}

function setStatus(status, detail) {
  cloud.status = status;

  const labels = {
    local: "Stored in this browser",
    "signed-out": "Not signed in",
    connecting: "Connecting…",
    synced: "Synced",
    syncing: "Saving…",
    offline: "Offline · changes will sync",
    error: "Sync problem"
  };

  const element = document.getElementById("sync-status");

  if (element) {
    element.dataset.status = status;
    element.querySelector(".sync-label").textContent = detail || labels[status] || status;
  }
}

// ---- Pushing local changes

function schedulePush() {
  if (!cloud.ready) {
    // Edits made before the cloud connects are found by comparing with the base on connect.
    return;
  }

  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(push, 600);
}

// Sends a waiting save right away, e.g. when the app is closed or put in the background.
function flush() {
  if (pushTimer) {
    push();
  }
}

function push() {
  window.clearTimeout(pushTimer);
  pushTimer = null;

  if (!cloud.ready) {
    return;
  }

  const writes = [];
  const sections = sectionsFromState();
  const coreChanges = {};
  const current = new Map();

  Object.keys(sections).forEach(function (key) {
    if (writeAllCore || sections[key] !== syncedCore[key]) {
      coreChanges[key] = sections[key];
    }
  });

  if (Object.keys(coreChanges).length) {
    writes.push(["set", coreRef, Object.assign({}, coreChanges, {
      json: deleteField(),
      updatedAt: serverTimestamp(),
      updatedBy: cloud.user.email
    }), { merge: true }]);
    Object.assign(syncedCore, coreChanges);
    writeAllCore = false;
  }

  (APP.state.transactions || []).forEach(function (transaction) {
    if (!transaction || !transaction.id) {
      return;
    }

    const json = JSON.stringify(transaction);
    current.set(transaction.id, json);

    if (syncedTransactions.get(transaction.id) !== json) {
      writes.push(["set", doc(transactionsRef, transaction.id), { json: json, updatedAt: serverTimestamp() }]);
    }
  });

  syncedTransactions.forEach(function (json, id) {
    if (!current.has(id)) {
      writes.push(["delete", doc(transactionsRef, id)]);
    }
  });

  syncedTransactions = current;

  if (!writes.length) {
    saveBaseIfSettled();
    return;
  }

  setStatus(navigator.onLine ? "syncing" : "offline");

  // Firestore batches hold at most 500 writes. Each commit lands in the local cache
  // right away; its promise settles when the server confirms, which can be much later
  // offline, so later saves don't wait on it.
  const commits = [];

  for (let start = 0; start < writes.length; start += 450) {
    const batch = writeBatch(db);

    writes.slice(start, start + 450).forEach(function (write) {
      if (write[0] === "set") {
        batch.set(write[1], write[2], write[3] || {});
      } else {
        batch.delete(write[1]);
      }
    });

    commits.push(batch.commit());
  }

  pendingCommits += 1;

  Promise.all(commits).then(function () {
    pendingCommits -= 1;

    if (!pendingCommits) {
      setStatus("synced");
    }

    saveBaseIfSettled();
  }).catch(function (error) {
    pendingCommits -= 1;
    console.error("Cloud save failed", error);
    // Resend everything with the next save. The base isn't updated, so if the app is
    // closed first these edits are still sent the next time it connects.
    writeAllCore = true;
    syncedTransactions = new Map();
    setStatus("error", error.code === "permission-denied" ?
      "This account can't save to the budget" :
      "Couldn't save to the cloud");
    APP.dom.toast("Couldn't save to the cloud: " + (error.message || error), "danger");
  });
}

// ---- Receiving other devices' changes

let renderQueued = false;

function refreshApp() {
  if (renderQueued) {
    return;
  }

  renderQueued = true;

  window.requestAnimationFrame(function () {
    renderQueued = false;
    APP.controller.normalizeState();
    // commit() saves locally, re-renders, and pushes anything still unsent.
    APP.controller.commit();
  });
}

function listen() {
  unsubscribers.forEach(function (stop) {
    stop();
  });

  unsubscribers = [
    onSnapshot(coreRef, { includeMetadataChanges: true }, function (snapshot) {
      if (!snapshot.metadata.hasPendingWrites) {
        setStatus(snapshot.metadata.fromCache && !navigator.onLine ? "offline" : "synced");
      }

      if (!snapshot.exists()) {
        return;
      }

      const remote = sectionsFromDoc(snapshot.data());
      const local = sectionsFromState();
      let changed = false;

      if (remote.legacy) {
        writeAllCore = true;
      }

      Object.keys(remote.sections).forEach(function (key) {
        const json = remote.sections[key];

        if (json === syncedCore[key]) {
          return;
        }

        // A section edited here and not yet sent keeps this device's version; the
        // pending save sends it. Otherwise take the other device's change.
        if (local[key] === syncedCore[key]) {
          applySection(key, json);
          changed = true;
        }

        syncedCore[key] = json;
      });

      if (changed) {
        refreshApp();
      } else if (!snapshot.metadata.hasPendingWrites) {
        saveBaseIfSettled();
      }
    }, onListenError),

    onSnapshot(transactionsRef, function (snapshot) {
      let changed = false;
      const byId = new Map((APP.state.transactions || []).map(function (transaction) {
        return [transaction.id, transaction];
      }));

      snapshot.docChanges().forEach(function (change) {
        const id = change.doc.id;
        const mine = byId.has(id) ? JSON.stringify(byId.get(id)) : undefined;
        // Unchanged here since the last sync, so the other device's version applies.
        const untouched = mine === syncedTransactions.get(id);

        if (change.type === "removed") {
          if (syncedTransactions.has(id)) {
            if (untouched) {
              byId.delete(id);
              changed = true;
            }
            syncedTransactions.delete(id);
          }
          return;
        }

        const json = change.doc.data().json;

        if (json && syncedTransactions.get(id) !== json) {
          if (untouched) {
            byId.set(id, JSON.parse(json));
            changed = true;
          }
          syncedTransactions.set(id, json);
        }
      });

      if (changed) {
        APP.state.transactions = Array.from(byId.values());
        refreshApp();
      } else {
        saveBaseIfSettled();
      }
    }, onListenError)
  ];
}

function onListenError(error) {
  console.error("Cloud listener failed", error);

  if (error.code === "permission-denied") {
    showGate("denied");
  } else {
    setStatus("error", "Can't reach the cloud");
  }
}

// ---- Connecting after sign-in

async function readCloud() {
  const coreSnapshot = await getDoc(coreRef);
  const transactionSnapshot = await getDocs(transactionsRef);
  const transactions = new Map();

  transactionSnapshot.forEach(function (item) {
    if (item.data().json) {
      transactions.set(item.id, item.data().json);
    }
  });

  const core = coreSnapshot.exists() ? sectionsFromDoc(coreSnapshot.data()) : null;

  return {
    core: core && Object.keys(core.sections).length ? core.sections : null,
    legacy: Boolean(core && core.legacy),
    transactions: transactions
  };
}

function localHasData() {
  return (APP.state.transactions || []).length > 0 ||
    (APP.state.budgets || []).some(function (budget) {
      return (budget.items || []).length > 0;
    }) ||
    (APP.state.debts || []).length > 0;
}

// Combines the cloud with this device's copy: whatever changed here since the last sync
// (base) is kept, and everything else comes from the cloud.
function mergeWithBase(remote, base) {
  const local = sectionsFromState();

  SECTIONS.forEach(function (key) {
    const editedHere = local[key] !== undefined && local[key] !== base.core[key];

    if (!editedHere && remote.core[key] !== undefined) {
      applySection(key, remote.core[key]);
    }
  });

  const mine = new Map();
  const merged = new Map();

  (APP.state.transactions || []).forEach(function (transaction) {
    if (transaction && transaction.id) {
      mine.set(transaction.id, transaction);
    }
  });

  function editedHere(id) {
    return fingerprint(JSON.stringify(mine.get(id))) !== base.transactions[id];
  }

  remote.transactions.forEach(function (json, id) {
    if (mine.has(id) && editedHere(id)) {
      merged.set(id, mine.get(id));
    } else if (mine.has(id) || base.transactions[id] === undefined ||
      fingerprint(json) !== base.transactions[id]) {
      // Unchanged here, new from another device, or changed elsewhere after being
      // deleted here: the cloud's version.
      merged.set(id, JSON.parse(json));
    }
    // Otherwise it was deleted on this device since the last sync, so it stays deleted.
  });

  mine.forEach(function (transaction, id) {
    if (!remote.transactions.has(id) && (base.transactions[id] === undefined || editedHere(id))) {
      // Added on this device, or edited here after another device deleted it.
      merged.set(id, transaction);
    }
  });

  APP.state.transactions = Array.from(merged.values());
}

function askWhichData(remoteCount) {
  return new Promise(function (resolve) {
    const content = APP.dom.el("div", "cloud-choice");

    content.appendChild(APP.dom.el("p", "",
      "The cloud already has a budget (" + remoteCount + " transactions), and this device has its own separate data (" +
      (APP.state.transactions || []).length + " transactions). Which should both of you use from now on?"));

    const actions = APP.dom.el("div", "modal-actions");
    const useCloud = APP.ui.button("Use the cloud budget", "button-primary");
    const useLocal = APP.ui.button("Replace it with this device's data");

    useCloud.addEventListener("click", function () {
      APP.ui.closeModal();
      resolve("cloud");
    });

    useLocal.addEventListener("click", function () {
      if (!window.confirm("Replace the shared cloud budget with this device's data? The cloud's current data will be overwritten for everyone.")) {
        return;
      }

      APP.ui.closeModal();
      resolve("local");
    });

    actions.appendChild(useLocal);
    actions.appendChild(useCloud);
    content.appendChild(actions);
    APP.ui.modal("Choose which budget to keep", content);
  });
}

async function connect(user) {
  cloud.user = user;
  hideGate();
  setStatus("connecting");

  let remote;

  try {
    remote = await readCloud();
  } catch (error) {
    console.error("Cloud read failed", error);

    if (error.code === "permission-denied") {
      showGate("denied");
    } else {
      setStatus("error", "Can't reach the cloud");
      showGate("error", error.message);
    }
    return;
  }

  const linked = storage("get", LINKED_KEY) === user.uid;
  const base = linked ? loadBase(user.uid) : null;
  let mode = "cloud";

  if (!remote.core) {
    mode = "upload";
  } else if (base) {
    mode = "merge";
  } else if (linked && storage("get", DIRTY_KEY) === "1") {
    mode = "legacy-merge";
  } else if (!linked && localHasData()) {
    mode = await askWhichData(remote.transactions.size);
  }

  if (mode === "cloud" || mode === "legacy-merge") {
    const localTransactions = APP.state.transactions || [];

    Object.keys(remote.core).forEach(function (key) {
      applySection(key, remote.core[key]);
    });

    const byId = new Map();

    remote.transactions.forEach(function (json, id) {
      byId.set(id, JSON.parse(json));
    });

    if (mode === "legacy-merge") {
      // Updated from an older version with offline edits but no base: keep this
      // device's transactions too (its version wins on conflicts).
      localTransactions.forEach(function (transaction) {
        byId.set(transaction.id, transaction);
      });
    }

    APP.state.transactions = Array.from(byId.values());
  }

  if (mode === "merge") {
    mergeWithBase(remote, base);
  }

  // What the cloud holds now; the first push writes only the differences.
  syncedCore = mode === "upload" ? {} : Object.assign({}, remote.core);
  syncedTransactions = mode === "upload" ? new Map() : new Map(remote.transactions);
  writeAllCore = remote.legacy;

  storage("set", LINKED_KEY, user.uid);
  storage("remove", DIRTY_KEY);
  cloud.ready = true;

  APP.controller.normalizeState();
  APP.controller.commit();
  // Send any differences now rather than after the usual short delay.
  flush();
  listen();

  if (mode === "upload") {
    APP.dom.toast("Your budget is now saved to the cloud and will sync across your devices.", "success");
  }

  renderAccount();
}

// ---- Sign-in gate and account display

function gateElement() {
  let gate = document.getElementById("cloud-gate");

  if (gate) {
    return gate;
  }

  gate = APP.dom.el("div", "cloud-gate");
  gate.id = "cloud-gate";
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.setAttribute("aria-labelledby", "cloud-gate-title");

  const card = APP.dom.el("div", "cloud-gate-card");
  const mark = APP.dom.el("div", "brand-mark", "$");
  const title = APP.dom.el("h1", "", "Budget");
  const message = APP.dom.el("p", "cloud-gate-message");
  const button = APP.dom.el("button", "button button-primary cloud-gate-button", "Sign in with Google");
  const secondary = APP.dom.el("button", "button button-quiet cloud-gate-secondary", "Use a different account");

  title.id = "cloud-gate-title";
  button.type = "button";
  secondary.type = "button";
  button.addEventListener("click", signIn);
  secondary.addEventListener("click", function () {
    leave(false);
  });

  card.appendChild(mark);
  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(button);
  card.appendChild(secondary);
  gate.appendChild(card);
  document.body.appendChild(gate);

  return gate;
}

function showGate(reason, detail) {
  cloud.ready = false;
  const gate = gateElement();
  const message = gate.querySelector(".cloud-gate-message");
  const button = gate.querySelector(".cloud-gate-button");
  const secondary = gate.querySelector(".cloud-gate-secondary");

  gate.hidden = false;
  document.body.classList.add("cloud-locked");
  button.hidden = false;
  button.disabled = false;
  secondary.hidden = true;

  if (reason === "denied") {
    message.textContent = (cloud.user ? cloud.user.email : "This account") +
      " doesn't have access to this budget. Sign in with an account that has been added to it.";
    button.hidden = true;
    secondary.hidden = false;
    setStatus("error", "No access");
  } else if (reason === "error") {
    message.textContent = "Couldn't connect to the cloud" + (detail ? " (" + detail + ")" : "") +
      ". Check your connection and try again.";
    button.textContent = "Try again";
  } else if (reason === "loading") {
    message.textContent = "Loading your budget…";
    button.hidden = true;
  } else if (reason === "file") {
    message.textContent = "Sign-in needs a web address. Open https://" + firebaseConfig.projectId +
      ".web.app, or run start-budget-app.cmd on this computer.";
    button.hidden = true;
  } else {
    message.textContent = "Sign in to see your shared budget on any device.";
    button.textContent = "Sign in with Google";
    setStatus("signed-out");
  }
}

function hideGate() {
  const gate = document.getElementById("cloud-gate");

  if (gate) {
    gate.hidden = true;
  }

  document.body.classList.remove("cloud-locked");
}

async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  if (cloud.status === "error" && cloud.user) {
    connect(cloud.user);
    return;
  }

  const button = gateElement().querySelector(".cloud-gate-button");
  button.disabled = true;

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    // Home-screen apps and strict browsers often block popups; a full-page redirect works there.
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment",
      "auth/cancelled-popup-request"].indexOf(error.code) !== -1) {
      await signInWithRedirect(auth, provider);
      return;
    }

    if (error.code !== "auth/popup-closed-by-user") {
      APP.dom.toast("Sign-in failed: " + (error.message || error.code), "danger");
    }

    button.disabled = false;
  }
}

// Signing out clears this device's copy, so a shared or borrowed device keeps nothing.
async function leave(confirmFirst) {
  if (confirmFirst && !window.confirm("Sign out? This device's copy of the budget will be removed; it stays safe in the cloud.")) {
    return;
  }

  unsubscribers.forEach(function (stop) {
    stop();
  });
  unsubscribers = [];
  cloud.ready = false;

  storage("remove", LINKED_KEY);
  storage("remove", BASE_KEY);
  storage("remove", DIRTY_KEY);
  storage("remove", APP.config.storageKey);

  await signOut(auth);
  location.reload();
}

function renderAccount() {
  const account = document.getElementById("sync-account");

  if (!account) {
    return;
  }

  APP.dom.clear(account);

  if (!cloud.user) {
    return;
  }

  account.appendChild(APP.dom.el("span", "sync-email", cloud.user.email));

  const out = APP.dom.el("button", "sync-signout", "Sign out");
  out.type = "button";
  out.addEventListener("click", function () {
    leave(true);
  });
  account.appendChild(out);
}

// ---- Start

function start() {
  const originalSave = APP.store.save;

  APP.store.save = function () {
    const result = originalSave.apply(APP.store, arguments);
    schedulePush();
    return result;
  };

  // Phones suspend or close an app in the background, so send any waiting save as it goes.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });

  window.addEventListener("pagehide", flush);

  window.addEventListener("online", function () {
    if (cloud.ready) {
      setStatus("synced");
    }
  });

  window.addEventListener("offline", function () {
    if (cloud.ready) {
      setStatus("offline");
    }
  });

  if (location.protocol === "file:") {
    showGate("file");
    return;
  }

  showGate("loading");
  setStatus("connecting");

  getRedirectResult(auth).catch(function (error) {
    APP.dom.toast("Sign-in failed: " + (error.message || error.code), "danger");
  });

  onAuthStateChanged(auth, function (user) {
    if (user) {
      connect(user);
    } else {
      cloud.user = null;
      cloud.ready = false;
      renderAccount();
      showGate("signed-out");
    }
  });
}

async function loadConfig() {
  try {
    const module = await import("./cloud-config.js");
    return module.default && module.default.projectId ? module.default : null;
  } catch (error) {
    return null;
  }
}

async function main() {
  firebaseConfig = await loadConfig();

  if (!firebaseConfig) {
    // Local-only mode: nothing to set up; the sidebar says where data lives.
    setStatus("local");
    return;
  }

  // On this project's own Firebase Hosting site, sign in through the same domain so
  // browsers that block third-party storage (Safari, iOS home-screen apps) can finish
  // signing in. That domain must be an authorized redirect URI (see README).
  const ownHosts = [
    firebaseConfig.projectId + ".web.app",
    firebaseConfig.projectId + ".firebaseapp.com"
  ];

  if (ownHosts.indexOf(location.hostname) !== -1) {
    firebaseConfig = Object.assign({}, firebaseConfig, { authDomain: location.hostname });
  }

  let modules;

  try {
    modules = await Promise.all([
      import(FIREBASE_SDK + "firebase-app.js"),
      import(FIREBASE_SDK + "firebase-auth.js"),
      import(FIREBASE_SDK + "firebase-firestore.js")
    ]);
  } catch (error) {
    // Offline before Firebase was ever cached: keep working from this device's copy.
    console.warn("Cloud sync unavailable", error);
    setStatus("offline", "Offline · using this device's copy");
    return;
  }

  const [appModule, authModule, firestoreModule] = modules;

  ({ GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect,
    getRedirectResult, signOut } = authModule);
  ({ doc, getDoc, getDocs, onSnapshot, writeBatch, serverTimestamp, deleteField } = firestoreModule);

  const firebaseApp = appModule.initializeApp(firebaseConfig);

  auth = authModule.getAuth(firebaseApp);
  db = firestoreModule.initializeFirestore(firebaseApp, {
    localCache: firestoreModule.persistentLocalCache({
      tabManager: firestoreModule.persistentMultipleTabManager()
    })
  });
  coreRef = doc(db, "households", HOUSEHOLD, "state", "core");
  transactionsRef = firestoreModule.collection(db, "households", HOUSEHOLD, "transactions");
  cloud.enabled = true;

  start();
}

if (APP.ready) {
  main();
} else {
  window.addEventListener("app:ready", main, { once: true });
}
