/**
 * The subset of `pint` (0.25.3) that upstream's output contract depends on, ported at the
 * mechanism level over the generated registry (`src/en/_pintRegistry.ts`). TS-native
 * supporting module (CLAUDE.md §5).
 *
 * Covered, with pint's exact algorithms: unit-name resolution (`parse_unit_name` walks
 * suffix × prefix in registry order, `_dedup_candidates`, `get_name`), `str(Unit)` /
 * `repr(Unit)` ('D' and 'P' formats; repr keeps insertion order, str sorts), root-unit
 * conversion factors (`_get_root_units` with its numerator/denominator cancellation keyed
 * by scale value and its multiplication order), offset/logarithmic conversions
 * (`NonMultiplicativeRegistry._convert`), `Quantity.to()` with exact `Fraction(str(factor))`
 * scaling for Fraction magnitudes, the `density` context ([volume] <-> [mass]), and the
 * Quantity arithmetic pint's expression evaluator reaches (`_mul_div`, `_add_sub`,
 * `__pow__`, `__floordiv__`, offset-unit rules).
 *
 * The expression front end is a port of pint's, not an approximation of it: the registry
 * preprocessors (`%`, `‰`, `×`), `pint.util.string_preprocessor` (comma removal, " per ",
 * `_subs_re_list` with Python `re` semantics, pretty exponents, `^`), `ParserHelper.from_string`
 * (bracket mangling, the `nan` rule), and `pint_eval.build_eval_tree` / `evaluate` over
 * `ParserHelper` (for `parse_units` / `x in UREG`) and over `Quantity` (for `UREG(x)`).
 * Tokenisation is a port of CPython 3.12.13's C tokenizer as driven by `tokenize.tokenize`
 * (extra_tokens mode: identifiers take every code point >= 128, `verify_end_of_number` and
 * old-style-octal checks are off, unmatched closing brackets are ordinary OP tokens),
 * including the PEP 263 BOM/cookie stage, INDENT/DEDENT bookkeeping, strings with
 * prefixes, f-string modes and every error site — so the port raises exactly where pint
 * raises, with the same class: TokenError, IndentationError, TabError, SyntaxError,
 * UnicodeEncodeError, DefinitionSyntaxError, AssertionError, ValueError, TypeError,
 * KeyError, ZeroDivisionError, OverflowError, AttributeError, UndefinedUnitError,
 * DimensionalityError, OffsetUnitCalculusError (error *messages* are reproduced where they
 * are cheap, never guaranteed).
 *
 * Python numbers are modelled: ints as `bigint`, floats as `number`, complex as `PyComplex`,
 * so exponents print like Python (`ounce ** 2` for both 2 and 2.0, `ounce ** 1.23457e+06`
 * for 1234567.0 but `ounce ** 1234567` for the int).
 *
 * Remaining limits (documented, raise `PintPortLimitError` rather than guess): a coding cookie
 * naming a real Python codec other than utf-8 / latin-1 / ascii is honoured only while the
 * input is pure ASCII (no codec tables are shipped); integer powers whose result would exceed
 * 100,000 bits are refused rather than computed.
 */
import { PY_ISDIGIT_EXTRA } from './en/_constants.js';
import { Fraction, OverflowError } from './fraction.js';
import { PY_B, PY_S, PY_W, pyFloat, pyFloatRepr, pyFormatG, pyInt, pyStrip } from './_py.js';
import {
  CODEC_ALIASES,
  CODEC_MODULES,
  DIMENSIONS,
  MKS_BASE_UNITS,
  PREFIXES,
  PREFIX_KEYS,
  SUFFIXES,
  UNITS_INDEX,
  UNIT_DEFS,
} from './en/_pintRegistry.js';

// ============================================================================================
// 1. Python exception classes (name = the Python class, so a harness can compare classes)
// ============================================================================================

/** Base of every Python-side exception raised by this module; `name` is the Python class name. */
export class PyException extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}
export class ValueError extends PyException {
  constructor(message: string, name = 'ValueError') {
    super(name, message);
  }
}
export class PyTypeError extends PyException {
  constructor(message: string, name = 'TypeError') {
    super(name, message);
  }
}
export class KeyError extends PyException {
  constructor(key: string) {
    super('KeyError', `'${key}'`);
  }
}
export class AttributeError extends PyException {
  constructor(message: string, name = 'AttributeError') {
    super(name, message);
  }
}
export class ZeroDivisionError extends PyException {
  constructor(message: string) {
    super('ZeroDivisionError', message);
  }
}
export class PintAssertionError extends PyException {
  constructor(message = '') {
    super('AssertionError', message);
  }
}
export class LookupError extends PyException {
  constructor(message: string, name = 'LookupError') {
    super(name, message);
  }
}
export class UnicodeError extends ValueError {
  constructor(message: string, name = 'UnicodeError') {
    super(message, name);
  }
}
export class UnicodeEncodeError extends UnicodeError {
  constructor(message: string) {
    super(message, 'UnicodeEncodeError');
  }
}
export class UnicodeDecodeError extends UnicodeError {
  constructor(message: string) {
    super(message, 'UnicodeDecodeError');
  }
}
export class PySyntaxError extends PyException {
  constructor(message: string, name = 'SyntaxError') {
    super(name, message);
  }
}
export class IndentationError extends PySyntaxError {
  constructor(message: string, name = 'IndentationError') {
    super(message, name);
  }
}
export class TabError extends IndentationError {
  constructor(message: string) {
    super(message, 'TabError');
  }
}
/** `tokenize.TokenError` (a plain Exception in CPython). */
export class TokenError extends PyException {
  constructor(message: string) {
    super('TokenError', message);
  }
}
/** `pint.errors.DefinitionSyntaxError(ValueError, PintError)`. */
export class DefinitionSyntaxError extends ValueError {
  constructor(message: string) {
    super(message, 'DefinitionSyntaxError');
  }
}
/** `pint.errors.UndefinedUnitError(AttributeError, PintError)`. */
export class UndefinedUnitError extends AttributeError {
  constructor(name: string) {
    super(`'${name}' is not defined in the unit registry`, 'UndefinedUnitError');
  }
}
/** `pint.errors.PintTypeError(TypeError, PintError)`. */
export class PintTypeError extends PyTypeError {
  constructor(message: string, name = 'PintTypeError') {
    super(message, name);
  }
}
export class DimensionalityError extends PintTypeError {
  constructor(src: string, dst: string, dim1 = '', dim2 = '', extra_msg = '') {
    const d1 = dim1 || dim2 ? ` (${dim1})` : '';
    const d2 = dim1 || dim2 ? ` (${dim2})` : '';
    super(`Cannot convert from '${src}'${d1} to '${dst}'${d2}${extra_msg}`, 'DimensionalityError');
  }
}
export class OffsetUnitCalculusError extends PintTypeError {
  constructor(units1: string, units2 = '') {
    super(
      `Ambiguous operation with offset unit (${units2 ? `${units1}, ${units2}` : units1}). See https://pint.readthedocs.io/en/latest/user/nonmult.html for guidance.`,
      'OffsetUnitCalculusError',
    );
  }
}
/** Not a Python class: raised where this port stops short of CPython/pint (see the header). */
export class PintPortLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PintPortLimitError';
  }
}

// ============================================================================================
// 2. Python numbers: int (bigint), float (number), complex (PyComplex)
// ============================================================================================

export class PyComplex {
  constructor(
    readonly re: number,
    readonly im: number,
  ) {}
}
export type PyNum = bigint | number | PyComplex;

const MAX_INT_POW_BITS = 100_000;

function pyTypeName(x: unknown): string {
  if (typeof x === 'bigint') return 'int';
  if (typeof x === 'number') return 'float';
  if (x instanceof PyComplex) return 'complex';
  if (x instanceof ParserHelper) return 'ParserHelper';
  if (x instanceof Quantity) return 'Quantity';
  if (x instanceof Fraction) return 'Fraction';
  return typeof x;
}

function unsupported(op: string, a: unknown, b: unknown): PyTypeError {
  return new PyTypeError(`unsupported operand type(s) for ${op}: '${pyTypeName(a)}' and '${pyTypeName(b)}'`);
}

/** `float(int)`: OverflowError when the int has no float representation. */
function intToFloat(x: bigint): number {
  const f = Number(x);
  if (!Number.isFinite(f)) throw new OverflowError('int too large to convert to float');
  return f;
}
function toComplex(x: PyNum): PyComplex {
  if (x instanceof PyComplex) return x;
  return new PyComplex(typeof x === 'bigint' ? intToFloat(x) : x, 0);
}
function isIntegerValued(x: number): boolean {
  return Number.isFinite(x) && Math.floor(x) === x;
}
function isOddInteger(x: number): boolean {
  return isIntegerValued(x) && Math.abs(x % 2) === 1;
}

export function pyAdd(a: PyNum, b: PyNum): PyNum {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a + b;
  if (a instanceof PyComplex || b instanceof PyComplex) {
    const x = toComplex(a);
    const y = toComplex(b);
    return new PyComplex(x.re + y.re, x.im + y.im);
  }
  return (typeof a === 'bigint' ? intToFloat(a) : a) + (typeof b === 'bigint' ? intToFloat(b) : b);
}
export function pySub(a: PyNum, b: PyNum): PyNum {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a - b;
  if (a instanceof PyComplex || b instanceof PyComplex) {
    const x = toComplex(a);
    const y = toComplex(b);
    return new PyComplex(x.re - y.re, x.im - y.im);
  }
  return (typeof a === 'bigint' ? intToFloat(a) : a) - (typeof b === 'bigint' ? intToFloat(b) : b);
}
export function pyMul(a: PyNum, b: PyNum): PyNum {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a * b;
  if (a instanceof PyComplex || b instanceof PyComplex) {
    const x = toComplex(a);
    const y = toComplex(b);
    return new PyComplex(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
  }
  return (typeof a === 'bigint' ? intToFloat(a) : a) * (typeof b === 'bigint' ? intToFloat(b) : b);
}
/** `_Py_c_quot`. */
function complexQuot(a: PyComplex, b: PyComplex): PyComplex {
  const abs_breal = Math.abs(b.re);
  const abs_bimag = Math.abs(b.im);
  if (abs_breal >= abs_bimag) {
    if (abs_breal === 0) throw new ZeroDivisionError('complex division by zero');
    const ratio = b.im / b.re;
    const denom = b.re + b.im * ratio;
    return new PyComplex((a.re + a.im * ratio) / denom, (a.im - a.re * ratio) / denom);
  }
  if (abs_bimag >= abs_breal) {
    const ratio = b.re / b.im;
    const denom = b.re * ratio + b.im;
    return new PyComplex((a.re * ratio + a.im) / denom, (a.im * ratio - a.re) / denom);
  }
  return new PyComplex(Number.NaN, Number.NaN);
}
export function pyTruediv(a: PyNum, b: PyNum): PyNum {
  if (a instanceof PyComplex || b instanceof PyComplex) return complexQuot(toComplex(a), toComplex(b));
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    if (b === 0n) throw new ZeroDivisionError('division by zero');
    return intToFloat(a) / intToFloat(b);
  }
  const x = typeof a === 'bigint' ? intToFloat(a) : a;
  const y = typeof b === 'bigint' ? intToFloat(b) : b;
  if (y === 0) throw new ZeroDivisionError('float division by zero');
  return x / y;
}
/** CPython `float_floor_div` / `float_rem` share `float_divmod`. */
function floatDivmod(vx: number, wx: number): [number, number] {
  let mod = vx % wx;
  let div = (vx - mod) / wx;
  if (mod !== 0) {
    if (wx < 0 !== mod < 0) {
      mod += wx;
      div -= 1.0;
    }
  } else {
    mod = wx < 0 ? -0 : 0;
  }
  let floordiv: number;
  if (div !== 0) {
    floordiv = Math.floor(div);
    if (div - floordiv > 0.5) floordiv += 1.0;
  } else {
    floordiv = vx / wx < 0 || Object.is(vx / wx, -0) ? -0 : 0;
  }
  return [floordiv, mod];
}
export function pyFloordiv(a: PyNum, b: PyNum): PyNum {
  if (a instanceof PyComplex || b instanceof PyComplex) throw unsupported('//', a, b);
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    if (b === 0n) throw new ZeroDivisionError('integer division or modulo by zero');
    const q = a / b;
    return (a % b !== 0n && a < 0n !== b < 0n) ? q - 1n : q;
  }
  const x = typeof a === 'bigint' ? intToFloat(a) : a;
  const y = typeof b === 'bigint' ? intToFloat(b) : b;
  if (y === 0) throw new ZeroDivisionError('float floor division by zero');
  return floatDivmod(x, y)[0];
}
export function pyMod(a: PyNum, b: PyNum): PyNum {
  if (a instanceof PyComplex || b instanceof PyComplex) throw unsupported('%', a, b);
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    if (b === 0n) throw new ZeroDivisionError('integer modulo by zero');
    const m = a % b;
    return m !== 0n && m < 0n !== b < 0n ? m + b : m;
  }
  const x = typeof a === 'bigint' ? intToFloat(a) : a;
  const y = typeof b === 'bigint' ? intToFloat(b) : b;
  if (y === 0) throw new ZeroDivisionError('float modulo');
  return floatDivmod(x, y)[1];
}
/** `_Py_c_pow`. */
function complexPow(a: PyComplex, b: PyComplex): PyComplex {
  if (b.re === 0 && b.im === 0) return new PyComplex(1, 0);
  if (a.re === 0 && a.im === 0) {
    if (b.im !== 0 || b.re < 0) throw new ZeroDivisionError('0.0 to a negative or complex power');
    return new PyComplex(0, 0);
  }
  const vabs = Math.hypot(a.re, a.im);
  let len = Math.pow(vabs, b.re);
  const at = Math.atan2(a.im, a.re);
  let phase = at * b.re;
  if (b.im !== 0) {
    len /= Math.exp(at * b.im);
    phase += b.im * Math.log(vabs);
  }
  return new PyComplex(len * Math.cos(phase), len * Math.sin(phase));
}
/** CPython `float_pow`, with its complex fallback for negative bases and non-integer exponents. */
function floatPow(iv: number, iw: number): PyNum {
  if (iw === 0) return 1.0;
  if (Number.isNaN(iv)) return iv;
  if (Number.isNaN(iw)) return iv === 1.0 ? 1.0 : iw;
  if (!Number.isFinite(iw)) {
    const av = Math.abs(iv);
    if (av === 1.0) return 1.0;
    if (iw > 0 === av > 1.0) return Math.abs(iw);
    return 0.0;
  }
  if (!Number.isFinite(iv)) {
    const odd = isOddInteger(iw);
    if (iw > 0) return odd ? iv : Math.abs(iv);
    return odd ? (iv < 0 ? -0 : 0) : 0.0;
  }
  if (iv === 0) {
    if (iw < 0) throw new ZeroDivisionError('0.0 cannot be raised to a negative power');
    return isOddInteger(iw) ? iv : 0.0;
  }
  let negate = false;
  if (iv < 0) {
    if (iw !== Math.floor(iw)) return complexPow(new PyComplex(iv, 0), new PyComplex(iw, 0));
    iv = -iv;
    negate = isOddInteger(iw);
  }
  if (iv === 1.0) return negate ? -1.0 : 1.0;
  let ix = Math.pow(iv, iw);
  if (negate) ix = -ix;
  if (!Number.isFinite(ix)) throw new OverflowError("(34, 'Numerical result out of range')");
  return ix;
}
export function pyPow(a: PyNum, b: PyNum): PyNum {
  if (a instanceof PyComplex || b instanceof PyComplex) return complexPow(toComplex(a), toComplex(b));
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    if (b >= 0n) {
      if (a !== 0n && a !== 1n && a !== -1n && b > BigInt(MAX_INT_POW_BITS)) {
        throw new PintPortLimitError(`int ** ${b}: result exceeds the ${MAX_INT_POW_BITS}-bit limit of this port`);
      }
      return a ** b;
    }
    if (a === 0n) throw new ZeroDivisionError('0.0 cannot be raised to a negative power');
    return floatPow(intToFloat(a), intToFloat(b));
  }
  return floatPow(typeof a === 'bigint' ? intToFloat(a) : a, typeof b === 'bigint' ? intToFloat(b) : b);
}
/** pint's unary minus is `x * -1`. */
export function pyNeg(x: PyNum): PyNum {
  return pyMul(x, -1n);
}
/** `x == n` for a small int `n`. */
export function pyEqInt(x: PyNum, n: number): boolean {
  if (typeof x === 'bigint') return x === BigInt(n);
  if (x instanceof PyComplex) return x.re === n && x.im === 0;
  return x === n;
}
/** `bool(x)`. */
export function pyTruthy(x: PyNum): boolean {
  return !pyEqInt(x, 0);
}
/** `x < 0` (`TypeError` for complex, as in Python). */
export function pyIsNegative(x: PyNum): boolean {
  if (x instanceof PyComplex) throw new PyTypeError("'<' not supported between instances of 'complex' and 'int'");
  return x < 0;
}
export function pyIsNaN(x: PyNum): boolean {
  if (typeof x === 'number') return Number.isNaN(x);
  if (x instanceof PyComplex) return Number.isNaN(x.re) || Number.isNaN(x.im);
  return false;
}
/** `abs(x)`. */
export function pyAbs(x: PyNum): PyNum {
  if (typeof x === 'bigint') return x < 0n ? -x : x;
  if (x instanceof PyComplex) return Math.hypot(x.re, x.im);
  return Math.abs(x);
}
/** `float(x)` for a real Python number. */
export function pyToFloat(x: PyNum): number {
  if (typeof x === 'bigint') return intToFloat(x);
  if (x instanceof PyComplex) throw new PyTypeError("float() argument must be a string or a real number, not 'complex'");
  return x;
}
/** `format(x, "n")` in the C locale: ints in full, floats as "g". */
export function pyFormatN(x: PyNum): string {
  if (typeof x === 'bigint') return x.toString();
  if (x instanceof PyComplex) throw new ValueError("Unknown format code 'n' for object of type 'complex'");
  if (Number.isNaN(x)) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  return pyFormatG(x);
}
/** `repr(x)` / `str(x)` of a Python number. */
export function pyNumRepr(x: PyNum): string {
  if (typeof x === 'bigint') return x.toString();
  if (x instanceof PyComplex) {
    const im = pyFloatRepr(x.im);
    if (x.re === 0 && !Object.is(x.re, -0)) return `${im}j`;
    const sign = x.im < 0 || Object.is(x.im, -0) || Number.isNaN(x.im) ? '' : '+';
    return `(${pyFloatRepr(x.re)}${sign}${im}j)`;
  }
  return pyFloatRepr(x);
}
/** Python `repr` of an int or float parsed back into a PyNum (registry exponents travel as reprs). */
function parsePyRepr(s: string): PyNum {
  if (/^-?\d+$/.test(s)) return BigInt(s);
  return Number(s);
}

// ============================================================================================
// 3. Registry state, unit-name resolution (verified against pint; unchanged algorithms)
// ============================================================================================

/** pint's UnitsContainer: canonical name -> exponent (a Python number), insertion-ordered like a dict. */
export type UnitsContainer = Map<string, PyNum>;

interface Def {
  is_base: boolean;
  scale: number;
  offset: number;
  is_multiplicative: boolean;
  is_logarithmic: boolean;
  logbase: number;
  logfactor: number;
  reference: UnitsContainer | null;
}

function containerFromReprs(rec: Readonly<Record<string, string>>): UnitsContainer {
  const c: UnitsContainer = new Map();
  for (const [k, v] of Object.entries(rec)) c.set(k, parsePyRepr(v));
  return c;
}

const DEFS = new Map<string, Def>();
for (const [name, d] of Object.entries(UNIT_DEFS)) {
  DEFS.set(name, {
    is_base: d.is_base,
    scale: d.scale,
    offset: d.offset,
    is_multiplicative: d.is_multiplicative,
    is_logarithmic: d.is_logarithmic,
    logbase: d.logbase,
    logfactor: d.logfactor,
    reference: d.reference === null ? null : containerFromReprs(d.reference),
  });
}
const INDEX = new Map<string, string>(Object.entries(UNITS_INDEX));
const DIMS = new Map<string, UnitsContainer | null>();
for (const [name, ref] of Object.entries(DIMENSIONS)) DIMS.set(name, ref === null ? null : containerFromReprs(ref));
const MKS_BASE = new Map<string, UnitsContainer>();
for (const [name, ref] of Object.entries(MKS_BASE_UNITS)) MKS_BASE.set(name, containerFromReprs(ref));

function getDef(name: string): Def {
  const d = DEFS.get(name);
  if (d === undefined) throw new KeyError(name);
  return d;
}

function parse_unit_name(unit_name: string): [string, string, string][] {
  const candidates = new Map<string, [string, string, string]>();
  for (const suffix of Object.keys(SUFFIXES)) {
    for (const prefix of PREFIX_KEYS) {
      if (unit_name.startsWith(prefix) && unit_name.endsWith(suffix)) {
        let name = unit_name.slice(prefix.length);
        if (suffix) {
          name = name.slice(0, name.length - suffix.length);
          if (name.length === 1) continue;
        }
        const canonical = INDEX.get(name);
        if (canonical !== undefined) {
          const triplet: [string, string, string] = [
            (PREFIXES[prefix] as { name: string }).name,
            canonical,
            SUFFIXES[suffix] as string,
          ];
          candidates.set(triplet.join(' '), triplet);
        }
      }
    }
  }
  // _dedup_candidates: prefer prefixed forms over the equivalent unprefixed name.
  for (const [cp, cu] of [...candidates.values()]) {
    if (cp) candidates.delete(['', cp + cu, ''].join(' '));
  }
  return [...candidates.values()];
}

/** Canonical name of a unit (registering prefixed units on first use, as pint does). */
export function get_name(name_or_alias: string): string {
  if (name_or_alias === 'dimensionless') return '';
  const direct = INDEX.get(name_or_alias);
  if (direct !== undefined) return direct;
  const candidates = parse_unit_name(name_or_alias);
  if (candidates.length === 0) throw new UndefinedUnitError(name_or_alias);
  const [prefix, unit_name] = candidates[0] as [string, string, string];
  if (prefix) {
    const base = getDef(unit_name);
    if (!base.is_multiplicative) throw new OffsetUnitCalculusError('Prefixing a unit requires multiplying the unit.');
    const name = prefix + unit_name;
    if (!DEFS.has(name)) {
      const prefix_def = PREFIXES[prefix] as { name: string; scale: number };
      DEFS.set(name, {
        is_base: false,
        scale: prefix_def.scale,
        offset: 0,
        is_multiplicative: true,
        is_logarithmic: false,
        logbase: 0,
        logfactor: 0,
        reference: new Map([[unit_name, 1n]]),
      });
      INDEX.set(name, name);
    }
    return name;
  }
  return unit_name;
}

// ============================================================================================
// 4. UnitsContainer operations (pint.util.UnitsContainer)
// ============================================================================================

/** `UnitsContainer.add(key, value)`: `udict` defaults to 0; a zero result pops the key (KeyError if absent). */
function ucAdd(c: UnitsContainer, key: string, value: PyNum): UnitsContainer {
  const newval = pyAdd(c.get(key) ?? 0n, value);
  const out = new Map(c);
  if (pyTruthy(newval)) out.set(key, newval);
  else if (out.has(key)) out.delete(key);
  else throw new KeyError(key);
  return out;
}
function ucMul(a: UnitsContainer, b: UnitsContainer): UnitsContainer {
  const out = new Map(a);
  for (const [k, v] of b) {
    const nv = pyAdd(out.get(k) ?? 0n, v);
    if (pyEqInt(nv, 0)) out.delete(k);
    else out.set(k, nv);
  }
  return out;
}
function ucTruediv(a: UnitsContainer, b: UnitsContainer): UnitsContainer {
  const out = new Map(a);
  for (const [k, v] of b) {
    const nv = pySub(out.get(k) ?? 0n, v);
    if (pyEqInt(nv, 0)) out.delete(k);
    else out.set(k, nv);
  }
  return out;
}
function ucPow(a: UnitsContainer, other: PyNum): UnitsContainer {
  const out: UnitsContainer = new Map();
  for (const [k, v] of a) out.set(k, pyMul(v, other));
  return out;
}
function ucRemove(a: UnitsContainer, keys: readonly string[]): UnitsContainer {
  const out = new Map(a);
  for (const k of keys) {
    if (!out.has(k)) throw new KeyError(k);
    out.delete(k);
  }
  return out;
}
function ucRename(a: UnitsContainer, oldkey: string, newkey: string): UnitsContainer {
  const out = new Map(a);
  if (!out.has(oldkey)) throw new KeyError(oldkey);
  const v = out.get(oldkey) as PyNum;
  out.delete(oldkey);
  out.set(newkey, v);
  return out;
}
function pyNumEq(a: PyNum, b: PyNum): boolean {
  if (typeof a === 'bigint' && typeof b === 'bigint') return a === b;
  const x = toComplex(a);
  const y = toComplex(b);
  return x.re === y.re && x.im === y.im;
}
function containerEq(a: UnitsContainer, b: UnitsContainer): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const o = b.get(k);
    if (o === undefined || !pyNumEq(o, v)) return false;
  }
  return true;
}
function containerKey(c: UnitsContainer): string {
  return [...c].map(([k, v]) => `${k}:${pyNumRepr(v)}`).join(',');
}

// ============================================================================================
// 5. Root units, dimensionality, conversion
// ============================================================================================

interface RootResult {
  factor: number;
  units: UnitsContainer;
}
const ROOT_CACHE = new Map<string, RootResult>();

/** `_get_root_units`: multiplicative factor and base units, with pint's cancellation and product order. */
export function get_root_units(input: UnitsContainer): RootResult {
  if (input.size === 0) return { factor: 1, units: new Map() };
  const key = containerKey(input);
  const cached = ROOT_CACHE.get(key);
  if (cached) return { factor: cached.factor, units: new Map(cached.units) };

  const accumulators = new Map<string, PyNum>();
  const numerator = new Map<number, number>();
  const denominator = new Map<number, number>();

  const recurse = (ref: UnitsContainer, exp: PyNum): void => {
    for (const [rawKey, refExp] of ref) {
      const exp2 = pyMul(exp, refExp);
      const name = get_name(rawKey);
      const reg = getDef(name);
      if (reg.is_base) {
        accumulators.set(name, pyAdd(accumulators.get(name) ?? 0n, exp2));
      } else {
        const scale_key = reg.scale;
        const e = pyToFloat(exp2);
        if (pyIsNegative(exp2)) denominator.set(scale_key, (denominator.get(scale_key) ?? 0) - e);
        else numerator.set(scale_key, (numerator.get(scale_key) ?? 0) + e);
        if (reg.reference !== null) recurse(reg.reference, exp2);
      }
    }
  };
  recurse(input, 1n);

  const termsAreUnique = (): boolean => {
    for (const k of numerator.keys()) if (denominator.has(k)) return false;
    return true;
  };
  while (!termsAreUnique()) {
    for (const [n_factor, n_exponent] of [...numerator]) {
      if (denominator.has(n_factor)) {
        const d = denominator.get(n_factor) as number;
        if (n_exponent >= d) {
          numerator.set(n_factor, n_exponent - d);
          denominator.delete(n_factor);
          continue;
        }
      }
    }
    for (const [d_factor, d_exponent] of [...denominator]) {
      if (numerator.has(d_factor)) {
        const n = numerator.get(d_factor) as number;
        if (d_exponent >= n) {
          denominator.set(d_factor, d_exponent - n);
          numerator.delete(d_factor);
          continue;
        }
      }
    }
  }

  let factor = 1;
  for (const [n_factor, n_exponent] of [...numerator]) {
    if (n_exponent === 0) numerator.delete(n_factor);
    else factor *= n_factor ** n_exponent;
  }
  for (const [d_factor, d_exponent] of [...denominator]) {
    if (d_exponent === 0) denominator.delete(d_factor);
    else factor *= d_factor ** -d_exponent;
  }

  const units: UnitsContainer = new Map();
  for (const [k, v] of accumulators) if (!pyEqInt(v, 0)) units.set(k, v);
  ROOT_CACHE.set(key, { factor, units: new Map(units) });
  return { factor, units };
}

function isDim(name: string): boolean {
  return name[0] === '[' && name[name.length - 1] === ']';
}

/** `_get_dimensionality`: base-dimension container (e.g. {"[length]": 3}). */
export function get_dimensionality(input: UnitsContainer): UnitsContainer {
  if (input.size === 0) return new Map();
  const accumulator = new Map<string, PyNum>();
  const recurse = (ref: UnitsContainer, exp: PyNum): void => {
    for (const [key, refExp] of ref) {
      const exp2 = pyMul(exp, refExp);
      if (isDim(key)) {
        const reg = DIMS.get(key);
        if (reg === undefined) throw new KeyError(key);
        if (reg !== null) recurse(reg, exp2);
        else accumulator.set(key, pyAdd(accumulator.get(key) ?? 0n, exp2));
      } else {
        const reg = getDef(get_name(key));
        if (reg.reference !== null) recurse(reg.reference, exp2);
      }
    }
  };
  recurse(input, 1n);
  accumulator.delete('[]');
  const dims: UnitsContainer = new Map();
  for (const [k, v] of accumulator) if (!pyEqInt(v, 0)) dims.set(k, v);
  return dims;
}

function get_conversion_factor(src: UnitsContainer, dst: UnitsContainer): number {
  const src_dim = get_dimensionality(src);
  const dst_dim = get_dimensionality(dst);
  if (!containerEq(src_dim, dst_dim)) {
    throw new DimensionalityError(formatUnits(src, '', false), formatUnits(dst, '', false), formatUnits(src_dim, '', false), formatUnits(dst_dim, '', false));
  }
  return get_root_units(ucTruediv(src, dst)).factor;
}

/** Magnitudes: a `Fraction` models Python's Fraction, a `PyNum` an int / float / complex. */
export type Magnitude = Fraction | PyNum;

type MagOp = 'add' | 'sub' | 'mul' | 'truediv' | 'floordiv' | 'mod' | 'pow';

function magOp(op: MagOp, a: Magnitude, b: Magnitude): Magnitude {
  if (a instanceof Fraction || b instanceof Fraction) {
    const af = a instanceof Fraction;
    const bf = b instanceof Fraction;
    // Fraction ∘ float -> float; Fraction ∘ complex -> complex; Fraction ∘ int/Fraction -> Fraction.
    if ((af && (typeof b === 'number' || b instanceof PyComplex)) || (bf && (typeof a === 'number' || a instanceof PyComplex))) {
      return magOp(op, a instanceof Fraction ? a.toNumber() : a, b instanceof Fraction ? b.toNumber() : b);
    }
    const x = a instanceof Fraction ? a : new Fraction(a as bigint);
    const y = b instanceof Fraction ? b : new Fraction(b as bigint);
    switch (op) {
      case 'add':
        return x.add(y);
      case 'sub':
        return x.sub(y);
      case 'mul':
        return x.mul(y);
      case 'truediv':
        if (y.isZero()) throw new ZeroDivisionError(`Fraction(${x.n}, 0)`);
        return x.div(y);
      case 'floordiv': {
        if (y.isZero()) throw new ZeroDivisionError(`Fraction(${x.n}, 0)`);
        const q = x.div(y);
        let f = q.n / q.d;
        if (q.n % q.d !== 0n && q.n < 0n) f -= 1n;
        return f;
      }
      case 'mod': {
        if (y.isZero()) throw new ZeroDivisionError(`Fraction(${x.n}, 0)`);
        const f = magOp('floordiv', x, y) as bigint;
        return x.sub(y.mul(f));
      }
      case 'pow':
        if (typeof b === 'bigint' || (b instanceof Fraction && b.d === 1n)) {
          const e = b instanceof Fraction ? b.n : b;
          if (e >= 0n) return new Fraction(x.n ** e, x.d ** e);
          if (x.isZero()) throw new ZeroDivisionError(`Fraction(${x.n}, 0)`);
          return new Fraction(x.d ** -e, x.n ** -e);
        }
        return pyPow(x.toNumber(), y.toNumber());
    }
  }
  const x = a as PyNum;
  const y = b as PyNum;
  switch (op) {
    case 'add':
      return pyAdd(x, y);
    case 'sub':
      return pySub(x, y);
    case 'mul':
      return pyMul(x, y);
    case 'truediv':
      return pyTruediv(x, y);
    case 'floordiv':
      return pyFloordiv(x, y);
    case 'mod':
      return pyMod(x, y);
    case 'pow':
      return pyPow(x, y);
  }
}

/** `PlainRegistry._convert`: multiply by the factor (`Fraction(str(factor))` for Fraction magnitudes). */
function convertPlain(value: Magnitude, src: UnitsContainer, dst: UnitsContainer): Magnitude {
  const factor = get_conversion_factor(src, dst);
  if (value instanceof Fraction) return value.mul(new Fraction(pyFloatRepr(factor)));
  return pyMul(value, factor);
}

function isMultiplicativeUnit(name: string): boolean {
  const d = DEFS.get(name);
  if (d !== undefined) return d.is_multiplicative;
  const names = parse_unit_name(name);
  if (names.length !== 1) throw new PintAssertionError();
  const base = DEFS.get((names[0] as [string, string, string])[1]);
  if (base === undefined) throw new UndefinedUnitError(name);
  return base.is_multiplicative;
}

/** `NonMultiplicativeRegistry._validate_and_extract`. */
function validateAndExtract(units: UnitsContainer): string | null {
  const nonmult: [string, PyNum][] = [];
  for (const [u, e] of units) if (!isMultiplicativeUnit(u)) nonmult.push([u, e]);
  if (nonmult.length > 1) throw new ValueError('more than one offset unit.');
  if (nonmult.length === 1) {
    const [nonmult_unit, exponent] = nonmult[0] as [string, PyNum];
    if (!pyEqInt(exponent, 1)) throw new ValueError('offset units in higher order.');
    if (units.size > 1) throw new ValueError('offset unit used in multiplicative context.');
    return nonmult_unit;
  }
  return null;
}

function addRefOfLogOrOffsetUnit(offset_unit: string, all_units: UnitsContainer): UnitsContainer {
  const slct = getDef(offset_unit);
  if (slct.is_logarithmic) {
    const ref = slct.reference ?? new Map();
    if (ref.size !== 0) {
      const [u, e] = [...ref][ref.size - 1] as [string, PyNum];
      return ucAdd(all_units, u, e);
    }
  }
  if (!slct.is_multiplicative) return slct.reference ?? new Map();
  return all_units;
}

function toReference(def: Def, value: Magnitude): Magnitude {
  if (def.is_logarithmic) {
    const v = value instanceof Fraction ? value.toNumber() : pyToFloat(value);
    return def.scale * Math.exp((v / def.logfactor) * Math.log(def.logbase));
  }
  return magOp('add', magOp('mul', value, def.scale), def.offset);
}
function fromReference(def: Def, value: Magnitude): Magnitude {
  if (def.is_logarithmic) {
    const v = value instanceof Fraction ? value.toNumber() : pyToFloat(value);
    return (def.logfactor * Math.log(v / def.scale)) / Math.log(def.logbase);
  }
  return magOp('truediv', magOp('sub', value, def.offset), def.scale);
}

/** `NonMultiplicativeRegistry._convert` (offset and logarithmic units) over `PlainRegistry._convert`. */
function convertUnits(value: Magnitude, src: UnitsContainer, dst: UnitsContainer): Magnitude {
  let src_offset_unit: string | null;
  try {
    src_offset_unit = validateAndExtract(src);
  } catch (ex) {
    if (ex instanceof ValueError) throw new DimensionalityError(formatUnits(src, '', false), formatUnits(dst, '', false), '', '', ` - In source units, ${ex.message}`);
    throw ex;
  }
  let dst_offset_unit: string | null;
  try {
    dst_offset_unit = validateAndExtract(dst);
  } catch (ex) {
    if (ex instanceof ValueError) throw new DimensionalityError(formatUnits(src, '', false), formatUnits(dst, '', false), '', '', ` - In destination units, ${ex.message}`);
    throw ex;
  }
  if (!(src_offset_unit || dst_offset_unit)) return convertPlain(value, src, dst);

  const src_dim = get_dimensionality(src);
  const dst_dim = get_dimensionality(dst);
  if (!containerEq(src_dim, dst_dim)) {
    throw new DimensionalityError(formatUnits(src, '', false), formatUnits(dst, '', false), formatUnits(src_dim, '', false), formatUnits(dst_dim, '', false));
  }
  if (src_offset_unit) {
    for (const u of dst.keys()) if (u.startsWith('delta_')) throw new DimensionalityError(formatUnits(src, '', false), formatUnits(dst, '', false));
    value = toReference(getDef(src_offset_unit), value);
    src = ucRemove(src, [src_offset_unit]);
    src = addRefOfLogOrOffsetUnit(src_offset_unit, src);
  }
  if (dst_offset_unit) {
    for (const u of src.keys()) if (u.startsWith('delta_')) throw new DimensionalityError(formatUnits(src, '', false), formatUnits(dst, '', false));
    dst = ucRemove(dst, [dst_offset_unit]);
    dst = addRefOfLogOrOffsetUnit(dst_offset_unit, dst);
  }
  value = convertPlain(value, src, dst);
  if (dst_offset_unit) value = fromReference(getDef(dst_offset_unit), value);
  return value;
}

/** `registry.convert(value, src, dst)`. */
function convert(value: Magnitude, src: UnitsContainer, dst: UnitsContainer): Magnitude {
  if (containerEq(src, dst)) return value;
  return convertUnits(value, src, dst);
}

/** `SystemRegistry._get_base_units` for the default system (mks). */
function get_base_units(input: UnitsContainer): UnitsContainer {
  const { units } = get_root_units(input);
  let destination: UnitsContainer = new Map();
  for (const [unit, value] of units) {
    const bu = MKS_BASE.get(unit);
    if (bu !== undefined) destination = ucMul(destination, ucPow(bu, value));
    else destination = ucMul(destination, new Map([[unit, value]]));
  }
  return destination;
}

// ============================================================================================
// 6. Formatting (`str(Unit)` sorted, `repr(Unit)` / `str(UnitsContainer)` in insertion order)
// ============================================================================================

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** `pretty_fmt_exponent`. */
function prettyFmtExponent(num: PyNum): string {
  let ret = pyFormatN(num).replace(/-/g, '⁻').replace(/\./g, '⋅');
  for (let n = 0; n < 10; n++) ret = ret.split(String(n)).join(SUPERSCRIPT_DIGITS[n] as string);
  return ret;
}

function codePointCompare(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done && y.done) return 0;
    if (x.done) return -1;
    if (y.done) return 1;
    const cx = (x.value as string).codePointAt(0) as number;
    const cy = (y.value as string).codePointAt(0) as number;
    if (cx !== cy) return cx - cy;
  }
}

/**
 * pint's `formatter()` over `prepare_compount_unit()`: 'D' (default) and 'P' (pretty) specs;
 * `sorted` mirrors `sort_by_unit_name` (str(Unit)); false keeps insertion order (repr).
 */
export function formatUnits(c: UnitsContainer, spec: string, sorted = true): string {
  if (c.size === 0) return 'dimensionless';
  let entries = [...c];
  let pos = entries.filter(([, e]) => !pyIsNegative(e));
  let neg = entries.filter(([, e]) => pyIsNegative(e));
  if (sorted) {
    pos = pos.sort((a, b) => codePointCompare(a[0], b[0]));
    neg = neg.sort((a, b) => codePointCompare(a[0], b[0]));
  }
  entries = [];
  const pretty = spec === 'P' || spec === '~P';
  const product_fmt = pretty ? '·' : ' * ';
  const division_fmt = pretty ? '/' : ' / ';
  const power = (name: string, e: PyNum): string => (pretty ? `${name}${prettyFmtExponent(e)}` : `${name} ** ${pyFormatN(e)}`);
  const pos_terms = pos.map(([name, e]) => (pyEqInt(e, 1) ? name : power(name, pyAbs(e))));
  const neg_terms = neg.map(([name, e]) => (pyEqInt(e, -1) ? name : power(name, pyAbs(e))));
  const pos_ret = pos_terms.join(product_fmt) || '1';
  if (neg_terms.length === 0) return pos_ret;
  return [pos_ret, neg_terms.join(division_fmt)].join(division_fmt);
}

// ============================================================================================
// 7. pint.util.string_preprocessor and the registry preprocessors
// ============================================================================================

const IDENT = '[_a-zA-Z][_a-zA-Z0-9]*';
const SUBS_RE_JS: readonly (readonly [RegExp, string])[] = [
  [/°/gu, 'degree'],
  [new RegExp(`(${PY_W}|[.\\-+*\\\\^])${PY_S}+`, 'gu'), '$1 '],
  [new RegExp(`(${IDENT}) squared`, 'gu'), '$1**2'],
  [new RegExp(`(${IDENT}) cubed`, 'gu'), '$1**3'],
  [new RegExp(`cubic (${IDENT})`, 'gu'), '$1**3'],
  [new RegExp(`square (${IDENT})`, 'gu'), '$1**2'],
  [new RegExp(`sq (${IDENT})`, 'gu'), '$1**2'],
  [new RegExp(`${PY_B}([0-9]+\\.?[0-9]*)(?=[e|E][a-zA-Z]|[a-df-zA-DF-Z])`, 'gu'), '$1*'],
  [new RegExp(`(${PY_W}|[.)])${PY_S}+(?=${PY_W}|\\()`, 'gu'), '$1*'],
];
const PRETTY_EXP_RE_JS = /(⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:\.[⁰¹²³⁴⁵⁶⁷⁸⁹]*)?)/gu;
const PRETTY_TABLE_JS = new Map<string, string>([...'⁰¹²³⁴⁵⁶⁷⁸⁹·⁻'].map((ch, i) => [ch, '0123456789*-'[i] as string]));

/** `pint.util.string_preprocessor`. */
export function string_preprocessor(input_string: string): string {
  input_string = input_string.split(',').join('');
  input_string = input_string.split(' per ').join('/');
  for (const [re, repl] of SUBS_RE_JS) input_string = input_string.replace(re, repl);
  input_string = input_string.replace(PRETTY_EXP_RE_JS, '**($1)');
  let out = '';
  for (const ch of input_string) out += PRETTY_TABLE_JS.get(ch) ?? ch;
  input_string = out.split('^').join('**');
  return input_string;
}

/** The registry's `preprocessors` (`%`, `‰`, `×`), applied before `string_preprocessor`. */
export function registry_preprocess(s: string): string {
  s = s.split('×').join('*');
  s = s.split('‰').join(' permille ');
  s = s.split('%').join(' percent ');
  return s;
}

// ============================================================================================
// 8. CPython 3.12 tokenizer (Parser/tokenizer.c, extra_tokens mode) + tokenize.tokenize glue
// ============================================================================================

export type TokType =
  | 'ENDMARKER'
  | 'NAME'
  | 'NUMBER'
  | 'STRING'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'OP'
  | 'FSTRING_START'
  | 'FSTRING_MIDDLE'
  | 'FSTRING_END'
  | 'COMMENT'
  | 'NL';
export interface TokenInfo {
  type: TokType;
  string: string;
}

const EOF = -1;
const MAXINDENT = 100;
const MAXLEVEL = 200;
const MAXFSTRINGLEVEL = 150;
const MAX_EXPR_NESTING = 3;
const TABSIZE = 8;
const ALTTABSIZE = 1;

type Done = 'OK' | 'EOF' | 'ERROR' | 'EOLS' | 'EOFS' | 'DEDENT' | 'TABSPACE' | 'TOODEEP' | 'LINECONT' | 'TOKEN';

const ERRORTOKEN = 'ERRORTOKEN';
type TokKind = TokType | typeof ERRORTOKEN;

interface TokMode {
  kind: 'regular' | 'fstring';
  quote: number;
  quote_size: number;
  raw: boolean;
  curly_bracket_depth: number;
  curly_bracket_expr_start_depth: number;
  in_format_spec: boolean;
  f_string_debug: boolean;
  f_string_start: number;
}

const CH = (s: string): number => s.charCodeAt(0);
const isdigit = (c: number): boolean => c >= 48 && c <= 57;
const isxdigit = (c: number): boolean => isdigit(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
const is_potential_identifier_start = (c: number): boolean => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95 || c >= 128;
const is_potential_identifier_char = (c: number): boolean => is_potential_identifier_start(c) || isdigit(c);
const tolower = (c: number): number => (c >= 65 && c <= 90 ? c + 32 : c);
const isprintable = (c: number): boolean => c >= 0x20 && c <= 0x7e;

const TWO_CHARS = new Set(['!=', '%=', '&=', '**', '*=', '+=', '-=', '->', '//', '/=', ':=', '<<', '<=', '<>', '==', '>=', '>>', '@=', '^=', '|=']);
const THREE_CHARS = new Set(['**=', '...', '//=', '<<=', '>>=']);

/** A port of `struct tok_state` and `tok_get_normal_mode` / `tok_get_fstring_mode`. */
class CTokenizer {
  private buf = '';
  private cur = 0;
  private inp = 0;
  private bufStart = 0;
  private lineIdx = 0;
  private done: Done = 'OK';
  private pending: PySyntaxError | null = null;
  private implicit_newline = false;
  private lineno = 0;
  private line_start = 0;
  private atbol = true;
  private pendin = 0;
  private indent = 0;
  private readonly indstack: number[] = [0];
  private readonly altindstack: number[] = [0];
  private level = 0;
  private comment_newline = false;
  private start: number | null = null;
  private first_lineno = 0;
  private readonly modes: TokMode[] = [CTokenizer.regularMode()];
  private p_start: number | null = null;
  private p_end: number | null = null;

  constructor(private readonly lines: readonly string[]) {}

  private static regularMode(): TokMode {
    return {
      kind: 'regular',
      quote: 0,
      quote_size: 0,
      raw: false,
      curly_bracket_depth: 0,
      curly_bracket_expr_start_depth: 0,
      in_format_spec: false,
      f_string_debug: false,
      f_string_start: 0,
    };
  }

  private mode(): TokMode {
    return this.modes[this.modes.length - 1] as TokMode;
  }
  private insideFstring(): boolean {
    return this.modes.length > 1;
  }

  private nextc(): number {
    for (;;) {
      if (this.cur !== this.inp) return this.buf.charCodeAt(this.cur++);
      if (this.done !== 'OK') return EOF;
      // tok_underflow_readline
      if (this.start === null && !this.insideFstring()) this.bufStart = this.cur;
      if (this.lineIdx >= this.lines.length) {
        this.done = 'EOF';
        return EOF;
      }
      let line = this.lines[this.lineIdx++] as string;
      this.implicit_newline = false;
      if (!line.endsWith('\n')) {
        line += '\n';
        this.implicit_newline = true;
      }
      this.buf += line;
      this.inp = this.buf.length;
      this.lineno += 1;
      this.line_start = this.cur;
      if (line.includes('\0')) {
        this.syntaxerror('source code cannot contain null bytes');
        this.cur = this.inp;
        return EOF;
      }
    }
  }

  private backup(c: number): void {
    if (c !== EOF) this.cur -= 1;
  }

  private syntaxerror(msg: string): TokKind {
    if (this.done === 'ERROR') return ERRORTOKEN;
    this.pending = new PySyntaxError(msg);
    this.done = 'ERROR';
    return ERRORTOKEN;
  }

  private indenterror(): TokKind {
    this.done = 'TABSPACE';
    this.cur = this.inp;
    return ERRORTOKEN;
  }

  private continuationLine(): number {
    let c = this.nextc();
    if (c === CH('\r')) c = this.nextc();
    if (c !== CH('\n')) {
      this.done = 'LINECONT';
      return -1;
    }
    c = this.nextc();
    if (c === EOF) {
      this.done = 'EOF';
      this.cur = this.inp;
      return -1;
    }
    this.backup(c);
    return c;
  }

  private decimalTail(): number {
    let c: number;
    for (;;) {
      do {
        c = this.nextc();
      } while (isdigit(c));
      if (c !== CH('_')) break;
      c = this.nextc();
      if (!isdigit(c)) {
        this.backup(c);
        this.syntaxerror('invalid decimal literal');
        return 0;
      }
    }
    return c;
  }

  private tok(type: TokKind, p_start: number | null = this.start, p_end: number | null = this.cur): TokKind {
    this.p_start = p_start;
    this.p_end = p_end;
    return type;
  }

  private getNormalMode(current_tok: TokMode): TokKind {
    let c: number;
    let blankline = false;
    this.p_start = null;
    this.p_end = null;
    // nextline:
    for (;;) {
      this.start = null;
      blankline = false;
      if (this.atbol) {
        let col = 0;
        let altcol = 0;
        this.atbol = false;
        let cont_line_col = 0;
        for (;;) {
          c = this.nextc();
          if (c === CH(' ')) {
            col++;
            altcol++;
          } else if (c === CH('\t')) {
            col = (Math.floor(col / TABSIZE) + 1) * TABSIZE;
            altcol = (Math.floor(altcol / ALTTABSIZE) + 1) * ALTTABSIZE;
          } else if (c === 0x0c) {
            col = altcol = 0;
          } else if (c === CH('\\')) {
            cont_line_col = cont_line_col ? cont_line_col : col;
            if ((c = this.continuationLine()) === -1) return this.tok(ERRORTOKEN);
          } else {
            break;
          }
        }
        this.backup(c);
        if (c === CH('#') || c === CH('\n') || c === CH('\r')) blankline = true;
        if (!blankline && this.level === 0) {
          col = cont_line_col ? cont_line_col : col;
          altcol = cont_line_col ? cont_line_col : altcol;
          const top = this.indstack[this.indent] as number;
          const alttop = this.altindstack[this.indent] as number;
          if (col === top) {
            if (altcol !== alttop) return this.tok(this.indenterror());
          } else if (col > top) {
            if (this.indent + 1 >= MAXINDENT) {
              this.done = 'TOODEEP';
              this.cur = this.inp;
              return this.tok(ERRORTOKEN);
            }
            if (altcol <= alttop) return this.tok(this.indenterror());
            this.pendin++;
            this.indent++;
            this.indstack[this.indent] = col;
            this.altindstack[this.indent] = altcol;
          } else {
            while (this.indent > 0 && col < (this.indstack[this.indent] as number)) {
              this.pendin--;
              this.indent--;
            }
            if (col !== (this.indstack[this.indent] as number)) {
              this.done = 'DEDENT';
              this.cur = this.inp;
              return this.tok(ERRORTOKEN);
            }
            if (altcol !== (this.altindstack[this.indent] as number)) return this.tok(this.indenterror());
          }
        }
      }

      this.start = this.cur;
      if (this.pendin !== 0) {
        if (this.pendin < 0) {
          this.pendin++;
          return this.tok('DEDENT', this.cur, this.cur);
        }
        this.pendin--;
        return this.tok('INDENT', this.bufStart, this.cur);
      }

      c = this.nextc();
      this.backup(c);

      // again:
      for (;;) {
        this.start = null;
        do {
          c = this.nextc();
        } while (c === CH(' ') || c === CH('\t') || c === 0x0c);
        this.start = this.cur - 1;

        if (c === CH('#')) {
          while (c !== EOF && c !== CH('\n') && c !== CH('\r')) c = this.nextc();
          this.backup(c);
          this.comment_newline = blankline;
          return this.tok('COMMENT');
        }

        if (c === EOF) {
          if (this.level) return this.tok(ERRORTOKEN);
          return this.tok(this.done === 'EOF' ? 'ENDMARKER' : ERRORTOKEN, null, null);
        }

        if (is_potential_identifier_start(c)) {
          let saw_b = false;
          let saw_r = false;
          let saw_u = false;
          let saw_f = false;
          let quoted = false;
          for (;;) {
            if (!(saw_b || saw_u || saw_f) && (c === CH('b') || c === CH('B'))) saw_b = true;
            else if (!(saw_b || saw_u || saw_r || saw_f) && (c === CH('u') || c === CH('U'))) saw_u = true;
            else if (!(saw_r || saw_u) && (c === CH('r') || c === CH('R'))) saw_r = true;
            else if (!(saw_f || saw_b || saw_u) && (c === CH('f') || c === CH('F'))) saw_f = true;
            else break;
            c = this.nextc();
            if (c === CH('"') || c === CH("'")) {
              quoted = true;
              break;
            }
          }
          if (!quoted) {
            while (is_potential_identifier_char(c)) c = this.nextc();
            this.backup(c);
            return this.tok('NAME');
          }
          if (saw_f) return this.fStringQuote(c);
          return this.letterQuote(c);
        }

        if (c === CH('\r')) c = this.nextc();

        if (c === CH('\n')) {
          this.atbol = true;
          if (blankline || this.level > 0) {
            if (this.comment_newline) this.comment_newline = false;
            return this.tok('NL');
          }
          if (this.comment_newline) {
            this.comment_newline = false;
            return this.tok('NL');
          }
          return this.tok('NEWLINE', this.start, this.cur - 1);
        }

        if (c === CH('.')) {
          c = this.nextc();
          if (isdigit(c)) return this.fraction(c);
          if (c === CH('.')) {
            c = this.nextc();
            if (c === CH('.')) return this.tok('OP');
            this.backup(c);
            this.backup(CH('.'));
          } else {
            this.backup(c);
          }
          return this.tok('OP');
        }

        if (isdigit(c)) return this.number(c);

        if (c === CH("'") || c === CH('"')) return this.letterQuote(c);

        if (c === CH('\\')) {
          if ((c = this.continuationLine()) === -1) return this.tok(ERRORTOKEN);
          continue; // again
        }

        const is_punctuation = c === CH(':') || c === CH('}') || c === CH('!') || c === CH('{');
        if (is_punctuation && this.insideFstring() && current_tok.curly_bracket_expr_start_depth >= 0) {
          const cursor = current_tok.curly_bracket_depth - (c !== CH('{') ? 1 : 0);
          if (c === CH(':') && cursor === current_tok.curly_bracket_expr_start_depth) {
            current_tok.kind = 'fstring';
            current_tok.in_format_spec = true;
            return this.tok('OP');
          }
        }

        {
          const c2 = this.nextc();
          const two = String.fromCharCode(c, c2);
          if (c2 !== EOF && TWO_CHARS.has(two)) {
            const c3 = this.nextc();
            if (c3 === EOF || !THREE_CHARS.has(two + String.fromCharCode(c3))) this.backup(c3);
            return this.tok('OP');
          }
          this.backup(c2);
        }

        switch (c) {
          case CH('('):
          case CH('['):
          case CH('{'):
            if (this.level >= MAXLEVEL) return this.tok(this.syntaxerror('too many nested parentheses'));
            this.level++;
            if (this.insideFstring()) current_tok.curly_bracket_depth++;
            break;
          case CH(')'):
          case CH(']'):
          case CH('}'):
            if (this.insideFstring() && !current_tok.curly_bracket_depth && c === CH('}')) {
              return this.tok(this.syntaxerror("f-string: single '}' is not allowed"));
            }
            if (this.level > 0) this.level--;
            if (this.insideFstring()) {
              current_tok.curly_bracket_depth--;
              if (current_tok.curly_bracket_depth < 0) {
                return this.tok(this.syntaxerror(`f-string: unmatched '${String.fromCharCode(c)}'`));
              }
              if (c === CH('}') && current_tok.curly_bracket_depth === current_tok.curly_bracket_expr_start_depth) {
                current_tok.curly_bracket_expr_start_depth--;
                current_tok.kind = 'fstring';
                current_tok.in_format_spec = false;
                current_tok.f_string_debug = false;
              }
            }
            break;
          default:
            break;
        }

        if (c >= 128) {
          // Only reachable after '\r': the C tokenizer took the first UTF-8 byte of a non-ASCII
          // character as a one-byte punctuation token ("\r" + lead byte), and decoding that token
          // string fails. Valid lead bytes (0xC2..0xF4) are all printable as Latin-1, so no
          // "non-printable" error precedes it.
          const cu = c;
          let cp = cu;
          if (cu >= 0xd800 && cu <= 0xdbff) cp = 0x10000 + ((cu - 0xd800) << 10) + (this.buf.charCodeAt(this.cur) - 0xdc00);
          const lead = cp < 0x800 ? 0xc0 | (cp >> 6) : cp < 0x10000 ? 0xe0 | (cp >> 12) : 0xf0 | (cp >> 18);
          throw new UnicodeDecodeError(`'utf-8' codec can't decode byte 0x${lead.toString(16)} in position 1: unexpected end of data`);
        }
        if (!isprintable(c)) {
          return this.tok(this.syntaxerror(`invalid non-printable character U+${c.toString(16).toUpperCase().padStart(4, '0')}`));
        }
        if (c === CH('=') && current_tok.curly_bracket_expr_start_depth >= 0) current_tok.f_string_debug = true;
        return this.tok('OP');
      }
    }
  }

  /** The `fraction:` / `exponent:` / `imaginary:` tail of the number scanner; `c` is the first char after '.'. */
  private fraction(c: number): TokKind {
    if (isdigit(c)) {
      c = this.decimalTail();
      if (c === 0) return this.tok(ERRORTOKEN);
    }
    return this.exponentOrImaginary(c);
  }

  private exponentOrImaginary(c: number): TokKind {
    if (c === CH('e') || c === CH('E')) {
      const e = c;
      c = this.nextc();
      if (c === CH('+') || c === CH('-')) {
        c = this.nextc();
        if (!isdigit(c)) {
          this.backup(c);
          return this.tok(this.syntaxerror('invalid decimal literal'));
        }
      } else if (!isdigit(c)) {
        this.backup(c);
        this.backup(e);
        return this.tok('NUMBER');
      }
      c = this.decimalTail();
      if (c === 0) return this.tok(ERRORTOKEN);
    }
    if (c === CH('j') || c === CH('J')) c = this.nextc();
    this.backup(c);
    return this.tok('NUMBER');
  }

  private number(c: number): TokKind {
    if (c === CH('0')) {
      c = this.nextc();
      if (c === CH('x') || c === CH('X')) {
        c = this.nextc();
        do {
          if (c === CH('_')) c = this.nextc();
          if (!isxdigit(c)) {
            this.backup(c);
            return this.tok(this.syntaxerror('invalid hexadecimal literal'));
          }
          do {
            c = this.nextc();
          } while (isxdigit(c));
        } while (c === CH('_'));
      } else if (c === CH('o') || c === CH('O')) {
        c = this.nextc();
        do {
          if (c === CH('_')) c = this.nextc();
          if (c < CH('0') || c >= CH('8')) {
            if (isdigit(c)) return this.tok(this.syntaxerror(`invalid digit '${String.fromCharCode(c)}' in octal literal`));
            this.backup(c);
            return this.tok(this.syntaxerror('invalid octal literal'));
          }
          do {
            c = this.nextc();
          } while (c >= CH('0') && c < CH('8'));
        } while (c === CH('_'));
        if (isdigit(c)) return this.tok(this.syntaxerror(`invalid digit '${String.fromCharCode(c)}' in octal literal`));
      } else if (c === CH('b') || c === CH('B')) {
        c = this.nextc();
        do {
          if (c === CH('_')) c = this.nextc();
          if (c !== CH('0') && c !== CH('1')) {
            if (isdigit(c)) return this.tok(this.syntaxerror(`invalid digit '${String.fromCharCode(c)}' in binary literal`));
            this.backup(c);
            return this.tok(this.syntaxerror('invalid binary literal'));
          }
          do {
            c = this.nextc();
          } while (c === CH('0') || c === CH('1'));
        } while (c === CH('_'));
        if (isdigit(c)) return this.tok(this.syntaxerror(`invalid digit '${String.fromCharCode(c)}' in binary literal`));
      } else {
        for (;;) {
          if (c === CH('_')) {
            c = this.nextc();
            if (!isdigit(c)) {
              this.backup(c);
              return this.tok(this.syntaxerror('invalid decimal literal'));
            }
          }
          if (c !== CH('0')) break;
          c = this.nextc();
        }
        if (isdigit(c)) {
          c = this.decimalTail();
          if (c === 0) return this.tok(ERRORTOKEN);
        }
        if (c === CH('.')) {
          c = this.nextc();
          return this.fraction(c);
        }
        return this.exponentOrImaginary(c);
      }
    } else {
      c = this.decimalTail();
      if (c === 0) return this.tok(ERRORTOKEN);
      if (c === CH('.')) {
        c = this.nextc();
        return this.fraction(c);
      }
      return this.exponentOrImaginary(c);
    }
    this.backup(c);
    return this.tok('NUMBER');
  }

  private fStringQuote(c: number): TokKind {
    const quote = c;
    let quote_size = 1;
    this.first_lineno = this.lineno;
    const after_quote = this.nextc();
    if (after_quote === quote) {
      const after_after_quote = this.nextc();
      if (after_after_quote === quote) {
        quote_size = 3;
      } else {
        this.backup(after_after_quote);
        this.backup(after_quote);
      }
    }
    if (after_quote !== quote) this.backup(after_quote);
    if (this.modes.length >= MAXFSTRINGLEVEL) return this.tok(this.syntaxerror('too many nested f-strings'));
    const start = this.start as number;
    const first = tolower(this.buf.charCodeAt(start));
    const mode: TokMode = {
      kind: 'fstring',
      quote,
      quote_size,
      raw: first === CH('r') ? true : tolower(this.buf.charCodeAt(start + 1)) === CH('r'),
      curly_bracket_depth: 0,
      curly_bracket_expr_start_depth: -1,
      in_format_spec: false,
      f_string_debug: false,
      f_string_start: start,
    };
    this.modes.push(mode);
    return this.tok('FSTRING_START');
  }

  private letterQuote(c: number): TokKind {
    const quote = c;
    let quote_size = 1;
    let end_quote_size = 0;
    this.first_lineno = this.lineno;
    c = this.nextc();
    if (c === quote) {
      c = this.nextc();
      if (c === quote) quote_size = 3;
      else end_quote_size = 1;
    }
    if (c !== quote) this.backup(c);
    while (end_quote_size !== quote_size) {
      c = this.nextc();
      if (this.done === 'ERROR') return this.tok(ERRORTOKEN);
      if (c === EOF || (quote_size === 1 && c === CH('\n'))) {
        const start = this.lineno;
        this.lineno = this.first_lineno;
        if (this.insideFstring()) {
          const m = this.mode();
          if (m.quote === quote && m.quote_size === quote_size) return this.tok(this.syntaxerror("f-string: expecting '}'"));
        }
        if (quote_size === 3) {
          this.syntaxerror(`unterminated triple-quoted string literal (detected at line ${start})`);
          if (c !== CH('\n')) this.done = 'EOFS';
          return this.tok(ERRORTOKEN);
        }
        this.syntaxerror(`unterminated string literal (detected at line ${start})`);
        if (c !== CH('\n')) this.done = 'EOLS';
        return this.tok(ERRORTOKEN);
      }
      if (c === quote) {
        end_quote_size += 1;
      } else {
        end_quote_size = 0;
        if (c === CH('\\')) {
          c = this.nextc();
          if (c === CH('\r')) c = this.nextc();
        }
      }
    }
    return this.tok('STRING');
  }

  private getFstringMode(current_tok: TokMode): TokKind {
    let end_quote_size = 0;
    let unicode_escape = false;
    this.start = this.cur;
    this.first_lineno = this.lineno;

    const start_char = this.nextc();
    if (start_char === CH('{')) {
      const peek1 = this.nextc();
      this.backup(peek1);
      this.backup(start_char);
      if (peek1 !== CH('{')) {
        current_tok.curly_bracket_expr_start_depth++;
        if (current_tok.curly_bracket_expr_start_depth >= MAX_EXPR_NESTING) {
          return this.tok(this.syntaxerror('f-string: expressions nested too deeply'));
        }
        current_tok.kind = 'regular';
        return this.getNormalMode(current_tok);
      }
    } else {
      this.backup(start_char);
    }

    let atEnd = true;
    for (let i = 0; i < current_tok.quote_size; i++) {
      const quote = this.nextc();
      if (quote !== current_tok.quote) {
        this.backup(quote);
        atEnd = false;
        break;
      }
    }
    if (atEnd) {
      const r = this.tok('FSTRING_END');
      this.modes.pop();
      return r;
    }

    // f_string_middle:
    while (end_quote_size !== current_tok.quote_size) {
      const c = this.nextc();
      if (this.done === 'ERROR') return this.tok(ERRORTOKEN);
      const in_format_spec = current_tok.in_format_spec && current_tok.curly_bracket_expr_start_depth >= 0;
      if (c === EOF || (current_tok.quote_size === 1 && c === CH('\n'))) {
        if (in_format_spec && c === CH('\n')) {
          this.backup(c);
          current_tok.kind = 'regular';
          current_tok.in_format_spec = false;
          return this.tok('FSTRING_MIDDLE');
        }
        const start = this.lineno;
        if (current_tok.quote_size === 3) {
          this.syntaxerror(`unterminated triple-quoted f-string literal (detected at line ${start})`);
          if (c !== CH('\n')) this.done = 'EOFS';
          return this.tok(ERRORTOKEN);
        }
        return this.tok(this.syntaxerror(`unterminated f-string literal (detected at line ${start})`));
      }
      if (c === current_tok.quote) {
        end_quote_size += 1;
        continue;
      }
      end_quote_size = 0;
      if (c === CH('{')) {
        const peek = this.nextc();
        if (peek !== CH('{') || in_format_spec) {
          this.backup(peek);
          this.backup(c);
          current_tok.curly_bracket_expr_start_depth++;
          if (current_tok.curly_bracket_expr_start_depth >= MAX_EXPR_NESTING) {
            return this.tok(this.syntaxerror('f-string: expressions nested too deeply'));
          }
          current_tok.kind = 'regular';
          current_tok.in_format_spec = false;
          return this.tok('FSTRING_MIDDLE');
        }
        return this.tok('FSTRING_MIDDLE', this.start, this.cur - 1);
      } else if (c === CH('}')) {
        if (unicode_escape) return this.tok('FSTRING_MIDDLE');
        const peek = this.nextc();
        const cursor = current_tok.curly_bracket_depth;
        if (peek === CH('}') && !in_format_spec && cursor === 0) return this.tok('FSTRING_MIDDLE', this.start, this.cur - 1);
        this.backup(peek);
        this.backup(c);
        current_tok.kind = 'regular';
        return this.tok('FSTRING_MIDDLE');
      } else if (c === CH('\\')) {
        let peek = this.nextc();
        if (peek === CH('\r')) peek = this.nextc();
        if (peek === CH('{') || peek === CH('}')) {
          this.backup(peek);
          continue;
        }
        if (!current_tok.raw) {
          if (peek === CH('N')) {
            peek = this.nextc();
            if (peek === CH('{')) unicode_escape = true;
            else this.backup(peek);
          }
        }
      }
    }
    for (let i = 0; i < current_tok.quote_size; i++) this.backup(current_tok.quote);
    return this.tok('FSTRING_MIDDLE');
  }

  private get(): TokKind {
    const current_tok = this.mode();
    if (current_tok.kind === 'regular') return this.getNormalMode(current_tok);
    return this.getFstringMode(current_tok);
  }

  /** `tokenizeriter_next` in a loop: the token list, or the exception CPython raises. */
  run(): TokenInfo[] {
    const out: TokenInfo[] = [];
    for (;;) {
      const type = this.get();
      if (type === ERRORTOKEN) {
        if (this.pending) throw this.pending;
        throw this.tokenizerError();
      }
      let str = this.p_start === null || this.p_end === null ? '' : this.buf.slice(this.p_start, this.p_end);
      if (type === 'NEWLINE') {
        if (!this.implicit_newline) str = this.buf.charCodeAt(this.start as number) === CH('\r') ? '\r\n' : '\n';
      } else if (type === 'NL') {
        if (this.implicit_newline) str = '';
      }
      out.push({ type, string: str });
      if (type === 'ENDMARKER') return out;
    }
  }

  private tokenizerError(): PySyntaxError {
    switch (this.done) {
      case 'EOF':
        return new PySyntaxError('unexpected EOF in multi-line statement');
      case 'DEDENT':
        return new IndentationError('unindent does not match any outer indentation level');
      case 'TABSPACE':
        return new TabError('inconsistent use of tabs and spaces in indentation');
      case 'TOODEEP':
        return new IndentationError('too many levels of indentation');
      case 'LINECONT':
        return new PySyntaxError('unexpected character after line continuation character');
      case 'TOKEN':
        return new PySyntaxError('invalid token');
      default:
        return new PySyntaxError('unknown tokenization error');
    }
  }
}

// ---- tokenize.tokenize: the PEP 263 stage, encoding and the C-tokenizer error translation ----

/** `str.encode("utf-8")` as bytes, raising `UnicodeEncodeError` for lone surrogates. */
function utf8Encode(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const cu = s.charCodeAt(i);
    let cp = cu;
    if (cu >= 0xd800 && cu <= 0xdbff && i + 1 < s.length) {
      const lo = s.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cu - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp >= 0xd800 && cp <= 0xdfff) {
      throw new UnicodeEncodeError(`'utf-8' codec can't encode character '\\u${cp.toString(16).padStart(4, '0')}' in position ${i}: surrogates not allowed`);
    }
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
}

const COOKIE_RE = /^[ \t\f]*#[^\n]*?coding[:=][ \t]*([-\w.]+)/;
const BLANK_RE = /^[ \t\f]*(?:[#\r\n]|\n?$)/;

/** `tokenize._get_normal_name`. */
function getNormalName(orig_enc: string): string {
  const enc = orig_enc.slice(0, 12).toLowerCase().split('_').join('-');
  if (enc === 'utf-8' || enc.startsWith('utf-8-')) return 'utf-8';
  if (
    enc === 'latin-1' ||
    enc === 'iso-8859-1' ||
    enc === 'iso-latin-1' ||
    enc.startsWith('latin-1-') ||
    enc.startsWith('iso-8859-1-') ||
    enc.startsWith('iso-latin-1-')
  ) {
    return 'iso-8859-1';
  }
  return orig_enc;
}

/** `encodings.normalize_encoding` (ASCII input only, as the cookie regex guarantees). */
function normalizeEncoding(encoding: string): string {
  let chars = '';
  let punct = false;
  for (const c of encoding) {
    if (/[A-Za-z0-9.]/.test(c)) {
      if (punct && chars) chars += '_';
      chars += c;
      punct = false;
    } else {
      punct = true;
    }
  }
  return chars;
}

/** `codecs.lookup(name)` -> the encodings-package module, or null (LookupError). */
function codecLookup(name: string): string | null {
  const norm = normalizeEncoding(name.toLowerCase().split(' ').join('-'));
  const aliased = CODEC_ALIASES[norm] ?? CODEC_ALIASES[norm.split('.').join('_')];
  const modnames = aliased !== undefined ? [aliased, norm] : [norm];
  for (const modname of modnames) {
    if (!modname || modname.includes('.')) continue;
    if (Object.hasOwn(CODEC_MODULES, modname)) return modname;
  }
  return null;
}

/** `tokenize.detect_encoding` + the per-line decoding `tokenize.tokenize` feeds the C tokenizer. */
function decodedLines(text: string): string[] {
  let bytes = utf8Encode(text);
  let bom_found = false;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bom_found = true;
    bytes = bytes.slice(3);
  }
  // Split into readline() chunks (after every '\n').
  const rawLines: number[][] = [];
  let cur: number[] = [];
  for (const b of bytes) {
    cur.push(b);
    if (b === 0x0a) {
      rawLines.push(cur);
      cur = [];
    }
  }
  if (cur.length) rawLines.push(cur);
  const utf8 = (line: number[]): string => {
    // Valid UTF-8 by construction: decode by re-reading the original text is not possible here, so decode manually.
    let s = '';
    for (let i = 0; i < line.length; ) {
      const b0 = line[i] as number;
      let cp: number;
      let n: number;
      if (b0 < 0x80) {
        cp = b0;
        n = 1;
      } else if (b0 < 0xe0) {
        cp = ((b0 & 0x1f) << 6) | ((line[i + 1] as number) & 0x3f);
        n = 2;
      } else if (b0 < 0xf0) {
        cp = ((b0 & 0x0f) << 12) | (((line[i + 1] as number) & 0x3f) << 6) | ((line[i + 2] as number) & 0x3f);
        n = 3;
      } else {
        cp = ((b0 & 0x07) << 18) | (((line[i + 1] as number) & 0x3f) << 12) | (((line[i + 2] as number) & 0x3f) << 6) | ((line[i + 3] as number) & 0x3f);
        n = 4;
      }
      s += String.fromCodePoint(cp);
      i += n;
    }
    return s;
  };
  const findCookie = (line: number[]): string | null => {
    const m = COOKIE_RE.exec(utf8(line));
    if (!m) return null;
    const encoding = getNormalName(m[1] as string);
    if (codecLookup(encoding) === null) throw new PySyntaxError(`unknown encoding: ${encoding}`);
    if (bom_found) {
      if (encoding !== 'utf-8') throw new PySyntaxError('encoding problem: utf-8');
      return encoding + '-sig';
    }
    return encoding;
  };
  let encoding: string | null = null;
  const first = rawLines[0];
  if (first !== undefined) {
    encoding = findCookie(first);
    if (encoding === null && BLANK_RE.test(utf8(first))) {
      const second = rawLines[1];
      if (second !== undefined) encoding = findCookie(second);
    }
  }
  encoding = encoding ?? 'utf-8';
  if (encoding === 'utf-8-sig') encoding = 'utf-8';
  const module = codecLookup(encoding) as string;
  const how = CODEC_MODULES[module] as string;
  if (how === 'utf8') return rawLines.map(utf8);
  if (how === 'latin1') return rawLines.map((line) => line.map((b) => String.fromCharCode(b)).join(''));
  if (how === 'ascii') return rawLines.map((line) => line.map((b) => (b < 0x80 ? String.fromCharCode(b) : '�')).join(''));
  if (how.startsWith('raise:')) throw how === 'raise:LookupError' ? new LookupError(`'${encoding}' is not a text encoding; use codecs.decode() to handle arbitrary codecs`) : new UnicodeError(`${encoding}: cannot decode`, how.slice(6));
  if (how === 'ascii-compatible' && rawLines.every((line) => line.every((b) => b < 0x80))) return rawLines.map(utf8);
  throw new PintPortLimitError(`coding cookie '${encoding}': no codec table for '${module}' in this port`);
}

/** `pint.pint_eval.plain_tokenizer` (CPython `tokenize.tokenize`), minus the ENCODING token. */
export function tokenizer(input_string: string): TokenInfo[] {
  // detect_encoding's SyntaxErrors are raised by `tokenize.tokenize` itself, untranslated.
  const lines = decodedLines(input_string);
  try {
    return new CTokenizer(lines).run();
  } catch (e) {
    // _generate_tokens_from_c_tokenizer: plain SyntaxError -> TokenError; subclasses propagate.
    if (e instanceof PySyntaxError && e.name === 'SyntaxError' && !(e instanceof IndentationError)) {
      const msg = e.message.includes('unterminated triple-quoted string literal') ? 'EOF in multi-line string' : e.message;
      throw new TokenError(msg);
    }
    throw e;
  }
}

// ============================================================================================
// 9. pint.pint_eval: build_eval_tree / EvalTreeNode.evaluate
// ============================================================================================

const OP_PRIORITY: Readonly<Record<string, number>> = {
  '+/-': 4,
  '**': 3,
  '^': 3,
  unary: 2,
  '*': 1,
  '': 1,
  '//': 1,
  '/': 1,
  '%': 1,
  '+': 0,
  '-': 0,
};
const BINARY_OPS = new Set(['+/-', '**', '*', '', '/', '+', '-', '%', '//']);
const UNARY_OPS = new Set(['+', '-']);

class EvalTreeNode {
  constructor(
    readonly left: EvalTreeNode | TokenInfo,
    readonly operator: TokenInfo | null = null,
    readonly right: EvalTreeNode | null = null,
  ) {}
}

function _build_eval_tree(tokens: readonly TokenInfo[], index: number, depth: number, prev_op: string): [EvalTreeNode, number] {
  let result: EvalTreeNode | null = null;
  const priorityOf = (op: string): number => (Object.hasOwn(OP_PRIORITY, op) ? (OP_PRIORITY[op] as number) : -1);
  for (;;) {
    const current_token = tokens[index];
    if (current_token === undefined) throw new PyException('IndexError', 'list index out of range');
    const token_type = current_token.type;
    const token_text = current_token.string;

    if (token_type === 'OP') {
      if (token_text === ')') {
        if (prev_op === '<none>') throw new DefinitionSyntaxError(`unopened parentheses in tokens: ${token_text}`);
        if (prev_op === '(') {
          if (result === null) throw new PintAssertionError();
          return [result, index];
        }
        if (result === null) throw new PintAssertionError();
        return [result, index - 1];
      } else if (token_text === '(') {
        const [right, idx] = _build_eval_tree(tokens, index + 1, 0, token_text);
        index = idx;
        if ((tokens[index] as TokenInfo).string !== ')') throw new DefinitionSyntaxError('weird exit from parentheses');
        result = result ? new EvalTreeNode(result, null, right) : right;
      } else if (Object.hasOwn(OP_PRIORITY, token_text)) {
        if (result) {
          if ((OP_PRIORITY[token_text] as number) <= priorityOf(prev_op) && token_text !== '**' && token_text !== '^') {
            return [result, index - 1];
          }
          const [right, idx] = _build_eval_tree(tokens, index + 1, depth + 1, token_text);
          index = idx;
          result = new EvalTreeNode(result, current_token, right);
        } else {
          const [right, idx] = _build_eval_tree(tokens, index + 1, depth + 1, 'unary');
          index = idx;
          result = new EvalTreeNode(right, current_token);
        }
      }
    } else if (token_type === 'NUMBER' || token_type === 'NAME') {
      if (result) {
        if ((OP_PRIORITY[''] as number) <= priorityOf(prev_op)) return [result, index - 1];
        const [right, idx] = _build_eval_tree(tokens, index, depth + 1, '');
        index = idx;
        result = new EvalTreeNode(result, null, right);
      } else {
        result = new EvalTreeNode(current_token);
      }
    }

    if ((tokens[index] as TokenInfo).type === 'ENDMARKER') {
      if (prev_op === '(') throw new DefinitionSyntaxError('unclosed parentheses in tokens');
      if (depth > 0 || prev_op) {
        if (result === null) throw new PintAssertionError();
        return [result, index];
      }
      if (result === null) throw new PintAssertionError();
      return [result, -1];
    }
    if (index + 1 >= tokens.length) throw new DefinitionSyntaxError('unexpected end to tokens');
    index += 1;
  }
}

function build_eval_tree(tokens: readonly TokenInfo[]): EvalTreeNode {
  return _build_eval_tree(tokens, 0, 0, '<none>')[0];
}

/** `EvalTreeNode.evaluate`: `bin_op(op_text, left, right)` and `un_op(op_text, value)` implement pint's operator maps over a value domain. */
function evaluate<V>(node: EvalTreeNode, define_op: (t: TokenInfo) => V, bin_op: (op: string, l: V, r: V) => V, un_op: (op: string, v: V) => V): V {
  if (node.right) {
    if (!(node.left instanceof EvalTreeNode)) throw new PintAssertionError('self.left not EvalTreeNode (3)');
    const op_text = node.operator ? node.operator.string : '';
    if (!BINARY_OPS.has(op_text)) throw new DefinitionSyntaxError(`missing binary operator '${op_text}'`);
    const l = evaluate(node.left, define_op, bin_op, un_op);
    const r = evaluate(node.right, define_op, bin_op, un_op);
    return bin_op(op_text, l, r);
  }
  if (node.operator) {
    if (!(node.left instanceof EvalTreeNode)) throw new PintAssertionError('self.left not EvalTreeNode (4)');
    const op_text = node.operator.string;
    if (!UNARY_OPS.has(op_text)) throw new DefinitionSyntaxError(`missing unary operator '${op_text}'`);
    return un_op(op_text, evaluate(node.left, define_op, bin_op, un_op));
  }
  return define_op(node.left as TokenInfo);
}

/** `ParserHelper.eval_token` for NUMBER tokens: `int(text)`, else `float(text)`, else ValueError. */
function evalNumberToken(text: string): PyNum {
  const i = pyInt(text);
  if (i !== null) return i;
  const f = pyFloat(text);
  if (f !== null) return f;
  throw new ValueError(`could not convert string to float: '${text}'`);
}

// ============================================================================================
// 10. ParserHelper and parse_units (the `x in UREG` path)
// ============================================================================================

/** `pint.util.ParserHelper`: a UnitsContainer with a scale (the value domain of `parse_units`). */
class ParserHelper {
  constructor(
    readonly scale: PyNum,
    readonly _d: UnitsContainer,
  ) {
    for (const [k, v] of _d) {
      // UnitsContainer.__init__: non-int, non-float values go through float().
      if (v instanceof PyComplex) throw new PyTypeError("float() argument must be a string or a real number, not 'complex'");
      if (typeof v !== 'bigint' && typeof v !== 'number') _d.set(k, pyToFloat(v));
    }
  }

  static from_word(word: string): ParserHelper {
    return new ParserHelper(1n, new Map([[word, 1n]]));
  }

  /** `operate(items, op, cleanup=True)`: `udict` semantics, zero entries removed. */
  operate(items: UnitsContainer, op: 'add' | 'sub'): ParserHelper {
    const d = new Map(this._d);
    for (const [key, value] of items) {
      const cur = d.get(key) ?? 0n;
      d.set(key, op === 'add' ? pyAdd(cur, value) : pySub(cur, value));
    }
    for (const [key, value] of [...d]) if (pyEqInt(value, 0)) d.delete(key);
    return new ParserHelper(this.scale, d);
  }

  mul(other: ParserHelper | PyNum): ParserHelper {
    if (other instanceof ParserHelper) {
      const n = this.operate(other._d, 'add');
      return new ParserHelper(pyMul(n.scale, other.scale), n._d);
    }
    return new ParserHelper(pyMul(this.scale, other), new Map(this._d));
  }

  pow(other: PyNum): ParserHelper {
    const d: UnitsContainer = new Map();
    for (const [key, value] of this._d) d.set(key, pyMul(value, other));
    return new ParserHelper(pyPow(this.scale, other), d);
  }

  truediv(other: ParserHelper | PyNum): ParserHelper {
    if (other instanceof ParserHelper) {
      const n = this.operate(other._d, 'sub');
      return new ParserHelper(pyTruediv(n.scale, other.scale), n._d);
    }
    return new ParserHelper(pyTruediv(this.scale, other), new Map(this._d));
  }

  rtruediv(other: PyNum): ParserHelper {
    const n = this.pow(-1n);
    return new ParserHelper(pyMul(n.scale, other), n._d);
  }
}

type PHValue = ParserHelper | PyNum;

function phBinOp(op: string, left: PHValue, right: PHValue): PHValue {
  const lp = left instanceof ParserHelper;
  const rp = right instanceof ParserHelper;
  switch (op) {
    case '**':
      if (lp) {
        if (rp) {
          // ParserHelper.__pow__: `d[key] *= other` succeeds (int * ParserHelper), then `scale ** other` fails.
          throw new PyTypeError(`unsupported operand type(s) for ** or pow(): '${pyTypeName(left.scale)}' and 'ParserHelper'`);
        }
        return left.pow(right as PyNum);
      }
      if (rp) throw new PyTypeError(`unsupported operand type(s) for ** or pow(): '${pyTypeName(left)}' and 'ParserHelper'`);
      return pyPow(left as PyNum, right as PyNum);
    case '*':
    case '':
      if (lp) return left.mul(right);
      if (rp) return right.mul(left as PyNum);
      return pyMul(left as PyNum, right as PyNum);
    case '/':
      if (lp) return left.truediv(right);
      if (rp) return right.rtruediv(left as PyNum);
      return pyTruediv(left as PyNum, right as PyNum);
    case '//':
      if (lp) return left.truediv(right); // __floordiv__ = __truediv__
      if (rp) throw unsupported('//', left, right);
      return pyFloordiv(left as PyNum, right as PyNum);
    case '+':
      if (lp || rp) throw unsupported('+', left, right);
      return pyAdd(left as PyNum, right as PyNum);
    case '-':
      if (lp || rp) throw unsupported('-', left, right);
      return pySub(left as PyNum, right as PyNum);
    case '%':
      if (lp || rp) throw unsupported('%', left, right);
      return pyMod(left as PyNum, right as PyNum);
    default:
      // '+/-': pint's `_ufloat` without the uncertainties package.
      throw new PyTypeError('Please install the uncertainties package to be able to parse quantities with uncertainty.');
  }
}

function phUnOp(op: string, v: PHValue): PHValue {
  if (op === '+') return v;
  return v instanceof ParserHelper ? v.mul(-1n) : pyMul(v, -1n);
}

/** `ParserHelper.from_string`. */
function parserHelperFromString(input_string: string): ParserHelper {
  if (!input_string) return new ParserHelper(1n, new Map());
  input_string = string_preprocessor(input_string);
  let reps = false;
  if (input_string.includes('[')) {
    input_string = input_string.split('[').join('__obra__').split(']').join('__cbra__');
    reps = true;
  }
  const tree = build_eval_tree(tokenizer(input_string));
  let ret = evaluate<PHValue>(
    tree,
    (t) => (t.type === 'NUMBER' ? evalNumberToken(t.string) : ParserHelper.from_word(t.string)),
    phBinOp,
    phUnOp,
  );
  if (!(ret instanceof ParserHelper)) return new ParserHelper(ret, new Map());
  if (reps) {
    const d: UnitsContainer = new Map();
    for (const [k, v] of ret._d) d.set(k.split('__obra__').join('[').split('__cbra__').join(']'), v);
    ret = new ParserHelper(ret.scale, d);
  }
  let scale = ret.scale;
  const d = new Map(ret._d);
  for (const k of [...d.keys()]) {
    if (k.toLowerCase() === 'nan') {
      d.delete(k);
      scale = Number.NaN;
    }
  }
  return new ParserHelper(scale, d);
}

/** `parse_units_as_container` / `_parse_units_as_container` (as_delta=True, case_sensitive=True). */
export function parse_units(input_string: string): UnitsContainer {
  input_string = registry_preprocess(input_string);
  if (!input_string) return new Map();
  input_string = pyStrip(input_string);
  const units = parserHelperFromString(input_string);
  if (!pyEqInt(units.scale, 1)) throw new ValueError('Unit expression cannot have a scaling factor.');
  let ret: UnitsContainer = new Map();
  const many = units._d.size > 1;
  for (const [name, value] of units._d) {
    let cname = get_name(name);
    if (!cname) continue;
    if (many || (!many && !pyEqInt(value, 1))) {
      const definition = getDef(cname);
      if (!definition.is_multiplicative) cname = 'delta_' + cname;
    }
    ret = ucAdd(ret, cname, value);
  }
  return ret;
}

/** `pint.util.getattr_maybe_raise`: the guard `UnitRegistry.__getattr__` runs before parsing. */
function getattr_maybe_raise(item: string): void {
  const stripped = item.replace(/^_+/, '');
  // Python `stripped[0].isdigit()`: Nd plus Numeric_Type=Digit code points (², ①, …) — audit round 2, F13.
  const first = stripped.codePointAt(0) as number;
  const isdigit = /^\p{Nd}/u.test(stripped) || PY_ISDIGIT_EXTRA.has(first);
  if (item.endsWith('__') || stripped.length === 0 || (item.startsWith('_') && !isdigit)) {
    throw new AttributeError(`<pint.registry.UnitRegistry object> object has no attribute '${item}'`);
  }
}

// ============================================================================================
// 11. Unit and Quantity, parse_expression (the `UREG(x)` path)
// ============================================================================================

export class Unit {
  readonly _units: UnitsContainer;

  constructor(units: UnitsContainer | string) {
    this._units = typeof units === 'string' ? parse_units(units) : new Map(units);
  }

  /** `str(unit)`: terms sorted by name. */
  toString(): string {
    return formatUnits(this._units, '', true);
  }

  format(spec: string): string {
    return formatUnits(this._units, spec, true);
  }

  /** `repr(unit)`: pint formats the bare UnitsContainer, i.e. in insertion order. */
  repr(): string {
    return `<Unit('${formatUnits(this._units, '', false)}')>`;
  }

  equals(other: unknown): boolean {
    return other instanceof Unit && containerEq(this._units, other._units);
  }

  get dimensionality(): UnitsContainer {
    return get_dimensionality(this._units);
  }
}

/** The `density` context of pint_extensions.txt: [volume] -> [mass]: value * p; [mass] -> [volume]: value / p. */
export interface DensityContext {
  p: Quantity;
}

const VOLUME_DIM: UnitsContainer = new Map([['[length]', 3n]]);
const MASS_DIM: UnitsContainer = new Map([['[mass]', 1n]]);

function ucStr(c: UnitsContainer): string {
  return formatUnits(c, '', false);
}

export class Quantity {
  /** pint's `_magnitude`: a Fraction or a Python number (int as bigint, float, complex). */
  readonly _magnitude: Magnitude;
  readonly units: Unit;

  constructor(magnitude: Magnitude, units: Unit) {
    this._magnitude = magnitude;
    this.units = units;
  }

  static of(magnitude: Magnitude, units: UnitsContainer): Quantity {
    return new Quantity(magnitude, new Unit(units));
  }

  /** The magnitude as consumers see it: Fractions untouched, Python ints/floats as JS numbers. */
  get magnitude(): Fraction | number {
    const m = this._magnitude;
    if (m instanceof Fraction || typeof m === 'number') return m;
    return pyToFloat(m);
  }

  get _units(): UnitsContainer {
    return this.units._units;
  }

  private _get_non_multiplicative_units(): string[] {
    return [...this._units.keys()].filter((u) => !getDef(u).is_multiplicative);
  }
  private get _is_multiplicative(): boolean {
    return this._get_non_multiplicative_units().length === 0;
  }
  private get _is_logarithmic(): boolean {
    return this._units.size === 1 && getDef([...this._units.keys()][0] as string).is_logarithmic;
  }
  private _get_delta_units(): string[] {
    return [...this._units.keys()].filter((u) => u.startsWith('delta_'));
  }
  private _has_compatible_delta(unit: string): boolean {
    const deltas = this._get_delta_units();
    if (deltas.includes('delta_' + unit)) return true;
    const offset_unit_dim = getDef(unit).reference;
    return deltas.some((d) => {
      const ref = getDef(d).reference;
      return ref !== null && offset_unit_dim !== null && containerEq(ref, offset_unit_dim);
    });
  }
  private _ok_for_muldiv(no_offset_units?: number): boolean {
    let is_ok = true;
    if (no_offset_units === undefined) no_offset_units = this._get_non_multiplicative_units().length;
    if (no_offset_units > 1) is_ok = false;
    if (no_offset_units === 1) {
      if (this._units.size > 1) is_ok = false;
      if (this._units.size === 1) is_ok = false; // autoconvert_offset_to_baseunit is False
      if (!pyEqInt([...this._units.values()][0] as PyNum, 1)) is_ok = false;
    }
    return is_ok;
  }

  get dimensionality(): UnitsContainer {
    return get_dimensionality(this._units);
  }

  get dimensionless(): boolean {
    const tmp = this.to_root_units();
    return tmp.dimensionality.size === 0;
  }

  private _convert_magnitude_not_inplace(other: UnitsContainer): Magnitude {
    return convert(this._magnitude, this._units, other);
  }

  /** `q.to(unit)`; pass `{ p }` to activate the density context. */
  to(unit: string | Unit | UnitsContainer, context?: DensityContext): Quantity {
    const dst = unit instanceof Unit ? unit._units : typeof unit === 'string' ? parse_units(unit) : unit;
    let value = this._magnitude;
    let src = this._units;
    if (context) {
      const src_dim = get_dimensionality(src);
      const dst_dim = get_dimensionality(dst);
      if (!containerEq(src_dim, dst_dim)) {
        const p = context.p;
        if (containerEq(src_dim, VOLUME_DIM) && containerEq(dst_dim, MASS_DIM)) {
          value = magOp('mul', value, p._magnitude);
          src = ucMul(src, p._units);
        } else if (containerEq(src_dim, MASS_DIM) && containerEq(dst_dim, VOLUME_DIM)) {
          value = magOp('truediv', value, p._magnitude);
          src = ucTruediv(src, p._units);
        }
      }
    }
    return Quantity.of(convert(value, src, dst), dst);
  }

  to_root_units(): Quantity {
    const { units } = get_root_units(this._units);
    return Quantity.of(this._convert_magnitude_not_inplace(units), units);
  }

  to_base_units(): Quantity {
    const units = get_base_units(this._units);
    return Quantity.of(this._convert_magnitude_not_inplace(units), units);
  }

  /** `PlainQuantity._add_sub`. */
  _add_sub(other: Quantity | PyNum, op: 'add' | 'sub'): Quantity {
    if (!(other instanceof Quantity)) {
      if (pyEqInt(other, 0) || pyIsNaN(other)) return Quantity.of(magOp(op, this._magnitude, other), this._units);
      if (this.dimensionless) return Quantity.of(magOp(op, this.to(new Map())._magnitude, other), new Map());
      throw new DimensionalityError(ucStr(this._units), 'dimensionless');
    }
    const self_non_mul_units = this._get_non_multiplicative_units();
    const other_non_mul_units = other._get_non_multiplicative_units();
    const is_self_multiplicative = self_non_mul_units.length === 0;
    const is_other_multiplicative = other_non_mul_units.length === 0;
    const self_non_mul_unit = self_non_mul_units[0] as string;
    const other_non_mul_unit = other_non_mul_units[0] as string;

    if (this._is_logarithmic && other._is_logarithmic) {
      const self_base = this.to_base_units();
      const other_base = other.to_base_units();
      const result = op === 'add' ? self_base._mul_div(other_base, 'mul') : self_base._mul_div(other_base, 'truediv');
      if (self_base.dimensionless && other_base.dimensionless) return result.to(this._units);
      if (self_base.dimensionless) return result.to(other._units);
      if (other_base.dimensionless) return result.to(this._units);
      return result;
    }

    if (!containerEq(this.dimensionality, other.dimensionality)) {
      throw new DimensionalityError(ucStr(this._units), ucStr(other._units), ucStr(this.dimensionality), ucStr(other.dimensionality));
    }

    let magnitude: Magnitude;
    let units: UnitsContainer;
    if (is_self_multiplicative && is_other_multiplicative) {
      if (containerEq(this._units, other._units)) {
        magnitude = magOp(op, this._magnitude, other._magnitude);
        units = this._units;
      } else if (this._get_delta_units().length && !other._get_delta_units().length) {
        magnitude = magOp(op, this._convert_magnitude_not_inplace(other._units), other._magnitude);
        units = other._units;
      } else {
        units = this._units;
        magnitude = magOp(op, this._magnitude, other.to(this._units).magnitude);
      }
    } else if (
      op === 'sub' &&
      self_non_mul_units.length === 1 &&
      pyEqInt(this._units.get(self_non_mul_unit) as PyNum, 1) &&
      !other._has_compatible_delta(self_non_mul_unit)
    ) {
      if (containerEq(this._units, other._units)) magnitude = magOp(op, this._magnitude, other._magnitude);
      else magnitude = magOp(op, this._magnitude, other.to(this._units).magnitude);
      units = ucRename(this._units, self_non_mul_unit, 'delta_' + self_non_mul_unit);
    } else if (
      op === 'sub' &&
      other_non_mul_units.length === 1 &&
      pyEqInt(other._units.get(other_non_mul_unit) as PyNum, 1) &&
      !this._has_compatible_delta(other_non_mul_unit)
    ) {
      magnitude = magOp(op, this._magnitude, other.to(this._units).magnitude);
      units = this._units;
    } else if (
      self_non_mul_units.length === 1 &&
      pyEqInt(this._units.get(self_non_mul_unit) as PyNum, 1) &&
      other._has_compatible_delta(self_non_mul_unit)
    ) {
      const tu = ucRename(this._units, self_non_mul_unit, 'delta_' + self_non_mul_unit);
      magnitude = magOp(op, this._magnitude, other.to(tu).magnitude);
      units = this._units;
    } else if (
      other_non_mul_units.length === 1 &&
      pyEqInt(other._units.get(other_non_mul_unit) as PyNum, 1) &&
      this._has_compatible_delta(other_non_mul_unit)
    ) {
      const tu = ucRename(other._units, other_non_mul_unit, 'delta_' + other_non_mul_unit);
      magnitude = magOp(op, this._convert_magnitude_not_inplace(tu), other._magnitude);
      units = other._units;
    } else {
      throw new OffsetUnitCalculusError(ucStr(this._units), ucStr(other._units));
    }
    return Quantity.of(magnitude, units);
  }

  /** `PlainQuantity._mul_div` (`__truediv__` casts int magnitudes to float first). */
  _mul_div(other: Quantity | PyNum, op: 'mul' | 'truediv'): Quantity {
    const offset_units_self = this._get_non_multiplicative_units();
    const no_offset_units_self = offset_units_self.length;
    const castInt = (m: Magnitude): Magnitude => (typeof m === 'bigint' ? intToFloat(m) : m);
    const magOpCast = (a: Magnitude, b: Magnitude): Magnitude => {
      if (op === 'truediv' && (typeof a === 'bigint' || typeof b === 'bigint')) return magOp(op, castInt(a), castInt(b));
      return magOp(op, a, b);
    };
    if (!(other instanceof Quantity)) {
      if (!this._ok_for_muldiv(no_offset_units_self)) throw new OffsetUnitCalculusError(ucStr(this._units));
      if (offset_units_self.length === 1) {
        if (!pyEqInt(this._units.get(offset_units_self[0] as string) as PyNum, 1) || op !== 'mul') {
          throw new OffsetUnitCalculusError(ucStr(this._units));
        }
      }
      const magnitude = magOpCast(this._magnitude, other);
      const units = op === 'mul' ? ucMul(this._units, new Map()) : ucTruediv(this._units, new Map());
      return Quantity.of(magnitude, units);
    }
    const new_self: Quantity = this;
    if (!this._ok_for_muldiv(no_offset_units_self)) throw new OffsetUnitCalculusError(ucStr(this._units), ucStr(other._units));
    const no_offset_units_other = other._get_non_multiplicative_units().length;
    if (!other._ok_for_muldiv(no_offset_units_other)) throw new OffsetUnitCalculusError(ucStr(this._units), ucStr(other._units));
    const magnitude = magOpCast(new_self.magnitude, other._magnitude);
    const units = op === 'mul' ? ucMul(new_self._units, other._units) : ucTruediv(new_self._units, other._units);
    return Quantity.of(magnitude, units);
  }

  /** `PlainQuantity.__rtruediv__` (number / quantity). */
  _rtruediv(other: PyNum): Quantity {
    const no_offset_units_self = this._get_non_multiplicative_units().length;
    if (!this._ok_for_muldiv(no_offset_units_self)) throw new OffsetUnitCalculusError(ucStr(this._units), '');
    return Quantity.of(magOp('truediv', other, this._magnitude), ucPow(this._units, -1n));
  }

  _floordiv(other: Quantity | PyNum): Quantity {
    let magnitude: Magnitude;
    if (other instanceof Quantity) magnitude = magOp('floordiv', this._magnitude, other.to(this._units).magnitude);
    else if (this.dimensionless) magnitude = magOp('floordiv', this.to(new Map())._magnitude, other);
    else throw new DimensionalityError(ucStr(this._units), 'dimensionless');
    return Quantity.of(magnitude, new Map());
  }

  _rfloordiv(other: PyNum): Quantity {
    if (!this.dimensionless) throw new DimensionalityError(ucStr(this._units), 'dimensionless');
    return Quantity.of(magOp('floordiv', other, this.to(new Map())._magnitude), new Map());
  }

  _mod(other: Quantity | PyNum): Quantity {
    const o = other instanceof Quantity ? other : Quantity.of(other, new Map());
    return Quantity.of(magOp('mod', this._magnitude, o.to(this._units).magnitude), this._units);
  }

  _rmod(other: PyNum): Quantity {
    return Quantity.of(magOp('mod', other, this.to(new Map())._magnitude), new Map());
  }

  /** `PlainQuantity.__eq__(other)` for a plain number `other` (what `__pow__`'s `other == 1` / `other == 0` reach). */
  _eqNumber(other: PyNum): boolean {
    if (pyEqInt(other, 0) || pyIsNaN(other)) {
      if (this._is_multiplicative) return magEq(this._magnitude, other);
      throw new OffsetUnitCalculusError(ucStr(this._units));
    }
    if (this.dimensionless) return magEq(this._convert_magnitude_not_inplace(new Map()), other);
    return false;
  }

  /** `PlainQuantity.__pow__`. */
  _pow(other: Quantity | PyNum): Quantity {
    // pint tests the bound method `self._ok_for_muldiv` (always truthy): no offset check here.
    const otherEq = (n: number): boolean => (other instanceof Quantity ? other._eqNumber(BigInt(n)) : pyEqInt(other, n));
    if (otherEq(1)) return this;
    let exponent: Magnitude;
    let units: UnitsContainer;
    if (otherEq(0)) {
      exponent = 0n;
      units = new Map();
    } else {
      if (!this._is_multiplicative) throw new OffsetUnitCalculusError(ucStr(this._units));
      if (other instanceof Quantity) {
        if (!other.dimensionless) throw new DimensionalityError(ucStr(other._units), 'dimensionless');
        exponent = other.to_root_units()._magnitude;
      } else {
        exponent = other;
      }
      units = ucPow(this._units, exponent as PyNum);
    }
    return Quantity.of(magOp('pow', this._magnitude, exponent), units);
  }

  /** `PlainQuantity.__rpow__` (number ** quantity): a plain number. */
  _rpow(other: PyNum): Magnitude {
    if (!this.dimensionless) throw new DimensionalityError(ucStr(this._units), 'dimensionless');
    return magOp('pow', other, this.to_root_units()._magnitude);
  }

  _neg(): Quantity {
    return Quantity.of(magNeg(this._magnitude), this._units);
  }

  add(other: Quantity): Quantity {
    return this._add_sub(other, 'add');
  }

  sub(other: Quantity): Quantity {
    return this._add_sub(other, 'sub');
  }

  /** Public `q * x`; an integer-valued JS number stands for a Python int (as in `1000 * UREG(...)`). */
  mul(other: Quantity | Magnitude): Quantity {
    if (other instanceof Fraction) return Quantity.of(magOp('mul', this._magnitude, other), this._units);
    if (typeof other === 'number' && Number.isInteger(other)) other = BigInt(other);
    return this._mul_div(other, 'mul');
  }

  repr(): string {
    const m = this._magnitude instanceof Fraction ? this._magnitude.toString() : pyNumRepr(this._magnitude);
    return `<Quantity(${m}, '${formatUnits(this._units, '', false)}')>`;
  }
}

function magEq(a: Magnitude, b: PyNum): boolean {
  if (a instanceof Fraction) {
    if (b instanceof PyComplex) return b.im === 0 && a.equals(b.re);
    return a.equals(b);
  }
  return pyNumEq(a, b);
}
function magNeg(a: Magnitude): Magnitude {
  if (a instanceof Fraction) return a.neg();
  if (typeof a === 'bigint') return -a;
  if (a instanceof PyComplex) return new PyComplex(-a.re, -a.im);
  return -a;
}

type QValue = Quantity | PyNum;

function qBinOp(op: string, left: QValue, right: QValue): QValue {
  const lq = left instanceof Quantity;
  const rq = right instanceof Quantity;
  switch (op) {
    case '**':
      if (lq) return left._pow(right);
      if (rq) return right._rpow(left) as PyNum;
      return pyPow(left, right);
    case '*':
    case '':
      if (lq) return left._mul_div(right, 'mul');
      if (rq) return right._mul_div(left, 'mul'); // __rmul__ = __mul__
      return pyMul(left, right);
    case '/':
      if (lq) return left._mul_div(right, 'truediv');
      if (rq) return right._rtruediv(left);
      return pyTruediv(left, right);
    case '//':
      if (lq) return left._floordiv(right);
      if (rq) return right._rfloordiv(left);
      return pyFloordiv(left, right);
    case '%':
      if (lq) return left._mod(right);
      if (rq) return right._rmod(left);
      return pyMod(left, right);
    case '+':
      if (lq) return left._add_sub(right, 'add');
      if (rq) return right._add_sub(left, 'add'); // __radd__ = __add__
      return pyAdd(left, right);
    case '-':
      if (lq) return left._add_sub(right, 'sub');
      if (rq) return right._add_sub(left, 'sub')._neg(); // __rsub__
      return pySub(left, right);
    default:
      throw new PyTypeError('Please install the uncertainties package to be able to parse quantities with uncertainty.');
  }
}

function qUnOp(op: string, v: QValue): QValue {
  if (op === '+') return v;
  return v instanceof Quantity ? v._mul_div(-1n, 'mul') : pyMul(v, -1n);
}

/** `_eval_token` for `parse_expression`. */
function qDefineOp(t: TokenInfo): QValue {
  if (t.type === 'NAME') {
    const text = t.string;
    if (text === 'dimensionless') return Quantity.of(1n, new Map());
    const lower = text.toLowerCase();
    if (lower === 'inf' || lower === 'infinity') return Infinity;
    if (lower === 'nan') return Number.NaN;
    return Quantity.of(1n, new Map([[get_name(text), 1n]]));
  }
  return evalNumberToken(t.string);
}

/** `UnitRegistry.parse_expression` (= `UREG(x)`). */
export function parse_expression(input_string: string): Quantity {
  if (!input_string) return Quantity.of(1n, new Map());
  input_string = registry_preprocess(input_string);
  input_string = string_preprocessor(input_string);
  const result = evaluate<QValue>(build_eval_tree(tokenizer(input_string)), qDefineOp, qBinOp, qUnOp);
  if (!(result instanceof Quantity)) return Quantity.of(result, new Map());
  return result;
}

/** `UREG(expr)`: `pint.UnitRegistry.__call__` -> a Quantity (magnitude 1 for a bare unit name). */
export interface UnitRegistry {
  (expr: string): Quantity;
  /** `expr in UREG`: false only for undefined units; other exceptions propagate, as in pint. */
  has(expr: string): boolean;
  parse_units(expr: string): Unit;
  Quantity(magnitude: Magnitude, units: string | Unit): Quantity;
}

export const UREG: UnitRegistry = Object.assign(parse_expression, {
  has(expr: string): boolean {
    try {
      getattr_maybe_raise(expr);
      new Unit(expr);
      return true;
    } catch (e) {
      if (e instanceof UndefinedUnitError) return false;
      throw e;
    }
  },
  parse_units(expr: string): Unit {
    return new Unit(parse_units(expr));
  },
  Quantity(magnitude: Magnitude, units: string | Unit): Quantity {
    return new Quantity(magnitude, units instanceof Unit ? units : new Unit(units));
  },
});
