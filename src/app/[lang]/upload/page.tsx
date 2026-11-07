import { notFound } from "next/navigation";
import { SUPPORTED_LANGUAGES, type Language } from "../../../lib/i18n/locales.js";
import { getDictionary, type Dictionary } from "../../../lib/i18n/getDictionary.js";
import { listContractDocuments, getContractExtraction } from "../../../lib/services/contractsService.js";
import { getSettings } from "../../../lib/services/settingsService.js";
import { getAvailableAccountsForLoanSelect } from "../../../lib/services/loansPageService.js";
import { Badge, type BadgeTone } from "../../../components/ui/Badge.js";
import { UploadSubmitButton } from "../../../components/upload/UploadSubmitButton.js";
import { LiveRefresh } from "../../../components/ui/LiveRefresh.js";
import { moneyFromSerialized } from "../../../domain/shared/codecs.js";
import { formatMoney, formatDate } from "../../../lib/format.js";
import { isReadyForLoanCreation, type ContractExtraction } from "../../../domain/contracts/contract.js";
import { uploadContractAction } from "./actions.js";
import { createLoanFromContractAction } from "../loans/actions.js";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

const DOCUMENT_STATUS_TONE: Record<string, BadgeTone> = {
  uploaded: "neutral",
  extracting: "warning",
  extracted: "healthy",
  failed: "danger",
};

type ReviewField = "loanType" | "principal" | "term" | "rateType" | "amortizationType";
const REVIEW_FIELDS: { key: ReviewField; icon: string }[] = [
  { key: "loanType", icon: "category" },
  { key: "principal", icon: "payments" },
  { key: "term", icon: "calendar_month" },
  { key: "rateType", icon: "percent" },
  { key: "amortizationType", icon: "schedule" },
];

function fieldLabel(dict: Dictionary, key: ReviewField): string {
  const labels: Record<ReviewField, string> = {
    loanType: dict.upload.fieldLoanType,
    principal: dict.upload.fieldPrincipal,
    term: dict.upload.fieldTerm,
    rateType: dict.upload.fieldRateType,
    amortizationType: dict.upload.fieldAmortizationType,
  };
  return labels[key];
}

function fieldDisplayValue(extraction: ContractExtraction, key: ReviewField, lang: string): string {
  const field = extraction[key];
  if (field.value === null) return "—";
  if (key === "principal") return formatMoney(moneyFromSerialized(field.value as { minorUnits: string; currency: string }), lang);
  return String(field.value);
}

export default async function UploadPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const dict = getDictionary(lang);
  const [documents, settings, accounts] = await Promise.all([
    listContractDocuments(),
    getSettings(),
    getAvailableAccountsForLoanSelect(),
  ]);
  const boundAction = uploadContractAction.bind(null, lang);
  const boundCreateLoanFromContract = createLoanFromContractAction.bind(null, lang);

  // Most recently uploaded document (list is ordered by uploaded_at ascending).
  const mostRecent = documents[documents.length - 1];
  const mostRecentExtraction = mostRecent ? await getContractExtraction(mostRecent.id) : undefined;

  return (
    <div className="flex flex-col w-full">
      <LiveRefresh scope="upload" />
      <div className="w-full max-w-3xl">
        <div className="mb-stack-lg border-b border-on-surface pb-5">
          <h2 className="text-display-lg-mobile lg:text-display-lg text-on-background">{dict.upload.title}</h2>
          <p className="text-body-lg text-on-surface-variant mt-1 max-w-2xl">{dict.upload.description}</p>
        </div>

        {!settings.llmEnabled ? (
          <div className="mb-stack-md flex items-start gap-2 text-status-warning bg-status-warning/10 border border-status-warning rounded-lg px-4 py-3">
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              info
            </span>
            <p className="text-label-sm">{dict.upload.llmDisabledNotice}</p>
          </div>
        ) : null}

        <div className="bg-surface-container-lowest border border-outline-variant rounded-sm shadow-sm overflow-hidden">
          <form action={boundAction} className="p-8 md:p-12 flex flex-col items-center text-center gap-stack-md">
            <label
              htmlFor="contract-file"
              className="w-full border-2 border-dashed border-outline-variant hover:border-primary bg-surface rounded-sm p-12 transition-all cursor-pointer flex flex-col items-center gap-stack-md"
            >
              <span className="font-mono text-[28px] leading-none text-outline">↑ .pdf</span>
              <div>
                <p className="text-headline-sm text-on-surface mb-1">{dict.upload.dropHint}</p>
              </div>
              <input id="contract-file" type="file" name="file" accept="application/pdf" className="sr-only" required />
            </label>

            <div className="flex items-center gap-2 text-tertiary">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                lock
              </span>
              <span className="text-label-sm">{dict.upload.localBadge}</span>
            </div>

            <UploadSubmitButton label={dict.upload.selectFile} pendingLabel={dict.upload.uploading} />
          </form>
        </div>

        {mostRecent && mostRecentExtraction ? (
          <div className="mt-stack-lg bg-surface-container-lowest border border-outline-variant rounded-sm overflow-hidden">
            <div className="bg-surface-container-low border-b border-outline-variant px-6 py-4 flex items-center gap-3">
              <span aria-hidden className="w-2 h-2 bg-status-healthy" />
              <div>
                <h3 className="text-label-md text-on-surface font-semibold">{dict.upload.reviewTitle}</h3>
                <p className="eyebrow">{mostRecent.fileName}</p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-stack-md">
              {REVIEW_FIELDS.map(({ key, icon }) => {
                const field = mostRecentExtraction[key];
                const flagged = field.status === "ambiguous" || field.status === "missing";
                return (
                  <div
                    key={key}
                    className={`bg-surface border rounded-lg p-4 flex flex-col justify-between ${flagged ? "border-status-warning" : "border-outline-variant"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="eyebrow">{fieldLabel(dict, key)}</span>
                      <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: "16px" }}>
                        {icon}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-headline-md text-on-background">{fieldDisplayValue(mostRecentExtraction, key, lang)}</span>
                      {flagged ? (
                        <Badge tone={field.status === "missing" ? "danger" : "warning"}>
                          {field.status === "missing" ? dict.upload.statusMissing : dict.upload.statusAmbiguous}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <form action={boundCreateLoanFromContract} className="px-6 py-5 bg-surface-container-lowest border-t border-outline-variant flex flex-col gap-stack-md">
              <input type="hidden" name="contractDocumentId" value={mostRecent.id} />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
                <label className="flex flex-col gap-1 eyebrow">
                  {dict.loans.name}
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={mostRecent.fileName.replace(/\.pdf$/i, "")}
                    className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface text-on-surface"
                  />
                </label>
                <label className="flex flex-col gap-1 eyebrow">
                  {dict.loans.startDate}
                  <input
                    type="date"
                    name="startDate"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface text-on-surface"
                  />
                </label>
                <label className="flex flex-col gap-1 eyebrow">
                  {dict.loans.sourceAccount}
                  <select
                    name="sourceAccountId"
                    required
                    defaultValue={accounts[0]?.id ?? ""}
                    className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface text-on-surface"
                  >
                    {accounts.length === 0 ? <option value="">—</option> : null}
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Pre-filled extracted hidden/editable parameters */}
              <input
                type="hidden"
                name="category"
                value={
                  typeof mostRecentExtraction.loanType.value === "string" &&
                  ["mortgage", "auto", "personal", "consumer", "student"].includes(mostRecentExtraction.loanType.value)
                    ? mostRecentExtraction.loanType.value
                    : "other"
                }
              />
              <input
                type="hidden"
                name="principalAmount"
                value={
                  mostRecentExtraction.principal.value && typeof mostRecentExtraction.principal.value === "object"
                    ? (mostRecentExtraction.principal.value as { minorUnits: string }).minorUnits
                      ? (Number((mostRecentExtraction.principal.value as { minorUnits: string }).minorUnits) / 100).toString()
                      : "10000"
                    : "10000"
                }
              />
              <input
                type="hidden"
                name="currency"
                value={
                  mostRecentExtraction.principal.value && typeof mostRecentExtraction.principal.value === "object"
                    ? (mostRecentExtraction.principal.value as { currency: string }).currency ?? "EUR"
                    : "EUR"
                }
              />
              <input
                type="hidden"
                name="numberOfPeriods"
                value={
                  typeof mostRecentExtraction.term.value === "number" || typeof mostRecentExtraction.term.value === "string"
                    ? String(mostRecentExtraction.term.value)
                    : "12"
                }
              />
              <input type="hidden" name="rateType" value="fixed" />
              <input type="hidden" name="fixedRate" value="4" />
              <input type="hidden" name="euriborRate" value="2" />
              <input type="hidden" name="spread" value="1" />
              <input type="hidden" name="fixedRatePeriods" value="12" />
              <input type="hidden" name="paymentFrequency" value="monthly" />
              <input type="hidden" name="amortizationType" value="french" />

              <button
                type="submit"
                disabled={!isReadyForLoanCreation(mostRecentExtraction) || accounts.length === 0}
                className="bg-primary text-on-primary py-2.5 px-6 rounded-lg text-label-md font-medium shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  add_task
                </span>
                {dict.upload.confirmAdd}
              </button>
              <p className="text-label-sm text-on-surface-variant text-center">{dict.upload.confirmAddHelp}</p>
              {!isReadyForLoanCreation(mostRecentExtraction) ? (
                <p className="text-label-sm text-status-warning text-center">Review required fields before creating the loan.</p>
              ) : null}
              {accounts.length === 0 ? (
                <p className="text-label-sm text-status-warning text-center">Add an account first to assign a payment source.</p>
              ) : null}
            </form>
          </div>
        ) : null}

        <div className="mt-stack-lg w-full">
          <h3 className="text-headline-sm text-on-background mb-stack-md">{dict.upload.documents}</h3>
          {documents.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">{dict.upload.empty}</p>
          ) : (
            <div className="flex flex-col border-t border-on-surface divide-y divide-outline-variant">
              {[...documents].reverse().map((doc) => (
                <div
                  key={doc.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <span aria-hidden className="font-mono text-[11px] text-outline border border-outline-variant px-1 py-0.5">PDF</span>
                    <div>
                      <p className="text-label-md text-on-surface font-semibold">{doc.fileName}</p>
                      <p className="eyebrow">{formatDate(doc.uploadedAt.toString(), lang)}</p>
                      {doc.status === "extracting" && doc.chunkTotal && doc.chunkLabel ? (
                        <p className="text-label-sm text-primary mt-1">
                          {dict.upload.analyzingSection
                            .replace("{label}", doc.chunkLabel)
                            .replace("{current}", String((doc.chunkDone ?? 0) + 1))
                            .replace("{total}", String(doc.chunkTotal))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Badge tone={DOCUMENT_STATUS_TONE[doc.status] ?? "neutral"}>
                    {dict.upload.status[doc.status as keyof typeof dict.upload.status] ?? doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
