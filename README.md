# Personal Budget Dashboard

A private, local-first budgeting app that runs in your browser. Track income, spending, savings funds and debts; plan each month; and see where your money goes through a customizable dashboard of charts. It can optionally:

- **Sync across devices and people** (phones, laptops, a partner's phone) using a free Firebase project, and
- **Answer questions about your finances** using an AI model running on your own computer through [Ollama](https://ollama.com), so your data never goes to an AI company.

There is no build step and no server code: it's plain HTML, CSS and JavaScript.

> **Planning notice:** estimates, projections and advisor answers are informational only. They are not tax, payroll, legal, investment, accounting or professional financial advice.

---

## Contents

- [Features](#features)
- [Choose how to run it](#choose-how-to-run-it)
- [Option 1: Use it locally (no account needed)](#option-1-use-it-locally-no-account-needed)
- [Option 2: Host it on Firebase with shared sync](#option-2-host-it-on-firebase-with-shared-sync)
- [Using the app](#using-the-app)
- [Ollama financial advisor (optional)](#ollama-financial-advisor-optional)
- [Your data: where it lives and how to back it up](#your-data-where-it-lives-and-how-to-back-it-up)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [For developers](#for-developers)

---

## Features

**Tracking and planning**
- Transactions: income, expenses, savings contributions and spending paid from savings funds, with search, filters, CSV export, and CSV/XLSX import. Category pickers are searchable.
- Kinds of income (paycheck, extra income, gift, interest, other) and **refunds**. A refund names the category it goes back to and lowers that category's spending instead of counting as income.
- **Round-ups:** an expense can be rounded up to the next dollar, with the change saved into a round-up savings fund. Settings sets whether that's on by default.
- **Free Money** is tracked as its own kind of outflow, separate from savings, in the summary cards and flow charts.
- Monthly Plan: set expected income and a target for every category. The page shows how much income is still unassigned, lets you search and filter categories, groups them with subtotals, and shows progress on every row.
- Savings funds with monthly and long-term goals. Give a goal a target date and the app tells you how much to save each month to hit it.
- Debts with APR, minimum payments and payment tracking.
- **Accounts:** a balance check that compares your budget with the money really in your accounts. Enter each bank account's and credit card's balance and which savings funds live in each. The app checks that every savings account holds exactly its funds, and that checking minus your card balances equals the funds kept there plus your available cash. Your money is tracked from the day you start: income and refunds add to it, expenses subtract, and moving money into funds or paying the card from checking are just transfers. When something doesn't match, it shows where and helps you fix it with an adjustment that doesn't affect your monthly numbers.
- Paycheck estimate (on the Accounts page) for hourly or salaried pay on any schedule: each paycheck's hours and take-home (twice-a-month hourly checks are 80, 88 or 96 hours depending on the weekdays in the period), used for the Monthly Plan's expected income.

**Dashboard**
- Summary cards for income, spending, savings, debt payments, total outflow and net cash flow. Colors mean good or bad news: debt payments count as progress, and spending only turns red when it's over budget.
- **Tabs**: Overview, Spending, Savings, Debt and Trends. Rename, add, delete and reorder tabs, and move visuals between them.
- **Visuals** (add, edit, resize, reorder, hide):
  - *Spending budget gauge*: how much you have left this month. It never shows more than the cash you actually have left, and explains any gap (for example, saving more than planned).
  - Budget vs. actual by category, spending pace vs. budget, a daily spending calendar, and a category heatmap.
  - Income allocation (sankey) and a cash-flow waterfall.
  - Debt: total paid down, estimated payoff date per debt, avalanche vs. snowball comparison, balances over time, and interest vs. principal.
  - Savings: goal progress rings, contributions vs. goal, savings rate, and fund balances.
  - Trends: income vs. outflow, net cash flow, spending by category over time, and this year vs. last year.
  - Line and area charts can show **each category as its own line** on top of the total.
  - An **Avg** toggle on line, bar and heatmap visuals adds the period's average.
  - Category totals: every category's total, monthly average and this month, split into spending, savings, Free Money and debt.
- Colors are checked for colorblind readability. Tap a chart once for one point, again for the whole column, and a third time to close it. Scrolling on a phone never opens tooltips.

**Everywhere**
- Works on phones: every page fits a phone screen, and you can add it to your home screen like an app.
- **Light and dark mode** (Settings → Appearance), or follow the device's setting. It's chosen separately on each device.
- Works offline. With cloud sync, changes sync when you reconnect.

---

## Choose how to run it

| | **Option 1: Local** | **Option 2: Firebase** |
|---|---|---|
| Setup time | 1 minute | About 20 minutes, once |
| Account needed | None | A free Google/Firebase account |
| Where data lives | In your browser, on one device | In your Firebase project, synced to every signed-in device |
| Phones and other people | No (one browser on one device) | Yes: any device, shared with the people you allow |
| Cost | Free | Free (Firebase's free Spark plan is far more than a household needs) |
| Ollama advisor | Works on the computer running Ollama | Works on the computer running Ollama (see [advisor notes](#ollama-financial-advisor-optional)) |

You can start with Option 1 and move to Option 2 later. Export a backup and restore it in the hosted version.

---

## Option 1: Use it locally (no account needed)

### Requirements
- A modern browser (Chrome, Edge, Firefox or Safari).
- **Python 3**, to run a tiny local web server. It's already on macOS and most Linux systems; on Windows, install it from [python.org](https://www.python.org/downloads/) or the Microsoft Store.
- An internet connection the first time you open the app (charts and spreadsheet import load from a CDN). After that, it works offline from the browser cache.

### 1. Get the code

```bash
git clone https://github.com/joshua-licona02/Budget-Web-App.git
cd Budget-Web-App
```

Or on GitHub click **Code → Download ZIP** and unzip it.

### 2. Start it

**Windows:** double-click `start-budget-app.cmd`.

**macOS / Linux:**

```bash
sh start-budget-app.sh
```

Either way, it opens **http://localhost:8080** in your browser. Keep the window it opens running while you use the app, and close it (or press Ctrl+C) to stop.

**Any system, manually:**

```bash
python -m http.server 8080 --bind 127.0.0.1
```

Then open http://localhost:8080.

That's it. With no `js/cloud-config.js` file, the app runs in **local mode**: no sign-in, and the sidebar says *"Stored in this browser"*.

### Why not just double-click `index.html`?
You can, and most of the app works. But:
- The **Ollama advisor won't work**, because Ollama blocks pages opened as files.
- Browsers keep **separate data for each address**, so data entered in the double-clicked file won't appear at `http://localhost:8080`, and vice versa. Pick one way to open the app and stick with it, or move data between them with **Settings → export and restore a backup**.

---

## Option 2: Host it on Firebase with shared sync

This puts the app at a web address like `https://your-project.web.app`. The people you allow sign in with Google and all see the same budget, updated live.

**How the data is stored:**
- Everything goes in **your own** Firebase project.
- Budgets, categories, debts and settings are saved together as one record, and each transaction is saved as its own record, so two people can add transactions at the same time without overwriting each other.
- Some settings stay on each device: which month and dashboard tab you're viewing, and the advisor address.

**Who can get in:** a security rule lets only the Google accounts you list read or change the data.

### Requirements
- A Google account.
- [Node.js](https://nodejs.org) (LTS), used once to install the Firebase command-line tool.

### Step 1: Create the Firebase project
1. Go to the [Firebase console](https://console.firebase.google.com) and click **Create a project**. You can turn off Google Analytics.
2. **Build → Authentication → Get started → Sign-in method → Google** → turn on **Enable**, choose a support email, and click **Save**.
3. **Build → Firestore Database → Create database** → pick a location near you → choose **production mode**.
4. **Project settings (gear icon) → General → Your apps** → click the **</>** (Web) icon → give it a nickname → check **Also set up Firebase Hosting** → **Register app**. Keep the `firebaseConfig` values it shows, which you need in step 3. You can skip the remaining screens.

### Step 2: Allow sign-in on your site's address
The app signs in through its own web address, because Safari and iPhone home-screen apps block the default method. Google needs to know that address:

1. Open the [Google Cloud credentials page](https://console.cloud.google.com/apis/credentials) and select your Firebase project at the top.
2. Under **OAuth 2.0 Client IDs**, open **Web client (auto created by Google Service)**.
3. Under **Authorized JavaScript origins**, add `https://YOUR_PROJECT_ID.web.app`.
4. Under **Authorized redirect URIs**, add `https://YOUR_PROJECT_ID.web.app/__/auth/handler`.
5. **Save.** It can take from a few minutes to a few hours to start working.

If you skip this step, sign-in fails with **Error 400: redirect_uri_mismatch**.

### Step 3: Configure the app
Copy the three example files and fill them in. The real files are ignored by git, so your setup stays out of the repository.

**`js/cloud-config.js`:** copy `js/cloud-config.example.js` and paste in your `firebaseConfig` values:

```js
export default {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

These values are meant to be public: they identify your project, and access is controlled by the rules below, not by keeping them secret.

**`firestore.rules`:** copy `firestore.rules.example` and list the Google accounts allowed in, in lowercase:

```
&& request.auth.token.email.lower() in [
  'you@gmail.com',
  'partner@gmail.com'
];
```

**`.firebaserc`:** copy `.firebaserc.example` and put your project ID in it:

```json
{ "projects": { "default": "your-project" } }
```

### Step 4: Install the Firebase CLI and deploy

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase deploy
```

`firebase login` opens your browser. Sign in with the Google account that owns the project. `firebase deploy` publishes the site **and** the security rules, and ends by printing your address, `https://YOUR_PROJECT_ID.web.app`.

### Step 5: Sign in and bring your data
1. **Sign in first on the device that has your existing data**, if you have any:
   - **If you used Option 1 at `http://localhost:8080`:** start it as usual and sign in there (`localhost` is allowed to sign in by default). If the cloud is empty, your data uploads automatically.
   - **If your data is in a double-clicked `index.html`:** use **Settings → export a backup**, then open the hosted site, sign in, and **restore the backup**.
2. Everyone else opens the site and signs in with an allowed account.
3. **Add it to your home screen:**
   - iPhone Safari: **Share → Add to Home Screen**.
   - Android Chrome: **menu → Add to Home screen** or **Install app**.

When a device that already has its own data signs in to a budget that exists in the cloud, the app asks which one to keep. It never silently overwrites either.

### Managing the hosted app
- **Add or remove a person:** edit the email list in `firestore.rules`, then run:

  ```bash
  firebase deploy --only firestore:rules
  ```

- **Publish app changes:**

  ```bash
  firebase deploy --only hosting
  ```

  Open apps pick up the new version the next time they're reloaded. On a phone home-screen app, close it fully and reopen it.
- **See the stored data:** Firebase console → **Firestore Database → households → main**.
- **Sign out** (sidebar, under your email) removes that device's copy of the budget, which is handy on a borrowed computer. The data stays in the cloud.
- **Settings → Reset** deletes the shared budget **for everyone**. You have to type `RESET` to confirm.

### Free-plan limits
Firebase's free Spark plan includes 1 GiB of Firestore storage, 50,000 document reads and 20,000 writes per day, and 10 GB of hosting storage, with no credit card required. A household budget uses a tiny fraction of that. See [Firebase pricing](https://firebase.google.com/pricing) for current numbers.

---

## Using the app

**Getting started**
1. **Settings:** review the categories. Mark savings funds and debt categories, and add any categories of your own. Categories with no transactions can be deleted; others can be archived.
2. **Monthly Plan:** enter your expected monthly income, then give each category a target until *Left to assign* reaches $0. Spending targets are limits; savings and debt targets are what you plan to put in.
3. **Transactions:** add transactions, or import a CSV/XLSX. To link a payment to a specific debt, add a **debt allocation** to it; the payoff estimates rely on this.
4. **Savings & Goals** and **Debts:** set fund goals and add debt accounts. Update each debt's *confirmed balance* now and then so the estimates stay accurate.

**The reporting month** at the top of the page controls which month every page shows.

**Dashboard tips**
- Many visuals have their own controls: **Currency/Percent**, **Total/By Category**, and a category filter. **Save Default** keeps your choice.
- **Customize dashboard** lets you drag to reorder, resize, hide or delete visuals, move them to other tabs, add recommended visuals to a built-in tab, and rename, add, reorder or delete tabs.
- **+ Add visual** opens the editor: pick a chart type, what to show, the timeline and the tab.

**How "spending left" is calculated.** The budget gauge shows the **lower** of:
- your spending budgets minus what you've spent, and
- your actual cash left this month: income (plus expected income that hasn't arrived yet) minus spending, savings and debt payments.

When cash is the lower number, a note explains why, for example *"you saved $90 more than planned"*. Net cash flow counts only actual transactions, so it never changes when you edit the plan.

**Keyboard shortcuts on the Monthly Plan:** **Enter** saves a target and moves to the next row. **Tab** moves between fields without losing your place.

---

## Ollama financial advisor (optional)

The **Ollama Advisor** page chats with an AI model running on your own computer. It sends the model a summary the app computes (monthly totals, budget vs. actual, savings funds, debts and salary estimates), so the model interprets numbers instead of calculating them. **"Show the data sent to the model"** on that page shows exactly what's included.

### Setup
1. Install [Ollama](https://ollama.com/download) and download a model, for example:

   ```bash
   ollama pull qwen3:8b
   ```

2. Run the app from `http://localhost:8080` (Option 1). Ollama rejects pages opened as files.
3. Open **Ollama Advisor**, pick a model, and ask a question. **Settings → Ollama Connection** has the endpoint (default `http://localhost:11434`), the timeout, and the context window.

### Choosing a model
Pick a model that fits in your graphics card's memory (VRAM). Models that spill over onto the CPU are many times slower. As a rough guide:

| VRAM | Try |
|---|---|
| 6–8 GB | `qwen3:8b`, `llama3.1:8b` |
| 12–16 GB | `qwen3:14b` |
| 24 GB+ | Larger models |

**"Let the model reason first"** gives better answers to math-heavy questions, but is much slower.

### Using the advisor with the Firebase-hosted app
The advisor needs the computer running Ollama, so from another device it only works if that device can reach your computer. A hosted `https` page also can't call a plain `http://localhost` address, and Ollama must be told to accept requests from your site's address. The simplest setup is to use the advisor from `http://localhost:8080` on the computer running Ollama. Signed in there, you'll see the same synced budget.

To use it from phones, [Tailscale](https://tailscale.com) (free for personal use) can give your computer a private `https` address. Then:
- Set the Windows environment variable `OLLAMA_ORIGINS` to your site's address, and restart Ollama.
- On each device, point **Settings → Ollama endpoint** at the Tailscale address.

---

## Your data: where it lives and how to back it up

- **Local mode:** everything is in your browser's storage for that address on that device. Clearing site data deletes it.
- **Firebase mode:** the shared copy is in your Firestore database, and each signed-in device keeps a local copy that works offline.
- **Backups:** **Settings → export a backup** downloads a JSON file with everything, and restoring it replaces the current data. Export one regularly, and especially before big changes.
- **Portability:** Settings also has CSV exports of transactions and other data.
- **Privacy:** this project has no analytics and no tracking. In local mode, nothing leaves your device except requests for the chart and spreadsheet libraries. In Firebase mode, data goes only to your own Firebase project. The advisor talks only to the Ollama endpoint you configure.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **Error 400: redirect_uri_mismatch** when signing in | Do [Step 2](#step-2-allow-sign-in-on-your-sites-address), then wait a few minutes and try again. |
| "*…doesn't have access to this budget*" | That Google account isn't in `firestore.rules`. Add it and run `firebase deploy --only firestore:rules`. |
| Sidebar shows **Sync problem** | Check your connection. If it persists, sign out and back in, and check that the rules were deployed. |
| Data I entered isn't on another device | In **local mode**, data never leaves the browser. Use Firebase mode, or move a backup. Also make sure you're opening the same address each time. |
| A phone shows an old version after an update | Fully close the home-screen app or tab and reopen it. |
| Advisor says it **can't reach Ollama** | Make sure Ollama is running and the app is served from `http://localhost:8080`, not a double-clicked file. **Settings → Test Connection** checks the endpoint. |
| Advisor **times out** | The model is probably too big for your GPU. Try a smaller one, or raise the timeout in Settings. |
| Port 8080 is already in use | Run `python -m http.server 8090 --bind 127.0.0.1` and open http://localhost:8090. It's a different address, so it has separate local data. |

---

## Project structure

```
index.html                  App shell: navigation, page containers, script loading
styles.css                  All styles (dark theme, phone layouts)
manifest.webmanifest        Home-screen app settings; icons/ holds the app icons
start-budget-app.cmd / .sh  Local launchers (Windows / macOS & Linux)

js/00-core.js               App namespace, default state, localStorage
js/01-dom.js … 10-ui-*.js   DOM helpers, utilities, import/cleaning, model, analytics
js/07-charts.js             Chart theme, palettes and chart types (gauge, sankey, waterfall, …)
js/11-…17-page-*.js         Pages: Transactions, Monthly Plan, Savings, Debts, Accounts (+ paycheck estimate), Settings
js/18-page-visuals.js       Dashboard visual catalog, tabs, recommended layouts, editor
js/19-page-advisor.js       Ollama advisor chat
js/99-controller.js         Dashboard rendering, visual renderers, startup
js/cloud-sync.js            Optional Firebase sign-in and sync (only runs with cloud-config.js)

js/cloud-config.example.js  Template for js/cloud-config.js (git-ignored)
firestore.rules.example     Template for firestore.rules (git-ignored)
.firebaserc.example         Template for .firebaserc (git-ignored)
firebase.json               Firebase Hosting + Firestore rules deployment settings
```

---

## For developers

- **No build step.** Edit the files and reload. Scripts load in numeric order and share a single `window.APP` namespace. `js/cloud-sync.js` is an ES module that starts after the app fires `app:ready`.
- **Libraries** (from CDNs): [Chart.js](https://www.chartjs.org/) for charts, [SheetJS](https://sheetjs.com/) for XLSX import, and the Firebase JS SDK (cloud mode only). The app keeps working if a CDN is blocked; the affected feature just isn't available.
- **State** lives in `APP.state` and is saved through `APP.store.save()`. `APP.controller.commit()` saves and re-renders. `APP.controller.normalizeState()` migrates older data and is safe to run repeatedly. Cloud sync calls it after loading data another device saved.
- **Chart colors** come from a fixed categorical palette and a set of money-flow colors (spending, savings, debt, income, leftover) in `js/07-charts.js`. They were checked for colorblind separation and contrast against the dark background.
- **Firestore layout:** `households/main/state/core` holds one JSON document (settings, categories, budgets, debts, salary), and `households/main/transactions/{id}` holds one document per transaction.
- **Deploy excludes** local-only files (`.git`, `.claude`, launchers, examples, `Shipped Apps/`). See `firebase.json`.
