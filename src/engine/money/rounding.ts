/**
 * Centralized rounding policy. Every place in the engine that must collapse a
 * higher-precision intermediate value down to an integer (minor units, or any other
 * scaled bigint) goes through here. Do not call Math.round / manual +0.5 tricks elsewhere.
 */
export type RoundingMode = "half-up" | "half-even" | "down" | "up";

/**
 * Rounds `numerator / denominator` to the nearest integer using `mode`.
 * `denominator` must be positive. Works for negative numerators (rounds toward
 * the correct sign, "half-up" meaning half-away-from-zero, matching common
 * consumer-finance conventions).
 */
export function roundDiv(numerator: bigint, denominator: bigint, mode: RoundingMode = "half-up"): bigint {
  if (denominator <= 0n) {
    throw new Error("roundDiv: denominator must be positive");
  }
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const quotient = n / denominator;
  const remainder = n % denominator;

  let rounded: bigint;
  if (remainder === 0n) {
    rounded = quotient;
  } else {
    switch (mode) {
      case "down":
        rounded = quotient;
        break;
      case "up":
        rounded = quotient + 1n;
        break;
      case "half-up": {
        rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
        break;
      }
      case "half-even": {
        const twiceRemainder = remainder * 2n;
        if (twiceRemainder > denominator) {
          rounded = quotient + 1n;
        } else if (twiceRemainder < denominator) {
          rounded = quotient;
        } else {
          rounded = quotient % 2n === 0n ? quotient : quotient + 1n;
        }
        break;
      }
      default: {
        const exhaustive: never = mode;
        throw new Error(`Unhandled rounding mode: ${String(exhaustive)}`);
      }
    }
  }

  return negative ? -rounded : rounded;
}
