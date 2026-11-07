---
sidebar_position: 6
title: Settings
---

# Settings

![Settings](/img/screenshots/settings.png)

## Financial engine

| Setting | Effect |
|---|---|
| **Base currency** | Every aggregated metric and simulation is converted into this currency |
| **Rounding policy** | Half-even (banker's rounding), half-up, down or up. Applied everywhere the engine rounds to minor units |
| **Default day-count convention** | Actual/365, Actual/360 or 30/360. Used for interest accrual |
| **Language** | EN, PT, ES, FR, DE. Also selectable through the URL (`/pt/dashboard`) |
| **Account type labels** | Rename Checking, Savings, Emergency, Investment, Other |
| **Loan type labels** | Rename Mortgage, Auto, Personal, Consumer, Student, Other, and add **custom loan types** |
| **Income types** | Add **custom income types** |

## Theme

Three colour themes, switchable from the bottom of the sidebar or from the **Theme** section here. The choice is remembered in this browser.

| Classic (default) | Ledger | Original |
|---|---|---|
| ![Classic theme](/img/screenshots/theme-classic.png) | ![Ledger theme](/img/screenshots/theme-ledger.png) | ![Original theme](/img/screenshots/theme-original.png) |

- **Classic:** the original blue colours with the current layout
- **Ledger:** warm paper colours, a bottle-green accent and a dark sidebar
- **Original:** the look before the redesign, including its sidebar, top bar and dashboard

## Security & AI engine

- **Local LLM endpoint:** an OpenAI-compatible server such as Ollama or llama.cpp, for example `http://localhost:8050/v1`
- **Enable local AI extraction:** turns AI field suggestions on or off for uploaded contracts
- **Allow cloud LLM fallback:** off by default. If you turn it on, contract text may be sent to a non-local endpoint when the local one is unavailable, and a warning is shown

## Privacy & status

This panel shows **100% Offline Mode Active** when no non-local endpoint is configured. Otherwise it shows a warning. It also shows the app version.

## Languages

![Dashboard in Portuguese](/img/screenshots/dashboard-pt.png)
