import { roundDiv, type RoundingMode } from "./rounding.js";

/**
 * Fixed-point decimal for intermediate financial math (rates, day-count fractions,
 * interest accrual) that must NOT lose precision before the final rounding step into
 * money minor units. Backed by bigint scaled by 10^SCALE. Never backed by `number`.
 */
const SCALE = 18;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

export class Decimal {
  private constructor(private readonly scaled: bigint) {}

  static readonly ZERO = new Decimal(0n);
  static readonly ONE = new Decimal(SCALE_FACTOR);

  static fromScaledBigInt(scaled: bigint): Decimal {
    return new Decimal(scaled);
  }

  /** Parses a decimal literal string exactly (no float round-trip). E.g. "0.035", "-12.5". */
  static fromString(value: string): Decimal {
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
    if (!match) {
      throw new Error(`Decimal.fromString: invalid decimal literal "${value}"`);
    }
    const sign = match[1];
    const intPart = match[2] ?? "0";
    const fracPart = match[3] ?? "";
    const fracPadded = (fracPart + "0".repeat(SCALE)).slice(0, SCALE);
    const magnitude = BigInt(intPart) * SCALE_FACTOR + BigInt(fracPadded || "0");
    return new Decimal(sign === "-" ? -magnitude : magnitude);
  }

  static fromBigInt(value: bigint): Decimal {
    return new Decimal(value * SCALE_FACTOR);
  }

  static fromFraction(numerator: bigint, denominator: bigint): Decimal {
    if (denominator === 0n) throw new Error("Decimal.fromFraction: division by zero");
    return new Decimal(roundDiv(numerator * SCALE_FACTOR, denominator, "half-even"));
  }

  add(other: Decimal): Decimal {
    return new Decimal(this.scaled + other.scaled);
  }

  sub(other: Decimal): Decimal {
    return new Decimal(this.scaled - other.scaled);
  }

  mul(other: Decimal): Decimal {
    return new Decimal(roundDiv(this.scaled * other.scaled, SCALE_FACTOR, "half-even"));
  }

  div(other: Decimal): Decimal {
    if (other.scaled === 0n) throw new Error("Decimal.div: division by zero");
    return new Decimal(roundDiv(this.scaled * SCALE_FACTOR, other.scaled, "half-even"));
  }

  neg(): Decimal {
    return new Decimal(-this.scaled);
  }

  reciprocal(): Decimal {
    return Decimal.ONE.div(this);
  }

  /** Integer non-negative exponent power, via exact repeated squaring. */
  pow(exponent: number): Decimal {
    if (!Number.isInteger(exponent) || exponent < 0) {
      throw new Error("Decimal.pow: exponent must be a non-negative integer");
    }
    let result = Decimal.ONE;
    let base = Decimal.fromScaledBigInt(this.scaled);
    let n = exponent;
    while (n > 0) {
      if (n & 1) result = result.mul(base);
      base = base.mul(base);
      n >>= 1;
    }
    return result;
  }

  isZero(): boolean {
    return this.scaled === 0n;
  }

  isNegative(): boolean {
    return this.scaled < 0n;
  }

  compare(other: Decimal): -1 | 0 | 1 {
    if (this.scaled === other.scaled) return 0;
    return this.scaled < other.scaled ? -1 : 1;
  }

  min(other: Decimal): Decimal {
    return this.compare(other) <= 0 ? this : other;
  }

  max(other: Decimal): Decimal {
    return this.compare(other) >= 0 ? this : other;
  }

  /** Rounds down to an integer bigint (e.g. converting an accrual-days fraction). */
  toIntegerBigInt(mode: RoundingMode = "half-even"): bigint {
    return roundDiv(this.scaled, SCALE_FACTOR, mode);
  }

  /** Rounds to `minorUnitScale` minor units of a currency (e.g. cents), using `mode`. */
  toMinorUnits(minorUnitScaleFactor: bigint, mode: RoundingMode = "half-even"): bigint {
    return roundDiv(this.scaled * minorUnitScaleFactor, SCALE_FACTOR, mode);
  }

  toRawScaled(): bigint {
    return this.scaled;
  }

  toString(): string {
    const negative = this.scaled < 0n;
    const magnitude = negative ? -this.scaled : this.scaled;
    const intPart = magnitude / SCALE_FACTOR;
    const fracPart = (magnitude % SCALE_FACTOR).toString().padStart(SCALE, "0").replace(/0+$/, "");
    const sign = negative ? "-" : "";
    return fracPart ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`;
  }
}
