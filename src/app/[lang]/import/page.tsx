import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LANGUAGES, type Language } from "../../../lib/i18n/locales.js";
import { getDictionary, type Dictionary } from "../../../lib/i18n/getDictionary.js";
import { listAccounts } from "../../../lib/services/accountsService.js";
import { getSettings } from "../../../lib/services/settingsService.js";
import { getImport, getProposals, listImports } from "../../../lib/services/bankImportService.js";
import { getIncomeCategoryOptions } from "../../../lib/settings/typeOptions.js";
import { EXPENSE_CATEGORIES } from "../../../domain/expenses/expense.js";
import { formatDate, formatMoney } from "../../../lib/format.js";
import { Money } from "../../../engine/money/money.js";
import { merchantKey, displayLabel } from "../../../engine/bankImport/merchant.js";
import { type Proposal } from "../../../engine/bankImport/recurrence.js";
import { UploadSubmitButton } from "../../../components/upload/UploadSubmitButton.js";
import { FileDropZone } from "../../../components/upload/FileDropZone.js";
import { ProposalRow, type ProposalRowData } from "../../../components/import/ProposalRow.js";
import {
  importStatementAction,
  applyProposalsAction,
  dismissProposalAction,
  restoreProposalAction,
  deleteImportAction,
} from "./actions.js";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

type SearchParams = Record<string, string | string[] | undefined>;
const param = (sp: SearchParams, key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : undefined);

const SECTION_ORDER = ["income", "transfer", "recurring", "annual", "average", "known"] as const;
type Section = (typeof SECTION_ORDER)[number];

function sectionOf(p: Proposal): Section {
  if (p.status === "exists" || p.status === "covered_by_loan") return "known";
  if (p.kind === "income") return "income";
  if (p.kind === "transfer") return "transfer";
  if (p.source === "average") return "average";
  if (p.source === "annual" || p.source === "extra") return "annual";
  return "recurring";
}

const MAX_EVIDENCE = 24;

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const sp = await searchParams;
  const dict = getDictionary(lang);
  const t = dict.importer;
  const [accounts, settings, imports] = await Promise.all([listAccounts(), getSettings(), listImports()]);

  const importedId = param(sp, "imported");
  const imported = importedId ? await getImport(importedId) : undefined;
  const error = param(sp, "error");
  const applied = param(sp, "applied");

  const accountsWithImports = accounts.filter((a) => imports.some((i) => i.accountId === a.id));
  const selectedAccount =
    accounts.find((a) => a.id === param(sp, "account")) ?? accountsWithImports[0];
  const view = selectedAccount ? await getProposals(selectedAccount.id) : undefined;
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const loanName = new Map(Object.entries(view?.loanNames ?? {}));
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];

  const categoryLabel = (c: string) => (t.categories as Record<string, string>)[c] ?? c;
  const expenseCategories = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }));
  const incomeCategories = getIncomeCategoryOptions(settings).map((o) => ({ value: o.value, label: categoryLabel(o.value) }));
  const frequencies: Record<string, string> = {
    monthly: dict.wizards.freqMonthly,
    quarterly: dict.wizards.freqQuarterly,
    semiannual: dict.wizards.freqSemiannual,
    annual: dict.wizards.freqAnnual,
    biweekly: dict.wizards.freqBiweekly,
    weekly: dict.wizards.freqWeekly,
    daily: dict.wizards.freqDaily,
  };

  const rows: (ProposalRowData & { section: Section })[] = (view?.proposals ?? []).map((p, index) =>
    toRow(p, index, { lang, t, frequencies, categoryLabel, accountName, loanName }),
  );
  const boundImport = importStatementAction.bind(null, lang);
  const boundApply = applyProposalsAction.bind(null, lang);
  const boundDismiss = dismissProposalAction.bind(null, lang);
  const boundRestore = restoreProposalAction.bind(null, lang);
  const boundDeleteImport = deleteImportAction.bind(null, lang);
  const otherAccounts = accounts.filter((a) => a.id !== selectedAccount?.id).map((a) => ({ id: a.id, name: a.name }));
  const rowLabels = {
    include: t.include,
    kind: t.kind,
    kinds: t.kinds,
    amount: t.amount,
    frequency: t.frequency,
    frequencies,
    category: t.category,
    target: t.target,
    chooseAccount: t.chooseAccount,
    startDate: t.startDate,
    evidence: t.evidence,
    evidenceMore: t.evidenceMore,
    topCounterparties: t.topCounterparties,
    dismiss: t.dismiss,
  };

  return (
    <div className="flex flex-col gap-stack-lg w-full max-w-4xl">
      <div className="page-head border-b border-on-surface pb-5">
        <h1 className="text-display-lg-mobile md:text-display-lg text-on-surface">{t.title}</h1>
        <p className="text-body-lg text-on-surface-variant mt-stack-sm max-w-2xl">{t.subtitle}</p>
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 text-status-danger bg-status-danger/10 border border-status-danger rounded-lg px-4 py-3">
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>error</span>
          <p className="text-label-md">{(t.errors as Record<string, string>)[error] ?? t.errors.generic}</p>
        </div>
      ) : null}

      {imported ? <ImportResultBanner record={imported} balanceUpdated={param(sp, "balance") === "1"} lang={lang} t={t} accountName={accountName} /> : null}

      {applied !== undefined ? (
        <div role="status" className="flex items-start gap-2 text-status-healthy bg-status-healthy/10 border border-status-healthy rounded-lg px-4 py-3">
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>task_alt</span>
          <p className="text-label-md">
            {t.appliedNotice.replace("{count}", applied)}{" "}
            <Link href={`/${lang}/loans`} className="underline">{dict.nav.loans}</Link> ·{" "}
            <Link href={`/${lang}/accounts`} className="underline">{dict.nav.accounts}</Link>
          </p>
        </div>
      ) : null}

      <section className="bg-surface-container-lowest border border-outline-variant rounded-sm">
        <form action={boundImport} className="p-6 md:p-8 flex flex-col gap-stack-md">
          <FileDropZone
            id="statement-file"
            name="file"
            accept=".csv,text/csv"
            extensions={[".csv"]}
            badge="↑ .csv"
            note={t.supportedBanks}
            required
            labels={{ title: t.dropHint, hint: t.dropOr, dropHere: t.dropHere, selected: t.fileSelected, wrongType: t.wrongType }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md items-end">
            <label className="flex flex-col gap-1 eyebrow">
              {t.accountLabel}
              <select
                name="accountId"
                defaultValue=""
                className="border border-outline-variant rounded-lg px-3 py-2 text-body-md bg-surface text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">{t.accountAuto.replace("{name}", defaultAccount?.name ?? "—")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-label-md text-on-surface">
              <input type="checkbox" name="updateBalance" defaultChecked className="w-4 h-4 accent-primary" />
              {t.updateBalance}
            </label>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-stack-sm">
            <span className="flex items-center gap-2 text-tertiary text-label-sm">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>lock</span>
              {t.localBadge}
            </span>
            <UploadSubmitButton label={t.importButton} pendingLabel={t.importing} />
          </div>
        </form>
      </section>

      {accountsWithImports.length > 1 ? (
        <nav aria-label={t.proposalsFor} className="flex flex-wrap gap-2">
          {accountsWithImports.map((a) => (
            <Link
              key={a.id}
              href={`/${lang}/import?account=${encodeURIComponent(a.id)}`}
              aria-current={a.id === selectedAccount?.id ? "page" : undefined}
              className={`text-label-md px-3 py-1.5 rounded-sm border ${a.id === selectedAccount?.id ? "border-primary text-primary" : "border-outline-variant text-on-surface-variant hover:text-on-surface"}`}
            >
              {a.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {selectedAccount && view && view.transactionCount > 0 ? (
        <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-4 md:p-6 flex flex-col gap-stack-md">
          <div>
            <h2 className="text-headline-sm text-on-surface">
              {t.proposalsTitle} · {selectedAccount.name}
            </h2>
            <p className="text-body-md text-on-surface-variant mt-1">
              {t.basedOn
                .replace("{count}", String(view.transactionCount))
                .replace("{start}", view.historyStart ? formatDate(view.historyStart, lang) : "—")
                .replace("{end}", view.asOf ? formatDate(view.asOf, lang) : "—")}
            </p>
            <p className="text-label-sm text-on-surface-variant mt-1">{t.howItWorks}</p>
          </div>

          {view.unmatchedExisting.length > 0 ? (
            <div className="border border-status-warning bg-status-warning/10 rounded-lg px-4 py-3">
              <p className="text-label-md text-status-warning font-semibold">{t.unmatchedTitle}</p>
              <ul className="mt-1 text-body-md text-on-surface list-disc pl-5">
                {view.unmatchedExisting.map((item) => (
                  <li key={item.id}>
                    {t.kinds[item.kind]} · {categoryLabel(item.category)} · {formatMoney(item.amount, lang)} · {frequencies[item.frequency] ?? item.frequency}
                  </li>
                ))}
              </ul>
              <p className="text-label-sm text-on-surface-variant mt-1">{t.unmatchedHelp}</p>
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">{t.noProposals}</p>
          ) : (
            <form action={boundApply} className="flex flex-col gap-stack-md">
              <input type="hidden" name="accountId" value={selectedAccount.id} />
              {SECTION_ORDER.map((section) => {
                const sectionRows = rows.filter((r) => r.section === section);
                if (sectionRows.length === 0) return null;
                return (
                  <div key={section}>
                    <h3 className="eyebrow border-b border-outline-variant pb-1">
                      {t.sections[section]} <span className="font-mono">({sectionRows.length})</span>
                    </h3>
                    <ul className="divide-y divide-outline-variant">
                      {sectionRows.map((row) => (
                        <ProposalRow
                          key={row.key}
                          row={row}
                          accounts={otherAccounts}
                          expenseCategories={expenseCategories}
                          incomeCategories={incomeCategories}
                          labels={rowLabels}
                          dismissAction={boundDismiss}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-stack-sm border-t border-outline-variant pt-stack-md">
                <p className="text-label-sm text-on-surface-variant">{t.applyHelp}</p>
                <button type="submit" className="bg-primary text-on-primary py-2.5 px-6 rounded-lg text-label-md font-medium shadow-sm hover:opacity-90">
                  {t.apply}
                </button>
              </div>
            </form>
          )}

          {view.acceptedCount > 0 ? <p className="text-label-sm text-on-surface-variant">{t.acceptedNote.replace("{count}", String(view.acceptedCount))}</p> : null}

          {view.dismissed.length > 0 ? (
            <details className="text-body-md">
              <summary className="cursor-pointer text-label-md text-on-surface-variant hover:text-on-surface">
                {t.dismissedTitle.replace("{count}", String(view.dismissed.length))}
              </summary>
              <ul className="mt-2 divide-y divide-outline-variant">
                {view.dismissed.map((p) => (
                  <li key={p.key} className="py-2 flex items-center justify-between gap-4">
                    <span className="text-on-surface-variant">
                      {proposalTitle(p, t, categoryLabel)} · {formatMoney(p.amount, lang)} · {frequencies[p.frequency] ?? p.frequency}
                    </span>
                    <form action={boundRestore}>
                      <input type="hidden" name="accountId" value={selectedAccount.id} />
                      <input type="hidden" name="restoreKey" value={p.key} />
                      <button type="submit" className="text-label-sm text-primary hover:underline">{t.restore}</button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : (
        <p className="text-body-md text-on-surface-variant">{t.noImports}</p>
      )}

      {imports.length > 0 ? (
        <section>
          <h2 className="text-headline-sm text-on-surface mb-stack-md">{t.importsTitle}</h2>
          <ul className="flex flex-col border-t border-on-surface divide-y divide-outline-variant">
            {imports.map((record) => (
              <li key={record.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-label-md text-on-surface font-semibold truncate">{record.fileName}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {accountName.get(record.accountId) ?? record.accountId} ·{" "}
                    {t.importRow
                      .replace("{rows}", String(record.rowCount))
                      .replace("{new}", String(record.newRowCount))
                      .replace("{start}", record.periodStart ? formatDate(record.periodStart, lang) : "—")
                      .replace("{end}", record.periodEnd ? formatDate(record.periodEnd, lang) : "—")}
                    {" · "}
                    {formatDate(record.importedAt.slice(0, 10), lang)}
                  </p>
                </div>
                <form action={boundDeleteImport}>
                  <input type="hidden" name="importId" value={record.id} />
                  <input type="hidden" name="accountId" value={selectedAccount?.id ?? ""} />
                  <button
                    type="submit"
                    title={t.deleteImport}
                    aria-label={`${t.deleteImport}: ${record.fileName}`}
                    className="w-8 h-8 rounded-sm border border-outline-variant text-on-surface-variant hover:text-status-danger hover:border-status-danger transition-colors flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

type ImporterDict = Dictionary["importer"];

function proposalTitle(p: Proposal, t: ImporterDict, categoryLabel: (c: string) => string): string {
  if (p.source === "average" && p.kind === "expense") return t.averageLabel.replace("{category}", categoryLabel(p.category));
  if (p.source === "average" && p.kind === "transfer") return t.averageTransferLabel.replace("{name}", p.label);
  if (p.source === "extra") return t.extraLabel.replace("{name}", p.label);
  return p.label;
}

function toRow(
  p: Proposal,
  index: number,
  ctx: {
    lang: string;
    t: ImporterDict;
    frequencies: Record<string, string>;
    categoryLabel: (c: string) => string;
    accountName: Map<string, string>;
    loanName: Map<string, string>;
  },
): ProposalRowData & { section: Section } {
  const { lang, t } = ctx;
  const badges: ProposalRowData["badges"] = [];
  if (p.status === "covered_by_loan") {
    badges.push({ tone: "healthy", text: t.statusLoan.replace("{name}", ctx.loanName.get(p.matchId ?? "") ?? "") });
  } else if (p.status === "exists") {
    badges.push({ tone: "healthy", text: t.statusExists });
  } else if (p.status === "update" && p.matchAmount) {
    badges.push({ tone: "warning", text: t.statusUpdate.replace("{amount}", formatMoney(p.matchAmount, lang)) });
  }
  badges.push({ tone: p.confidence === "high" ? "healthy" : p.confidence === "medium" ? "neutral" : "warning", text: t.confidence[p.confidence] });
  if (p.variableAmount) badges.push({ tone: "neutral", text: t.variable });
  if (p.replaces) badges.push({ tone: "neutral", text: t.replaces.replace("{name}", p.replaces) });

  const subtitleParts = [
    `${formatMoney(p.amount, lang)} · ${ctx.frequencies[p.frequency] ?? p.frequency}`,
    p.kind === "transfer" && p.toAccountId ? `→ ${ctx.accountName.get(p.toAccountId) ?? ""}` : "",
    p.monthsCovered ? t.averageMonths.replace("{months}", String(p.monthsCovered)) : `${formatDate(p.firstDate.toString(), lang)} – ${formatDate(p.lastDate.toString(), lang)}`,
  ];

  const occurrences = [...p.occurrences].reverse();
  let topCounterparties: ProposalRowData["topCounterparties"];
  if (p.source === "average") {
    const totals = new Map<string, { total: Money; names: string[] }>();
    for (const o of p.occurrences) {
      const key = merchantKey(o.description);
      const entry = totals.get(key) ?? { total: Money.zero(o.amount.currency), names: [] };
      entry.total = entry.total.add(o.amount);
      entry.names.push(o.description);
      totals.set(key, entry);
    }
    topCounterparties = [...totals.values()]
      .sort((a, b) => b.total.compare(a.total))
      .slice(0, 8)
      .map((e) => ({ label: displayLabel(e.names), total: formatMoney(e.total, lang) }));
  }

  const locked = p.status === "exists" || p.status === "covered_by_loan";
  return {
    section: sectionOf(p),
    index,
    key: p.key,
    kind: p.kind,
    credit: p.kind === "income",
    title: proposalTitle(p, t, ctx.categoryLabel),
    subtitle: subtitleParts.filter(Boolean).join(" · "),
    amount: p.amount.toDecimalString(),
    frequency: p.frequency,
    category: p.category,
    startDate: p.startDate.toString(),
    ...(p.toAccountId ? { toAccountId: p.toAccountId } : {}),
    ...(p.status === "update" && p.matchId ? { updateId: p.matchId } : {}),
    defaultChecked: !locked && p.confidence !== "low" && (p.kind !== "transfer" || p.toAccountId !== undefined),
    locked,
    badges,
    evidence: occurrences.slice(0, MAX_EVIDENCE).map((o) => ({
      date: formatDate(o.date.toString(), lang),
      amount: formatMoney(o.amount, lang),
      description: o.description,
    })),
    evidenceMore: Math.max(0, occurrences.length - MAX_EVIDENCE),
    ...(topCounterparties ? { topCounterparties } : {}),
  };
}

function ImportResultBanner({
  record,
  balanceUpdated,
  lang,
  t,
  accountName,
}: {
  record: NonNullable<Awaited<ReturnType<typeof getImport>>>;
  balanceUpdated: boolean;
  lang: string;
  t: ImporterDict;
  accountName: Map<string, string>;
}) {
  const closing = record.closingBalanceMinorUnits ? Money.fromMinorUnits(BigInt(record.closingBalanceMinorUnits), record.currency) : undefined;
  return (
    <div role="status" className="border border-outline-variant bg-surface-container-low rounded-lg px-4 py-3 text-body-md text-on-surface flex flex-col gap-1">
      <p className="text-label-md font-semibold">{t.resultTitle.replace("{file}", record.fileName)}</p>
      <p>
        {t.resultRows
          .replace("{rows}", String(record.rowCount))
          .replace("{new}", String(record.newRowCount))
          .replace("{dup}", String(record.rowCount - record.newRowCount))}{" "}
        {record.periodStart && record.periodEnd
          ? t.resultPeriod.replace("{start}", formatDate(record.periodStart, lang)).replace("{end}", formatDate(record.periodEnd, lang))
          : null}
      </p>
      <p>
        {balanceUpdated && closing
          ? t.resultBalanceUpdated.replace("{account}", accountName.get(record.accountId) ?? "").replace("{balance}", formatMoney(closing, lang))
          : t.resultBalanceUnchanged}
      </p>
      <p className={record.balanceCheckOk ? "text-status-healthy" : "text-status-warning"}>
        {record.balanceCheckOk ? t.resultCheckOk : t.resultCheckFailed}
      </p>
    </div>
  );
}
