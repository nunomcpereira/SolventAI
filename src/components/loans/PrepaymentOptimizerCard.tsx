"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseLoan, type SerializedLoan } from "../../domain/loans/loan.js";
import { Money } from "../../engine/money/money.js";
import { type CurrencyCode } from "../../engine/money/currency.js";
import { type PrepaymentStrategy } from "../../engine/prepayment/prepayment.js";
import { optimizePrepaymentsAcrossLoans } from "../../lib/services/prepaymentOptimizationService.js";
import { formatMoney } from "../../lib/format.js";
import { Badge } from "../ui/Badge.js";

const CATEGORY_ICON: Record<string, string> = {
  mortgage: "home",
  auto: "directions_car",
  personal: "person",
  consumer: "shopping_cart",
  student: "school",
  other: "account_balance_wallet",
};

export interface PrepaymentOptimizerLabels {
  title: string;
  deterministic: string;
  subtitle: string;
  lumpSum: string;
  strategy: string;
  reducePayment: string;
  shortenTerm: string;
  rank: string;
  bestOption: string;
  interestSaved: string;
  netSavings: string;
  penalty: string;
  paymentDrop: string;
  termShortened: string;
  months: string;
  simulate: string;
  noLoans: string;
}

export interface PrepaymentOptimizerCardProps {
  serializedLoans: SerializedLoan[];
  currency: string;
  lang: string;
  labels: PrepaymentOptimizerLabels;
}

export function PrepaymentOptimizerCard({
  serializedLoans,
  currency,
  lang,
  labels,
}: PrepaymentOptimizerCardProps) {
  const [lumpSum, setLumpSum] = useState<string>("5000");
  const [strategy, setStrategy] = useState<PrepaymentStrategy>("reduce_payment");

  const loans = useMemo(() => {
    return serializedLoans.map((s) => parseLoan(s));
  }, [serializedLoans]);

  const results = useMemo(() => {
    const numeric = parseFloat(lumpSum);
    if (isNaN(numeric) || numeric <= 0 || loans.length === 0) {
      return [];
    }
    try {
      const money = Money.fromDecimalString(numeric.toFixed(2), currency as CurrencyCode);
      return optimizePrepaymentsAcrossLoans({
        loans,
        lumpSum: money,
        strategy,
      });
    } catch {
      return [];
    }
  }, [loans, lumpSum, currency, strategy]);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-stack-lg shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-stack-md border-b border-outline-variant pb-stack-md">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-headline-sm text-on-surface flex items-center gap-2">
              {labels.title}
              <Badge tone="healthy">{labels.deterministic}</Badge>
            </h2>
            <p className="text-body-md text-on-surface-variant mt-0.5">{labels.subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <label className="flex items-center gap-2 text-label-md text-on-surface">
            <span>{labels.lumpSum}:</span>
            <div className="relative">
              <input
                type="number"
                min="100"
                step="100"
                value={lumpSum}
                onChange={(e) => setLumpSum(e.target.value)}
                className="w-32 border border-outline-variant rounded-lg px-3 py-1.5 text-body-md font-medium text-on-surface focus:outline-none focus:border-primary pr-8"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant font-semibold">
                {currency}
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2 text-label-md text-on-surface">
            <span>{labels.strategy}:</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as PrepaymentStrategy)}
              className="border border-outline-variant rounded-lg px-3 py-1.5 text-body-md text-on-surface focus:outline-none focus:border-primary bg-surface-container-lowest"
            >
              <option value="reduce_payment">{labels.reducePayment}</option>
              <option value="shorten_term">{labels.shortenTerm}</option>
            </select>
          </label>
        </div>
      </div>

      {loans.length === 0 ? (
        <p className="text-body-md text-on-surface-variant py-4">{labels.noLoans}</p>
      ) : results.length === 0 ? (
        <p className="text-body-md text-on-surface-variant py-4">
          Enter an amount in {currency} to calculate the optimal prepayment allocation across your loans.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((item) => {
            const isTop = item.isBest;
            return (
              <div
                key={item.loanId}
                className={`rounded-sm p-4 transition-all border ${
                  isTop
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                    : "border-outline-variant bg-surface-container-lowest hover:border-outline"
                }`}
              >
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-label-md shrink-0 ${
                        isTop ? "bg-primary text-on-primary shadow-sm" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      #{item.rank}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="material-symbols-outlined text-outline text-lg">
                          {CATEGORY_ICON[item.category] ?? "account_balance_wallet"}
                        </span>
                        <h4 className="text-title-md text-on-surface font-semibold">{item.loanName}</h4>
                        <span className="text-label-sm px-2 py-0.5 rounded-sm bg-surface-container text-on-surface-variant">
                          {item.rateDescription}
                        </span>
                        {isTop && (
                          <span className="text-label-sm font-semibold px-2.5 py-0.5 rounded-sm bg-status-healthy/15 text-status-healthy flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">stars</span>
                            {labels.bestOption}
                          </span>
                        )}
                      </div>

                      <div className="text-body-sm text-on-surface-variant mt-1">
                        Outstanding: {formatMoney(item.outstandingPrincipal, lang)} • Prepayment applied:{" "}
                        {formatMoney(item.prepaymentAmountApplied, lang)} • {labels.penalty}:{" "}
                        {formatMoney(item.penaltyFee, lang)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 lg:justify-end">
                    <div className="text-left lg:text-right">
                      <p className="eyebrow">
                        {labels.netSavings}
                      </p>
                      <p className="text-headline-sm text-status-healthy font-bold">
                        +{formatMoney(item.netSavings, lang)}
                      </p>
                      <p className="eyebrow">
                        ({labels.interestSaved}: {formatMoney(item.interestSaved, lang)})
                      </p>
                    </div>

                    <div className="text-left lg:text-right min-w-[160px]">
                      <p className="eyebrow">
                        {strategy === "reduce_payment" ? labels.paymentDrop : labels.termShortened}
                      </p>
                      <p className="text-title-md text-on-surface font-semibold">
                        {strategy === "reduce_payment" ? (
                          item.monthlyPaymentSavings ? (
                            `-${formatMoney(item.monthlyPaymentSavings, lang)} / mo`
                          ) : (
                            "—"
                          )
                        ) : (
                          `${item.periodsSaved} ${labels.months}`
                        )}
                      </p>
                      <p className="eyebrow">
                        {strategy === "reduce_payment" && item.newMonthlyPayment
                          ? `New: ${formatMoney(item.newMonthlyPayment, lang)} / mo`
                          : `${item.newRemainingPeriods} ${labels.months} left`}
                      </p>
                    </div>

                    <Link
                      href={`/${lang}/simulation`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-label-md font-medium bg-surface-container-low text-primary hover:bg-surface-container border border-outline-variant transition-colors"
                    >
                      <span>{labels.simulate}</span>
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
