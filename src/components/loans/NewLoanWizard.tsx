"use client";

import { useEffect, useState } from "react";
import { type LoanContractDraftState } from "../../lib/forms/loanForm.js";
import { useLoanDraftWizard } from "./useLoanDraftWizard.js";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual";
type AmortizationType = "french" | "constant_amortization" | "interest_only";
type MortgageRateType = "fixed" | "variable" | "mixed";

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface LoanCategoryOption {
  value: string;
  label: string;
}

interface LoanLabels {
  addLoan: string;
  name: string;
  category: string;
  principal: string;
  startDate: string;
  remainingTerm: string;
  rate: string;
  saveLoan: string;
  sourceAccount: string;
}

export function NewLoanWizard({
  createAction,
  extractAction,
  accounts,
  defaultCurrency,
  loanCategoryOptions,
  labels,
  ambiguousWarningLabel,
}: {
  createAction: (formData: FormData) => Promise<void>;
  extractAction: (state: LoanContractDraftState, formData: FormData) => Promise<LoanContractDraftState>;
  accounts: AccountOption[];
  defaultCurrency: string;
  loanCategoryOptions: LoanCategoryOption[];
  labels: LoanLabels;
  ambiguousWarningLabel: string;
}) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const extractionSteps = [
    "Reading PDF pages...",
    "Identifying loan type and terms...",
    "Extracting fields with the local LLM...",
    "Validating extracted values...",
  ] as const;

  const {
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
    ambiguousWarning,
    draft,
    extractFormAction,
    isExtracting,
    extractionStepIndex,
    selectedAccountCurrency,
  } = useLoanDraftWizard(extractAction, accounts, defaultCurrency, extractionSteps, ambiguousWarningLabel);

  useEffect(() => {
    if (draft.status === "success") {
      setCurrentStep(2);
    }
  }, [draft.status]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-sm mt-stack-md text-left w-full">
      <div className="md:col-span-2 text-label-sm text-on-surface-variant flex items-center gap-2">
        <span className={currentStep === 1 ? "text-primary font-medium" : ""}>Step 1</span>
        <span>•</span>
        <span className={currentStep === 2 ? "text-primary font-medium" : ""}>Step 2</span>
      </div>

      {currentStep === 1 ? (
        <>
          <form action={extractFormAction} className="md:col-span-2 rounded-lg border border-outline-variant bg-surface p-4 flex flex-col gap-2">
            <p className="text-label-md text-on-surface font-semibold">Step 1: Upload contract PDF</p>
            <p className="text-label-sm text-on-surface-variant">
              We identify loan type and terms, then pre-fill the loan form for review.
            </p>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <input
                type="file"
                name="file"
                accept="application/pdf"
                required
                className="block w-full text-label-sm text-on-surface-variant file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-on-primary"
              />
              <button
                type="submit"
                className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md whitespace-nowrap disabled:opacity-60"
                disabled={isExtracting}
              >
                {isExtracting ? "Extracting..." : "Upload and extract"}
              </button>
            </div>
            {isExtracting ? (
              <p className="text-label-sm text-on-surface-variant flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                {extractionSteps[extractionStepIndex]}
              </p>
            ) : null}
            {draft.message ? (
              <p className={draft.status === "error" ? "text-label-sm text-status-danger" : "text-label-sm text-status-success"}>
                {draft.message}
              </p>
            ) : null}
          </form>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="bg-primary text-on-primary py-2 px-4 rounded-lg text-label-md"
            >
              Next
            </button>
          </div>
        </>
      ) : null}

      {currentStep === 2 ? (
        <>
          <div className="md:col-span-2">
            <p className="text-label-md text-on-surface font-semibold">Step 2: Review and create loan</p>
          </div>

          <form action={createAction} className="contents">
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.name}
              <input
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.category}
              {ambiguousWarning("category")}
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              >
                {loanCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.principal}
              {ambiguousWarning("principalAmount")}
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="principalAmount"
                required
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              Currency
              <input
                name="currency"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.startDate}
              {ambiguousWarning("startDate")}
              <input
                type="date"
                name="startDate"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.remainingTerm}
              {ambiguousWarning("numberOfPeriods")}
              <input
                type="number"
                min="1"
                step="1"
                name="numberOfPeriods"
                required
                value={numberOfPeriods}
                onChange={(e) => setNumberOfPeriods(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              Payment frequency
              {ambiguousWarning("paymentFrequency")}
              <select
                name="paymentFrequency"
                value={paymentFrequency}
                onChange={(e) => setPaymentFrequency(e.target.value as Frequency)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semiannual">Semiannual</option>
                <option value="annual">Annual</option>
                <option value="biweekly">Biweekly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              Amortization
              {ambiguousWarning("amortizationType")}
              <select
                name="amortizationType"
                value={amortizationType}
                onChange={(e) => setAmortizationType(e.target.value as AmortizationType)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              >
                <option value="french">French</option>
                <option value="constant_amortization">Constant amortization</option>
                <option value="interest_only">Interest only</option>
              </select>
            </label>
            {category === "mortgage" ? (
              <>
                <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                  Rate type
                  {ambiguousWarning("rateType")}
                  <select
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value as MortgageRateType)}
                    className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="variable">Variable</option>
                    <option value="mixed">Mixed (fixed then variable)</option>
                  </select>
                </label>
                {(rateType === "fixed" || rateType === "mixed") ? (
                  <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                    Fixed rate (%)
                    {ambiguousWarning("fixedRate")}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={fixedRate}
                      onChange={(e) => setFixedRate(e.target.value)}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                ) : null}
                {(rateType === "variable" || rateType === "mixed") ? (
                  <>
                    <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                      Euribor rate (%)
                      {ambiguousWarning("euriborRate")}
                      <input
                        type="number"
                        step="0.01"
                        value={euriborRate}
                        onChange={(e) => setEuriborRate(e.target.value)}
                        className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                      Spread (%)
                      {ambiguousWarning("spread")}
                      <input
                        type="number"
                        step="0.01"
                        value={spread}
                        onChange={(e) => setSpread(e.target.value)}
                        className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                      />
                    </label>
                  </>
                ) : null}
                {rateType === "mixed" ? (
                  <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                    Fixed-rate periods
                    {ambiguousWarning("fixedRatePeriods")}
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={fixedRatePeriods}
                      onChange={(e) => setFixedRatePeriods(e.target.value)}
                      className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                    />
                  </label>
                ) : null}
              </>
            ) : (
              <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                {labels.rate} (%)
                {ambiguousWarning("fixedRate")}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={fixedRate}
                  onChange={(e) => setFixedRate(e.target.value)}
                  className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant md:col-span-2">
              {labels.sourceAccount}
              <select
                name="sourceAccountId"
                required
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary"
              >
                {accounts.length === 0 ? <option value="">-</option> : null}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
              </select>
              {selectedAccountCurrency && selectedAccountCurrency !== currency ? (
                <span className="text-label-sm text-status-warning">Source account currency differs from loan currency.</span>
              ) : null}
            </label>

            <input type="hidden" name="contractDocumentId" value={contractDocumentId} />
            <input type="hidden" name="rateType" value={category === "mortgage" ? rateType : "fixed"} />
            <input type="hidden" name="fixedRate" value={fixedRate} />
            <input type="hidden" name="euriborRate" value={euriborRate} />
            <input type="hidden" name="spread" value={spread} />
            <input type="hidden" name="fixedRatePeriods" value={fixedRatePeriods} />

            <div className="md:col-span-2 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="border border-outline-variant text-on-surface py-2 px-4 rounded-lg text-label-md"
              >
                Previous
              </button>
              <button
                type="submit"
                disabled={accounts.length === 0}
                className="bg-primary text-on-primary py-2 px-4 rounded-lg text-label-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {labels.saveLoan}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
