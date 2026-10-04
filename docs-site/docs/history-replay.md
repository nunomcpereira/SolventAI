---
sidebar_position: 2
title: History & replay
---

# History & replay

Every save or delete of an account, income, expense or loan is written to an append-only **entity history** table, which stores a full snapshot of the entity at that moment.

This makes several features possible:

- **Historical projection:** paging the dashboard or simulation into the past rebuilds the configuration that was in force at each date. It splits the timeline at every configuration change, so the past is shown as it was projected at the time, not with today's settings.
- **Actual points:** each saved account balance is a real data point.
- **Projected vs. actual chart:** compares that replay with the real balances, per account.
- **Savings trend:** the average savings per period between consecutive real balance entries, extended forward from the latest one.

:::note Limitation
Whether an item belongs to an account is decided by its *current* account. If an item was moved to another account, older history is not split perfectly.
:::
