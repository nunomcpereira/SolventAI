// One-off script to (re)generate the binary PDF fixtures used by lib/ai/pdf tests.
// Run with: node fixtures/contracts/generateFixtures.mjs
import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 400]);
  const lines = [
    "MORTGAGE LOAN AGREEMENT",
    "This agreement is entered into between the Lender and the Borrower.",
    "Principal Amount: EUR 200,000.00",
    "Term: 360 months",
    "Annual Interest Rate: 3.5% (fixed)",
    "Start Date: 2026-02-01",
    "Maturity Date: 2056-02-01",
    "Payment Frequency: Monthly",
    "Amortization Type: French (constant payment)",
    "Day Count Convention: Actual/365",
    "Prepayment Penalty: 0.5% of the prepaid amount, capped at EUR 1,000.00",
    "Origination Fee: EUR 500.00, payable at closing.",
  ];
  lines.forEach((line, i) => {
    page.drawText(line, { x: 20, y: 350 - i * 24, size: 12, font });
  });
  const bytes = await doc.save();
  writeFileSync(join(here, "sample-text-loan.pdf"), bytes);

  const blankDoc = await PDFDocument.create();
  blankDoc.addPage([400, 400]); // no text at all -> simulates a scanned/image-only page
  const blankBytes = await blankDoc.save();
  writeFileSync(join(here, "sample-blank.pdf"), blankBytes);

  console.log("Fixtures written.");
}

main();
