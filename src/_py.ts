/**
 * Python-semantics helpers (TS-native addition, CLAUDE.md §5). Each mirrors one CPython
 * behaviour the port depends on. Regex fragments are for `u`-flag patterns and reproduce
 * Python `re` str-pattern classes, which are Unicode-aware where JavaScript's are ASCII-only.
 */

/** Python `\w` for str patterns: str.isalnum() or '_' ≈ letters, all numeric categories, underscore. */
export const PY_W = '[\\p{L}\\p{N}_]';
/** Python `\b` (word boundary derived from PY_W), as lookarounds. No capturing groups. */
export const PY_B = `(?:(?<!${PY_W})(?=${PY_W})|(?<=${PY_W})(?!${PY_W}))`;
/** Python `\d` for str patterns: Unicode decimal digits (category Nd). */
export const PY_D = '\\p{Nd}';
/** Python `\s` for str patterns: str.isspace(). Differs from JS `\s` (\x1c-\x1f, \x85 in; ﻿ out). */
export const PY_S_CHARS =
  '\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
export const PY_S = `[${PY_S_CHARS}]`;
/** The whitespace `float()`/`int()` strip: PY_S_CHARS without U+001C–U+001F (see pyFloat). */
const PY_NUM_S_CHARS = '\\t\\n\\x0b\\x0c\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
export const PY_NS = `[^${PY_S_CHARS}]`;
/** Python `$` without MULTILINE: end of string, or just before a final newline. */
export const PY_EOS = '(?=\\n?$)';

const PY_SPACE_RE = new RegExp(PY_S, 'u');
const PY_STRIP_RE = new RegExp(`^${PY_S}+|${PY_S}+$`, 'gu');
const ND_RE = /\p{Nd}/u;

/** `str.strip()` with no arguments. */
export function pyStrip(s: string): string {
  return s.replace(PY_STRIP_RE, '');
}

export function pyIsSpace(ch: string): boolean {
  return PY_SPACE_RE.test(ch);
}

/** Code-point view of a string: Python indexes/slices/len by code point, JS by UTF-16 unit. */
export function pyChars(s: string): string[] {
  return Array.from(s);
}

/** Numeric value of a Unicode decimal digit (category Nd). Blocks are contiguous runs of 10. */
function digitValue(ch: string): number {
  let cp = ch.codePointAt(0) as number;
  let first = cp;
  while (first > 0 && ND_RE.test(String.fromCodePoint(first - 1))) first -= 1;
  return (cp - first) % 10;
}

/** Map Unicode decimal digits to ASCII (what CPython does before parsing numbers). */
function asciiDigits(s: string): string {
  let out = '';
  for (const ch of s) out += ND_RE.test(ch) ? String(digitValue(ch)) : ch;
  return out;
}

/**
 * Whitespace `float(s)` / `int(s)` strip. CPython first runs `_PyUnicode_TransformDecimalAndSpaceToASCII`
 * (unicodeobject.c): code points < 127 pass through unchanged, other `Py_UNICODE_ISSPACE` code points
 * become ' ', decimal digits become ASCII. The C parsers (`_Py_string_to_number_with_underscores`,
 * `PyOS_string_to_double`) then strip only C whitespace `\t\n\v\f\r ` — so U+001C–U+001F are
 * str.isspace() but are rejected here, while U+0085/U+00A0/U+2000… are accepted.
 */
const NUM_STRIP_RE = new RegExp(`^[${PY_NUM_S_CHARS}]+|[${PY_NUM_S_CHARS}]+$`, 'gu');

const FLOAT_RE = /^[+-]?(?:(?:\d(?:_?\d)*)(?:\.(?:\d(?:_?\d)*)?)?|\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?$/;
const SPECIAL_FLOAT_RE = /^[+-]?(?:inf|infinity|nan)$/i;

/** NaN with the sign bit set — what `float("-nan")` produces (`_Py_parse_inf_or_nan` negates the NaN). */
const NEGATIVE_NAN = (() => {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setUint32(0, 0xfff80000);
  return buf.getFloat64(0);
})();

/**
 * Python `float(s)` acceptance and value; `null` where Python raises ValueError.
 * Strips whitespace per the rule above, accepts Unicode decimal digits, single underscores
 * between digits, and inf/infinity/nan; rejects hex, empty strings and everything JS `Number()` is
 * lenient about.
 */
export function pyFloat(s: string): number | null {
  const t = asciiDigits(s.replace(NUM_STRIP_RE, ''));
  if (FLOAT_RE.test(t)) return Number(t.replace(/_/g, ''));
  if (SPECIAL_FLOAT_RE.test(t)) {
    const neg = t.startsWith('-');
    if (/nan$/i.test(t)) return neg ? NEGATIVE_NAN : Number.NaN;
    return neg ? -Infinity : Infinity;
  }
  return null;
}

const INT_RE = /^[+-]?\d(?:_?\d)*$/;

/** Python `int(s)` for base 10; `null` where Python raises ValueError. Returns a bigint. */
export function pyInt(s: string): bigint | null {
  const t = asciiDigits(s.replace(NUM_STRIP_RE, ''));
  if (!INT_RE.test(t)) return null;
  return BigInt(t.replace(/_/g, ''));
}

/**
 * Full titlecase mappings that differ from the full uppercase mapping (Unicode 15.0 = CPython 3.12's
 * table): the Latin digraphs, Georgian Mkhedruli (titlecase is the letter itself), the Greek
 * iota-subscript letters (single-code-point titlecase, two-code-point uppercase), and the
 * SpecialCasing ligature expansions (ß → Ss, ﬁ → Fi, և → Եւ …). Generated with
 * `c.title() != c.upper()` over all code points; everything else titlecases as it uppercases.
 */
const TITLECASE_EXCEPTIONS: Readonly<Record<string, string>> = {
  '\u00df': 'Ss', '\u01c4': '\u01c5', '\u01c5': '\u01c5', '\u01c6': '\u01c5', '\u01c7': '\u01c8',
  '\u01c8': '\u01c8', '\u01c9': '\u01c8', '\u01ca': '\u01cb', '\u01cb': '\u01cb', '\u01cc': '\u01cb',
  '\u01f1': '\u01f2', '\u01f2': '\u01f2', '\u01f3': '\u01f2', '\u0587': '\u0535\u0582', '\u10d0': '\u10d0',
  '\u10d1': '\u10d1', '\u10d2': '\u10d2', '\u10d3': '\u10d3', '\u10d4': '\u10d4', '\u10d5': '\u10d5',
  '\u10d6': '\u10d6', '\u10d7': '\u10d7', '\u10d8': '\u10d8', '\u10d9': '\u10d9', '\u10da': '\u10da',
  '\u10db': '\u10db', '\u10dc': '\u10dc', '\u10dd': '\u10dd', '\u10de': '\u10de', '\u10df': '\u10df',
  '\u10e0': '\u10e0', '\u10e1': '\u10e1', '\u10e2': '\u10e2', '\u10e3': '\u10e3', '\u10e4': '\u10e4',
  '\u10e5': '\u10e5', '\u10e6': '\u10e6', '\u10e7': '\u10e7', '\u10e8': '\u10e8', '\u10e9': '\u10e9',
  '\u10ea': '\u10ea', '\u10eb': '\u10eb', '\u10ec': '\u10ec', '\u10ed': '\u10ed', '\u10ee': '\u10ee',
  '\u10ef': '\u10ef', '\u10f0': '\u10f0', '\u10f1': '\u10f1', '\u10f2': '\u10f2', '\u10f3': '\u10f3',
  '\u10f4': '\u10f4', '\u10f5': '\u10f5', '\u10f6': '\u10f6', '\u10f7': '\u10f7', '\u10f8': '\u10f8',
  '\u10f9': '\u10f9', '\u10fa': '\u10fa', '\u10fd': '\u10fd', '\u10fe': '\u10fe', '\u10ff': '\u10ff',
  '\u1f80': '\u1f88', '\u1f81': '\u1f89', '\u1f82': '\u1f8a', '\u1f83': '\u1f8b', '\u1f84': '\u1f8c',
  '\u1f85': '\u1f8d', '\u1f86': '\u1f8e', '\u1f87': '\u1f8f', '\u1f88': '\u1f88', '\u1f89': '\u1f89',
  '\u1f8a': '\u1f8a', '\u1f8b': '\u1f8b', '\u1f8c': '\u1f8c', '\u1f8d': '\u1f8d', '\u1f8e': '\u1f8e',
  '\u1f8f': '\u1f8f', '\u1f90': '\u1f98', '\u1f91': '\u1f99', '\u1f92': '\u1f9a', '\u1f93': '\u1f9b',
  '\u1f94': '\u1f9c', '\u1f95': '\u1f9d', '\u1f96': '\u1f9e', '\u1f97': '\u1f9f', '\u1f98': '\u1f98',
  '\u1f99': '\u1f99', '\u1f9a': '\u1f9a', '\u1f9b': '\u1f9b', '\u1f9c': '\u1f9c', '\u1f9d': '\u1f9d',
  '\u1f9e': '\u1f9e', '\u1f9f': '\u1f9f', '\u1fa0': '\u1fa8', '\u1fa1': '\u1fa9', '\u1fa2': '\u1faa',
  '\u1fa3': '\u1fab', '\u1fa4': '\u1fac', '\u1fa5': '\u1fad', '\u1fa6': '\u1fae', '\u1fa7': '\u1faf',
  '\u1fa8': '\u1fa8', '\u1fa9': '\u1fa9', '\u1faa': '\u1faa', '\u1fab': '\u1fab', '\u1fac': '\u1fac',
  '\u1fad': '\u1fad', '\u1fae': '\u1fae', '\u1faf': '\u1faf', '\u1fb2': '\u1fba\u0345', '\u1fb3': '\u1fbc',
  '\u1fb4': '\u0386\u0345', '\u1fb7': '\u0391\u0342\u0345', '\u1fbc': '\u1fbc', '\u1fc2': '\u1fca\u0345', '\u1fc3': '\u1fcc',
  '\u1fc4': '\u0389\u0345', '\u1fc7': '\u0397\u0342\u0345', '\u1fcc': '\u1fcc', '\u1ff2': '\u1ffa\u0345', '\u1ff3': '\u1ffc',
  '\u1ff4': '\u038f\u0345', '\u1ff7': '\u03a9\u0342\u0345', '\u1ffc': '\u1ffc', '\ufb00': 'Ff', '\ufb01': 'Fi',
  '\ufb02': 'Fl', '\ufb03': 'Ffi', '\ufb04': 'Ffl', '\ufb05': 'St', '\ufb06': 'St',
  '\ufb13': '\u0544\u0576', '\ufb14': '\u0544\u0565', '\ufb15': '\u0544\u056b', '\ufb16': '\u054e\u0576', '\ufb17': '\u0544\u056d',
};

const CASED_RE = /\p{Cased}/u;
const CASE_IGNORABLE_RE = /\p{Case_Ignorable}/u;

/**
 * CPython `handle_capital_sigma` (unicodeobject.c): the Σ at code-point index `i` of the ORIGINAL
 * string is in Final_Sigma context when `\p{Cased}\p{Case_Ignorable}*Σ` and not followed by
 * `\p{Case_Ignorable}*\p{Cased}`.
 */
function isFinalSigma(chars: readonly string[], i: number): boolean {
  let j = i - 1;
  while (j >= 0 && CASE_IGNORABLE_RE.test(chars[j] as string)) j -= 1;
  if (j < 0 || !CASED_RE.test(chars[j] as string)) return false;
  j = i + 1;
  while (j < chars.length && CASE_IGNORABLE_RE.test(chars[j] as string)) j += 1;
  return j === chars.length || !CASED_RE.test(chars[j] as string);
}

/**
 * `str.capitalize()` (CPython `do_capitalize`): first code point → full TITLECASE mapping
 * (`_PyUnicode_ToTitleFull`), the rest → full lowercase (`lower_ucs4`, with Σ resolved by
 * `handle_capital_sigma` against the original string). JS has no titlecase, so uppercase plus the
 * exception table above stands in for it.
 */
export function pyCapitalize(s: string): string {
  const chars = pyChars(s);
  if (chars.length === 0) return s;
  const first = chars[0] as string;
  let out = dictGet(TITLECASE_EXCEPTIONS, first) ?? first.toUpperCase();
  for (let i = 1; i < chars.length; i++) {
    const c = chars[i] as string;
    if (c === '\u03a3') out += isFinalSigma(chars, i) ? '\u03c2' : '\u03c3';
    else out += c.toLowerCase();
  }
  return out;
}

/** `string.punctuation`. */
export const PY_PUNCTUATION = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

const NOT_PRINTABLE_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/u;

/** `repr(str)`. */
export function pyReprStr(s: string): string {
  const useDouble = s.includes("'") && !s.includes('"');
  const q = useDouble ? '"' : "'";
  let out = q;
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (ch === q || ch === '\\') out += '\\' + ch;
    else if (ch === '\t') out += '\\t';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (cp < 0x20 || cp === 0x7f) out += '\\x' + cp.toString(16).padStart(2, '0');
    else if (cp < 0x7f) out += ch;
    else if (ch === ' ' || !NOT_PRINTABLE_RE.test(ch)) out += ch;
    else if (cp <= 0xff) out += '\\x' + cp.toString(16).padStart(2, '0');
    else if (cp <= 0xffff) out += '\\u' + cp.toString(16).padStart(4, '0');
    else out += '\\U' + cp.toString(16).padStart(8, '0');
  }
  return out + q;
}

/** `repr(list[str])`. */
export function pyReprStrList(items: readonly string[]): string {
  return '[' + items.map(pyReprStr).join(', ') + ']';
}

/** `repr(list[list[int]])` / `repr(list[int])` (numbers only). */
export function pyReprNested(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(pyReprNested).join(', ') + ']';
  return String(v);
}

/** `re.sub(pattern, repl, s)` — `repl` uses JS `$n` syntax; pattern must carry the `g` flag. */
export function pySub(re: RegExp, repl: string | ((...m: string[]) => string), s: string): string {
  return s.replace(re, repl as string);
}

/** `re.findall(pattern, s)` returning full match arrays (index 0 = whole match, 1.. = groups). */
export function pyFindall(re: RegExp, s: string): RegExpMatchArray[] {
  return [...s.matchAll(re)];
}

/** `str.replace(old, new)` — every occurrence, no `$` interpretation. */
export function pyReplaceAll(s: string, old: string, repl: string): string {
  if (old === '') return s;
  return s.split(old).join(repl);
}

/** Own-property dict lookup (never hits Object.prototype keys like "constructor"). */
export function dictGet<V>(rec: Readonly<Record<string, V>>, key: string): V | undefined {
  return Object.hasOwn(rec, key) ? rec[key] : undefined;
}

// ---- html.unescape ----
import { HTML5_ENTITIES, INVALID_CHARREFS, INVALID_CODEPOINTS } from './en/_htmlEntities.js';

const CHARREF_RE = /&(#[0-9]+;?|#[xX][0-9a-fA-F]+;?|[^\t\n\f <&#;]{1,32};?)/g;

function replaceCharref(_whole: string, s: string): string {
  if (s[0] === '#') {
    // numeric charref
    let num: number;
    if (s[1] === 'x' || s[1] === 'X') num = parseInt(s.slice(2).replace(/;+$/, ''), 16);
    else num = parseInt(s.slice(1).replace(/;+$/, ''), 10);
    const invalid = dictGet(INVALID_CHARREFS, String(num));
    if (invalid !== undefined) return invalid;
    if ((0xd800 <= num && num <= 0xdfff) || num > 0x10ffff) return '�';
    if (INVALID_CODEPOINTS.has(num)) return '';
    return String.fromCodePoint(num);
  }
  // named charref
  const direct = dictGet(HTML5_ENTITIES, s);
  if (direct !== undefined) return direct;
  // find the longest matching name (as defined by the standard)
  const chars = pyChars(s);
  for (let x = chars.length - 1; x > 1; x--) {
    const head = chars.slice(0, x).join('');
    const hit = dictGet(HTML5_ENTITIES, head);
    if (hit !== undefined) return hit + chars.slice(x).join('');
  }
  return '&' + s;
}

/** Python `html.unescape(s)`: named and numeric character references per the HTML5 rules. */
export function pyHtmlUnescape(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(CHARREF_RE, replaceCharref);
}

// ---- numeric helpers backed by Fraction ----
import { Fraction } from './fraction.js';

/**
 * `statistics.mean(floats)`: CPython sums the exact rationals of the inputs and converts the
 * exact mean to the nearest float — NOT a naive float sum divided by n. Non-finite inputs go
 * to `_sum`'s `partials[None]` bucket, a plain float sum in input order that then wins over every
 * finite partial (`[inf] → inf`, `[inf, -inf] → nan`, `[1, nan, 2] → nan`).
 */
export function pyMean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('mean requires at least one data point'); // Python: StatisticsError
  let total = new Fraction(0);
  let special: number | undefined;
  for (const v of values) {
    if (Number.isFinite(v)) total = total.add(Fraction.from_float(v));
    else special = (special ?? 0) + v;
  }
  if (special !== undefined) return special / values.length;
  return total.div(BigInt(values.length)).toNumber();
}

/** Nearest integer to an exact rational, ties to even (`fr.n / fr.d` truncates toward zero). */
function roundHalfEvenToInt(fr: Fraction): bigint {
  let q = fr.n / fr.d;
  const r = fr.n - q * fr.d;
  const twice = 2n * (r < 0n ? -r : r);
  if (twice > fr.d || (twice === fr.d && q % 2n !== 0n)) q += r < 0n ? -1n : 1n;
  return q;
}

/** 10**k as an exact rational (k may be negative). */
function pow10(k: number): Fraction {
  return k >= 0 ? new Fraction(10n ** BigInt(k)) : new Fraction(1n, 10n ** BigInt(-k));
}

/** `copysign(0.0, x)`. */
function signedZero(x: number): number {
  return x < 0 || Object.is(x, -0) ? -0 : 0;
}

/**
 * `round(x, ndigits)` for floats (CPython `float___round__` → `double_round`, floatobject.c):
 * round-half-even on the EXACT binary value at `ndigits` decimal places (`_Py_dg_dtoa` mode 3),
 * then the nearest double (`_Py_dg_strtod`). The sign travels with the decimal string, so a
 * negative input that rounds to zero gives `-0.0`. `ndigits` beyond NDIGITS_MAX (323) returns x
 * unchanged; below NDIGITS_MIN (-308) returns a zero with x's sign.
 */
export function pyRound(x: number, ndigits: number): number {
  if (!Number.isFinite(x)) return x;
  if (ndigits > 323) return x;
  if (ndigits < -308) return signedZero(x);
  const exact = Fraction.from_float(x);
  const scale = 10n ** BigInt(Math.abs(ndigits));
  const q = roundHalfEvenToInt(ndigits >= 0 ? exact.mul(scale) : exact.div(scale));
  if (q === 0n) return signedZero(x);
  const rounded = ndigits >= 0 ? new Fraction(q, scale) : new Fraction(q * scale);
  return rounded.toNumber(); // OverflowError past DBL_MAX, as CPython
}

/** `repr(float)`: shortest round-trip digits, Python's positional/exponent switch and `.0`. */
export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (x === Infinity) return 'inf';
  if (x === -Infinity) return '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const e = x.toExponential(); // shortest digits, e.g. "1.2345e-7"
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(e) as RegExpExecArray;
  const sign = m[1] as string;
  const digits = (m[2] as string) + (m[3] ?? '');
  const exp = Number(m[4]);
  if (exp >= -4 && exp < 16) {
    let s: string;
    if (exp >= 0) {
      const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, '0');
      const fracPart = digits.slice(exp + 1);
      s = intPart + '.' + (fracPart === '' ? '0' : fracPart);
    } else {
      s = '0.' + '0'.repeat(-exp - 1) + digits;
    }
    return sign + s;
  }
  const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
  const expStr = (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0');
  return `${sign}${mant}e${expStr}`;
}

/**
 * `_Py_dg_dtoa(x, 2, p)`: the first `p` significant decimal digits of |x| (finite, non-zero),
 * correctly rounded half-even on the exact binary value, and the decimal exponent of the first
 * digit. JS `toExponential(p - 1)` rounds ties away from zero instead, so it cannot be used.
 */
function roundSignificant(ax: number, p: number): [string, number] {
  const f = Fraction.from_float(ax);
  let e = Math.floor(Math.log10(ax));
  while (f.lt(pow10(e))) e -= 1; // settle 10**e <= ax < 10**(e + 1) exactly
  while (!f.lt(pow10(e + 1))) e += 1;
  let n = roundHalfEvenToInt(f.mul(pow10(p - 1 - e)));
  if (n === 10n ** BigInt(p)) {
    n /= 10n; // carried into a new leading digit (999999.5 → 1e+06)
    e += 1;
  }
  return [n.toString(), e];
}

/**
 * `'%g' % x` (precision 6): CPython `format_float_short` (pystrtod.c) over `_Py_dg_dtoa` mode 2 —
 * exponent form when the decimal exponent is < -4 or >= 6 (judged after rounding), trailing
 * zeros and a bare decimal point removed.
 */
export function pyFormatG(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0' : '0';
  const sign = x < 0 ? '-' : '';
  const [sig, exp] = roundSignificant(Math.abs(x), 6);
  if (exp < -4 || exp >= 6) {
    const digits = sig.replace(/0+$/, '');
    const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${mant}e${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  let s: string;
  if (exp >= 0) {
    s = sig.slice(0, exp + 1) + '.' + sig.slice(exp + 1);
  } else {
    s = '0.' + '0'.repeat(-exp - 1) + sig;
  }
  s = s.replace(/\.?0+$/, '');
  if (s.endsWith('.')) s = s.slice(0, -1);
  return sign + s;
}

/**
 * Python `re.IGNORECASE` on str patterns folds more than JS's `iu` simple case folding: besides
 * the pairs both engines share (ſ↔s, K↔k, Å↔å, µ↔μ …) CPython also lets ASCII `i`/`I` match
 * U+0130 İ and U+0131 ı (sre's `_equivalences` + simple lowercase of İ). Apply to any pattern
 * source that upstream compiles with `re.I` so an `i` in a word alternation or `[a-zA-Z]` class
 * matches the same code points (audit round 2, preprocess F1).
 */
export function pyReIgnoreCase(src: string): string {
  return src.replace(/[iI]/g, '[iIİı]').replace(/\[a-zA-Z/g, '[a-zA-Zİı');
}

/**
 * `re.sub(pattern, repl, s)` with a STRING replacement: CPython parses `repl` as a template
 * (`re._parser.parse_template`) — `\\` `\n` `\t` `\r` `\f` `\v` `\a` `\b`(backspace), octal `\0`/`\ooo`,
 * group references `\1`…`\99` and `\g<n>`/`\g<name>`; any other backslash + ASCII letter is
 * `re.error: bad escape`; backslash + other character stays literal. Returns the expander for one
 * match: `groups[0]` is the whole match, `groups[i]` group i. Named groups are not supported here
 * (none of the port's `re.sub` sites define any → `\g<name>` raises like Python's IndexError).
 */
export function pyReTemplate(repl: string, ngroups: number): (groups: readonly (string | undefined)[]) => string {
  type Part = string | number;
  const parts: Part[] = [];
  let lit = '';
  let i = 0;
  const flush = (): void => { if (lit) { parts.push(lit); lit = ''; } };
  while (i < repl.length) {
    const c = repl[i] as string;
    if (c !== '\\') { lit += c; i += 1; continue; }
    if (i + 1 >= repl.length) throw new Error('bad escape (end of pattern) at position ' + i);
    const d = repl[i + 1] as string;
    if (d === 'g') {
      const m = /^\\g<([^>]*)>/.exec(repl.slice(i));
      if (!m) throw new Error('missing < at position ' + (i + 2));
      const name = m[1] as string;
      if (/^[0-9]+$/.test(name)) {
        const g = Number(name);
        if (g > ngroups) throw new Error(`invalid group reference ${g} at position ${i + 3}`);
        flush(); parts.push(g);
      } else if (name === '') {
        throw new Error('missing group name at position ' + (i + 3));
      } else {
        throw new RangeError(`unknown group name '${name}'`); // Python: IndexError
      }
      i += m[0].length; continue;
    }
    if (d === '0') {
      // \0 + up to two octal digits
      let j = i + 2; let oct = '0';
      while (j < repl.length && j < i + 4 && /[0-7]/.test(repl[j] as string)) { oct += repl[j]; j += 1; }
      lit += String.fromCharCode(parseInt(oct, 8)); i = j; continue;
    }
    if (/[1-9]/.test(d)) {
      let j = i + 1; let digits = '';
      while (j < repl.length && j < i + 3 && /[0-9]/.test(repl[j] as string)) { digits += repl[j]; j += 1; }
      if (digits.length === 2 && j < repl.length && /[0-7]/.test(repl[j] as string) && /^[0-7]{2}$/.test(digits)) {
        const oct = digits + repl[j];
        if (parseInt(oct, 8) > 0o377) throw new Error(`octal escape value \\${oct} outside of range 0-0o377 at position ${i}`);
        lit += String.fromCharCode(parseInt(oct, 8)); i = j + 1; continue;
      }
      const g = Number(digits);
      if (g > ngroups) throw new Error(`invalid group reference ${g} at position ${i + 1}`);
      flush(); parts.push(g); i = j; continue;
    }
    const simple: Record<string, string> = { '\\': '\\', n: '\n', t: '\t', r: '\r', f: '\f', v: '\v', a: '\x07', b: '\b' };
    if (d in simple) { lit += simple[d]; i += 2; continue; }
    if (/[A-Za-z]/.test(d)) throw new Error(`bad escape \\${d} at position ${i}`);
    lit += '\\' + d; i += 2; // unknown non-letter escape: kept literally
  }
  flush();
  return (groups) => {
    let out = '';
    for (const p of parts) out += typeof p === 'number' ? (groups[p] ?? '') : p;
    return out;
  };
}
