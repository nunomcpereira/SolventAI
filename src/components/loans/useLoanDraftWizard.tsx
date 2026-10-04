"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { type LoanContractDraftState } from "../../lib/forms/loanForm.js";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

/** Shared field-state, extraction-polling, and defaults-application logic behind every
 * "upload a contract, review pre-filled loan fields" wizard (standalone loans page and
 * the dashboard suggestion card) — only step count and JSX layout differ between them. */
export function useLoanDraftWizard(
  extractAction: (state: LoanContractDraftState, formData: FormData) => Promise<LoanContractDraftState>,
  accounts: AccountOption[],
  defaultCurrency: string,
  extractionStepLabels: readonly [string, string, string, string],
  ambiguousWarningLabel: string,
) {
  const [name, setName] = useState("New Loan");
  const [category, setCategory] = useState("personal");
  const [principalAmount, setPrincipalAmount] = useState("10000");
  const [currency, setCurrency] = useState(defaultCurrency || "EUR");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [numberOfPeriods, setNumberOfPeriods] = useState("12");
  const [paymentFrequency, setPaymentFrequency] = useState("monthly");
  const [amortizationType, setAmortizationType] = useState("french");
  const [rateType, setRateType] = useState<"fixed" | "variable" | "mixed">("fixed");
  const [fixedRate, setFixedRate] = useState("4");
  const [euriborRate, setEuriborRate] = useState("2");
  const [spread, setSpread] = useState("1");
  const [fixedRatePeriods, setFixedRatePeriods] = useState("12");
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");
  const [contractDocumentId, setContractDocumentId] = useState("");
  const [ambiguousFields, setAmbiguousFields] = useState<string[]>([]);

  const initialExtractionState: LoanContractDraftState = { status: "idle" };
  const [draft, extractFormAction, isExtracting] = useActionState(extractAction, initialExtractionState);

  const [extractionStepIndex, setExtractionStepIndex] = useState(0);

  useEffect(() => {
    if (!isExtracting) {
      setExtractionStepIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setExtractionStepIndex((step) => Math.min(step + 1, extractionStepLabels.length - 1));
    }, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExtracting]);

  const selectedAccountCurrency = useMemo(
    () => accounts.find((a) => a.id === sourceAccountId)?.currency,
    [accounts, sourceAccountId],
  );

  useEffect(() => {
    if (draft.status !== "success" || !draft.defaults) return;
    setName(draft.defaults.name);
    setCategory(draft.defaults.category);
    setPrincipalAmount(draft.defaults.principalAmount);
    setCurrency(draft.defaults.currency);
    setStartDate(draft.defaults.startDate);
    setNumberOfPeriods(draft.defaults.numberOfPeriods);
    setPaymentFrequency(draft.defaults.paymentFrequency);
    setAmortizationType(draft.defaults.amortizationType);
    setRateType(draft.defaults.rateType);
    setFixedRate(draft.defaults.fixedRate);
    setEuriborRate(draft.defaults.euriborRate);
    setSpread(draft.defaults.spread);
    setFixedRatePeriods(draft.defaults.fixedRatePeriods);
    setAmbiguousFields(draft.defaults.ambiguousFields);
  }, [draft]);

  useEffect(() => {
    if (!draft.contractDocumentId) return;
    setContractDocumentId(draft.contractDocumentId);
  }, [draft.contractDocumentId]);

  function ambiguousWarning(field: string) {
    if (!ambiguousFields.includes(field)) return null;
    return (
      <span className="text-label-sm text-status-warning flex items-center gap-1">
        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
          warning
        </span>
        {ambiguousWarningLabel}
      </span>
    );
  }

  return {
    name, setName,
    category, setCategory,
    principalAmount, setPrincipalAmount,
    currency, setCurrency,
    startDate, setStartDate,
    numberOfPeriods, setNumberOfPeriods,
    paymentFrequency, setPaymentFrequency,
    amortizationType, setAmortizationType,
    rateType, setRateType,
    fixedRate, setFixedRate,
    euriborRate, setEuriborRate,
    spread, setSpread,
    fixedRatePeriods, setFixedRatePeriods,
    sourceAccountId, setSourceAccountId,
    contractDocumentId,
    ambiguousFields,
    ambiguousWarning,
    draft,
    extractFormAction,
    isExtracting,
    extractionStepIndex,
    selectedAccountCurrency,
  };
}
