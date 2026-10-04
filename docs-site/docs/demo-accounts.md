---
sidebar_position: 7
title: Demo accounts & mobile
---

# Demo accounts

The **Account** selector in the top bar switches between separate databases (tenants). Each one is its own SQLite file in `data/`.

- **Create demo account** (the button next to the selector) creates `demo`, `demo-2`, `demo-3` and so on. Each is seeded with illustrative data: a checking account, an emergency savings account, a salary, living expenses, a home mortgage, a car loan and a few example scenarios ("Job loss", "Salary raise", "Extra mortgage payment").
- Demo accounts are a safe place to try features without touching your real data.
- The selected account is remembered in a browser cookie.

Pages refresh automatically when data changes in another tab or window.

## Mobile

Below the `lg` breakpoint, the sidebar becomes a top app bar plus a bottom navigation bar, and the layouts stack.

<div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
  <img src={require("@site/static/img/screenshots/mobile-dashboard.png").default} alt="Mobile dashboard" width="300" />
  <img src={require("@site/static/img/screenshots/mobile-simulation.png").default} alt="Mobile simulation" width="300" />
</div>
