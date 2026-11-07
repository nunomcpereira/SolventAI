# Solvent AI

> **Deterministic, local-first personal liquidity simulator and debt decision engine.**

Solvent AI helps individuals and households model their complete financial reality across bank accounts, loans, recurring incomes, and recurring expenses. It projects cash flows month-by-month and lets you run rigorous what-if scenarios (interest rate shocks, income cuts, emergency expenses, early debt prepayments) while keeping all data completely private on your own machine.

---

## Key Features

- **Deterministic Financial Engine**:
  - Zero floating-point monetary arithmetic: all values use integer minor units and arbitrary-precision decimal math.
  - Authoritative calculation of amortization, interest drag, effort rate (debt-to-income / DTI), and liquidity runway.
  - Supports French (fixed annuity), constant/linear principal, and interest-only amortization schedules.
  - Standard day-count conventions (`ACT/360`, `ACT/365`, `30/360`, etc.) and configurable rounding rules.
  - Realistic prepayment calculations with statutory penalty modeling (including Portuguese Decree-Law 74-A/2017: 0.5% variable, 2.0% fixed).

- **What-If Scenario Simulation**:
  - Create named scenarios side-by-side with the base case.
  - Model rate shocks (e.g. +200 bps Euribor spike), income loss/reduction, unexpected capital expenditures, scheduled debt prepayments, and inflation adjustments.
  - Instant visual delta comparison across net monthly cash flow, liquidity runway, and total interest paid.

- **Local-First & Multi-Tenant**:
  - All data is stored in local SQLite databases on your machine—never sent to an external cloud.
  - Multi-profile support with built-in isolated demo accounts to experiment safely.
  - History replay and audit log tracking changes to accounts, loans, and recurring entries.

- **Contract PDF Import with Local AI**:
  - Ingest loan contracts (PDF) via local client-side text extraction with an OCR fallback.
  - Optional local LLM assistance (compatible with Ollama or local OpenAI-compatible endpoints) to extract candidate loan fields.
  - **Strict rule**: AI only suggests values; the user confirms and the deterministic financial engine performs all math.

- **Multi-Currency & Internationalization**:
  - Denominate accounts and loans in different currencies (`EUR`, `USD`, `GBP`, `CHF`, etc.) with user-configured exchange rates.
  - Full UI localization in 5 languages: English, Português, Español, Français, and Deutsch.

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Database**: SQLite via `better-sqlite3`
- **Validation**: [Zod](https://zod.dev/)
- **PDF & OCR**: `pdfjs-dist`, `pdf-lib`, `tesseract.js`
- **Testing**: [Vitest](https://vitest.dev/) (310+ unit & domain tests) & [Playwright](https://playwright.dev/) (end-to-end tests)
- **Documentation**: [Docusaurus 3](https://docusaurus.io/)

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/SolventAI.git
cd SolventAI

# Install dependencies
npm install
```

### Running Locally

```bash
# Start Next.js development server on port 5555
npm run dev
```

Open [http://localhost:5555](http://localhost:5555) in your browser.

### Building for Production

```bash
npm run build
npm run start
```

---

## Testing & Quality Assurance

```bash
# Type check TypeScript
npm run typecheck

# Run unit tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch

# Run end-to-end browser tests (Playwright)
npm run e2e

# Lint code
npm run lint
```

---

## Documentation Site

A full documentation site with user guides and architecture references is included under `docs-site`:

```bash
cd docs-site
npm install
npm start
```

Runs the Docusaurus documentation portal at [http://localhost:3000](http://localhost:3000).

---

## Design Principles

1. **The financial engine is the single source of truth**: React components, UI charts, and AI layers never compute financial numbers independently.
2. **AI never determines financial truth**: Extraction suggestions from contract documents require user confirmation before persisting.
3. **Local-first privacy**: Your financial life belongs on your disk. Offline by default with no required cloud services.
