import { minorUnitExponent, minorUnitScale, type CurrencyCode } from "./currency.js";
import { roundDiv, type RoundingMode } from "./rounding.js";
import { Decimal } from "./decimal.js";

/**
 * Exact monetary value: integer minor units (e.g. cents) + currency code.
 * Never backed by IEEE-754 `number`. All arithmetic between two Money values
 * requires matching currencies — cross-currency ops must go through explicit
 * FX conversion (see engine/rates or a future fx module), never implicit coercion.
 */
export class Money {
  private constructor(
    public readonly minorUnits: bigint,
    public readonly currency: CurrencyCode,
  ) {}

  static zero(currency: CurrencyCode): Money {
    minorUnitExponent(currency); // validates currency is registered
    return new Money(0n, currency);
  }

  static fromMinorUnits(minorUnits: bigint, currency: CurrencyCode): Money {
    minorUnitExponent(currency);
    return new Money(minorUnits, currency);
  }

  /** Parses a major-unit decimal literal (e.g. "10.23" EUR -> 1023 minor units). */
  static fromDecimalString(value: string, currency: CurrencyCode): Money {
    const scale = minorUnitScale(currency);
    const decimal = Decimal.fromString(value);
    return new Money(decimal.toMinorUnits(scale, "half-even"), currency);
  }

  private assertSameCurrency(other: Money, op: string): void {
    if (this.currency !== other.currency) {
      throw new Error(`Money.${op}: currency mismatch (${this.currency} vs ${other.currency}). Convert via FX first.`);
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other, "add");
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  sub(other: Money): Money {
    this.assertSameCurrency(other, "sub");
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  neg(): Money {
    return new Money(-this.minorUnits, this.currency);
  }

  /** Multiplies by an exact rational factor (numerator/denominator), rounding per `mode`. */
  mulFraction(numerator: bigint, denominator: bigint, mode: RoundingMode = "half-even"): Money {
    return new Money(roundDiv(this.minorUnits * numerator, denominator, mode), this.currency);
  }

  /** Multiplies by a Decimal factor (e.g. a rate), rounding down to minor units per `mode`. */
  mulDecimal(factor: Decimal, mode: RoundingMode = "half-even"): Money {
    const product = Decimal.fromBigInt(this.minorUnits).mul(factor);
    return new Money(product.toIntegerBigInt(mode), this.currency);
  }

  /**
   * Splits this amount into `parts` shares as close to equal as possible, with the
   * exact total preserved (remainder minor units distributed one-by-one to the first
   * shares). Never creates or destroys money — sum(allocate(n)) === this always.
   */
  allocate(parts: number): Money[] {
    if (parts <= 0 || !Number.isInteger(parts)) {
      throw new Error("Money.allocate: parts must be a positive integer");
    }
    const n = BigInt(parts);
    const base = this.minorUnits / n;
    let remainder = this.minorUnits % n;
    const result: Money[] = [];
    for (let i = 0; i < parts; i++) {
      let share = base;
      if (remainder > 0n) {
        share += 1n;
        remainder -= 1n;
      } else if (remainder < 0n) {
        share -= 1n;
        remainder += 1n;
      }
      result.push(new Money(share, this.currency));
    }
    return result;
  }

  isZero(): boolean {
    return this.minorUnits === 0n;
  }

  isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other, "compare");
    if (this.minorUnits === other.minorUnits) return 0;
    return this.minorUnits < other.minorUnits ? -1 : 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  min(other: Money): Money {
    return this.compare(other) <= 0 ? this : other;
  }

  max(other: Money): Money {
    return this.compare(other) >= 0 ? this : other;
  }

  abs(): Money {
    return this.isNegative() ? this.neg() : this;
  }

  /** Formats as a plain major-unit decimal string, e.g. 1023 minor units EUR -> "10.23". */
  toDecimalString(): string {
    const exponent = minorUnitExponent(this.currency);
    if (exponent === 0) return this.minorUnits.toString();
    const scale = minorUnitScale(this.currency);
    const negative = this.minorUnits < 0n;
    const magnitude = negative ? -this.minorUnits : this.minorUnits;
    const intPart = magnitude / scale;
    const fracPart = (magnitude % scale).toString().padStart(exponent, "0");
    return `${negative ? "-" : ""}${intPart}.${fracPart}`;
  }

  toJSON(): { minorUnits: string; currency: string } {
    return { minorUnits: this.minorUnits.toString(), currency: this.currency };
  }
}

export function sumMoney(currency: CurrencyCode, values: readonly Money[]): Money {
  return values.reduce((acc, v) => acc.add(v), Money.zero(currency));
}
