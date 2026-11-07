---
sidebar_position: 4
title: Contract upload
---

# Contract upload (AI assisted)

You can upload a loan contract PDF to pre-fill a loan. The upload is available from the loan wizard (**Start from contract**) and from the contract upload page.

![Contract upload](/img/screenshots/upload.png)

## Pipeline

1. **Text extraction:** the PDF's text layer is read on your machine.
2. **Quality check:** if the text looks poor (for example a scanned contract), an **OCR fallback** runs. If OCR is unavailable, the document is still kept for manual review.
3. **LLM extraction** (optional): a local, OpenAI-compatible LLM goes through the contract in chunks. A live checklist tracks the fields: loan type, principal, start date, term, payment frequency, amortization and interest rate.
4. **Consistency checks:** before you see the result, deterministic checks compare each value with the quote the model cited and with related fields. A field is marked **Needs review** when, for example, the rate type contradicts its own quote ("Tipo de taxa: Mista" read as *variable*), the fixed rate was taken from a spread line, the term doesn't match the start and maturity dates, or two parts of the contract gave different values.
5. **Review:** each field is marked as found, **Missing** or **Needs review** (low confidence or failed a check). Nothing is trusted automatically.
6. **Confirm & Add to Portfolio:** creates an active loan linked to the contract document.

:::tip Privacy
Extraction runs on your device. The contract text is only sent to a non-local endpoint if you explicitly turn on **Allow cloud LLM fallback** in [Settings](./settings.md).
:::

If local AI extraction is turned off, uploads still work and you fill in the fields manually.

## Uploaded documents

Document statuses: *Uploaded → Extracting… → Extracted* or *Failed*. A failed document shows the reason, with two actions:

- **Retry** runs extraction again from the stored contract text, without uploading the file again.
- **Delete** removes the document and its extracted fields. Loans created from it keep their data.

Extraction runs in the background. If the app restarts or the AI server stops responding mid-run, the document is marked *Failed* ("interrupted") after 10 minutes without progress, so you can retry it.

Uploading the same file twice doesn't create a duplicate: you get the existing document back, or, if its extraction had failed, it is run again.
