# Clínica Endodiagnose — Dashboard

Internal management dashboard for **Clínica Endodiagnose**, built with **React 19 + Vite 8**.  
The system manages exams, cash flow, health insurance providers, medical payouts (physician fee splitting), and payroll, featuring resilient local storage (`localStorage`), cloud synchronization via **Firebase Cloud Firestore**, immutable audit trails, and compliance with data protection standards (**LGPD**).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Production Build](#production-build)
- [Testing and Continuous Validation](#testing-and-continuous-validation)
- [Firebase Configuration](#firebase-configuration)
  - [Environment Variables (.env)](#environment-variables-env)
  - [Firestore Security Rules](#firestore-security-rules)
- [Security and Compliance (LGPD)](#security-and-compliance-lgpd)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Prerequisites

| Tool | Minimum Recommended Version |
|------|-----------------------------|
| [Node.js](https://nodejs.org/) | **20+** (ES Modules & React 19 support) |
| npm | **10+** (bundled with Node) |

> **Tip:** Check your installed versions with:
> ```bash
> node -v
> npm -v
> ```

---

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd DashboardED
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

---

## Running the Project

Start the local development server:

```bash
npm run dev
```

Vite will serve the app locally — typically at **http://localhost:5173**.  
Any code modifications will reflect instantly via Hot Module Replacement (HMR).

---

## Production Build

To compile minified and optimized assets for production deployment:

```bash
npm run build
```

The output artifacts are generated in the `dist/` directory. To preview the production build locally:

```bash
npm run preview
```

---

## Testing and Continuous Validation

The project includes an automated test suite powered by **Vitest**, covering business rules, persistence logic, schema migrations (v1, v2, v3), helper utilities, and integration:

- **Run all tests once:**
  ```bash
  npm test
  ```
- **Interactive watch mode:**
  ```bash
  npm run test:watch
  ```
- **Full CI Validation Pipeline (Lint + Test + Build):**
  ```bash
  npm run ci
  ```

> The repository includes continuous integration automation via **GitHub Actions** (`.github/workflows/ci.yml`), ensuring every push or pull request to the main branch passes `npm run ci`.

---

## Firebase Configuration

The dashboard operates in an **offline-first** mode using `localStorage`. For cloud synchronization and secure multi-device data sharing across authorized staff, connect a Firebase project (Firestore and Authentication).

### Environment Variables (.env)

1. Create a `.env` file based on the template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials from the Firebase Console:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=my-project
   VITE_FIREBASE_STORAGE_BUCKET=my-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

### Firestore Security Rules

Security rules are defined in `firestore.rules`:
- Only authenticated users listed in the authorized allowlist have read and write permissions.
- Audit trail (`audit_logs`) is append-only: entries cannot be updated or deleted.
- Strict schema and field validation on write operations.

To deploy the rules to Firebase:
```bash
npx firebase-tools deploy --only firestore:rules
```

---

## Security and Compliance (LGPD)

- **Inactivity Screen Lock:** Automatic screen protection after an idle period, requiring a 4-digit numeric PIN to resume the session.
- **Access Control:** Restricted access through Google Authentication with an allowlist of authorized corporate email accounts.
- **Audit Logging:** Immutably records sensitive operations, data deletions, and restorations.
- **Healthcare Data Minimization:** Architectural isolation of sensitive medical and patient identifiers.
- **Accessibility (a11y):** Modal dialogues include accessible focus trapping, keyboard navigation (`Escape`, `Tab`), and semantic ARIA attributes (`aria-live`, `aria-current`).

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the Vite development server with HMR |
| `npm run build` | Compiles the production bundle into `dist/` |
| `npm run preview` | Serves the local production build preview |
| `npm run lint` | Runs code analysis using [OxLint](https://oxc.rs/) |
| `npm test` | Runs the full unit test suite with Vitest |
| `npm run test:watch` | Runs tests in interactive watch mode |
| `npm run ci` | Runs the full CI pipeline (`lint` + `test` + `build`) |

---

## Project Structure

```
DashboardED/
├── .github/
│   └── workflows/
│       └── ci.yml             # Continuous Integration pipeline (GitHub Actions)
├── public/                    # Favicon and static assets
├── src/
│   ├── assets/                # Logos and graphics
│   ├── components/            # Reusable UI components
│   │   ├── AutoCompleteInput.jsx
│   │   ├── CloudSyncModal.jsx     # Firebase sync modal and status indicators
│   │   ├── ConfirmDialog.jsx
│   │   ├── ConvenioFluxoModal.jsx # Quick transaction modals
│   │   ├── DetalhesFormModal.jsx  # Exam details editing modal
│   │   ├── ErrorBoundary.jsx
│   │   ├── ExportMenu.jsx
│   │   ├── FolhaTable.jsx         # Isolated payroll table component
│   │   ├── FolhaTotalsBar.jsx     # Payroll summary metrics and totals bar
│   │   ├── Modal.jsx              # Accessible modal with focus trap & ARIA support
│   │   ├── Sidebar.jsx            # Main navigation sidebar with aria-current
│   │   └── ToastContainer.jsx     # Toast notifications with aria-live regions
│   ├── pages/                 # Main application views/pages
│   │   ├── OverviewPage.jsx       # Key performance indicators and metrics dashboard
│   │   ├── ExamesPage.jsx         # Procedures registration and listing
│   │   ├── ConveniosPage.jsx      # Health insurance billing & claim tracking
│   │   ├── FluxoCaixaPage.jsx     # Financial management (inflow/outflow)
│   │   ├── DetalhesPage.jsx       # Clinical and financial procedure breakdown
│   │   ├── RepassePage.jsx        # Physician fee splitting and payout calculations
│   │   └── FolhaPage.jsx          # Staff payroll and compensation management
│   ├── services/
│   │   └── firebase.js            # Firebase SDK setup, Firestore and Auth integration
│   ├── styles/                # Modular CSS architecture
│   │   ├── variables.css          # Design tokens (colors, typography, spacing, shadows)
│   │   ├── layout.css             # Grid, flexbox, sidebar, tables, and responsive layout
│   │   ├── components.css         # Buttons, cards, inputs, modals, and badges
│   │   └── pages/                 # Page-specific styling modules
│   ├── utils/
│   │   ├── helpers.js             # Currency formatting, date calculations, and math helpers
│   │   ├── storage.js             # LocalStorage manager, schema migrations, and backup
│   │   └── __tests__/             # Automated unit and integration tests (Vitest)
│   ├── App.jsx                # Root orchestrator component
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles entry point importing CSS modules
├── firestore.rules            # Firestore security rules and validation logic
├── vite.config.js             # Vite and Vitest configuration
├── package.json
└── README.md
```

---

## Features

- 📊 **Overview Dashboard** — Consolidated revenue tracking, exam volume, average ticket, and trend charts.
- 🩺 **Exams** — Rapid recording and status management of medical procedures and charges.
- 🏥 **Health Insurance** — Tracking of insurance providers, claim rejections/disallowances (*glosas*), and billing status.
- 💰 **Cash Flow** — Inflow/outflow recording, transaction categories, and daily/monthly reconciliations.
- 📋 **Procedure Details** — Granular patient and clinical procedure records.
- 🔄 **Medical Fee Splitting** — Automated commission and fee-split calculations per physician and procedure (Schema v3).
- 👥 **Payroll** — Team salary management, overtime/additions, deductions, and labor costs.
- 🔒 **Inactivity PIN & LGPD** — Idle timeout with 4-digit PIN lock to prevent unauthorized physical access.
- ☁️ **Cloud Sync & Backup** — Timestamped JSON backups with local version history and optional Firestore synchronization.
- 📤 **Report Exporting** — Clean data export in structured CSV and JSON formats.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [React 19](https://react.dev/) | Modern, declarative, reactive user interface |
| [Vite 8](https://vite.dev/) | Next-generation frontend build tooling and fast dev server |
| [Vitest](https://vitest.dev/) | Native ESM test framework with unit and regression test coverage |
| [Firebase / Firestore](https://firebase.google.com/) | Cloud NoSQL database and secure Google Authentication |
| [OxLint](https://oxc.rs/) | High-performance Rust-based linter |
| [Modular Design System](src/styles/) | Pure CSS using CSS Custom Properties and responsive design |

---

## License

Proprietary software for the internal use of **Clínica Endodiagnose**. All rights reserved.
