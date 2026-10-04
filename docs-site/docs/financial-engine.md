---
sidebar_position: 1
title: Financial engine
---

# Financial engine

Every number in the UI comes from a pure, deterministic engine (`src/engine`). The UI only formats the results.

## Money and dates

- **Money** is stored as integer minor units (`bigint`) with a currency code. There is never floating-point money, and you can't mix currencies implicitly.
- **Rounding** is centralised and follows the rounding policy in Settings.
- **Dates** are calendar-only (`IsoDate`), with no time-zone drift.
- **Day-count conventions:** Actual/360, Actual/365, 30/360.

## Modules

| Module | Responsibility |
|---|---|
| `amortization` | French, constant-amortization and interest-only schedules, including fixed→variable resets |
| `rates` | Fixed, variable (index + spread) and mixed rates |
| `prepayment` | Prepayments with *reduce payment* or *shorten term*, and prepayment penalty rules |
| `cashflow` | One authoritative formula that closes each account's period |
| `simulation` | Runs period by period: applies events in a fixed order, expands recurring income and expenses, debits loan payments |
| `metrics` | Total, available and minimum liquidity, runway, reserve breaches, effort rate, interest drag, savings trend |
| `optimization` | Prepayment optimisation (engine-level) |

## Recurring items

Income and expenses support the frequencies daily, weekly, biweekly, monthly, quarterly, semiannual and annual. Each has a start date and an optional end date. The engine also supports inflation rules (annual or monthly-compounded indexation) on recurring items.

## Design invariants

- **Conservation:** cash-flow periods and transfers neither create nor destroy money
- **Currency:** arithmetic between different currencies throws an error instead of silently mixing them
- **Determinism:** the same inputs always produce identical outputs, with events sorted by (date, type priority, id)

Each engine module has unit tests next to it (Vitest, `npm test`).
