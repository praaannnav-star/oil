# 🛢️ Oil India Limited — Field to Schedule Bridge (SIH26122)

> **Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management**
> 
> A Smart India Hackathon (SIH 2026) Solution tailored for Oil India Limited.

---

## 📖 The Story (What is this and why does it exist?)

Building massive infrastructure (like an Oil Rig or a Pipeline) is incredibly complex. There is a massive communication gap between the **AC Office** and the **Muddy Field**:
* **The Planners (in the office):** Manage a master calendar (a "Schedule") with 10,000 tiny micro-tasks.
* **The Field Workers (in the mud):** Are doing the actual work, but they are in remote locations with **zero internet** and no time to fill out complex software forms.

**The Result:** A worker finishes a concrete foundation, but the office doesn't find out until two weeks later. The master calendar gets delayed, money is lost, and executives panic.

**Our Solution:** We built a "Bridge". It is an offline-capable mobile web app. A field worker pulls out their phone (even with no internet), taps a button, and speaks: *"Finished pouring concrete for Foundation B"*. When they drive back to town and get Wi-Fi, the app secretly sends this voice note to the cloud. An AI reads it, matches it to the exact task on the master calendar, and alerts the Planner to approve it. 

---

## ✨ The Magic Tricks (Core Features)

1. 📵 **100% Offline-First (PWA):** The app downloads itself to the phone. If a worker submits a report deep in the jungle, the app saves it in a hidden filing cabinet inside the browser (**IndexedDB**). 
2. 🔄 **Background Sync:** The literal second the phone detects a 4G/Wi-Fi signal, the app wakes up, grabs the offline reports, and flushes them to the server automatically.
3. 🧠 **AI Matcher (NLP):** The app reads the raw voice text, extracts the keywords (e.g., *Civil, 240 m³, Foundation B*), and scores it against the master calendar to suggest exactly which task was completed.
4. 🔒 **Immutable Audit Trail:** Every approval is logged in a digital receipt book. If a project is delayed, executives can see exactly *who* approved *what* and *when*.

---

## 👥 A Shapeshifting App (The 5 Personas)

Because this is used by an entire enterprise, the app uses **Role-Based Access Control (RBAC)** to completely change its interface depending on who logs in:

1. 👷 **The Field Supervisor (The Worker):** Sees a simple, high-contrast screen. They tap "Report Progress", speak into the phone, snap a photo, and hit submit. No complex charts.
2. 📅 **The Lead Planner (The Mastermind):** Sees a dual-screen workstation. They act as the Gatekeeper. They review the AI's suggested match, look at the worker's photo, and click "Approve" to officially update the Master Calendar.
3. 🔎 **The QA/QC Reviewer (The Inspector):** Looks at the Evidence Gallery. Before a task is marked complete, they verify the safety and quality of the photos/documents.
4. 👔 **The Executive / GM (The Big Boss):** Sees the Command Center dashboard. No data-entry buttons—just high-level health indicators, budgets, and alerts answering: *"Are we delayed, and how much is it costing us?"*
5. 💻 **The System Admin (The IT Support):** Manages user accounts and has a special "Reset Demo Data" button to wipe the database for presentations.

---

## 🏗️ Under the Hood (Architecture)

We intentionally used **0% heavy frontend frameworks** (No React, Vue, or Webpack) to ensure ultra-fast load times on low-end rugged devices.

* **Frontend / UI:** 100% Vanilla HTML5, CSS3, and ES6 JavaScript Modules.
* **Offline Engine:** Service Workers + IndexedDB.
* **Physics Engine:** Custom 60fps HTML5 Canvas fluid simulation for the landing page.
* **Backend / Cloud:** Cloudflare Workers (Edge Serverless API) + Cloudflare D1 (Edge SQLite Database).

---

## 🗺️ Beginner's Code Map (Where is everything?)

* `index.html` — The empty container (The App Shell).
* `js/views/` — The different screens (Dashboard, Capture Form, etc.).
* `js/router.js` — The waiter that swaps the screens in and out without refreshing the page.
* `js/services/` — The brain. Where the data logic, AI matching, and offline interceptors live.
* `js/components/` — Reusable UI pieces (Buttons, Tables, Cards).
* `worker/` — The Cloudflare backend API code and database schemas.

---

## 🚀 Quick Start (How to run it)

Because Progressive Web Apps and ES Modules require a secure origin, you cannot just double-click the HTML file. You must run a local server:

### Option 1: One-Click Windows Launcher
Double-click `deploy-windows.bat` in the project folder. It will start the server and open the app as a native Windows desktop application.

### Option 2: Python (Recommended)
Open your terminal in the project folder and run:
```bash
python -m http.server 8000
```
Then open your browser and go to: **http://localhost:8000/#/login**

*(Tip: Click the "1-Click Persona Login" cards on the landing page to instantly test the different role-based views!)*
