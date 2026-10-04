import { IsoDate } from "../dates/isoDate.js";
import { Decimal } from "../money/decimal.js";

export type DayCountConvention = "actual/360" | "actual/365" | "30/360";

/**
 * Computes the accrual year-fraction for [accrualStartDate, accrualEndDate) under the
 * given convention. Never approximated via "months * 30 / 360" shortcuts — each
 * convention counts actual calendar days except 30/360, which has its own explicit
 * day-counting rule (US 30/360, unadjusted).
 */
export function yearFraction(
  accrualStartDate: IsoDate,
  accrualEndDate: IsoDate,
  convention: DayCountConvention,
): Decimal {
  if (accrualEndDate.isBefore(accrualStartDate)) {
    throw new Error("yearFraction: accrualEndDate must not be before accrualStartDate");
  }
  switch (convention) {
    case "actual/360": {
      const days = accrualStartDate.daysUntil(accrualEndDate);
      return Decimal.fromFraction(BigInt(days), 360n);
    }
    case "actual/365": {
      const days = accrualStartDate.daysUntil(accrualEndDate);
      return Decimal.fromFraction(BigInt(days), 365n);
    }
    case "30/360": {
      const days = days30360(accrualStartDate, accrualEndDate);
      return Decimal.fromFraction(BigInt(days), 360n);
    }
    default: {
      const exhaustive: never = convention;
      throw new Error(`Unhandled day-count convention: ${String(exhaustive)}`);
    }
  }
}

/**
 * Actual calendar days in [accrualStartDate, accrualEndDate). Exposed separately
 * because actual/360 and actual/365 share the same day count, only the denominator differs.
 */
export function actualDays(accrualStartDate: IsoDate, accrualEndDate: IsoDate): number {
  if (accrualEndDate.isBefore(accrualStartDate)) {
    throw new Error("actualDays: accrualEndDate must not be before accrualStartDate");
  }
  return accrualStartDate.daysUntil(accrualEndDate);
}

/**
 * US (NASD) 30/360 day count, unadjusted variant:
 * - If start day is 31, treat as 30.
 * - If end day is 31 and (adjusted) start day is 30, treat end day as 30.
 */
function days30360(start: IsoDate, end: IsoDate): number {
  const d1 = start.day === 31 ? 30 : start.day;
  const d2 = end.day === 31 && d1 === 30 ? 30 : end.day;
  return 360 * (end.year - start.year) + 30 * (end.month - start.month) + (d2 - d1);
}

/** Convenience: computes accrued interest = principal * annualRate * yearFraction, via Decimal. */
export function accrualFraction(
  accrualStartDate: IsoDate,
  accrualEndDate: IsoDate,
  convention: DayCountConvention,
  annualRate: Decimal,
): Decimal {
  return annualRate.mul(yearFraction(accrualStartDate, accrualEndDate, convention));
}

export function daysInYearForConvention(year: number, convention: DayCountConvention): number {
  switch (convention) {
    case "actual/360":
      return 360;
    case "actual/365":
      return 365;
    case "30/360":
      return 360;
    default: {
      const exhaustive: never = convention;
      throw new Error(`Unhandled day-count convention: ${String(exhaustive)}`);
    }
  }
}
