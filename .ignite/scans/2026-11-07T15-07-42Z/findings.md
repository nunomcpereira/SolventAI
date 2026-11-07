# Ignite scan findings — 2026-11-07T15:07:42Z

Scanned against commit: b844fdbff42e16926c4af0e72323821ef2aad048

## 1. [WARNING] gha-security - credential persistence through GitHub Actions artifacts (uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1)

- ID: `gha-security::.github/workflows/docs.yml::25`
- Location: .github/workflows/docs.yml:25
- Score: 4

## 2. [WARNING] code-duplication - 253-line duplicate block, also found in .ignite/scans/2026-10-04T13-49-08Z/findings.md:5-257.

- ID: `code-duplication::.ignite/scans/2026-09-22T21-35-56Z/findings.md::5`
- Location: .ignite/scans/2026-09-22T21-35-56Z/findings.md:5
- Score: 1

## 3. [WARNING] code-duplication - 987-line duplicate block, also found in .ignite/scans/2026-10-04T13-49-33Z/findings.md:1-987.

- ID: `code-duplication::.ignite/scans/2026-10-04T13-49-08Z/findings.md::1`
- Location: .ignite/scans/2026-10-04T13-49-08Z/findings.md:1
- Score: 1

## 4. [WARNING] code-duplication - 39-line duplicate block, also found in .ignite/scans/2026-10-04T14-23-53Z/findings.md:1-39.

- ID: `code-duplication::.ignite/scans/2026-10-04T14-22-56Z/findings.md::1::a414f4aa`
- Location: .ignite/scans/2026-10-04T14-22-56Z/findings.md:1
- Score: 1

## 5. [WARNING] code-duplication - 39-line duplicate block, also found in .ignite/scans/2026-10-04T14-24-34Z/findings.md:1-39.

- ID: `code-duplication::.ignite/scans/2026-10-04T14-22-56Z/findings.md::1::0f870b27`
- Location: .ignite/scans/2026-10-04T14-22-56Z/findings.md:1
- Score: 1

## 6. [WARNING] code-duplication - 1109-line duplicate block, also found in .ignite/scans/2026-10-04T14-42-33Z/findings.md:5-1113.

- ID: `code-duplication::.ignite/scans/2026-10-04T14-26-00Z/findings.md::5::52d3fb46`
- Location: .ignite/scans/2026-10-04T14-26-00Z/findings.md:5
- Score: 1

## 7. [WARNING] code-duplication - 31-line duplicate block, also found in .ignite/scans/2026-11-07T12-01-24Z/findings.md:5-35.

- ID: `code-duplication::.ignite/scans/2026-10-04T14-26-00Z/findings.md::5::f8ba734b`
- Location: .ignite/scans/2026-10-04T14-26-00Z/findings.md:5
- Score: 1

## 8. [WARNING] code-duplication - 31-line duplicate block, also found in .ignite/scans/2026-11-07T13-59-26Z/findings.md:5-35.

- ID: `code-duplication::.ignite/scans/2026-10-04T14-26-00Z/findings.md::5::550eae89`
- Location: .ignite/scans/2026-10-04T14-26-00Z/findings.md:5
- Score: 1

## 9. [WARNING] code-duplication - 48-line duplicate block, also found in src/components/original/OriginalDashboard.tsx:45-92.

- ID: `code-duplication::src/app/[lang]/dashboard/page.tsx::109`
- Location: src/app/[lang]/dashboard/page.tsx:109
- Score: 1

## 10. [WARNING] malicious-dependency - Dependency "react-dom==19.3.1" flagged by GuardDog (npm): metadata_mismatch, capability-network-outbound, capability-process-spawn [risk suspicious, 6.3/10].

- ID: `malicious-dependency::docs-site/package.json::0`
- Location: docs-site/package.json
- Score: 5

## 11. [WARNING] malicious-dependency - Dependency "react-dom==19.3.1" flagged by GuardDog (npm): metadata_mismatch, capability-network-outbound, capability-process-spawn [risk suspicious, 6.3/10].

- ID: `malicious-dependency::package.json::0::2300ce5e`
- Location: package.json
- Score: 5

## 12. [WARNING] malicious-dependency - Dependency "recharts==3.10.1" flagged by GuardDog (npm): capability-network-outbound, capability-process-hooks, capability-process-spawn, threat-network-outbound-shady-links [risk suspicious, 6.4/10].

- ID: `malicious-dependency::package.json::0::c865b627`
- Location: package.json
- Score: 5

## 13. [WARNING] malicious-dependency - Dependency "pdfjs-dist==6.5.438" flagged by GuardDog (npm): capability-filesystem-read, capability-network-download, capability-network-outbound, capability-process-spawn, threat-runtime-obfuscation, threat-runtime-obfuscation-general [risk suspicious, 6.3/10].

- ID: `malicious-dependency::package.json::0::24cea2f5`
- Location: package.json
- Score: 5

## 14. [ERROR] malicious-dependency - Dependency "next==15.5.29" flagged by GuardDog (npm): metadata_mismatch, capability-filesystem-delete, capability-filesystem-read, capability-network-download, capability-network-outbound, capability-process-schedule, capability-process-spawn, threat-filesystem-autostart, threat-filesystem-destruction, threat-filesystem-read, threat-process-download-exec, threat-process-memory, threat-process-spawn-silent, threat-runtime-environment-read, threat-runtime-obfuscation, threat-runtime-obfuscation-base64exec, threat-runtime-obfuscation-log-suppress, threat-runtime-obfuscation-steganography [risk high_risk, 7.9/10].

- ID: `malicious-dependency::package.json::0::79f887a2`
- Location: package.json
- Score: 9
- Status: overridden

## 15. [WARNING] dead-code - docs-site/sidebars.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::docs-site/sidebars.ts::1::unused-file`
- Location: docs-site/sidebars.ts:1
- Score: 2

## 16. [WARNING] dead-code - docs-site/.docusaurus/client-modules.js is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::docs-site/.docusaurus/client-modules.js::1::unused-file`
- Location: docs-site/.docusaurus/client-modules.js:1
- Score: 2

## 17. [WARNING] dead-code - docs-site/.docusaurus/registry.js is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::docs-site/.docusaurus/registry.js::1::unused-file`
- Location: docs-site/.docusaurus/registry.js:1
- Score: 2

## 18. [WARNING] dead-code - docs-site/.docusaurus/routes.js is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::docs-site/.docusaurus/routes.js::1::unused-file`
- Location: docs-site/.docusaurus/routes.js:1
- Score: 2

## 19. [WARNING] dead-code - docs-site/scripts/capture-screenshots.mjs is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::docs-site/scripts/capture-screenshots.mjs::1::unused-file`
- Location: docs-site/scripts/capture-screenshots.mjs:1
- Score: 2

## 20. [WARNING] dead-code - next-env.d.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::next-env.d.ts::1::unused-file`
- Location: next-env.d.ts:1
- Score: 2

## 21. [WARNING] dead-code - fixtures/contracts/generateFixtures.mjs is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::fixtures/contracts/generateFixtures.mjs::1::unused-file`
- Location: fixtures/contracts/generateFixtures.mjs:1
- Score: 2

## 22. [WARNING] dead-code - e2e/global-teardown.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::e2e/global-teardown.ts::1::unused-file`
- Location: e2e/global-teardown.ts:1
- Score: 2

## 23. [WARNING] dead-code - src/app/layout.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/layout.tsx::1::unused-file`
- Location: src/app/layout.tsx:1
- Score: 2

## 24. [WARNING] dead-code - src/app/api/changes/[scope]/route.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/api/changes/[scope]/route.ts::1::unused-file`
- Location: src/app/api/changes/[scope]/route.ts:1
- Score: 2

## 25. [WARNING] dead-code - src/app/api/loan-contracts/route.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/api/loan-contracts/route.ts::1::unused-file`
- Location: src/app/api/loan-contracts/route.ts:1
- Score: 2

## 26. [WARNING] dead-code - src/app/api/loan-contracts/[id]/route.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/api/loan-contracts/[id]/route.ts::1::unused-file`
- Location: src/app/api/loan-contracts/[id]/route.ts:1
- Score: 2

## 27. [WARNING] dead-code - src/app/tenantActions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/tenantActions.ts::1::unused-file`
- Location: src/app/tenantActions.ts:1
- Score: 2

## 28. [WARNING] dead-code - src/app/page.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/page.tsx::1::unused-file`
- Location: src/app/page.tsx:1
- Score: 2

## 29. [WARNING] dead-code - src/app/[lang]/loans/actions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/loans/actions.ts::1::unused-file`
- Location: src/app/[lang]/loans/actions.ts:1
- Score: 2

## 30. [WARNING] dead-code - src/app/[lang]/loans/page.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/loans/page.tsx::1::unused-file`
- Location: src/app/[lang]/loans/page.tsx:1
- Score: 2

## 31. [WARNING] dead-code - src/app/[lang]/settings/actions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/settings/actions.ts::1::unused-file`
- Location: src/app/[lang]/settings/actions.ts:1
- Score: 2

## 32. [WARNING] dead-code - src/app/[lang]/settings/page.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/settings/page.tsx::1::unused-file`
- Location: src/app/[lang]/settings/page.tsx:1
- Score: 2

## 33. [WARNING] dead-code - src/app/[lang]/simulation/actions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/simulation/actions.ts::1::unused-file`
- Location: src/app/[lang]/simulation/actions.ts:1
- Score: 2

## 34. [WARNING] dead-code - src/app/[lang]/simulation/page.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/simulation/page.tsx::1::unused-file`
- Location: src/app/[lang]/simulation/page.tsx:1
- Score: 2

## 35. [WARNING] dead-code - src/app/[lang]/dashboard/actions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/dashboard/actions.ts::1::unused-file`
- Location: src/app/[lang]/dashboard/actions.ts:1
- Score: 2

## 36. [WARNING] dead-code - src/app/[lang]/dashboard/page.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/dashboard/page.tsx::1::unused-file`
- Location: src/app/[lang]/dashboard/page.tsx:1
- Score: 2

## 37. [WARNING] dead-code - src/app/[lang]/accounts/actions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/accounts/actions.ts::1::unused-file`
- Location: src/app/[lang]/accounts/actions.ts:1
- Score: 2

## 38. [WARNING] dead-code - src/app/[lang]/accounts/page.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/accounts/page.tsx::1::unused-file`
- Location: src/app/[lang]/accounts/page.tsx:1
- Score: 2

## 39. [WARNING] dead-code - src/app/[lang]/layout.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/layout.tsx::1::unused-file`
- Location: src/app/[lang]/layout.tsx:1
- Score: 2

## 40. [WARNING] dead-code - src/app/[lang]/upload/actions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/upload/actions.ts::1::unused-file`
- Location: src/app/[lang]/upload/actions.ts:1
- Score: 2

## 41. [WARNING] dead-code - src/app/[lang]/upload/page.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/app/[lang]/upload/page.tsx::1::unused-file`
- Location: src/app/[lang]/upload/page.tsx:1
- Score: 2

## 42. [WARNING] dead-code - src/components/loans/NewLoanWizard.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/loans/NewLoanWizard.tsx::1::unused-file`
- Location: src/components/loans/NewLoanWizard.tsx:1
- Score: 2

## 43. [WARNING] dead-code - src/components/loans/ExpenseEntryForm.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/loans/ExpenseEntryForm.tsx::1::unused-file`
- Location: src/components/loans/ExpenseEntryForm.tsx:1
- Score: 2

## 44. [WARNING] dead-code - src/components/loans/useLoanDraftWizard.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/loans/useLoanDraftWizard.tsx::1::unused-file`
- Location: src/components/loans/useLoanDraftWizard.tsx:1
- Score: 2

## 45. [WARNING] dead-code - src/components/loans/PrepaymentOptimizerCard.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/loans/PrepaymentOptimizerCard.tsx::1::unused-file`
- Location: src/components/loans/PrepaymentOptimizerCard.tsx:1
- Score: 2

## 46. [WARNING] dead-code - src/components/ui/Card.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/ui/Card.tsx::1::unused-file`
- Location: src/components/ui/Card.tsx:1
- Score: 2

## 47. [WARNING] dead-code - src/components/ui/StatCard.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/ui/StatCard.tsx::1::unused-file`
- Location: src/components/ui/StatCard.tsx:1
- Score: 2

## 48. [WARNING] dead-code - src/components/ui/InlineRecurringItemRow.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/ui/InlineRecurringItemRow.tsx::1::unused-file`
- Location: src/components/ui/InlineRecurringItemRow.tsx:1
- Score: 2

## 49. [WARNING] dead-code - src/components/ui/LiveRefresh.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/ui/LiveRefresh.tsx::1::unused-file`
- Location: src/components/ui/LiveRefresh.tsx:1
- Score: 2

## 50. [WARNING] dead-code - src/components/ui/Badge.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/ui/Badge.tsx::1::unused-file`
- Location: src/components/ui/Badge.tsx:1
- Score: 2

## 51. [WARNING] dead-code - src/components/ui/MonthKeyboardNav.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/ui/MonthKeyboardNav.tsx::1::unused-file`
- Location: src/components/ui/MonthKeyboardNav.tsx:1
- Score: 2

## 52. [WARNING] dead-code - src/components/settings/CustomTypeListEditor.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/settings/CustomTypeListEditor.tsx::1::unused-file`
- Location: src/components/settings/CustomTypeListEditor.tsx:1
- Score: 2

## 53. [WARNING] dead-code - src/components/original/OriginalEffortGauge.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/original/OriginalEffortGauge.tsx::1::unused-file`
- Location: src/components/original/OriginalEffortGauge.tsx:1
- Score: 2

## 54. [WARNING] dead-code - src/components/original/OriginalAppShell.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/original/OriginalAppShell.tsx::1::unused-file`
- Location: src/components/original/OriginalAppShell.tsx:1
- Score: 2

## 55. [WARNING] dead-code - src/components/original/OriginalSidebarNav.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/original/OriginalSidebarNav.tsx::1::unused-file`
- Location: src/components/original/OriginalSidebarNav.tsx:1
- Score: 2

## 56. [WARNING] dead-code - src/components/original/OriginalDashboard.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/original/OriginalDashboard.tsx::1::unused-file`
- Location: src/components/original/OriginalDashboard.tsx:1
- Score: 2

## 57. [WARNING] dead-code - src/components/shell/AppShell.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/shell/AppShell.tsx::1::unused-file`
- Location: src/components/shell/AppShell.tsx:1
- Score: 2

## 58. [WARNING] dead-code - src/components/shell/TenantSwitcher.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/shell/TenantSwitcher.tsx::1::unused-file`
- Location: src/components/shell/TenantSwitcher.tsx:1
- Score: 2

## 59. [WARNING] dead-code - src/components/shell/navItems.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/shell/navItems.ts::1::unused-file`
- Location: src/components/shell/navItems.ts:1
- Score: 2

## 60. [WARNING] dead-code - src/components/shell/SidebarNav.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/shell/SidebarNav.tsx::1::unused-file`
- Location: src/components/shell/SidebarNav.tsx:1
- Score: 2

## 61. [WARNING] dead-code - src/components/charts/BalanceDriftChart.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/charts/BalanceDriftChart.tsx::1::unused-file`
- Location: src/components/charts/BalanceDriftChart.tsx:1
- Score: 2

## 62. [WARNING] dead-code - src/components/charts/LoanAmortizationChart.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/charts/LoanAmortizationChart.tsx::1::unused-file`
- Location: src/components/charts/LoanAmortizationChart.tsx:1
- Score: 2

## 63. [WARNING] dead-code - src/components/charts/EffortGauge.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/charts/EffortGauge.tsx::1::unused-file`
- Location: src/components/charts/EffortGauge.tsx:1
- Score: 2

## 64. [WARNING] dead-code - src/components/charts/LiquidityChart.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/charts/LiquidityChart.tsx::1::unused-file`
- Location: src/components/charts/LiquidityChart.tsx:1
- Score: 2

## 65. [WARNING] dead-code - src/components/charts/chartTheme.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/charts/chartTheme.ts::1::unused-file`
- Location: src/components/charts/chartTheme.ts:1
- Score: 2

## 66. [WARNING] dead-code - src/components/charts/ComparisonChart.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/charts/ComparisonChart.tsx::1::unused-file`
- Location: src/components/charts/ComparisonChart.tsx:1
- Score: 2

## 67. [WARNING] dead-code - src/components/simulation/EventEntryForm.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/simulation/EventEntryForm.tsx::1::unused-file`
- Location: src/components/simulation/EventEntryForm.tsx:1
- Score: 2

## 68. [WARNING] dead-code - src/components/simulation/SimulationChartCard.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/simulation/SimulationChartCard.tsx::1::unused-file`
- Location: src/components/simulation/SimulationChartCard.tsx:1
- Score: 2

## 69. [WARNING] dead-code - src/components/simulation/EditEventModal.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/simulation/EditEventModal.tsx::1::unused-file`
- Location: src/components/simulation/EditEventModal.tsx:1
- Score: 2

## 70. [WARNING] dead-code - src/components/shared/RecurringEntryForm.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/shared/RecurringEntryForm.tsx::1::unused-file`
- Location: src/components/shared/RecurringEntryForm.tsx:1
- Score: 2

## 71. [WARNING] dead-code - src/components/dashboard/DashboardSuggestionWizards.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/dashboard/DashboardSuggestionWizards.tsx::1::unused-file`
- Location: src/components/dashboard/DashboardSuggestionWizards.tsx:1
- Score: 2

## 72. [WARNING] dead-code - src/components/accounts/InlineEditControls.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/accounts/InlineEditControls.tsx::1::unused-file`
- Location: src/components/accounts/InlineEditControls.tsx:1
- Score: 2

## 73. [WARNING] dead-code - src/components/accounts/InlineAccountReserveEditor.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/accounts/InlineAccountReserveEditor.tsx::1::unused-file`
- Location: src/components/accounts/InlineAccountReserveEditor.tsx:1
- Score: 2

## 74. [WARNING] dead-code - src/components/accounts/InlineAccountActiveEditor.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/accounts/InlineAccountActiveEditor.tsx::1::unused-file`
- Location: src/components/accounts/InlineAccountActiveEditor.tsx:1
- Score: 2

## 75. [WARNING] dead-code - src/components/accounts/IncomeEntryForm.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/accounts/IncomeEntryForm.tsx::1::unused-file`
- Location: src/components/accounts/IncomeEntryForm.tsx:1
- Score: 2

## 76. [WARNING] dead-code - src/components/accounts/InlineAccountBalanceEditor.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/accounts/InlineAccountBalanceEditor.tsx::1::unused-file`
- Location: src/components/accounts/InlineAccountBalanceEditor.tsx:1
- Score: 2

## 77. [WARNING] dead-code - src/components/accounts/InlineAccountNameEditor.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/accounts/InlineAccountNameEditor.tsx::1::unused-file`
- Location: src/components/accounts/InlineAccountNameEditor.tsx:1
- Score: 2

## 78. [WARNING] dead-code - src/components/theme/themeOptions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/theme/themeOptions.ts::1::unused-file`
- Location: src/components/theme/themeOptions.ts:1
- Score: 2

## 79. [WARNING] dead-code - src/components/theme/ThemeSelect.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/theme/ThemeSelect.tsx::1::unused-file`
- Location: src/components/theme/ThemeSelect.tsx:1
- Score: 2

## 80. [WARNING] dead-code - src/components/i18n/LanguagePreferenceSync.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/i18n/LanguagePreferenceSync.tsx::1::unused-file`
- Location: src/components/i18n/LanguagePreferenceSync.tsx:1
- Score: 2

## 81. [WARNING] dead-code - src/components/i18n/RootLanguageRedirect.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/i18n/RootLanguageRedirect.tsx::1::unused-file`
- Location: src/components/i18n/RootLanguageRedirect.tsx:1
- Score: 2

## 82. [WARNING] dead-code - src/components/upload/UploadSubmitButton.tsx is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/components/upload/UploadSubmitButton.tsx::1::unused-file`
- Location: src/components/upload/UploadSubmitButton.tsx:1
- Score: 2

## 83. [WARNING] dead-code - src/lib/settings/typeOptions.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/settings/typeOptions.ts::1::unused-file`
- Location: src/lib/settings/typeOptions.ts:1
- Score: 2

## 84. [WARNING] dead-code - src/lib/forms/loanForm.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/forms/loanForm.ts::1::unused-file`
- Location: src/lib/forms/loanForm.ts:1
- Score: 2

## 85. [WARNING] dead-code - src/lib/forms/recurringEntryForm.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/forms/recurringEntryForm.ts::1::unused-file`
- Location: src/lib/forms/recurringEntryForm.ts:1
- Score: 2

## 86. [WARNING] dead-code - src/lib/forms/accountForm.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/forms/accountForm.ts::1::unused-file`
- Location: src/lib/forms/accountForm.ts:1
- Score: 2

## 87. [WARNING] dead-code - src/lib/themeServer.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/themeServer.ts::1::unused-file`
- Location: src/lib/themeServer.ts:1
- Score: 2

## 88. [WARNING] dead-code - src/lib/format.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/format.ts::1::unused-file`
- Location: src/lib/format.ts:1
- Score: 2

## 89. [WARNING] dead-code - src/lib/marketRates/euribor.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/marketRates/euribor.ts::1::unused-file`
- Location: src/lib/marketRates/euribor.ts:1
- Score: 2

## 90. [WARNING] dead-code - src/lib/ai/ocr/ocrEngine.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/ocr/ocrEngine.ts::1::unused-file`
- Location: src/lib/ai/ocr/ocrEngine.ts:1
- Score: 2

## 91. [WARNING] dead-code - src/lib/ai/ocr/resolveContractText.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/ocr/resolveContractText.ts::1::unused-file`
- Location: src/lib/ai/ocr/resolveContractText.ts:1
- Score: 2

## 92. [WARNING] dead-code - src/lib/ai/pdf/extractText.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/pdf/extractText.ts::1::unused-file`
- Location: src/lib/ai/pdf/extractText.ts:1
- Score: 2

## 93. [WARNING] dead-code - src/lib/ai/pdf/textQuality.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/pdf/textQuality.ts::1::unused-file`
- Location: src/lib/ai/pdf/textQuality.ts:1
- Score: 2

## 94. [WARNING] dead-code - src/lib/ai/extraction/plausibility.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/extraction/plausibility.ts::1::unused-file`
- Location: src/lib/ai/extraction/plausibility.ts:1
- Score: 2

## 95. [WARNING] dead-code - src/lib/ai/extraction/pipeline.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/extraction/pipeline.ts::1::unused-file`
- Location: src/lib/ai/extraction/pipeline.ts:1
- Score: 2

## 96. [WARNING] dead-code - src/lib/ai/extraction/rawSchema.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/extraction/rawSchema.ts::1::unused-file`
- Location: src/lib/ai/extraction/rawSchema.ts:1
- Score: 2

## 97. [WARNING] dead-code - src/lib/ai/extraction/extractionLogger.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/extraction/extractionLogger.ts::1::unused-file`
- Location: src/lib/ai/extraction/extractionLogger.ts:1
- Score: 2

## 98. [WARNING] dead-code - src/lib/ai/extraction/llmClient.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/extraction/llmClient.ts::1::unused-file`
- Location: src/lib/ai/extraction/llmClient.ts:1
- Score: 2

## 99. [WARNING] dead-code - src/lib/ai/extraction/chunking.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/ai/extraction/chunking.ts::1::unused-file`
- Location: src/lib/ai/extraction/chunking.ts:1
- Score: 2

## 100. [WARNING] dead-code - src/lib/db/migrations.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/migrations.ts::1::unused-file`
- Location: src/lib/db/migrations.ts:1
- Score: 2

## 101. [WARNING] dead-code - src/lib/db/repositories/sqliteExpenseRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteExpenseRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteExpenseRepository.ts:1
- Score: 2

## 102. [WARNING] dead-code - src/lib/db/repositories/sqliteIncomeRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteIncomeRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteIncomeRepository.ts:1
- Score: 2

## 103. [WARNING] dead-code - src/lib/db/repositories/sqliteRecurringItemRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteRecurringItemRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteRecurringItemRepository.ts:1
- Score: 2

## 104. [WARNING] dead-code - src/lib/db/repositories/sqliteAccountRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteAccountRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteAccountRepository.ts:1
- Score: 2

## 105. [WARNING] dead-code - src/lib/db/repositories/sqliteSettingsRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteSettingsRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteSettingsRepository.ts:1
- Score: 2

## 106. [WARNING] dead-code - src/lib/db/repositories/sqliteContractRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteContractRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteContractRepository.ts:1
- Score: 2

## 107. [WARNING] dead-code - src/lib/db/repositories/sqliteExchangeRateRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteExchangeRateRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteExchangeRateRepository.ts:1
- Score: 2

## 108. [WARNING] dead-code - src/lib/db/repositories/sqliteScenarioRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteScenarioRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteScenarioRepository.ts:1
- Score: 2

## 109. [WARNING] dead-code - src/lib/db/repositories/sqliteEntityHistoryRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteEntityHistoryRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteEntityHistoryRepository.ts:1
- Score: 2

## 110. [WARNING] dead-code - src/lib/db/repositories/sqliteLoanRepository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/repositories/sqliteLoanRepository.ts::1::unused-file`
- Location: src/lib/db/repositories/sqliteLoanRepository.ts:1
- Score: 2

## 111. [WARNING] dead-code - src/lib/db/client.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/db/client.ts::1::unused-file`
- Location: src/lib/db/client.ts:1
- Score: 2

## 112. [WARNING] dead-code - src/lib/theme.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/theme.ts::1::unused-file`
- Location: src/lib/theme.ts:1
- Score: 2

## 113. [WARNING] dead-code - src/lib/i18n/locales.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/i18n/locales.ts::1::unused-file`
- Location: src/lib/i18n/locales.ts:1
- Score: 2

## 114. [WARNING] dead-code - src/lib/i18n/getDictionary.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/i18n/getDictionary.ts::1::unused-file`
- Location: src/lib/i18n/getDictionary.ts:1
- Score: 2

## 115. [WARNING] dead-code - src/lib/services/exchangeRateService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/exchangeRateService.ts::1::unused-file`
- Location: src/lib/services/exchangeRateService.ts:1
- Score: 2

## 116. [WARNING] dead-code - src/lib/services/accountsService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/accountsService.ts::1::unused-file`
- Location: src/lib/services/accountsService.ts:1
- Score: 2

## 117. [WARNING] dead-code - src/lib/services/scenarioService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/scenarioService.ts::1::unused-file`
- Location: src/lib/services/scenarioService.ts:1
- Score: 2

## 118. [WARNING] dead-code - src/lib/services/simulationService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/simulationService.ts::1::unused-file`
- Location: src/lib/services/simulationService.ts:1
- Score: 2

## 119. [WARNING] dead-code - src/lib/services/historyReplayService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/historyReplayService.ts::1::unused-file`
- Location: src/lib/services/historyReplayService.ts:1
- Score: 2

## 120. [WARNING] dead-code - src/lib/services/seed.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/seed.ts::1::unused-file`
- Location: src/lib/services/seed.ts:1
- Score: 2

## 121. [WARNING] dead-code - src/lib/services/recurringItemsService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/recurringItemsService.ts::1::unused-file`
- Location: src/lib/services/recurringItemsService.ts:1
- Score: 2

## 122. [WARNING] dead-code - src/lib/services/simulationBuilders.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/simulationBuilders.ts::1::unused-file`
- Location: src/lib/services/simulationBuilders.ts:1
- Score: 2

## 123. [WARNING] dead-code - src/lib/services/changeEvents.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/changeEvents.ts::1::unused-file`
- Location: src/lib/services/changeEvents.ts:1
- Score: 2

## 124. [WARNING] dead-code - src/lib/services/loanService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/loanService.ts::1::unused-file`
- Location: src/lib/services/loanService.ts:1
- Score: 2

## 125. [WARNING] dead-code - src/lib/services/loansPageService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/loansPageService.ts::1::unused-file`
- Location: src/lib/services/loansPageService.ts:1
- Score: 2

## 126. [WARNING] dead-code - src/lib/services/tenantService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/tenantService.ts::1::unused-file`
- Location: src/lib/services/tenantService.ts:1
- Score: 2

## 127. [WARNING] dead-code - src/lib/services/historyReplay.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/historyReplay.ts::1::unused-file`
- Location: src/lib/services/historyReplay.ts:1
- Score: 2

## 128. [WARNING] dead-code - src/lib/services/contractsService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/contractsService.ts::1::unused-file`
- Location: src/lib/services/contractsService.ts:1
- Score: 2

## 129. [WARNING] dead-code - src/lib/services/dashboardService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/dashboardService.ts::1::unused-file`
- Location: src/lib/services/dashboardService.ts:1
- Score: 2

## 130. [WARNING] dead-code - src/lib/services/db.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/db.ts::1::unused-file`
- Location: src/lib/services/db.ts:1
- Score: 2

## 131. [WARNING] dead-code - src/lib/services/prepaymentOptimizationService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/prepaymentOptimizationService.ts::1::unused-file`
- Location: src/lib/services/prepaymentOptimizationService.ts:1
- Score: 2

## 132. [WARNING] dead-code - src/lib/services/marketRatesService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/marketRatesService.ts::1::unused-file`
- Location: src/lib/services/marketRatesService.ts:1
- Score: 2

## 133. [WARNING] dead-code - src/lib/services/settingsService.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/lib/services/settingsService.ts::1::unused-file`
- Location: src/lib/services/settingsService.ts:1
- Score: 2

## 134. [WARNING] dead-code - src/engine/dayCount/dayCount.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/dayCount/dayCount.ts::1::unused-file`
- Location: src/engine/dayCount/dayCount.ts:1
- Score: 2

## 135. [WARNING] dead-code - src/engine/metrics/interestDrag.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/metrics/interestDrag.ts::1::unused-file`
- Location: src/engine/metrics/interestDrag.ts:1
- Score: 2

## 136. [WARNING] dead-code - src/engine/metrics/savingsTrend.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/metrics/savingsTrend.ts::1::unused-file`
- Location: src/engine/metrics/savingsTrend.ts:1
- Score: 2

## 137. [WARNING] dead-code - src/engine/metrics/effortRate.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/metrics/effortRate.ts::1::unused-file`
- Location: src/engine/metrics/effortRate.ts:1
- Score: 2

## 138. [WARNING] dead-code - src/engine/metrics/averageRate.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/metrics/averageRate.ts::1::unused-file`
- Location: src/engine/metrics/averageRate.ts:1
- Score: 2

## 139. [WARNING] dead-code - src/engine/metrics/liquidity.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/metrics/liquidity.ts::1::unused-file`
- Location: src/engine/metrics/liquidity.ts:1
- Score: 2

## 140. [WARNING] dead-code - src/engine/rates/rate.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/rates/rate.ts::1::unused-file`
- Location: src/engine/rates/rate.ts:1
- Score: 2

## 141. [WARNING] dead-code - src/engine/dates/isoDate.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/dates/isoDate.ts::1::unused-file`
- Location: src/engine/dates/isoDate.ts:1
- Score: 2

## 142. [WARNING] dead-code - src/engine/dates/frequency.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/dates/frequency.ts::1::unused-file`
- Location: src/engine/dates/frequency.ts:1
- Score: 2

## 143. [WARNING] dead-code - src/engine/optimization/optimizePrepayments.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/optimization/optimizePrepayments.ts::1::unused-file`
- Location: src/engine/optimization/optimizePrepayments.ts:1
- Score: 2

## 144. [WARNING] dead-code - src/engine/simulation/scenario.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/simulation/scenario.ts::1::unused-file`
- Location: src/engine/simulation/scenario.ts:1
- Score: 2

## 145. [WARNING] dead-code - src/engine/simulation/recurringSchedule.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/simulation/recurringSchedule.ts::1::unused-file`
- Location: src/engine/simulation/recurringSchedule.ts:1
- Score: 2

## 146. [WARNING] dead-code - src/engine/simulation/simulate.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/simulation/simulate.ts::1::unused-file`
- Location: src/engine/simulation/simulate.ts:1
- Score: 2

## 147. [WARNING] dead-code - src/engine/simulation/events.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/simulation/events.ts::1::unused-file`
- Location: src/engine/simulation/events.ts:1
- Score: 2

## 148. [WARNING] dead-code - src/engine/cashflow/cashflow.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/cashflow/cashflow.ts::1::unused-file`
- Location: src/engine/cashflow/cashflow.ts:1
- Score: 2

## 149. [WARNING] dead-code - src/engine/accounts/transfer.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/accounts/transfer.ts::1::unused-file`
- Location: src/engine/accounts/transfer.ts:1
- Score: 2

## 150. [WARNING] dead-code - src/engine/accounts/ledger.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/accounts/ledger.ts::1::unused-file`
- Location: src/engine/accounts/ledger.ts:1
- Score: 2

## 151. [WARNING] dead-code - src/engine/money/currency.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/money/currency.ts::1::unused-file`
- Location: src/engine/money/currency.ts:1
- Score: 2

## 152. [WARNING] dead-code - src/engine/money/money.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/money/money.ts::1::unused-file`
- Location: src/engine/money/money.ts:1
- Score: 2

## 153. [WARNING] dead-code - src/engine/money/decimal.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/money/decimal.ts::1::unused-file`
- Location: src/engine/money/decimal.ts:1
- Score: 2

## 154. [WARNING] dead-code - src/engine/money/rounding.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/money/rounding.ts::1::unused-file`
- Location: src/engine/money/rounding.ts:1
- Score: 2

## 155. [WARNING] dead-code - src/engine/amortization/amortization.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/amortization/amortization.ts::1::unused-file`
- Location: src/engine/amortization/amortization.ts:1
- Score: 2

## 156. [WARNING] dead-code - src/engine/prepayment/penalty.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/prepayment/penalty.ts::1::unused-file`
- Location: src/engine/prepayment/penalty.ts:1
- Score: 2

## 157. [WARNING] dead-code - src/engine/prepayment/prepayment.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/engine/prepayment/prepayment.ts::1::unused-file`
- Location: src/engine/prepayment/prepayment.ts:1
- Score: 2

## 158. [WARNING] dead-code - src/domain/loans/loan.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/loans/loan.ts::1::unused-file`
- Location: src/domain/loans/loan.ts:1
- Score: 2

## 159. [WARNING] dead-code - src/domain/settings/settings.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/settings/settings.ts::1::unused-file`
- Location: src/domain/settings/settings.ts:1
- Score: 2

## 160. [WARNING] dead-code - src/domain/expenses/expense.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/expenses/expense.ts::1::unused-file`
- Location: src/domain/expenses/expense.ts:1
- Score: 2

## 161. [WARNING] dead-code - src/domain/contracts/contract.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/contracts/contract.ts::1::unused-file`
- Location: src/domain/contracts/contract.ts:1
- Score: 2

## 162. [WARNING] dead-code - src/domain/contracts/extractedField.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/contracts/extractedField.ts::1::unused-file`
- Location: src/domain/contracts/extractedField.ts:1
- Score: 2

## 163. [WARNING] dead-code - src/domain/income/income.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/income/income.ts::1::unused-file`
- Location: src/domain/income/income.ts:1
- Score: 2

## 164. [WARNING] dead-code - src/domain/shared/repository.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/shared/repository.ts::1::unused-file`
- Location: src/domain/shared/repository.ts:1
- Score: 2

## 165. [WARNING] dead-code - src/domain/shared/recurringItem.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/shared/recurringItem.ts::1::unused-file`
- Location: src/domain/shared/recurringItem.ts:1
- Score: 2

## 166. [WARNING] dead-code - src/domain/shared/errors.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/shared/errors.ts::1::unused-file`
- Location: src/domain/shared/errors.ts:1
- Score: 2

## 167. [WARNING] dead-code - src/domain/shared/codecs.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/shared/codecs.ts::1::unused-file`
- Location: src/domain/shared/codecs.ts:1
- Score: 2

## 168. [WARNING] dead-code - src/domain/accounts/account.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/accounts/account.ts::1::unused-file`
- Location: src/domain/accounts/account.ts:1
- Score: 2

## 169. [WARNING] dead-code - src/domain/history/entityHistory.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/history/entityHistory.ts::1::unused-file`
- Location: src/domain/history/entityHistory.ts:1
- Score: 2

## 170. [WARNING] dead-code - src/domain/scenarios/scenario.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/scenarios/scenario.ts::1::unused-file`
- Location: src/domain/scenarios/scenario.ts:1
- Score: 2

## 171. [WARNING] dead-code - src/domain/exchangeRates/exchangeRate.ts is never imported/required from any detected entry point (package.json main/exports/bin, index/main/server/app files, config files, or tests) — a candidate for deletion.

- ID: `dead-code::src/domain/exchangeRates/exchangeRate.ts::1::unused-file`
- Location: src/domain/exchangeRates/exchangeRate.ts:1
- Score: 2

## 172. [WARNING] dead-code - Dependency "@tailwindcss/postcss" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::8a5b2b13`
- Location: package.json:1
- Score: 2

## 173. [WARNING] dead-code - Dependency "@types/node" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::3abaedf0`
- Location: package.json:1
- Score: 2

## 174. [WARNING] dead-code - Dependency "@types/react" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::a00c6322`
- Location: package.json:1
- Score: 2

## 175. [WARNING] dead-code - Dependency "@types/react-dom" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::83e974ff`
- Location: package.json:1
- Score: 2

## 176. [WARNING] dead-code - Dependency "@typescript-eslint/eslint-plugin" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::199f616a`
- Location: package.json:1
- Score: 2

## 177. [WARNING] dead-code - Dependency "@typescript-eslint/parser" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::3e5ba580`
- Location: package.json:1
- Score: 2

## 178. [WARNING] dead-code - Dependency "eslint-config-next" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::60dc5d32`
- Location: package.json:1
- Score: 2

## 179. [WARNING] dead-code - Dependency "tailwindcss" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::a154b6b6`
- Location: package.json:1
- Score: 2

## 180. [WARNING] dead-code - Dependency "typescript" is declared in package.json but never imported/required from any scanned source file and isn't referenced by an npm script.

- ID: `dead-code::package.json::1::unused-dependency::fd840655`
- Location: package.json:1
- Score: 2

## 181. [WARNING] complexity-health - Maintainability Index 38/100 — below the 40 threshold (complexity 47 over 167 lines of code).

- ID: `complexity-health::src/app/[lang]/loans/actions.ts::1::low-maintainability`
- Location: src/app/[lang]/loans/actions.ts:1
- Score: 2

## 182. [WARNING] complexity-health - Maintainability Index 30/100 — below the 40 threshold (complexity 48 over 644 lines of code).

- ID: `complexity-health::src/app/[lang]/loans/page.tsx::1::low-maintainability`
- Location: src/app/[lang]/loans/page.tsx:1
- Score: 2

## 183. [WARNING] complexity-health - Cyclomatic complexity 23 (cognitive 45) — over the 20 threshold past which functions become difficult to test exhaustively. CRAP score 552 (no coverage data ingested — treated as 0% for CRAP).

- ID: `complexity-health::src/app/[lang]/simulation/actions.ts::1::high-complexity`
- Location: src/app/[lang]/simulation/actions.ts:1
- Score: 2

## 184. [WARNING] complexity-health - Maintainability Index 31/100 — below the 40 threshold (complexity 55 over 484 lines of code).

- ID: `complexity-health::src/app/[lang]/simulation/page.tsx::1::low-maintainability`
- Location: src/app/[lang]/simulation/page.tsx:1
- Score: 2

## 185. [WARNING] complexity-health - Cyclomatic complexity 24 (cognitive 54) — over the 20 threshold past which functions become difficult to test exhaustively. CRAP score 600 (no coverage data ingested — treated as 0% for CRAP).

- ID: `complexity-health::src/app/[lang]/accounts/actions.ts::1::high-complexity`
- Location: src/app/[lang]/accounts/actions.ts:1
- Score: 2

## 186. [WARNING] complexity-health - Maintainability Index 36/100 — below the 40 threshold (complexity 39 over 314 lines of code).

- ID: `complexity-health::src/app/[lang]/upload/page.tsx::1::low-maintainability`
- Location: src/app/[lang]/upload/page.tsx:1
- Score: 2

## 187. [WARNING] complexity-health - Maintainability Index 34/100 — below the 40 threshold (complexity 57 over 265 lines of code).

- ID: `complexity-health::src/components/charts/ComparisonChart.tsx::1::low-maintainability`
- Location: src/components/charts/ComparisonChart.tsx:1
- Score: 2

## 188. [WARNING] complexity-health - Maintainability Index 31/100 — below the 40 threshold (complexity 66 over 360 lines of code).

- ID: `complexity-health::src/components/simulation/EventEntryForm.tsx::1::low-maintainability`
- Location: src/components/simulation/EventEntryForm.tsx:1
- Score: 2

## 189. [WARNING] complexity-health - Maintainability Index 29/100 — below the 40 threshold (complexity 72 over 425 lines of code).

- ID: `complexity-health::src/components/simulation/SimulationChartCard.tsx::1::low-maintainability`
- Location: src/components/simulation/SimulationChartCard.tsx:1
- Score: 2

## 190. [WARNING] complexity-health - Maintainability Index 36/100 — below the 40 threshold (complexity 27 over 498 lines of code).

- ID: `complexity-health::src/components/dashboard/DashboardSuggestionWizards.tsx::1::low-maintainability`
- Location: src/components/dashboard/DashboardSuggestionWizards.tsx:1
- Score: 2

## 191. [WARNING] complexity-health - Maintainability Index 38/100 — below the 40 threshold (complexity 48 over 164 lines of code).

- ID: `complexity-health::src/lib/forms/loanForm.ts::1::low-maintainability`
- Location: src/lib/forms/loanForm.ts:1
- Score: 2

## 192. [WARNING] complexity-health - Cyclomatic complexity 43 (cognitive 96) — over the 20 threshold past which functions become difficult to test exhaustively. CRAP score 1892 (no coverage data ingested — treated as 0% for CRAP).

- ID: `complexity-health::src/lib/marketRates/euribor.ts::1::high-complexity`
- Location: src/lib/marketRates/euribor.ts:1
- Score: 2

## 193. [WARNING] complexity-health - Cyclomatic complexity 36 (cognitive 70) — over the 20 threshold past which functions become difficult to test exhaustively. CRAP score 1332 (no coverage data ingested — treated as 0% for CRAP).

- ID: `complexity-health::src/lib/ai/extraction/plausibility.ts::1::high-complexity`
- Location: src/lib/ai/extraction/plausibility.ts:1
- Score: 2

## 194. [WARNING] complexity-health - Maintainability Index 36/100 — below the 40 threshold (complexity 42 over 286 lines of code).

- ID: `complexity-health::src/lib/ai/extraction/pipeline.ts::1::low-maintainability`
- Location: src/lib/ai/extraction/pipeline.ts:1
- Score: 2

## 195. [WARNING] complexity-health - Maintainability Index 26/100 — below the 40 threshold (complexity 82 over 582 lines of code).

- ID: `complexity-health::src/lib/services/scenarioService.ts::1::low-maintainability`
- Location: src/lib/services/scenarioService.ts:1
- Score: 2

## 196. [WARNING] complexity-health - Maintainability Index 35/100 — below the 40 threshold (complexity 45 over 299 lines of code).

- ID: `complexity-health::src/lib/services/historyReplayService.ts::1::low-maintainability`
- Location: src/lib/services/historyReplayService.ts:1
- Score: 2

## 197. [WARNING] complexity-health - Maintainability Index 30/100 — below the 40 threshold (complexity 80 over 330 lines of code).

- ID: `complexity-health::src/lib/services/loansPageService.ts::1::low-maintainability`
- Location: src/lib/services/loansPageService.ts:1
- Score: 2

## 198. [WARNING] complexity-health - Maintainability Index 34/100 — below the 40 threshold (complexity 47 over 320 lines of code).

- ID: `complexity-health::src/lib/services/contractsService.ts::1::low-maintainability`
- Location: src/lib/services/contractsService.ts:1
- Score: 2

## 199. [WARNING] complexity-health - Maintainability Index 35/100 — below the 40 threshold (complexity 46 over 291 lines of code).

- ID: `complexity-health::src/engine/simulation/simulate.ts::1::low-maintainability`
- Location: src/engine/simulation/simulate.ts:1
- Score: 2

## 200. [WARNING] complexity-health - Maintainability Index 36/100 — below the 40 threshold (complexity 44 over 249 lines of code).

- ID: `complexity-health::src/domain/contracts/contract.ts::1::low-maintainability`
- Location: src/domain/contracts/contract.ts:1
- Score: 2

## 201. [WARNING] css-dead-code - CSS class ".infima" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::d114ceac`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 202. [WARNING] css-dead-code - CSS class ".theme-common" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::f52fe60d`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 203. [WARNING] css-dead-code - CSS class ".theme-classic" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::8c3671d4`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 204. [WARNING] css-dead-code - CSS class ".core" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::4e999bdc`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 205. [WARNING] css-dead-code - CSS class ".plugin-debug" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::66193b86`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 206. [WARNING] css-dead-code - CSS class ".theme-mermaid" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::c98728d1`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 207. [WARNING] css-dead-code - CSS class ".theme-live-codeblock" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::f9d5944f`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 208. [WARNING] css-dead-code - CSS class ".theme-search-algolia" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::e50b0a64`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 209. [WARNING] css-dead-code - CSS class ".docsearch" is declared in docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css::1::unused-css-class::efa9063d`
- Location: docs-site/.docusaurus/docusaurus-plugin-css-cascade-layers/default/layers.css:1
- Score: 2

## 210. [WARNING] css-dead-code - CSS class ".markdown" is declared in docs-site/src/css/custom.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::docs-site/src/css/custom.css::22::unused-css-class`
- Location: docs-site/src/css/custom.css:22
- Score: 2

## 211. [WARNING] css-dead-code - CSS class ".surface-card" is declared in src/app/globals.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::src/app/globals.css::526::unused-css-class`
- Location: src/app/globals.css:526
- Score: 2

## 212. [WARNING] css-dead-code - CSS class ".section-rule" is declared in src/app/globals.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::src/app/globals.css::550::unused-css-class`
- Location: src/app/globals.css:550
- Score: 2

## 213. [WARNING] css-dead-code - CSS class ".shadow-md" is declared in src/app/globals.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::src/app/globals.css::613::unused-css-class`
- Location: src/app/globals.css:613
- Score: 2

## 214. [WARNING] css-dead-code - CSS class ".card-shadow" is declared in src/app/globals.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::src/app/globals.css::617::unused-css-class`
- Location: src/app/globals.css:617
- Score: 2

## 215. [WARNING] css-dead-code - CSS class ".shadow-xl" is declared in src/app/globals.css but never referenced in a class/className attribute across 266 scanned markup file(s).

- ID: `css-dead-code::src/app/globals.css::623::unused-css-class`
- Location: src/app/globals.css:623
- Score: 2

## 216. [WARNING] license-compliance - No project license declared — no root LICENSE/LICENCE/COPYING file and no license field in package.json, Cargo.toml, pyproject.toml, setup.cfg or pom.xml. Add a LICENSE file (for internal/proprietary code, a copyright + "All rights reserved" notice) and set the manifest's license field ("UNLICENSED" for a private npm package).

- ID: `license-compliance::LICENSE::1`
- Location: LICENSE:1
- Score: 3

## 217. [WARNING] dependency-vulnerability - vitest@4.1.10 — GHSA-82fw-gwwq-j7x9: Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock (CVE-2026-84373) (CVSS 5.9)

- ID: `dependency-vulnerability::package.json::11::vitest::GHSA-82fw-gwwq-j7x9`
- Location: package.json:11
- Score: 4

