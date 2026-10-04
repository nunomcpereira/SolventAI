# Flagged-issue triage — 2026-08-15

52 code-duplication warnings reviewed. Fixed the real ones (extracted shared helpers/hooks/components), typecheck + full test suite pass (298/298). Below: what was fixed, and why the rest are false positives / not worth fixing.

## Fixed

| # | Files | Fix |
|---|---|---|
| 6,7,17 | accounts/actions.ts, dashboard/actions.ts | `parseAccountFormCreate()` in `src/lib/forms/accountForm.ts` |
| 18,19,20,21,22 | dashboard/actions.ts ↔ loans/actions.ts | `parseLoanFormCreate()` + `buildLoanDraftFromExtraction()` in `src/lib/forms/loanForm.ts` — single source for the create-loan field mapping and the contract-extraction → draft-defaults mapping (was byte-identical in 3 places) |
| 24,25 | loans/actions.ts (createLoanAction vs createLoanFromContractAction) | same `parseLoanFormCreate()` |
| 47,48,49 | recurringItemsService.ts | `buildRecurringEntryFields()` — income/expense create/update were the same object-building code 4x in one file |
| 27,28,29 | IncomeEntryForm.tsx ↔ ExpenseEntryForm.tsx | extracted `src/components/shared/RecurringEntryForm.tsx`; both are now thin label-mapping wrappers around it |
| 33,34,35,36 | DashboardSuggestionWizards.tsx ↔ NewLoanWizard.tsx | extracted `useLoanDraftWizard()` hook (`src/components/loans/useLoanDraftWizard.tsx`) — the field state, extraction-polling effect, and defaults-apply effect were identical; left each component's own JSX/step-count alone since those genuinely differ |
| 42,44,45,46 | dashboardService.ts ↔ scenarioService.ts | new `src/lib/services/simulationBuilders.ts`: `loadSimulationInputs()`, `alignLoanScheduleToSimulation()`, `buildSimulationIncomeItems()`, `buildSimulationExpenseItems()`, `buildSimulationAccounts()`, `toLiquiditySnapshots()` |
| 38,39 | domain/loans/loan.ts | `variableIndexFieldsFromSerialized()` / `variableIndexFieldsToSerialized()` — the index/spread/cap/floor fields were written out twice per function (once for "variable", once for "mixed") |

Not touched: #43 (scenarioService's version does per-loan prepayment/rate-change handling dashboardService doesn't have — merging further risks correctness, not worth it for a 17-line match).

## False positives — acknowledge, don't fix

**#1–5 — package-lock.json (5 warnings).** Generated file; npm writes it, nothing here should hand-edit it. The "duplication" is npm mirroring the same dependency tree/platform-binary metadata across resolved packages — inherent to how lockfiles work, not a code smell.

**#10–16 — accounts/page.tsx ↔ loans/page.tsx (7 warnings).** These are two page-level components that are intentionally parallel UIs (accounts list vs loans list, same visual language). The tool is flagging structural JSX mirroring — delete buttons, label maps, wizard footer sections. Real, but low-value: collapsing two full page layouts into one shared component to save ~60 lines total would trade a bit of duplication for a much harder-to-follow indirection layer, for UI that's likely to diverge (accounts and loans already have different field sets). Left as-is; flag again if the two pages start drifting apart in a way that causes bugs, not just line-count.

**#30 — ComparisonChart.tsx ↔ LiquidityChart.tsx.** Recharts axis/grid boilerplate (`<CartesianGrid>`, `<XAxis>`, `<YAxis>`, `onMouseLeave`). This is how every Recharts composed chart is wired — the "duplication" is the charting library's own API surface, not app logic. Not worth an abstraction for two charts.

**#31–32 — DashboardSuggestionWizards.tsx select/option JSX.** A generic `<select>{options.map(...)}<option>...` block matched against itself elsewhere in the same file — this is the standard React pattern for rendering a dropdown from an options array, appearing wherever the component renders a category/type picker. Same shape everywhere by necessity, not shared logic.

**#37 — contract.ts (ContractDocument vs SerializedContractDocument).** This is the deliberate domain/wire-format split used throughout this codebase (see also Loan/SerializedLoan, Rate/SerializedRate): the domain type holds real `IsoDate` objects, the serialized type holds wire-safe strings. They're *supposed* to look almost identical — that's what makes `parseContractDocument`/`toSerialized` type-safe. Collapsing them into one type would remove the compiler's ability to catch "forgot to convert a date before persisting" bugs.

**#40 — recurringEntryForm.ts (parseRecurringEntryCreate vs parseRecurringEntryUpdate).** Only ~7 lines overlap, and the two functions read `endDate` from different sources (create derives it from `startDate` when the entry is one-off; update reads whatever's already stored). Merging would need a branch/flag parameter that's less readable than two short functions.

**#41 — accountsService.ts (createAccount vs updateAccountBalance).** create builds a brand-new account from raw form input; update fetches the existing record and merges balance/reserve/active onto it, preserving name/type/currency. Different data sources, not the same logic — the field-object shape just happens to match `parseAccount`'s schema.

**#50–52 — scenarioService.ts (addScenarioEvent usages, addOneTimeExpenseEvent/addIncomeChangeEvent).** These are already using the shared `addScenarioEvent()` helper; the "duplication" is each event-type constructor building its own 3-4 field payload literal, which is inherent to a discriminated union with different payloads per event type. Nothing left to extract.
