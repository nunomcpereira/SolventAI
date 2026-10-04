# Solvent AI — Master Engineering Prompt

You are the lead software architect, senior full-stack engineer, financial-domain engineer, and QA engineer responsible for building **Solvent AI**.

You are not being asked to create a mockup, prototype, or superficial dashboard.

You are building a **production-quality, local-first personal liquidity and debt simulation application** in which financial calculations must be deterministic, auditable, reproducible, and mathematically correct.

The application's purpose is to let a user model their complete financial liquidity across:

* multiple bank accounts
* multiple currencies
* mortgages
* auto loans
* personal/consumer credits
* recurring income
* recurring expenses
* variable interest rates
* rate shocks
* account transfers
* income changes
* expense changes
* one-time financial events
* debt prepayments
* alternative payoff strategies
* emergency liquidity requirements
* long-term cash-flow scenarios

The application must work **offline/local-first by default**. Financial data must never need to leave the user's machine.

---

# 1. PRIMARY OBJECTIVE

Build an application that answers questions such as:

* How much liquid cash will I have in 6, 12, 24, 60 months?
* Which account will run out of money first?
* What happens if my income falls by 25%?
* What happens if Euribor increases by 2 percentage points?
* How much interest can I save by making a €10,000 prepayment?
* Should I reduce the monthly payment or shorten the loan term?
* Which debt should I prepay first?
* How much emergency liquidity will remain after a prepayment?
* When does my debt-service burden become dangerous?
* How does moving money between accounts affect my liquidity?
* What happens if a major one-time expense occurs?
* Which strategy maximizes interest savings without violating my minimum liquidity reserve?

The application must provide answers through a **deterministic financial simulation engine**, not through AI-generated reasoning.

AI is an extraction/assistance layer only.

---

# 2. NON-NEGOTIABLE ENGINEERING PRINCIPLES

These rules override convenience.

## 2.1 Financial engine is the single source of truth

There must be exactly one authoritative implementation of financial calculations.

React components, charts, API routes, AI components, database adapters, and UI utilities must NEVER independently calculate:

* interest
* principal
* amortization
* remaining balance
* loan term
* prepayment savings
* DTI / effort rate
* account balances
* liquidity runway
* penalties

They consume results produced by the financial engine.

---

## 2.2 AI must never determine financial truth

The local LLM may:

* extract information from contracts
* identify candidate values
* classify loan types
* identify clauses
* identify possible rate structures
* flag ambiguous contract language

The LLM must NOT be trusted to calculate:

* amortization
* interest
* remaining principal
* prepayment savings
* penalties
* payment schedules
* DTI
* liquidity
* optimal financial decisions

All extracted values must pass through deterministic validation before entering the financial engine.

---

## 2.3 No floating-point money calculations

Never use IEEE-754 JavaScript `number` arithmetic for authoritative monetary calculations.

Use an exact representation such as:

* integer minor units, or
* an exact decimal implementation.

The chosen representation must be documented and consistently used.

Example:

```text
€10.23 → 1023 minor units
```

Interest rates, percentages, and day-count calculations must likewise avoid accidental floating-point drift.

All financial rounding rules must be explicit and centralized.

---

## 2.4 Deterministic simulations

Given:

```text
same initial state
+
same assumptions
+
same events
+
same rates
```

the engine must always produce exactly the same result.

No randomness.

No LLM decisions.

No current-time dependencies hidden inside calculations.

No external API calls during simulation.

---

## 2.5 Never silently invent financial data

If a required contract parameter is missing or ambiguous:

1. mark it as missing/ambiguous;
2. explain what is missing;
3. request manual verification;
4. do not silently guess.

The application must distinguish:

```text
extracted
verified
inferred
missing
ambiguous
user-overridden
```

---

## 2.6 Tests are part of the implementation

Do not postpone testing until the end.

Every financial feature must have deterministic unit tests before being considered complete.

Do not weaken or delete tests to make implementation pass.

---

# 3. TARGET ARCHITECTURE

Use a **TypeScript-first architecture**.

Do not make Python vs TypeScript an arbitrary choice.

## Recommended stack

### Application

* Next.js
* React
* TypeScript
* App Router
* Tailwind CSS
* shadcn/ui
* Recharts

### Financial engine

Pure TypeScript.

The engine must have no dependency on:

* React
* Next.js
* browser APIs
* IndexedDB
* SQLite
* HTTP
* LLMs

It must be usable independently from the UI.

### Persistence

Use a local database abstraction with SQLite as the preferred implementation.

The persistence layer must be replaceable without changing the financial engine.

### Local AI

OpenAI-compatible local endpoint:

```text
http://localhost:8050/v1
```

Support local engines such as:

* Ollama
* llama.cpp
* other OpenAI-compatible local servers

No cloud LLM fallback unless explicitly enabled by the user.

### Design
IMPORTANT: Use screenshots inside stitch_solvent_ai_financial_simulator.zip to build the UI look and feel

### Testing

* Vitest or Jest for engine/unit tests
* Playwright for E2E
* contract fixtures for AI extraction
* deterministic snapshot/golden tests for financial schedules

---

# 4. DOMAIN ARCHITECTURE

Model the application around explicit domain entities.

At minimum:

```text
UserProfile
Account
Loan
LoanRate
LoanFee
Income
Expense
Simulation
SimulationEvent
ExchangeRate
Scenario
ContractDocument
ContractExtraction
FinancialSnapshot
AmortizationEntry
```

Do not collapse everything into generic "transactions".

The domain model must preserve semantic meaning.

---

# 5. ACCOUNT MODEL

An account must contain at least:

```text
id
name
type
currency
initialBalance
minimumReserve
active
```

Supported account types should include:

* checking
* savings
* emergency
* investment
* other

Each account maintains its own balance independently.

The engine must support:

* initial balances
* deposits
* withdrawals
* recurring transfers
* one-time transfers
* balance overrides
* account closures
* account-specific minimum reserves

---

# 6. MULTI-CURRENCY MODEL

Do NOT simply sum balances with different currencies.

Every simulation must define a:

```text
baseCurrency
```

Example:

```text
EUR
```

Balances in other currencies must be converted using explicit exchange-rate inputs.

For v1:

* exchange rates are local/user-provided data;
* no online FX dependency;
* each rate must have an effective date;
* simulations must use the rate applicable to the simulation date;
* missing FX data must produce an explicit error/warning rather than an invented value.

Currency conversion must be deterministic.

---

# 7. LOAN MODEL

Loans must support:

### Loan categories

* mortgage
* auto
* personal
* consumer
* student
* other

### Core properties

```text
principal
startDate
maturityDate
term
currency
paymentFrequency
amortizationType
rateType
nominalRate
```

### Amortization types

At minimum:

1. French / constant payment
2. Constant amortization
3. Interest-only

### Rate types

At minimum:

```text
fixed
variable
```

Variable rates must support:

```text
index
spread
resetFrequency
rateCap
rateFloor
```

Examples:

```text
Euribor 6M + 1.00%
SOFR + 2.00%
Prime + 0.50%
```

Do not hard-code Euribor-specific logic into generic loan calculations.

Create a generic rate model.

---

# 8. INTEREST CALCULATION

Support:

* Actual/360
* Actual/365
* 30/360

The engine must explicitly model:

```text
accrualStartDate
accrualEndDate
dayCountConvention
annualRate
```

Do not approximate day-count calculations using "months × 30".

Every day-count implementation must have independent tests.

---

# 9. PAYMENT AND ROUNDING RULES

Define a centralized financial rounding policy.

At minimum:

* monetary values rounded to currency minor units where appropriate;
* intermediate calculations retain sufficient precision;
* final payment may be adjusted to eliminate residual balance;
* rounding behavior is deterministic.

Do not scatter `round()` calls throughout the code.

---

# 10. AMORTIZATION ENGINE

The engine must produce an explicit amortization schedule.

Each entry should contain at minimum:

```text
period
date
openingPrincipal
scheduledPayment
interest
principal
fees
totalCashOutflow
closingPrincipal
rate
```

For each loan, the engine must be able to answer:

* current balance
* total interest paid
* remaining term
* next payment
* total remaining payments
* effective payoff date
* interest saved under an alternative strategy

The engine must reconcile:

```text
opening principal
- principal repayment
= closing principal
```

for every period.

---

# 11. PREPAYMENT ENGINE

Prepayments are first-class simulation events.

A prepayment must specify:

```text
loanId
sourceAccountId
date
amount
strategy
```

Strategies:

```text
reduce_payment
shorten_term
```

The engine must calculate:

* prepayment amount
* applicable penalty
* account cash reduction
* new principal
* new payment or term
* new amortization schedule
* interest saved
* liquidity impact

The prepayment must never create money.

The account balance must reflect:

```text
prepayment + applicable fee
```

as an actual cash outflow.

---

# 12. PREPAYMENT PENALTIES

Penalty rules must be modeled as data.

Do not hard-code:

```text
0.5%
0.25%
```

into business logic.

A loan may contain:

```text
penaltyType
penaltyRate
maximumPenalty
fixedAmount
conditions
effectiveDate
```

The engine must calculate the applicable penalty from the loan's configured rules.

Contract extraction may suggest these values, but user verification is required before they become authoritative.

---

# 13. INCOME AND EXPENSE MODEL

Income and expenses must support:

```text
amount
currency
frequency
startDate
endDate
accountId
category
inflationRule
```

Income categories may include:

* salary
* bonus
* pension
* freelance
* investment
* other

Expense categories may include:

* housing
* utilities
* food
* transport
* insurance
* healthcare
* subscriptions
* discretionary
* other

---

# 14. INFLATION

Recurring expenses may optionally use an inflation rate.

The engine must model:

```text
Expense(t) = Expense(0) × (1 + inflationRate)^periods
```

But the actual implementation must respect the expense frequency.

Do not blindly apply annual inflation every month.

Define precisely whether inflation is:

* annualized
* monthly compounded
* applied on anniversary dates

and test it.

---

# 15. CASH-FLOW ENGINE

For every simulation period calculate:

```text
Opening Cash
+ Income
+ Transfers In
- Living Expenses
- Debt Payments
- Fees
- Prepayments
- Transfers Out
= Closing Cash
```

Transfers must be represented separately from external cash flow.

A transfer between two user accounts:

```text
does not change total liquidity
```

but changes account-level liquidity.

This invariant must be tested.

---

# 16. LIQUIDITY METRICS

At minimum provide:

### Total liquidity

Total cash across all accounts converted to base currency.

### Account liquidity

Balance of each individual account.

### Available liquidity

Liquidity above configured minimum reserves.

### Liquidity runway

Number of periods before available liquidity becomes negative.

### Minimum liquidity

Lowest projected available liquidity during the simulation.

### Liquidity breach

A boolean/event indicating that an account or global reserve falls below its configured minimum.

---

# 17. EFFORT RATE / DTI

Define the metric explicitly.

Base formula:

```text
Effort Rate =
Total Monthly Debt Obligations
/
Net Monthly Income
× 100
```

Support configurable thresholds.

Default:

```text
< 30%   = healthy
30–45%  = warning
> 45%   = critical
```

Do not embed the color thresholds inside the financial engine.

The engine returns the numeric metric.

The UI determines presentation.

---

# 18. INTEREST DRAG

Define this metric mathematically before implementation.

The implementation must document:

* numerator
* denominator
* time horizon
* treatment of fees
* treatment of principal
* treatment of prepayments

The formula must be implemented once in the engine and covered by golden tests.

Do not invent an alternative interpretation without documenting it.

---

# 19. PREPAYMENT OPTIMIZATION

Create a deterministic optimization module.

Given:

```text
available liquidity
minimum reserve
loan portfolio
loan rates
prepayment penalties
simulation horizon
```

the engine should be able to rank potential prepayments.

The optimization objective must be explicit.

Default objective:

```text
maximize interest saved
subject to:
    account liquidity >= minimum reserve
    account balances >= 0
    all mandatory obligations remain payable
```

Do not call something "optimal" unless the objective and constraints are explicit.

---

# 20. SCENARIO ENGINE

A scenario is:

```text
Base financial state
+
ordered events
+
assumptions
```

The base scenario must remain immutable.

Scenarios should be independently reproducible.

Support events including:

```text
IncomeChange
ExpenseChange
RateChange
AccountTransfer
BalanceOverride
Prepayment
OneTimeExpense
OneTimeIncome
```

Every event must have:

```text
id
date
type
payload
```

Events occurring on the same date must have deterministic ordering.

The engine must document that ordering.

---

# 21. TIMELINE

The UI should expose a horizontal timeline for scenario events.

Users should be able to:

* add events
* move events
* edit events
* delete events
* duplicate events
* compare scenarios
* reset to base scenario

Changing one event must recompute the affected simulation deterministically.

Do not mutate historical simulation results.

---

# 22. RATE SHOCKS

Support scenario-specific rate changes.

For variable-rate loans, a rate event should be able to modify:

```text
index value
spread
cap/floor
```

Example:

```text
Euribor 6M:
+0.50%
+1.00%
+2.00%
```

The scenario engine must recompute downstream payments and balances.

The base loan definition must remain unchanged.

---

# 23. CONTRACT PDF IMPORT

Users can upload one or multiple contracts.

Supported documents include:

* mortgage contracts
* auto loans
* personal loans
* consumer credits
* student loans

Pipeline:

```text
PDF
 ↓
text extraction
 ↓
text quality assessment
 ↓
OCR fallback if necessary
 ↓
local LLM extraction
 ↓
JSON schema validation
 ↓
domain validation
 ↓
human verification
 ↓
Loan entity
```

The AI extractor must return structured data only.

---

# 24. CONTRACT EXTRACTION SCHEMA

The extraction schema should support at least:

```text
loanType
principal
currency
term
startDate
maturityDate
rateType
fixedRate
index
spread
resetFrequency
amortizationType
paymentFrequency
dayCountConvention
fees
insurance
prepaymentRules
```

Each extracted field should preserve:

```text
value
confidence
sourceReference
```

where possible.

The system must make it possible for the user to inspect and correct extracted values.

---

# 25. OCR

Detect likely scanned PDFs.

If extracted text is insufficient:

```text
PDF
→ OCR
→ extraction
```

OCR must also remain local.

If extraction remains incomplete, show a manual verification interface.

Never fabricate missing values.

---

# 26. DATABASE / PERSISTENCE

All financial data must persist locally.

The persistence layer must support:

* accounts
* loans
* income
* expenses
* scenarios
* events
* contracts
* extracted data
* exchange rates
* application settings

The financial engine must not know that a database exists.

Use repositories/adapters to isolate persistence.

---

# 27. PRIVACY

Default behavior:

* no telemetry
* no analytics
* no tracking
* no cloud financial APIs
* no cloud LLM
* no external financial-data dependency
* no financial data leaving the machine

The application must clearly indicate when an external network dependency is introduced, if ever.

Local LLM communication must be configurable and auditable.

---

# 28. INTERNATIONALIZATION

Support:

```text
en
pt
es
de
fr
```

Use locale-aware:

* dates
* numbers
* currency
* percentages

All user-facing text must come from translation dictionaries.

No hard-coded UI strings.

Missing translation keys must be detectable through automated tests.

The URL structure should support:

```text
/[lang]/dashboard
/[lang]/upload
/[lang]/simulation
/[lang]/settings
```

---

# 29. UI / UX

The interface should be modern, restrained, and information-dense without becoming visually noisy.

Primary areas:

## Dashboard

Show:

* total liquidity
* available liquidity
* monthly debt obligations
* effort rate
* projected minimum liquidity
* debt outstanding
* interest projection
* account balances
* warnings

## Accounts

Show:

* account balances
* currency
* minimum reserve
* projected balance
* liquidity breaches
* transfers

## Loans

Show:

* principal
* rate
* monthly payment
* remaining term
* interest
* fees
* amortization

## Upload

Show:

* uploaded documents
* extraction status
* extracted values
* confidence
* missing fields
* verification UI

## Simulation

Show:

* timeline
* scenario events
* liquidity projection
* account-level balances
* debt balances
* effort rate
* interest
* comparison against base scenario

## Settings

Show:

* language
* base currency
* rounding policy
* day-count defaults
* local LLM endpoint
* privacy/network settings

---

# 30. RESPONSIVE DESIGN

Desktop is the primary experience.

Mobile must remain usable.

Dense financial tables should become:

```text
desktop → table/matrix
mobile → stacked cards/details
```

Do not simply shrink desktop tables until they become unusable.

---

# 31. CHARTS

Use Recharts for:

* total liquidity over time
* account balances over time
* debt balances
* cumulative interest
* effort rate
* scenario comparison

Charts must consume engine-generated data.

Do not calculate financial values inside chart components.

---

# 32. PROJECT STRUCTURE

Use a structure similar to:

```text
solvent-ai/
├── src/
│   ├── app/
│   │   └── [lang]/
│   │       ├── dashboard/
│   │       ├── accounts/
│   │       ├── loans/
│   │       ├── upload/
│   │       ├── simulation/
│   │       └── settings/
│   │
│   ├── engine/
│   │   ├── money/
│   │   ├── dates/
│   │   ├── rates/
│   │   ├── dayCount/
│   │   ├── amortization/
│   │   ├── accounts/
│   │   ├── cashflow/
│   │   ├── prepayment/
│   │   ├── metrics/
│   │   ├── simulation/
│   │   ├── optimization/
│   │   └── tests/
│   │
│   ├── domain/
│   │   ├── accounts/
│   │   ├── loans/
│   │   ├── income/
│   │   ├── expenses/
│   │   ├── scenarios/
│   │   └── contracts/
│   │
│   ├── lib/
│   │   ├── ai/
│   │   ├── i18n/
│   │   ├── db/
│   │   └── validation/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── dashboard/
│   │   ├── accounts/
│   │   ├── loans/
│   │   ├── charts/
│   │   ├── timeline/
│   │   └── mobile/
│
├── e2e/
├── fixtures/
│   ├── contracts/
│   └── financial/
└── package.json
```

The exact structure may evolve if there is a strong architectural reason, but separation of concerns must remain.

---

# 33. ENGINE INVARIANTS

Implement automated tests for these invariants.

### Account conservation

For every account:

```text
closingBalance =
openingBalance
+ inflows
- outflows
```

### Transfer conservation

For an internal transfer:

```text
total liquidity before transfer
=
total liquidity after transfer
```

### Loan conservation

For every amortization period:

```text
openingPrincipal
- principalPaid
=
closingPrincipal
```

### Zero-debt invariant

A fully repaid loan must never produce:

```text
negative principal
```

### Prepayment invariant

A prepayment cannot increase principal.

### Liquidity invariant

The system must never silently create cash.

### Currency invariant

Balances in different currencies must never be aggregated without conversion.

### Determinism invariant

Identical inputs must produce identical outputs.

---

# 34. TEST STRATEGY

## Unit tests

Test:

* money arithmetic
* rounding
* day counts
* fixed-rate loans
* variable-rate loans
* French amortization
* constant amortization
* interest-only loans
* fees
* penalties
* prepayments
* transfers
* account aggregation
* income
* expenses
* inflation
* DTI
* liquidity runway
* scenario events
* optimization

## Golden financial tests

Create known schedules and compare every period.

Include:

* opening balance
* payment
* interest
* principal
* closing balance

These become regression tests.

## AI tests

Mock the local LLM.

Test:

* valid extraction
* malformed JSON
* missing fields
* ambiguous fields
* wrong data types
* scanned PDF fallback
* schema violations

## E2E tests

### Flow 1 — Initial setup

1. Create three accounts.
2. Create two loans.
3. Import contracts.
4. Verify extracted data.
5. Open dashboard.
6. Verify aggregated liquidity and debt obligations.

### Flow 2 — Income shock

1. Create baseline scenario.
2. Reduce income by 25% at month 12.
3. Recalculate.
4. Verify effort rate.
5. Verify account depletion.
6. Verify warning state.

### Flow 3 — Rate shock

1. Create variable-rate mortgage.
2. Increase index by 2 percentage points.
3. Verify new payment.
4. Verify interest impact.
5. Verify liquidity impact.

### Flow 4 — Prepayment

1. Select highest-interest loan.
2. Prepay €10,000 from savings.
3. Apply penalty.
4. Verify account balance.
5. Verify new principal.
6. Verify interest saved.
7. Compare reduce-payment vs shorten-term strategies.

### Flow 5 — Multi-currency

1. Create EUR and USD accounts.
2. Configure FX rate.
3. Verify base-currency aggregation.
4. Change FX rate in scenario.
5. Verify liquidity changes.

---

# 35. ACCEPTANCE CRITERIA

The project is NOT considered complete merely because the UI renders.

It is complete only when:

* the financial engine has deterministic tests;
* monetary arithmetic is exact;
* amortization schedules reconcile;
* transfers conserve total liquidity;
* multi-currency aggregation is explicit;
* scenarios are reproducible;
* prepayments correctly modify debt;
* penalties are modeled;
* variable-rate changes propagate correctly;
* AI extraction is schema validated;
* missing contract information requires verification;
* all five languages work;
* responsive layouts work;
* E2E tests pass;
* no financial calculation exists outside the financial engine;
* no cloud service is required for normal operation;
* no telemetry is enabled;
* TypeScript has no avoidable type errors;
* linting passes;
* production build passes.

---

# 36. DEVELOPMENT PROCESS

Do NOT attempt to build the entire application in one pass.

Work in gated phases.

## Phase 0 — Architecture

Before writing substantial code:

1. inspect the repository;
2. identify existing files;
3. identify available dependencies;
4. identify constraints;
5. produce a concise implementation plan;
6. identify unresolved domain decisions.

Do not invent requirements that are not specified.

If an important financial rule is ambiguous, explicitly identify it.

---

## Phase 1 — Financial engine

Implement first:

```text
Money
Dates
DayCount
Rates
Amortization
Accounts
CashFlow
Prepayments
Metrics
Simulation
```

Write tests alongside each module.

Do not build the dashboard yet.

The engine must be independently testable.

---

## Phase 2 — Domain and persistence

Implement:

* domain entities
* validation
* repositories
* local persistence
* serialization

Verify that persistence does not leak into engine code.

---

## Phase 3 — AI contract extraction

Implement:

* PDF text extraction
* OCR fallback
* local LLM client
* JSON schema
* validation
* extraction review UI

AI output must terminate at a validated domain input.

---

## Phase 4 — Application UI

Implement:

* dashboard
* accounts
* loans
* upload
* settings
* simulation

Connect UI exclusively to domain/application services.

---

## Phase 5 — Scenario system

Implement:

* event timeline
* scenario editing
* scenario comparison
* rate shocks
* income shocks
* expense shocks
* prepayments
* transfers

---

## Phase 6 — Testing

Run:

```text
unit tests
integration tests
AI tests
E2E tests
lint
typecheck
production build
```

Fix failures instead of bypassing them.

---

## Phase 7 — Final audit

Before declaring completion, inspect the entire codebase for:

* duplicated financial calculations
* floating-point money arithmetic
* hidden network calls
* hard-coded translations
* missing validation
* mutable base scenarios
* untested financial branches
* incorrect rounding
* currency aggregation errors
* silent fallback behavior

---

# 37. AGENT BEHAVIOR

When implementing this project:

1. Do not make large speculative changes.
2. Prefer small, testable increments.
3. Preserve working functionality.
4. Do not rewrite unrelated code.
5. Explain architectural trade-offs briefly when they matter.
6. Surface ambiguity instead of hiding it.
7. Never fabricate financial rules.
8. Never use an LLM response as a financial calculation.
9. Never claim a feature is complete without tests.
10. Never mark a test as passing without actually running it.
11. Never replace a failing financial test with a weaker test merely to make the suite green.
12. Prefer correctness over speed.
13. Prefer explicit domain models over generic abstractions.
14. Keep the financial engine independent from the UI.
15. Keep the application local-first.

---

# 38. DEFINITION OF DONE FOR EACH FEATURE

A feature is complete only when all of the following are true:

```text
Implementation
+
Domain validation
+
Unit tests
+
Integration tests where applicable
+
UI
+
Error states
+
i18n
+
Responsive behavior
+
Documentation where necessary
```

A feature with only UI code is not complete.

A financial feature without deterministic tests is not complete.

---

# 39. FIRST TASK

Do not immediately start implementing the dashboard.

Your first task is:

### Step 1

Inspect the repository and existing project state.

### Step 2

Identify whether the repository already contains:

* Next.js
* TypeScript
* Tailwind
* shadcn/ui
* database infrastructure
* test infrastructure
* existing components
* existing configuration

### Step 3

Produce a concise architecture assessment.

### Step 4

Identify any genuinely ambiguous financial-domain decisions that must be resolved before implementation.

### Step 5

Create the initial implementation plan.

### Step 6

Begin with the **pure financial engine**, not the UI.

The first production code should establish the foundation for:

```text
exact money
+
dates
+
day-count conventions
+
loan rates
+
amortization
+
account ledger
+
cash flow
```

Then create comprehensive tests.

Do not proceed to the UI until the financial foundation is reliable.

---

# FINAL PRINCIPLE

Solvent AI is fundamentally a **financial simulation engine with a user interface**, not a dashboard with some financial calculations attached.

Treat the financial engine as the core product.

The UI visualizes it.

The database stores it.

The AI assists with data entry.

The scenario engine transforms inputs.

Tests prove it.

No layer is allowed to bypass the deterministic financial model.
