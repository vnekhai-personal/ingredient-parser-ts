/**
 * Port of Python's `fractions.Fraction` (TS-native supporting module, CLAUDE.md §5) — the
 * quantity type of the output contract. bigint-backed: one upstream expectation carries a
 * numerator above 2^53. Semantics mirrored: construction from int/float/string/Fraction,
 * exact arithmetic, comparisons with ints and floats, `str()`/`repr()`, and correctly
 * rounded `float()`.
 */
import { PY_S } from './_py.js';

/** Python `OverflowError` (only `float(Fraction)` raises it here). */
export class OverflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OverflowError';
  }
}

function bigAbs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

function gcd(a: bigint, b: bigint): bigint {
  a = bigAbs(a);
  b = bigAbs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function bitLength(x: bigint): number {
  return x === 0n ? 0 : bigAbs(x).toString(2).length;
}

const ND_RE = /\p{Nd}/u;
function digitValue(ch: string): number {
  const cp = ch.codePointAt(0) as number;
  let first = cp;
  while (first > 0 && ND_RE.test(String.fromCodePoint(first - 1))) first -= 1;
  return (cp - first) % 10;
}
function asciiDigits(s: string): string {
  let out = '';
  for (const ch of s) out += ND_RE.test(ch) ? String(digitValue(ch)) : ch;
  return out;
}

// fractions._RATIONAL_FORMAT (CPython 3.12), after Unicode digits are mapped to ASCII. Its `\s` is
// Python's str-pattern class (str.isspace: U+001C–001F and U+0085 in, U+FEFF out), not JS `\s`.
// Built on first use: this module and _py.ts import each other, so PY_S may not be initialised yet
// at module-evaluation time.
let rationalFormat: RegExp | undefined;
function RATIONAL_FORMAT(): RegExp {
  rationalFormat ??= new RegExp(
    `^${PY_S}*([-+]?)(?=\\d|\\.\\d)(\\d*|\\d+(?:_\\d+)*)(?:(?:${PY_S}*\\/${PY_S}*(\\d+(?:_\\d+)*))|(?:\\.(\\d*|\\d+(?:_\\d+)*))?(?:E([-+]?\\d+(?:_\\d+)*))?)?${PY_S}*$`,
    'iu',
  );
  return rationalFormat;
}

/** 2**e as a double, built from the IEEE-754 bit pattern (exact for -1074 <= e <= 1023, engine-independent). */
function pow2(e: number): number {
  const buf = new DataView(new ArrayBuffer(8));
  if (e >= -1022) buf.setUint32(0, (e + 1023) << 20);
  else if (e + 1074 >= 32) buf.setUint32(0, 1 << (e + 1074 - 32)); // subnormal, bit in the high word
  else buf.setUint32(4, 1 << (e + 1074)); // subnormal, bit in the low word
  return buf.getFloat64(0);
}

function stripUnderscores(s: string): string {
  return s.replace(/_/g, '');
}

/** Exact rational of a finite double. */
function floatToRatio(x: number): [bigint, bigint] {
  if (!Number.isFinite(x)) throw new Error(`Cannot convert ${x} to Fraction.`); // Python: ValueError/OverflowError
  if (x === 0) return [0n, 1n];
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  const hi = buf.getUint32(0);
  const lo = buf.getUint32(4);
  const sign = hi >>> 31 ? -1n : 1n;
  const expBits = (hi >>> 20) & 0x7ff;
  let mantissa = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let exp: number;
  if (expBits === 0) {
    exp = -1074; // subnormal
  } else {
    mantissa |= 1n << 52n;
    exp = expBits - 1075;
  }
  if (exp >= 0) return [sign * (mantissa << BigInt(exp)), 1n];
  return [sign * mantissa, 1n << BigInt(-exp)];
}

export class Fraction {
  /** Numerator (carries the sign). */
  readonly n: bigint;
  /** Denominator (> 0). */
  readonly d: bigint;

  constructor(numerator: number | bigint | string | Fraction = 0, denominator?: number | bigint) {
    let n: bigint;
    let d: bigint;
    if (denominator === undefined) {
      if (numerator instanceof Fraction) {
        n = numerator.n;
        d = numerator.d;
      } else if (typeof numerator === 'bigint') {
        n = numerator;
        d = 1n;
      } else if (typeof numerator === 'number') {
        if (Number.isInteger(numerator)) {
          n = BigInt(numerator);
          d = 1n;
        } else {
          [n, d] = floatToRatio(numerator);
        }
      } else {
        const m = RATIONAL_FORMAT().exec(asciiDigits(numerator));
        if (!m) throw new Error(`Invalid literal for Fraction: '${numerator}'`); // Python: ValueError
        n = BigInt(stripUnderscores(m[2] as string) || '0');
        const denom = m[3];
        if (denom !== undefined) {
          d = BigInt(stripUnderscores(denom));
          if (d === 0n) throw new Error(`Fraction(${n}, 0)`); // Python: ZeroDivisionError
        } else {
          d = 1n;
          const decimal = m[4];
          if (decimal !== undefined) {
            const dec = stripUnderscores(decimal);
            const scale = 10n ** BigInt(dec.length);
            n = n * scale + BigInt(dec || '0');
            d = scale;
          }
          const exp = m[5];
          if (exp !== undefined) {
            const e = Number(stripUnderscores(exp));
            if (e >= 0) n *= 10n ** BigInt(e);
            else d *= 10n ** BigInt(-e);
          }
        }
        if (m[1] === '-') n = -n;
      }
    } else {
      const toBig = (v: number | bigint | string | Fraction): bigint => {
        if (typeof v === 'bigint') return v;
        if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v);
        throw new Error('both arguments should be Rational instances'); // Python: TypeError
      };
      n = toBig(numerator);
      d = toBig(denominator);
      if (d === 0n) throw new Error(`Fraction(${n}, 0)`); // Python: ZeroDivisionError
    }
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    if (g > 1n) {
      n /= g;
      d /= g;
    }
    this.n = n;
    this.d = d;
  }

  static from_float(x: number): Fraction {
    const [n, d] = floatToRatio(x);
    return new Fraction(n, d);
  }

  private static coerce(other: Fraction | number | bigint): Fraction {
    if (other instanceof Fraction) return other;
    if (typeof other === 'bigint') return new Fraction(other);
    if (Number.isInteger(other)) return new Fraction(BigInt(other));
    return Fraction.from_float(other);
  }

  add(other: Fraction | number | bigint): Fraction {
    const o = Fraction.coerce(other);
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(other: Fraction | number | bigint): Fraction {
    const o = Fraction.coerce(other);
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(other: Fraction | number | bigint): Fraction {
    const o = Fraction.coerce(other);
    return new Fraction(this.n * o.n, this.d * o.d);
  }

  div(other: Fraction | number | bigint): Fraction {
    const o = Fraction.coerce(other);
    if (o.n === 0n) throw new Error('Fraction division by zero'); // Python: ZeroDivisionError
    return new Fraction(this.n * o.d, this.d * o.n);
  }

  neg(): Fraction {
    return new Fraction(-this.n, this.d);
  }

  /** -1, 0 or 1. Exact for ints and floats (floats compare by exact value, as in Python). */
  compare(other: Fraction | number | bigint): number {
    if (typeof other === 'number' && !Number.isFinite(other)) {
      if (Number.isNaN(other)) return Number.NaN;
      return other > 0 ? -1 : 1;
    }
    const o = Fraction.coerce(other);
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }

  equals(other: Fraction | number | bigint): boolean {
    return this.compare(other) === 0;
  }

  lt(other: Fraction | number | bigint): boolean {
    return this.compare(other) < 0;
  }

  gt(other: Fraction | number | bigint): boolean {
    return this.compare(other) > 0;
  }

  isZero(): boolean {
    return this.n === 0n;
  }

  /**
   * `float(self)` = `numerator / denominator` on ints: CPython `long_true_divide` (longobject.c) —
   * the exact quotient correctly rounded (half-even) to a double, subnormals included;
   * `OverflowError` once the rounded result reaches 2**1024.
   */
  toNumber(): number {
    const a = bigAbs(this.n);
    const b = this.d;
    const sign = this.n < 0n ? -1 : 1;
    if (a < 9007199254740992n && b < 9007199254740992n) {
      // both operands are exact doubles, so IEEE division is already the correctly rounded quotient
      return sign * (Number(a) / Number(b));
    }
    // Scale so the integer quotient carries 55 or 56 significant bits; the remainder is a sticky bit.
    const shift = 55 - (bitLength(a) - bitLength(b));
    const num = shift >= 0 ? a << BigInt(shift) : a;
    const den = shift >= 0 ? b : b << BigInt(-shift);
    const q = num / den;
    const sticky = num % den !== 0n;
    // Keep 53 bits, or fewer when the result lands in the subnormal range (unit 2**-1074).
    const drop = Math.max(bitLength(q) - 53, shift - 1074);
    let kept = q >> BigInt(drop);
    const rem = q & ((1n << BigInt(drop)) - 1n);
    const half = 1n << BigInt(drop - 1);
    if (rem > half || (rem === half && (sticky || (kept & 1n) === 1n))) kept += 1n;
    const e = drop - shift; // >= -1074 by construction
    const result = e > 1023 ? Infinity : Number(kept) * pow2(e); // exact: kept <= 2**53
    if (!Number.isFinite(result)) throw new OverflowError('integer division result too large for a float');
    return sign * result;
  }

  /** `str(self)`: "n/d", or "n" when the denominator is 1. */
  toString(): string {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
  }

  /** `repr(self)`. */
  repr(): string {
    return `Fraction(${this.n}, ${this.d})`;
  }

  /** Python `min()`: the first minimal element. */
  static min(values: readonly Fraction[]): Fraction {
    if (values.length === 0) throw new Error('min() arg is an empty sequence');
    let best = values[0] as Fraction;
    for (const v of values.slice(1)) if (v.lt(best)) best = v;
    return best;
  }

  /** Python `max()`: the first maximal element. */
  static max(values: readonly Fraction[]): Fraction {
    if (values.length === 0) throw new Error('max() arg is an empty sequence');
    let best = values[0] as Fraction;
    for (const v of values.slice(1)) if (v.gt(best)) best = v;
    return best;
  }

  /** Python `sum(fractions)` (start value 0). */
  static sum(values: readonly Fraction[]): Fraction {
    let total = new Fraction(0);
    for (const v of values) total = total.add(v);
    return total;
  }
}
