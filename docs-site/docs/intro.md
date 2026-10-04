---
slug: /
sidebar_position: 1
title: Overview
---

# Solvent AI

Solvent AI is a **local-first personal finance simulator**. You describe your bank accounts, recurring income, recurring expenses and loans. The app then projects your liquidity month by month and lets you run what-if scenarios such as a salary cut, a period of unemployment, a Euribor rise or a mortgage prepayment.

![Dashboard](/img/screenshots/dashboard.png)

## What it does

| Area | What you get |
|---|---|
| [Dashboard](./dashboard.md) | Effort rate (DTI), a 12-month liquidity projection you can page through past and future, real vs. projected balances, a savings trend, and guided setup wizards |
| [Income and balances](./accounts-and-income.md) | Bank accounts with balances, minimum reserves and an active/default flag, plus recurring or one-off income |
| [Loans and expenses](./loans-and-expenses.md) | Loans (fixed, variable or mixed rate; French, constant or interest-only amortization) with amortization charts, plus recurring or one-off expenses |
| [Contract upload](./contract-upload.md) | Upload a loan contract PDF. Text is extracted on your machine (with an OCR fallback), and a local LLM can suggest field values for you to review |
| [Simulation](./simulation.md) | Named scenarios built from events: one-time income or expense, income or expense changes with an optional end date, loan prepayments and interest-rate changes. Each scenario is compared side by side with the base case |
| [Settings](./settings.md) | Base currency, rounding policy, day-count convention, language, custom labels and types, and the local AI endpoint |
| [Demo accounts](./demo-accounts.md) | Separate demo databases with sample data to explore safely |

## Design principles

- **The financial engine is the single source of truth.** Every number comes from a deterministic engine that uses integer minor units, never floating-point money.
- **AI never decides financial facts.** Values extracted from contracts are suggestions you confirm.
- **Local-first.** Data lives in a SQLite file on your machine. Cloud LLM fallback stays off unless you turn it on.
- **Five languages:** English, Português, Español, Français, Deutsch.

:::info About the screenshots
Every screenshot in this guide comes from the **Demo 2** demo account, using its built-in sample data plus an "Unemployment" scenario.
:::
