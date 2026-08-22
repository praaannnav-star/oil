# Oil India Limited — Windows & Cloud Deployment Guide (SIH26122)

This guide provides deployment strategies for both **Windows native desktop environments** and **Cloud production hosting**.

---

## 🪟 1. Windows Native Deployment Options

### Method A: One-Click Local Windows Launcher
1. Open the project folder `c:\Users\Pranav\Documents\oil`.
2. Double-click **`deploy-windows.bat`** (or `start-server.bat`).
3. The script automatically detects Python or Node.js, starts the HTTP server on port 8000, and opens `http://localhost:8000/#/login`.

---

### Method B: Install as a Windows Standalone App (PWA)
Because the app includes a valid `manifest.json` and `service-worker.js`, it installs natively on Windows 10 & 11:

1. Open **http://localhost:8000** in **Microsoft Edge** or **Google Chrome**.
2. Click the **"Install App"** icon in the browser address bar (or click the **"Install PWA"** button in the app header).
3. Confirm **Install**:
   - The app opens in its own borderless native Windows window without browser tabs or address bars.
   - A shortcut is placed on your **Windows Desktop** and **Start Menu**.
   - You can right-click the icon in the Windows Taskbar and select **"Pin to Taskbar"**.
   - Runs offline with full IndexedDB persistence.

---

### Method C: Enterprise Windows Package (.MSIX) via PWABuilder
To distribute the app as an official Windows `.msix` installer (for Microsoft Store or enterprise IT deployment via Microsoft Intune / SCCM):

1. Deploy the app to any HTTPS URL (e.g. Cloudflare Pages, Vercel).
2. Go to **[PWABuilder.com](https://www.pwabuilder.com/)**.
3. Enter your live app URL and click **Start**.
4. Click **Package for Windows** to generate a signed `.msix` package ready for enterprise sideloading or Microsoft Store publishing.

---

## ☁️ 2. Cloud Production Deployment

### Option 1: Cloudflare Pages (Recommended)
```bash
# Using Wrangler CLI
npx wrangler pages deploy . --project-name=oil-india-bridge
```

### Option 2: Vercel
```bash
# Using Vercel CLI
npx vercel --prod
```

### Option 3: Netlify
```bash
# Using Netlify CLI
npx netlify deploy --prod --dir=.
```

---

## 🔐 3. Authentication & Demo Personas

The system includes pre-configured operational accounts for the SIH Jury demonstration:

| Role | Username | Password | Key Permissions |
|---|---|---|---|
| **System Admin** | `admin` | `password123` | Full access to all 11 views, audit logs, and user roles |
| **Executive / GM** | `executive` | `password123` | Overview KPIs, Project Details, Analytics, Delay Memory |
| **Project Planner** | `planner` | `password123` | Schedule Explorer (L1–L6), Review Queue, Activity Details |
| **QA / Reviewer** | `reviewer` | `password123` | Review Queue drawer, Evidence verification, Audit logs |
| **Field Supervisor** | `supervisor` | `password123` | Voice Field Capture, Offline Drafts, Mobile Progress |

> **Jury Tip:** On the landing page (`#/login`), click any **"Jury 1-Click Persona Login"** button to instantly authenticate as that role without typing credentials.
