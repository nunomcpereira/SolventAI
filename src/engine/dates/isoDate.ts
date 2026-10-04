/**
 * Calendar date with no time-of-day or timezone component. All engine dates are
 * IsoDate — never JS `Date` (which carries a timezone and a hidden `now` dependency).
 * Stored as UTC-epoch-day integer so arithmetic is exact and comparisons are trivial.
 */
export class IsoDate {
  private constructor(
    public readonly year: number,
    public readonly month: number, // 1-12
    public readonly day: number, // 1-31
    private readonly epochDay: number,
  ) {}

  static fromParts(year: number, month: number, day: number): IsoDate {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new Error("IsoDate.fromParts: year/month/day must be integers");
    }
    if (month < 1 || month > 12) {
      throw new Error(`IsoDate.fromParts: invalid month ${month}`);
    }
    const daysIn = daysInMonth(year, month);
    if (day < 1 || day > daysIn) {
      throw new Error(`IsoDate.fromParts: invalid day ${day} for ${year}-${month}`);
    }
    return new IsoDate(year, month, day, toEpochDay(year, month, day));
  }

  /** Parses strict "YYYY-MM-DD". */
  static fromString(value: string): IsoDate {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      throw new Error(`IsoDate.fromString: expected YYYY-MM-DD, got "${value}"`);
    }
    return IsoDate.fromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  static fromEpochDay(epochDay: number): IsoDate {
    const { year, month, day } = fromEpochDay(epochDay);
    return new IsoDate(year, month, day, epochDay);
  }

  toEpochDay(): number {
    return this.epochDay;
  }

  toString(): string {
    return `${String(this.year).padStart(4, "0")}-${String(this.month).padStart(2, "0")}-${String(this.day).padStart(2, "0")}`;
  }

  compare(other: IsoDate): -1 | 0 | 1 {
    if (this.epochDay === other.epochDay) return 0;
    return this.epochDay < other.epochDay ? -1 : 1;
  }

  isBefore(other: IsoDate): boolean {
    return this.epochDay < other.epochDay;
  }

  isAfter(other: IsoDate): boolean {
    return this.epochDay > other.epochDay;
  }

  isSameOrBefore(other: IsoDate): boolean {
    return this.epochDay <= other.epochDay;
  }

  isSameOrAfter(other: IsoDate): boolean {
    return this.epochDay >= other.epochDay;
  }

  equals(other: IsoDate): boolean {
    return this.epochDay === other.epochDay;
  }

  /** Whole calendar days between this date and other (other - this). */
  daysUntil(other: IsoDate): number {
    return other.epochDay - this.epochDay;
  }

  /** Whole calendar months between this date and other (other - this; negative if other is before this). */
  monthsUntil(other: IsoDate): number {
    let months = (other.year * 12 + other.month) - (this.year * 12 + this.month);
    if (other.day < this.day) months -= 1;
    return months;
  }

  addDays(days: number): IsoDate {
    return IsoDate.fromEpochDay(this.epochDay + days);
  }

  /**
   * Adds calendar months, clamping the day to the target month's length
   * (e.g. Jan 31 + 1 month -> Feb 28/29, not Mar 3).
   */
  addMonths(months: number): IsoDate {
    const totalMonths = (this.year * 12 + (this.month - 1)) + months;
    const year = Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1;
    const day = Math.min(this.day, daysInMonth(year, month));
    return IsoDate.fromParts(year, month, day);
  }

  addYears(years: number): IsoDate {
    return this.addMonths(years * 12);
  }
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const len = lengths[month - 1];
  if (len === undefined) throw new Error(`daysInMonth: invalid month ${month}`);
  return len;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Days since 1970-01-01 (proleptic Gregorian), via the standard civil_from_days algorithm. */
function toEpochDay(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400; // [0, 399]
  const mp = (month + 9) % 12; // Mar=0 .. Feb=11
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1; // [0, 365]
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

function fromEpochDay(epochDay: number): { year: number; month: number; day: number } {
  const z = epochDay + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097; // [0, 146096]
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365); // [0, 399]
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)); // [0, 365]
  const mp = Math.floor((5 * doy + 2) / 153); // [0, 11]
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const month = mp < 10 ? mp + 3 : mp - 9; // [1, 12]
  const year = month <= 2 ? y + 1 : y;
  return { year, month, day };
}
