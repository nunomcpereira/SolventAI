---
sidebar_position: 3
title: Loans and expenses
---

# Loans and expenses

![Loans and expenses](/img/screenshots/loans.png)

## Portfolio summary

- **Total liabilities:** outstanding principal across all loans
- **Average interest rate (current):** the rate each loan charges today, weighted by what is still owed. A mixed-rate loan counts at its fixed rate until the fixed period ends, then at index + spread
- **Total monthly payment:** the sum of today's payments

## Updating Euribor

Variable and mixed-rate loans keep a **current index rate** that feeds every projection. When you have at least one such loan, **Update Euribor rates** (top right) fetches the latest published fixings from [euribor-rates.eu](https://www.euribor-rates.eu/en/current-euribor-rates/) and applies the matching tenor (1 week, 1, 3, 6 or 12 months) to each Euribor-linked loan. Only the index value changes: spread, caps and the fixed period stay as they are, and each change is recorded in the loan's history.

This is the app's only outbound request apart from the LLM endpoint you configure. It runs only when you press the button, and it is a plain read of a public page: nothing about you or your loans is sent. If the page can't be read, your loans are left untouched.

## Loan cards

Each loan shows its principal, today's **monthly payment**, **outstanding balance**, rate, **total interest** over its life, start date, associated contract and **payoff progress**.

Expand **View amortization chart** to see the yearly split between interest and principal:

![Amortization chart](/img/screenshots/loans-amortization.png)

Expand **Edit Loan** to change a loan in place:

![Edit loan](/img/screenshots/loans-edit-loan.png)

## Supported loan features

| Feature | Options |
|---|---|
| Categories | Mortgage, Auto, Personal, Consumer, Student, Other, plus custom loan types |
| Amortization | **French** (constant payment), **constant amortization** (constant principal), **interest-only** |
| Rate type | **Fixed**, **Variable** (index such as Euribor 6M plus spread), **Mixed** (fixed for N periods, then variable) |
| Payment frequency | Monthly, quarterly, semiannual, annual, biweekly, weekly, daily |
| Day-count | Uses the default convention from Settings (for example Actual/365) |
| Payment source | The bank account the instalments are debited from. The wizard warns when its currency differs from the loan's |
| Contract | Optionally linked to an uploaded contract PDF |

For variable and mixed loans, the payment is recalculated when the fixed period ends and whenever the index changes. The [Simulation](./simulation.md) page can apply hypothetical index changes.

## Adding a loan

**Add Loan** opens the loan wizard. You can fill it in manually, or choose **Start from contract** to upload a PDF and pre-fill the fields (see [Contract upload](./contract-upload.md)).

![Add loan wizard](/img/screenshots/loans-add-loan.png)

## Prepayment Optimizer

The **Prepayment Optimizer** calculates which loan yields the highest interest savings for any extra cash payment you wish to make:

- **Lump-sum payment amount:** Enter any amount in your base currency.
- **Payoff strategy:**
  - **Reduce monthly payment:** Keeps the loan duration identical while lowering your monthly payment burden.
  - **Shorten term:** Keeps your monthly payment amount constant and pays off the loan earlier, shaving months off the maturity date.
- **Deterministic ranking:** Ranks loans by total interest saved minus statutory early repayment penalties (e.g. 0.5% variable, 2.0% fixed), highlighting the optimal choice.
- **Simulate in Scenarios:** Quickly navigate to the Simulation page to test the prepayment within a broader what-if scenario.

## Expenses

**Add expense** works like income: **recurring** (amount, frequency, category, start and optional end date, paying account) or **one-off**. The **Recurring expenses** table supports inline edit and delete.
