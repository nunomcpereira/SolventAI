import type { Dictionary } from "../i18n/getDictionary.js";
import { Money } from "../../engine/money/money.js";
import { formatDate, formatMoney } from "../format.js";
import { type AuditEvent } from "./auditLog.js";

/** Lookups for ids that appear in snapshots (account ids, loan ids), by id. */
export interface AuditNames {
  accounts: ReadonlyMap<string, string>;
  loans: ReadonlyMap<string, string>;
}

type Dict = Pick<Dictionary, "audit" | "simulation" | "wizards" | "settings">;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isMoney = (v: unknown): v is { minorUnits: string; currency: string } =>
  isObject(v) && typeof v["minorUnits"] === "string" && typeof v["currency"] === "string";

/** Snapshot keys whose decimal-string values are annual rates (0.03016 -> 3.016%). */
const RATE_KEYS = new Set(["annualRate", "fixedAnnualRate", "currentIndexRate", "spread", "rateCap", "rateFloor", "rate", "newAnnualValue", "percentage"]);
/** Snapshot keys that hold an account id / loan id. */
const ACCOUNT_KEYS = new Set(["accountId", "sourceAccountId", "fromAccountId", "toAccountId"]);
const LOAN_KEYS = new Set(["loanId"]);

const FREQUENCY_KEYS: Record<string, keyof Dictionary["wizards"]> = {
  daily: "freqDaily",
  weekly: "freqWeekly",
  biweekly: "freqBiweekly",
  monthly: "freqMonthly",
  quarterly: "freqQuarterly",
  semiannual: "freqSemiannual",
  annual: "freqAnnual",
};

/** Enum values with an existing translation, per snapshot key. */
function enumLabel(key: string, value: string, dict: Dict): string | undefined {
  const w = dict.wizards;
  const st = dict.settings;
  const byKey: Record<string, Record<string, string>> = {
    roundingMode: { "half-up": st.roundingHalfUp, "half-even": st.roundingHalfEven, down: st.roundingDown, up: st.roundingUp },
    amortizationType: { french: w.amortFrench, constant_amortization: w.amortConstant, interest_only: w.amortInterestOnly },
    type: { fixed: w.rateFixed, variable: w.rateVariable, mixed: w.rateMixed },
  };
  const direct = byKey[key]?.[value];
  if (direct) return direct;
  // Account "type" and loan "type"/"category" values share keys with other enums; fall back to
  // the configured type names when the value is one of them.
  if (key === "type" || key === "category") {
    const accountNames = st.accountTypeNames as Record<string, string>;
    const loanNames = st.loanTypeNames as Record<string, string>;
    return accountNames[value] ?? loanNames[value];
  }
  return undefined;
}

const lastKey = (path: string) => path.replace(/\[[^\]]*\]$/, "").split(".").pop() ?? path;

export function formatMoneyValue(value: { minorUnits: string; currency: string }, lang: string): string {
  return formatMoney(Money.fromMinorUnits(BigInt(value.minorUnits), value.currency), lang);
}

/** "0.03016" -> "3.016%" without float noise. */
export function formatRate(decimal: string): string {
  const n = Number(decimal);
  if (!Number.isFinite(n)) return decimal;
  return `${Number((n * 100).toFixed(4))}%`;
}

/** Label for a changed field path, e.g. "rate.currentIndexRate" -> "Index rate (e.g. Euribor)". */
export function fieldLabel(path: string, dict: Dict): string {
  const fields = dict.audit.fields as Record<string, string>;
  const clean = path.replace(/\[[^\]]*\]/g, "");
  const parts = clean.split(".");
  for (let i = parts.length; i > 0; i -= 1) {
    const label = fields[parts.slice(0, i).join("_")];
    if (label) {
      const rest = parts.slice(i).join(" ");
      return rest ? `${label} · ${rest}` : label;
    }
  }
  return clean.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function eventTypeLabel(type: string, dict: Dict): string {
  const sim = dict.simulation;
  const labels: Record<string, string> = {
    one_time_expense: sim.oneTimeExpense,
    one_time_income: sim.oneTimeIncome,
    income_change: sim.incomeChange,
    expense_change: sim.expenseChange,
    prepayment: sim.prepayment,
    rate_change: sim.rateChange,
    balance_override: dict.audit.eventBalanceOverride,
    account_transfer: dict.audit.eventAccountTransfer,
  };
  return labels[type] ?? type;
}

/** Display text for one value of a changed field. */
export function formatAuditValue(path: string, value: unknown, lang: string, dict: Dict, names: AuditNames): string {
  if (value === undefined || value === null || value === "") return "—";
  const key = lastKey(path);
  if (isMoney(value)) return formatMoneyValue(value, lang);
  if (typeof value === "boolean") return value ? dict.audit.yes : dict.audit.no;
  if (typeof value === "string") {
    if (RATE_KEYS.has(key)) return formatRate(value);
    if (ACCOUNT_KEYS.has(key)) return names.accounts.get(value) ?? value;
    if (LOAN_KEYS.has(key)) return names.loans.get(value) ?? value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value, lang);
    const translated = enumLabel(key, value, dict);
    if (translated) return translated;
    const freq = FREQUENCY_KEYS[value];
    if (freq && /frequency/i.test(key)) return String(dict.wizards[freq]);
    return value;
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length === 0 ? "—" : value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
  if (isObject(value)) {
    // Scenario event: "Jan 01, 2027 · One-time expense · €1,000.00 · CGD"
    const payload = value["payload"];
    if (isObject(payload) && typeof payload["type"] === "string") {
      const parts = [
        typeof value["date"] === "string" ? formatDate(value["date"], lang) : "",
        eventTypeLabel(payload["type"], dict),
        ...["amount", "newAmount", "newBalance"].filter((k) => isMoney(payload[k])).map((k) => formatMoneyValue(payload[k] as never, lang)),
        typeof payload["newAnnualValue"] === "string" ? formatRate(payload["newAnnualValue"]) : "",
        ...["accountId", "fromAccountId", "toAccountId"].map((k) => (typeof payload[k] === "string" ? names.accounts.get(payload[k]) ?? "" : "")),
        typeof payload["loanId"] === "string" ? names.loans.get(payload["loanId"]) ?? "" : "",
        typeof payload["description"] === "string" ? payload["description"] : "",
      ];
      return parts.filter(Boolean).join(" · ");
    }
    // Loan fee: "Origination · €500.00"
    if (typeof value["description"] === "string" && isMoney(value["amount"])) {
      return `${value["description"]} · ${formatMoneyValue(value["amount"], lang)}`;
    }
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(", ");
  }
  return String(value);
}

/** Human name of the changed entity, e.g. "CGD taxa fixa 3 anos 3%" or "Salary (Caixa Geral Depositos)". */
export function entityName(event: AuditEvent, dict: Dict, names: AuditNames): string {
  if (event.entityType === "settings") return dict.audit.settingsEntity;
  const snap = isObject(event.snapshot) ? event.snapshot : {};
  if (typeof snap["name"] === "string") return snap["name"];
  const category = typeof snap["category"] === "string" ? snap["category"].replace(/_/g, " ") : "";
  const account = typeof snap["accountId"] === "string" ? names.accounts.get(snap["accountId"]) : undefined;
  const label = category ? category.charAt(0).toUpperCase() + category.slice(1) : event.entityId;
  return account ? `${label} (${account})` : label;
}
