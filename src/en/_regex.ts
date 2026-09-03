/**
 * Port of `ingredient_parser/en/_regex.py` (pin ffd6ae3). Patterns are translated by
 * BEHAVIOUR, not copied: Python str-pattern `\d`, `\s`, `\b`, `\w` and `$` are Unicode-aware
 * or newline-tolerant where JavaScript's are not, so they are spelled out via the PY_*
 * fragments in `_py.ts`. Capturing-group numbering is kept identical to upstream so `$n`
 * replacements line up. Patterns used with `re.sub`/`findall` carry the `g` flag; patterns
 * used with `re.match` are `^`-anchored and carry no `g` (stateless `.test`).
 */
import { PY_B, PY_D, PY_EOS, PY_S, pyReIgnoreCase } from '../_py.js';
import { FLATTENED_UNITS_LIST, LENGTH_UNITS, STRING_NUMBERS } from './_constants.js';

/** Fraction parts: 0+ digits, 0+ whitespace, a digit, a slash, 1+ digits. */
export const FRACTION_PARTS_PATTERN = new RegExp(`(${PY_D}*${PY_S}*${PY_D}/${PY_D}+)`, 'gu');

/** Token starts with a capital letter. */
export const CAPITALISED_PATTERN = /^[A-Z]/u;

// Units set for splitting quantities from units; "x" is added so 2cmx2cm splits.
// Sorted for determinism: every entry is purely alphabetic, so alternation order cannot
// change what matches (verified at port time).
const units_list: readonly string[] = [...new Set([...FLATTENED_UNITS_LIST, 'x', ...LENGTH_UNITS])].sort();
const UNITS_ALT = units_list.join('|');
const STRING_NUMBERS_ALT = Object.keys(STRING_NUMBERS).join('|');

/** Quantity directly followed by a unit; the lookahead excludes letters other than x. */
export const QUANTITY_UNITS_PATTERN = new RegExp(`(${PY_D})-?(${UNITS_ALT})(?![a-wyzA-WYZ])`, 'gu');
export const UNITS_QUANTITY_PATTERN = new RegExp(`(${UNITS_ALT})(${PY_D})`, 'gu');
export const UNITS_HYPHEN_QUANTITY_PATTERN = new RegExp(`(${UNITS_ALT})-(${PY_D})`, 'gu');
// Compiled with re.IGNORECASE upstream: CPython also folds İ/ı onto i (pyReIgnoreCase).
export const STRING_QUANTITY_HYPHEN_PATTERN = new RegExp(
  pyReIgnoreCase(`${PY_B}(${STRING_NUMBERS_ALT})${PY_B}-${PY_B}(${UNITS_ALT})${PY_B}`),
  'giu',
);

/**
 * A range in string format e.g. "1 to 2", "8.5 to 12", "4 or 5"; fractions in #1$2 form.
 * Groups: 1 number, 2 hyphen?, 3 to|or, 4 hyphen*, 5 (number + hyphen?) [6 number, 7 hyphen].
 */
const NUM_A = `0\\.[0-9]|[1-9][${PY_D}.]*?|${PY_D}*#${PY_D}+\\$${PY_D}+`;
const NUM_B = `0\\.[0-9]+|[1-9][${PY_D}.]*?|${PY_D}*#${PY_D}+\\$${PY_D}+`;
export const STRING_RANGE_PATTERN = new RegExp(
  `(${NUM_A})${PY_S}*(-)?${PY_S}*(to|or)${PY_S}*(-)*${PY_S}*((${NUM_B})(-)?)`,
  'gu',
);

/** Quantities split by "and" e.g. "1 and 1/2": groups 1 whole, 2 before, 3 fraction. */
export const FRACTION_SPLIT_AND_PATTERN = new RegExp(`((${PY_D}+)${PY_S}and${PY_S}(${PY_D}/${PY_D}+))`, 'gu');

const DEC_OR_FRAC = `[${PY_D}.]+|${PY_D}*#${PY_D}+\\$${PY_D}+`;
/** "<qty> <unit> (-|to|or) <qty> <unit>": groups 1 whole, 2 qty, 3 unit, 4 qty, 5 unit. Case-insensitive. */
export const DUPE_UNIT_RANGES_PATTERN = new RegExp(
  pyReIgnoreCase(`((${DEC_OR_FRAC})${PY_S}([a-zA-Z]+)${PY_S}*(?:-|to|or)${PY_S}*(${DEC_OR_FRAC})${PY_S}([a-zA-Z]+))`),
  'giu',
);

/** A number followed by a space, an x, and optional space; group 1 = the number. */
export const QUANTITY_X_PATTERN = new RegExp(`(${DEC_OR_FRAC})${PY_S}[xX]${PY_S}*`, 'gu');

/** A range with spaces around the hyphen e.g. "0.5 - 1" (second number may start with #). */
export const EXPANDED_RANGE = new RegExp(`(${PY_D})${PY_S}*-${PY_S}*([${PY_D}#])`, 'gu');

export const LOWERCASE_PATTERN = /[a-z]/gu;
export const UPPERCASE_PATTERN = /[A-Z]/gu;
export const DIGIT_PATTERN = /[0-9]/gu;

/** A fraction token (#1$2, 1#1$3) or a range of fraction tokens. Anchored: use with `.test`. */
export const FRACTION_TOKEN_PATTERN = new RegExp(
  `^${PY_D}*#${PY_D}+\\$${PY_D}+(?:-${PY_D}*#${PY_D}+\\$${PY_D}+)?${PY_EOS}`,
  'u',
);

/** Currency within parentheses e.g. ($1.99), optionally suffixed with asterisks. */
const currency_pattern = ['$', '£', '€', '¥', '₹'].map((c) => c.replace(/[$]/g, '\\$')).join('|');
export const CURRENCY_PATTERN = new RegExp(`\\(${PY_S}*(?:${currency_pattern})${PY_S}*[0-9.,]+\\**${PY_S}*\\)`, 'gu');
