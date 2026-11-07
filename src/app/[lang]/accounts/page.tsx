import { notFound } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LANGUAGES, type Language } from "../../../lib/i18n/locales.js";
import { getDictionary } from "../../../lib/i18n/getDictionary.js";
import { listAccounts } from "../../../lib/services/accountsService.js";
import { getSettings } from "../../../lib/services/settingsService.js";
import { formatMoney } from "../../../lib/format.js";
import { sumMoney } from "../../../engine/money/money.js";
import { getAccountTypeOptions, getIncomeCategoryOptions } from "../../../lib/settings/typeOptions.js";
import { InlineAccountNameEditor } from "../../../components/accounts/InlineAccountNameEditor.js";
import { InlineAccountBalanceEditor } from "../../../components/accounts/InlineAccountBalanceEditor.js";
import { InlineAccountReserveEditor } from "../../../components/accounts/InlineAccountReserveEditor.js";
import { InlineAccountActiveEditor } from "../../../components/accounts/InlineAccountActiveEditor.js";
import { IncomeEntryForm } from "../../../components/accounts/IncomeEntryForm.js";
import { convertMoneyToCurrency } from "../../../lib/services/exchangeRateService.js";
import { listRecurringIncomes } from "../../../lib/services/recurringItemsService.js";
import { LiveRefresh } from "../../../components/ui/LiveRefresh.js";
import { InlineRecurringItemRow } from "../../../components/ui/InlineRecurringItemRow.js";
import {
  createAccountAction,
  updateAccountAction,
  deleteAccountAction,
  renameAccountAction,
  createRecurringIncomeAction,
  updateRecurringIncomeAction,
  deleteRecurringIncomeAction,
  setDefaultAccountAction,
} from "./actions.js";

function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

const ACCOUNT_TYPE_ICON: Record<string, string> = {
  checking: "account_balance",
  savings: "savings",
  emergency: "security",
  investment: "trending_up",
  other: "account_balance_wallet",
};

export default async function AccountsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLanguage(lang)) notFound();
  const dict = getDictionary(lang);
  const [accounts, settings, incomes] = await Promise.all([listAccounts(), getSettings(), listRecurringIncomes()]);
  const accountTypeOptions = getAccountTypeOptions(settings);
  const incomeCategoryOptions = getIncomeCategoryOptions(settings);
  const accountTypeLabelMap = new Map(accountTypeOptions.map((option) => [option.value, option.label]));
  const incomeCategoryLabelMap = new Map(incomeCategoryOptions.map((option) => [option.value, option.label]));
  const accountNameMap = new Map(accounts.map((account) => [account.id, account.name]));
  const frequencyLabelMap: Record<string, string> = {
    monthly: dict.wizards.freqMonthly,
    quarterly: dict.wizards.freqQuarterly,
    semiannual: dict.wizards.freqSemiannual,
    annual: dict.wizards.freqAnnual,
    biweekly: dict.wizards.freqBiweekly,
    weekly: dict.wizards.freqWeekly,
    daily: dict.wizards.freqDaily,
  };
  const currency = settings.baseCurrency;
  const accountDisplayAmounts = new Map(
    await Promise.all(
      accounts.map(async (account) => {
        const convertedBalance = await convertMoneyToCurrency(account.initialBalance, currency);
        const convertedReserve = await convertMoneyToCurrency(account.minimumReserve, currency);
        const hasCurrencyConversion = account.currency.toUpperCase() !== currency.toUpperCase();
        return [
          account.id,
          {
            formattedBalance: formatMoney(convertedBalance, lang),
            formattedBalanceSecondary: hasCurrencyConversion ? `(${formatMoney(account.initialBalance, lang)})` : undefined,
            formattedReserve: formatMoney(convertedReserve, lang),
            formattedReserveSecondary: hasCurrencyConversion ? `(${formatMoney(account.minimumReserve, lang)})` : undefined,
          },
        ] as const;
      }),
    ),
  );
  const activeAccounts = accounts.filter((account) => account.active);
  const activeBalancesInBaseCurrency = await Promise.all(
    activeAccounts.map((account) => convertMoneyToCurrency(account.initialBalance, currency)),
  );
  const totalLiquidity = accounts.length > 0 ? sumMoney(currency, activeBalancesInBaseCurrency) : undefined;

  const boundCreate = createAccountAction.bind(null, lang);
  const boundUpdate = updateAccountAction.bind(null, lang);
  const boundDelete = deleteAccountAction.bind(null, lang);
  const boundRename = renameAccountAction.bind(null, lang);
  const boundSetDefault = setDefaultAccountAction.bind(null, lang);
  const boundCreateIncome = createRecurringIncomeAction.bind(null, lang);
  const boundUpdateIncome = updateRecurringIncomeAction.bind(null, lang);
  const boundDeleteIncome = deleteRecurringIncomeAction.bind(null, lang);
  const accountOptionsForRows = accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }));

  return (
    <div className="flex flex-col gap-stack-lg w-full">
      <LiveRefresh scope="accounts" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 page-head border-b border-on-surface pb-5">
        <div>
          <h1 className="text-display-lg-mobile md:text-display-lg text-on-surface">{dict.accounts.title}</h1>
          <p className="text-body-lg text-on-surface-variant mt-stack-sm">{dict.accounts.subtitle}</p>
        </div>
        <Link
          href={`/${lang}/loans`}
          className="text-label-md text-primary hover:underline flex items-center gap-1"
        >
          {dict.nav.portfolio}
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            arrow_forward
          </span>
        </Link>
      </div>

      {totalLiquidity ? (
        <div className="figure-card border-b border-outline-variant pb-5 -mt-2">
          <h2 className="eyebrow !font-sans">
            {dict.accounts.totalAvailableLiquidity}
          </h2>
          <div className="figure text-[32px] md:text-[40px] leading-tight text-primary mt-2">
            {formatMoney(totalLiquidity, lang)}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
        {accounts.map((account) => {
          const belowReserve = account.initialBalance.compare(account.minimumReserve) < 0;
          const displayAmounts = accountDisplayAmounts.get(account.id);
          return (
            <div key={account.id} className="bg-surface-container-lowest border border-outline-variant rounded-sm p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-stack-md">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <InlineAccountNameEditor
                        accountId={account.id}
                        name={account.name}
                        renameAction={boundRename}
                        labels={{ edit: dict.accounts.renameAccount, save: dict.accounts.saveAccountName, cancel: dict.accounts.cancelRename }}
                      />
                      {account.isDefault ? (
                        <span className="text-label-sm text-primary bg-surface-container rounded-sm px-2 py-0.5">
                          {dict.accounts.defaultAccount}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-label-sm text-on-surface-variant capitalize">
                      {(accountTypeLabelMap.get(account.type) ?? account.type)} · {account.currency}
                      {!account.active ? ` · ${dict.accounts.inactive}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!account.isDefault ? (
                    <form action={boundSetDefault}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <button
                        type="submit"
                        aria-label={dict.accounts.setDefaultAccount}
                        title={dict.accounts.setDefaultAccount}
                        className="w-9 h-9 rounded-sm border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-container-low transition-colors flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                          star_outline
                        </span>
                      </button>
                    </form>
                  ) : null}
                  <form action={boundDelete}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <button
                      type="submit"
                      aria-label={dict.accounts.delete}
                      title={dict.accounts.delete}
                      className="w-9 h-9 rounded-sm border border-outline-variant text-on-surface-variant hover:text-status-danger hover:border-status-danger hover:bg-surface-container-low transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                        delete
                      </span>
                    </button>
                  </form>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div className="w-full space-y-2">
                  <p className="eyebrow">{dict.accounts.availableBalance}</p>
                  <InlineAccountBalanceEditor
                    accountId={account.id}
                    balance={account.initialBalance.toDecimalString()}
                    minimumReserve={account.minimumReserve.toDecimalString()}
                    active={account.active}
                    formattedBalance={displayAmounts?.formattedBalance ?? formatMoney(account.initialBalance, lang)}
                    {...(displayAmounts?.formattedBalanceSecondary
                      ? { formattedBalanceSecondary: displayAmounts.formattedBalanceSecondary }
                      : {})}
                    warning={belowReserve}
                    updateAction={boundUpdate}
                    labels={{ edit: dict.accounts.editBalance, save: dict.accounts.saveBalance, cancel: dict.accounts.cancelBalanceEdit }}
                  />
                  <p className="eyebrow">{dict.accounts.minimumReserve}</p>
                  <InlineAccountReserveEditor
                    accountId={account.id}
                    balance={account.initialBalance.toDecimalString()}
                    minimumReserve={account.minimumReserve.toDecimalString()}
                    active={account.active}
                    formattedReserve={displayAmounts?.formattedReserve ?? formatMoney(account.minimumReserve, lang)}
                    {...(displayAmounts?.formattedReserveSecondary
                      ? { formattedReserveSecondary: displayAmounts.formattedReserveSecondary }
                      : {})}
                    updateAction={boundUpdate}
                    labels={{ edit: dict.accounts.editMinimumReserve, save: dict.accounts.saveMinimumReserve, cancel: dict.accounts.cancelMinimumReserveEdit }}
                  />
                  <p className="eyebrow">{dict.accounts.status}</p>
                  <InlineAccountActiveEditor
                    accountId={account.id}
                    balance={account.initialBalance.toDecimalString()}
                    minimumReserve={account.minimumReserve.toDecimalString()}
                    active={account.active}
                    activeLabel={dict.accounts.active}
                    inactiveLabel={dict.accounts.inactive}
                    updateAction={boundUpdate}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <details className="self-start border border-dashed border-outline rounded-sm p-5 flex flex-col items-center justify-center min-h-[72px] group [&_summary]:list-none">
          <summary className="cursor-pointer select-none flex flex-col items-center text-center">
            <span className="text-label-md text-on-surface-variant group-hover:text-on-surface transition-colors border-b border-outline-variant group-hover:border-on-surface pb-0.5"><span className="font-mono text-primary mr-1.5">+</span>
              {dict.accounts.addAccount}
            </span>
          </summary>
          <form action={boundCreate} className="flex flex-col gap-stack-sm mt-stack-md text-left w-full max-w-xs mx-auto">
            <label className="flex flex-col gap-1 eyebrow">
              {dict.accounts.name}
              <input name="name" required className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1 eyebrow">
              {dict.accounts.type}
              <select name="type" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary">
                {accountTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 eyebrow">
              {dict.accounts.currency}
              <input name="currency" defaultValue={currency} className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1 eyebrow">
              {dict.accounts.balance}
              <input type="number" step="0.01" name="balance" defaultValue="0" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1 eyebrow">
              {dict.accounts.minimumReserve}
              <input type="number" step="0.01" name="minimumReserve" defaultValue="0" className="border border-outline-variant rounded-lg px-3 py-2 text-body-md focus:outline-none focus:border-primary" />
            </label>
            <label className="flex items-center gap-2 eyebrow">
              <input type="checkbox" name="active" defaultChecked />
              {dict.accounts.active}
            </label>
            <button type="submit" className="bg-primary text-on-primary py-2 rounded-lg text-label-md mt-stack-sm">
              {dict.accounts.save}
            </button>
          </form>
        </details>

        <details className="self-start border border-dashed border-outline rounded-sm p-5 flex flex-col items-center justify-center min-h-[72px] group [&_summary]:list-none">
          <summary className="cursor-pointer select-none flex flex-col items-center text-center">
            <span className="text-label-md text-on-surface-variant group-hover:text-on-surface transition-colors border-b border-outline-variant group-hover:border-on-surface pb-0.5"><span className="font-mono text-primary mr-1.5">+</span>
              {dict.accounts.addRecurringIncome}
            </span>
          </summary>
          <IncomeEntryForm
            action={boundCreateIncome}
            accounts={accounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }))}
            categoryOptions={incomeCategoryOptions}
            labels={{
              sourceAccount: dict.loans.sourceAccount,
              incomeAmount: dict.accounts.incomeAmount,
              incomeFrequency: dict.accounts.incomeFrequency,
              incomeCategory: dict.accounts.incomeCategory,
              incomeStartDate: dict.accounts.incomeStartDate,
              saveIncome: dict.accounts.saveRecurringIncome,
              schedule: dict.accounts.schedule,
              scheduleRecurring: dict.accounts.scheduleRecurring,
              scheduleOneOff: dict.accounts.scheduleOneOff,
              freqMonthly: dict.wizards.freqMonthly,
              freqQuarterly: dict.wizards.freqQuarterly,
              freqSemiannual: dict.wizards.freqSemiannual,
              freqAnnual: dict.wizards.freqAnnual,
              freqBiweekly: dict.wizards.freqBiweekly,
              freqWeekly: dict.wizards.freqWeekly,
              freqDaily: dict.wizards.freqDaily,
            }}
          />
        </details>
      </div>

      {accounts.length === 0 ? <p className="text-body-md text-on-surface-variant">{dict.accounts.empty}</p> : null}

      <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-6">
        <h2 className="text-headline-sm text-on-surface mb-stack-md">{dict.accounts.recurringIncomesTitle}</h2>
        {incomes.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">{dict.accounts.noRecurringIncomes}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-md">
              <thead>
                <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant">
                  <th className="py-2 pr-4 font-normal">{dict.accounts.account}</th>
                  <th className="py-2 pr-4 font-normal">{dict.accounts.incomeAmount}</th>
                  <th className="py-2 pr-4 font-normal">{dict.accounts.incomeFrequency}</th>
                  <th className="py-2 pr-4 font-normal">{dict.accounts.incomeCategory}</th>
                  <th className="py-2 pr-4 font-normal">{dict.accounts.incomeStartDate}</th>
                  <th className="py-2 pr-4 font-normal">{dict.accounts.endDate}</th>
                  <th className="py-2 pr-4 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((income) => (
                  <InlineRecurringItemRow
                    key={income.id}
                    id={income.id}
                    idFieldName="incomeId"
                    accountId={income.accountId}
                    accountName={accountNameMap.get(income.accountId) ?? income.accountId}
                    amount={income.amount.toDecimalString()}
                    formattedAmount={formatMoney(income.amount, lang)}
                    currency={income.amount.currency}
                    frequency={income.frequency}
                    frequencyLabel={frequencyLabelMap[income.frequency] ?? income.frequency}
                    category={income.category}
                    categoryLabel={incomeCategoryLabelMap.get(income.category) ?? income.category}
                    startDate={income.startDate.toString()}
                    {...(income.endDate ? { endDate: income.endDate.toString() } : {})}
                    accounts={accountOptionsForRows}
                    categoryOptions={incomeCategoryOptions}
                    updateAction={boundUpdateIncome}
                    deleteAction={boundDeleteIncome}
                    labels={{
                      account: dict.accounts.account,
                      amount: dict.accounts.incomeAmount,
                      frequency: dict.accounts.incomeFrequency,
                      category: dict.accounts.incomeCategory,
                      startDate: dict.accounts.incomeStartDate,
                      endDate: dict.accounts.endDate,
                      ongoing: dict.accounts.ongoing,
                      edit: dict.accounts.edit,
                      save: dict.accounts.save,
                      cancel: dict.accounts.cancel,
                      delete: dict.accounts.delete,
                      freqMonthly: dict.wizards.freqMonthly,
                      freqQuarterly: dict.wizards.freqQuarterly,
                      freqSemiannual: dict.wizards.freqSemiannual,
                      freqAnnual: dict.wizards.freqAnnual,
                      freqBiweekly: dict.wizards.freqBiweekly,
                      freqWeekly: dict.wizards.freqWeekly,
                      freqDaily: dict.wizards.freqDaily,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
