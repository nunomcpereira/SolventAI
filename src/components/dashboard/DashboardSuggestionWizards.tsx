"use client";

import { useState } from "react";
import { type LoanContractDraftState } from "../../lib/forms/loanForm.js";
import { type Dictionary } from "../../lib/i18n/getDictionary.js";
import { useLoanDraftWizard } from "../loans/useLoanDraftWizard.js";

type WizardLabels = Dictionary["wizards"];

interface AccountOption {
  id: string;
  name: string;
  currency: string;
}

interface TypeOption {
  value: string;
  label: string;
}

interface WizardActions {
  createAccount: (formData: FormData) => Promise<void>;
  createLoan: (formData: FormData) => Promise<void>;
  createScenario: (formData: FormData) => Promise<void>;
  extractLoanFromContract: (
    state: LoanContractDraftState,
    formData: FormData,
  ) => Promise<LoanContractDraftState>;
}

export function DashboardSuggestionWizards({
  actions,
  accountTypeOptions,
  loanCategoryOptions,
  accounts,
  defaultCurrency,
  labels,
}: {
  actions: WizardActions;
  accountTypeOptions: TypeOption[];
  loanCategoryOptions: TypeOption[];
  accounts: AccountOption[];
  defaultCurrency: string;
  labels: WizardLabels;
}) {
  const [activeWizard, setActiveWizard] = useState<"account" | "loan" | "scenario" | null>(null);

  return (
    <section>
      <div className="border-b border-on-surface pb-2">
        <h3 className="text-headline-sm text-on-surface">{labels.suggestionsTitle}</h3>
      </div>

      <p className="text-body-sm text-on-surface-variant mt-3 mb-4">{labels.suggestionsSubtitle}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 border-y border-outline-variant divide-y md:divide-y-0 md:divide-x divide-outline-variant mb-5">
        <button
          type="button"
          onClick={() => setActiveWizard("account")}
          className="group text-left py-4 md:px-5 md:first:pl-0 hover:bg-surface-container-low transition-colors"
        >
          <p className="text-label-md text-on-surface font-medium flex items-baseline gap-2"><span className="font-mono text-[11px] text-primary">→</span><span className="group-hover:underline underline-offset-4 decoration-1">{labels.createAccountTitle}</span></p>
          <p className="text-label-sm text-on-surface-variant mt-1 pl-5">{labels.createAccountDesc}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveWizard("loan")}
          className="group text-left py-4 md:px-5 md:first:pl-0 hover:bg-surface-container-low transition-colors"
        >
          <p className="text-label-md text-on-surface font-medium flex items-baseline gap-2"><span className="font-mono text-[11px] text-primary">→</span><span className="group-hover:underline underline-offset-4 decoration-1">{labels.createLoanTitle}</span></p>
          <p className="text-label-sm text-on-surface-variant mt-1 pl-5">{labels.createLoanDesc}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveWizard("scenario")}
          className="group text-left py-4 md:px-5 md:first:pl-0 hover:bg-surface-container-low transition-colors"
        >
          <p className="text-label-md text-on-surface font-medium flex items-baseline gap-2"><span className="font-mono text-[11px] text-primary">→</span><span className="group-hover:underline underline-offset-4 decoration-1">{labels.createScenarioTitle}</span></p>
          <p className="text-label-sm text-on-surface-variant mt-1 pl-5">{labels.createScenarioDesc}</p>
        </button>
      </div>

      {activeWizard === "account" ? (
        <AccountWizard
          createAction={actions.createAccount}
          defaultCurrency={defaultCurrency}
          accountTypeOptions={accountTypeOptions}
          labels={labels}
          onClose={() => setActiveWizard(null)}
        />
      ) : null}

      {activeWizard === "loan" ? (
        <LoanWizard
          createAction={actions.createLoan}
          extractAction={actions.extractLoanFromContract}
          defaultCurrency={defaultCurrency}
          loanCategoryOptions={loanCategoryOptions}
          accounts={accounts}
          labels={labels}
          onClose={() => setActiveWizard(null)}
        />
      ) : null}

      {activeWizard === "scenario" ? (
        <ScenarioWizard createAction={actions.createScenario} labels={labels} onClose={() => setActiveWizard(null)} />
      ) : null}
    </section>
  );
}

function AccountWizard({
  createAction,
  defaultCurrency,
  accountTypeOptions,
  labels,
  onClose,
}: {
  createAction: (formData: FormData) => Promise<void>;
  defaultCurrency: string;
  accountTypeOptions: TypeOption[];
  labels: WizardLabels;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Main Account");
  const [type, setType] = useState("checking");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [balance, setBalance] = useState("0");
  const [minimumReserve, setMinimumReserve] = useState("0");

  return (
    <form action={createAction} className="rounded-sm border border-outline-variant bg-surface-container-low p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-label-md text-on-surface font-semibold">{labels.accountWizardTitle}</h4>
        <button type="button" onClick={onClose} className="text-label-sm text-on-surface-variant">
          {labels.close}
        </button>
      </div>

      {step === 1 ? (
        <>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.accountName}
            <input value={name} onChange={(e) => setName(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.accountType}
            <select value={type} onChange={(e) => setType(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface">
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.currency}
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <div className="flex justify-end">
            <button type="button" onClick={() => setStep(2)} className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">
              {labels.next}
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.openingBalance}
            <input value={balance} onChange={(e) => setBalance(e.target.value)} type="number" step="0.01" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.minimumReserve}
            <input value={minimumReserve} onChange={(e) => setMinimumReserve(e.target.value)} type="number" step="0.01" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
            <input type="checkbox" checked readOnly name="active" /> {labels.active}
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="text-label-md text-on-surface-variant">
              {labels.back}
            </button>
            <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">
              {labels.createAccountBtn}
            </button>
          </div>
        </>
      ) : null}

      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="balance" value={balance} />
      <input type="hidden" name="minimumReserve" value={minimumReserve} />
      <input type="hidden" name="active" value="on" />
    </form>
  );
}

function LoanWizard({
  createAction,
  extractAction,
  loanCategoryOptions,
  accounts,
  defaultCurrency,
  labels,
  onClose,
}: {
  createAction: (formData: FormData) => Promise<void>;
  extractAction: (
    state: LoanContractDraftState,
    formData: FormData,
  ) => Promise<LoanContractDraftState>;
  loanCategoryOptions: TypeOption[];
  accounts: AccountOption[];
  defaultCurrency: string;
  labels: WizardLabels;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);

  const extractionSteps = [labels.extractionStep1, labels.extractionStep2, labels.extractionStep3, labels.extractionStep4] as const;

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
    draft: extractionState,
    extractFormAction: extractLoanFormAction,
    isExtracting,
    extractionStepIndex,
    selectedAccountCurrency,
  } = useLoanDraftWizard(extractAction, accounts, defaultCurrency, extractionSteps, labels.ambiguousFieldWarning);

  if (accounts.length === 0) {
    return (
      <div className="rounded-sm border border-outline-variant bg-surface-container-low p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-label-md text-on-surface font-semibold">{labels.loanWizardTitle}</h4>
          <button type="button" onClick={onClose} className="text-label-sm text-on-surface-variant">{labels.close}</button>
        </div>
        <p className="text-body-md text-on-surface-variant">{labels.needAccountFirst}</p>
      </div>
    );
  }

  return (
    <form action={createAction} className="rounded-sm border border-outline-variant bg-surface-container-low p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-label-md text-on-surface font-semibold">{labels.loanWizardTitle}</h4>
        <button type="button" onClick={onClose} className="text-label-sm text-on-surface-variant">{labels.close}</button>
      </div>

      {step === 1 ? (
        <>
          <div className="rounded-lg border border-outline-variant bg-surface p-3 flex flex-col gap-2">
            <p className="text-label-md text-on-surface">{labels.startFromContract}</p>
            <p className="text-label-sm text-on-surface-variant">{labels.uploadDesc}</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                type="file"
                name="file"
                accept="application/pdf"
                className="block w-full text-label-sm text-on-surface-variant file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-on-primary"
              />
              <button
                type="submit"
                formAction={extractLoanFormAction}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md whitespace-nowrap disabled:opacity-60"
                disabled={isExtracting}
              >
                {isExtracting ? labels.extracting : labels.uploadAndExtract}
              </button>
            </div>
            {isExtracting ? (
              <p className="text-label-sm text-on-surface-variant flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                {extractionSteps[extractionStepIndex]}
              </p>
            ) : null}
            {extractionState.message ? (
              <p className={
                extractionState.status === "error"
                  ? "text-label-sm text-status-danger"
                  : "text-label-sm text-status-success"
              }>
                {extractionState.message}
              </p>
            ) : null}
          </div>

          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.loanName}
            <input value={name} onChange={(e) => setName(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.category}
            {ambiguousWarning("category")}
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface">
              {loanCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.principalAmount}
            {ambiguousWarning("principalAmount")}
            <input value={principalAmount} onChange={(e) => setPrincipalAmount(e.target.value)} type="number" min="0" step="0.01" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.currency}
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <div className="flex justify-end">
            <button type="button" onClick={() => setStep(2)} className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">{labels.next}</button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.startDate}
            {ambiguousWarning("startDate")}
            <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.numberOfPeriods}
            {ambiguousWarning("numberOfPeriods")}
            <input value={numberOfPeriods} onChange={(e) => setNumberOfPeriods(e.target.value)} type="number" min="1" step="1" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.paymentFrequency}
            {ambiguousWarning("paymentFrequency")}
            <select value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface">
              <option value="monthly">{labels.freqMonthly}</option>
              <option value="quarterly">{labels.freqQuarterly}</option>
              <option value="semiannual">{labels.freqSemiannual}</option>
              <option value="annual">{labels.freqAnnual}</option>
              <option value="biweekly">{labels.freqBiweekly}</option>
              <option value="weekly">{labels.freqWeekly}</option>
              <option value="daily">{labels.freqDaily}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.amortization}
            {ambiguousWarning("amortizationType")}
            <select value={amortizationType} onChange={(e) => setAmortizationType(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface">
              <option value="french">{labels.amortFrench}</option>
              <option value="constant_amortization">{labels.amortConstant}</option>
              <option value="interest_only">{labels.amortInterestOnly}</option>
            </select>
          </label>
          {category === "mortgage" ? (
            <>
              <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                {labels.rateType}
                {ambiguousWarning("rateType")}
                <select value={rateType} onChange={(e) => setRateType(e.target.value as "fixed" | "variable" | "mixed")} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface">
                  <option value="fixed">{labels.rateFixed}</option>
                  <option value="variable">{labels.rateVariable}</option>
                  <option value="mixed">{labels.rateMixed}</option>
                </select>
              </label>
              {(rateType === "fixed" || rateType === "mixed") ? (
                <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                  {labels.fixedRate}
                  {ambiguousWarning("fixedRate")}
                  <input value={fixedRate} onChange={(e) => setFixedRate(e.target.value)} type="number" min="0" step="0.01" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
                </label>
              ) : null}
              {(rateType === "variable" || rateType === "mixed") ? (
                <>
                  <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                    {labels.euriborRate}
                    {ambiguousWarning("euriborRate")}
                    <input value={euriborRate} onChange={(e) => setEuriborRate(e.target.value)} type="number" step="0.01" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
                  </label>
                  <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                    {labels.spread}
                    {ambiguousWarning("spread")}
                    <input value={spread} onChange={(e) => setSpread(e.target.value)} type="number" step="0.01" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
                  </label>
                </>
              ) : null}
              {rateType === "mixed" ? (
                <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                  {labels.fixedRatePeriods}
                  {ambiguousWarning("fixedRatePeriods")}
                  <input value={fixedRatePeriods} onChange={(e) => setFixedRatePeriods(e.target.value)} type="number" min="1" step="1" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
                </label>
              ) : null}
            </>
          ) : (
            <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
              {labels.fixedRate}
              {ambiguousWarning("fixedRate")}
              <input value={fixedRate} onChange={(e) => setFixedRate(e.target.value)} type="number" min="0" step="0.01" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
            </label>
          )}
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.sourceAccount}
            <select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface">
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>
              ))}
            </select>
            {selectedAccountCurrency && selectedAccountCurrency !== currency ? (
              <span className="text-label-sm text-status-warning">{labels.currencyMismatch}</span>
            ) : null}
          </label>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="text-label-md text-on-surface-variant">{labels.back}</button>
            <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">{labels.createLoanBtn}</button>
          </div>
        </>
      ) : null}

      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="principalAmount" value={principalAmount} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="numberOfPeriods" value={numberOfPeriods} />
      <input type="hidden" name="paymentFrequency" value={paymentFrequency} />
      <input type="hidden" name="amortizationType" value={amortizationType} />
      <input type="hidden" name="rateType" value={category === "mortgage" ? rateType : "fixed"} />
      <input type="hidden" name="fixedRate" value={fixedRate} />
      <input type="hidden" name="euriborRate" value={euriborRate} />
      <input type="hidden" name="spread" value={spread} />
      <input type="hidden" name="fixedRatePeriods" value={fixedRatePeriods} />
      <input type="hidden" name="sourceAccountId" value={sourceAccountId} />
      <input type="hidden" name="contractDocumentId" value={contractDocumentId} />
    </form>
  );
}

function ScenarioWizard({
  createAction,
  labels,
  onClose,
}: {
  createAction: (formData: FormData) => Promise<void>;
  labels: WizardLabels;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Aggressive Paydown '26");

  return (
    <form action={createAction} className="rounded-sm border border-outline-variant bg-surface-container-low p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-label-md text-on-surface font-semibold">{labels.scenarioWizardTitle}</h4>
        <button type="button" onClick={onClose} className="text-label-sm text-on-surface-variant">{labels.close}</button>
      </div>

      {step === 1 ? (
        <>
          <label className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
            {labels.scenarioName}
            <input value={name} onChange={(e) => setName(e.target.value)} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface" />
          </label>
          <div className="flex justify-end">
            <button type="button" onClick={() => setStep(2)} className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">{labels.next}</button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="rounded-lg border border-outline-variant p-3 bg-surface">
            <p className="text-label-sm text-on-surface-variant">{labels.review}</p>
            <p className="text-body-md text-on-surface mt-1">{labels.scenarioLabel}: {name}</p>
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="text-label-md text-on-surface-variant">{labels.back}</button>
            <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md">{labels.createScenarioBtn}</button>
          </div>
        </>
      ) : null}

      <input type="hidden" name="name" value={name} />
    </form>
  );
}
