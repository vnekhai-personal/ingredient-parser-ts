/**
 * Port of `ingredient_parser/en/_utils.py` (pin ffd6ae3) — the parts the PreProcessor needs.
 * `convert_to_pint_unit`, `to_frac`, `ingredient_amount_factory`, `UREG`,
 * `VOLUMETRIC_UNITS_W_ALTERNATIVES`, `MISINTERPRETED_UNITS` land with step 3 (pint subset).
 *
 * Linguistic components (CLAUDE.md I2): the POS tagger is natural's Brill tagger and the
 * stemmer natural's vanilla PorterStemmer, exactly as `training/brill-tag.mjs` and
 * `training/porter-stem.mjs` produced the tags/stems `models/brill-porter.json.gz` was
 * trained on. NLTK's perceptron tagger + ingredient tagdict and Snowball stemmer are NOT
 * ported (docs/PORTING.md–2.4).
 */
// Deep imports on purpose: `natural`'s root index requires storage backends (mongoose, redis,
// pg, dotenv…) and Node built-ins, which breaks React Native/web bundles and runs dotenv on
// import (docs/VERIFICATION.md D1). These two modules need nothing outside natural itself.
import brill from 'natural/lib/natural/brill_pos_tagger/index.js';
import PorterStemmer from 'natural/lib/natural/stemmers/porter_stemmer.js';
import { PY_B, PY_EOS, PY_NS, PY_W, pyFindall, pyReplaceAll, pyRound, pyStrip, dictGet, pyReTemplate } from '../_py.js';
import { is_float, is_range } from '../_common.js';
import { IngredientAmount } from '../dataclasses.js';
import { Fraction } from '../fraction.js';
import { Unit, UREG } from '../_pint.js';
import { FLATTENED_UNITS_LIST, UNIT_SYNONYMS, UNITS } from './_constants.js';
import { FRACTION_SPLIT_AND_PATTERN, FRACTION_TOKEN_PATTERN, STRING_RANGE_PATTERN } from './_regex.js';

export { UREG };

/** Volumetric units that have different country versions. */
export const VOLUMETRIC_UNITS_W_ALTERNATIVES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  cup: { imperial: 'imperial_cup', japanese: 'jp_cup', australian: 'metric_cup', metric: 'metric_cup' },
  floz: { imperial: 'imperial_fluid_ounce' },
  fluid_ounce: { imperial: 'imperial_fluid_ounce' },
  quart: { imperial: 'imperial_quart' },
  pint: { imperial: 'imperial_pint', australian: 'aus_pint' },
  gallon: { imperial: 'imperial_gallon' },
  tablespoon: { imperial: 'imperial_tablespoon', japanese: 'metric_tablespoon', australian: 'aus_tablespoon', metric: 'metric_tablespoon' },
  tbsp: { imperial: 'imperial_tablespoon', japanese: 'metric_tablespoon', australian: 'aus_tablespoon', metric: 'metric_tablespoon' },
  teaspoon: { imperial: 'imperial_teaspoon', japanese: 'metric_teaspoon', australian: 'metric_teaspoon', metric: 'metric_teaspoon' },
  tsp: { imperial: 'imperial_teaspoon', japanese: 'metric_teaspoon', australian: 'metric_teaspoon', metric: 'metric_teaspoon' },
  ounce: { imperial: 'imperial_ounce' },
  oz: { imperial: 'imperial_ounce' },
  pound: { imperial: 'imperial_pound' },
  lb: { imperial: 'imperial_pound' },
};

/** Units pint interprets as something else (pinch → pico-inch, bar → pressure, …). */
export const MISINTERPRETED_UNITS: readonly string[] = [
  'pinch', 'pinches', 'bar', 'bars', 'link', 'links', 'shake', 'shakes', 'tin', 'tins', 'unit', 'units', 'fat',
];

/** Unit replacements so pint recognises them (step 3 consumer; kept with its upstream siblings). */
const UNIT_REPLACEMENTS_RAW: readonly (readonly [string, string])[] = [
  ['fl oz', 'floz'],
  ['fluid oz', 'fluid_ounce'],
  ['fl ounce', 'fluid_ounce'],
  ['fluid ounce', 'fluid_ounce'],
  ['C', 'cup'],
  ['c', 'cup'],
  ['qt', 'quart'],
  ['Cl', 'centiliter'],
  ['G', 'gram'],
  ['Ml', 'milliliter'],
  ['Mm', 'millimeter'],
  ['Pt', 'pint'],
  ['Tb', 'tablespoon'],
];
export const UNIT_REPLACEMENTS: readonly (readonly [RegExp, string])[] = UNIT_REPLACEMENTS_RAW.map(
  ([unit, repl]) => [new RegExp(`${PY_B}(${unit})${PY_B}`, 'gu'), repl] as const,
);

// ---- tagger + stemmer (natural 8.1.1, pinned in package.json) ----
const LEXICON = new brill.Lexicon('EN', 'NN', 'NNP');
const RULE_SET = new brill.RuleSet('EN');
const TAGGER = new brill.BrillPOSTagger(LEXICON, RULE_SET);
const STEMMER = PorterStemmer;

// Tokenizer regular expressions.
/** One or more non-whitespace characters. */
const WHITESPACE_TOKENISER = new RegExp(`${PY_NS}+`, 'gu');
/** Captures one of ( ) [ ] { } , / : ; ? ! * ~ */
const PUNCTUATION_TOKENISER = /([()[\]{},/:;?!*~])/u;
/** Captures a full stop at the end of the string unless preceded by ".<word char>". */
const FULL_STOP_TOKENISER = new RegExp(`(?<!\\.${PY_W})(\\.)${PY_EOS}`, 'u');

/**
 * Tokenise an ingredient sentence: split on whitespace, isolate the punctuation marks above,
 * recombine "and/or", then split trailing full stops. Empty tokens are dropped.
 */
export function tokenize(sentence: string): string[] {
  const tokens = pyFindall(WHITESPACE_TOKENISER, sentence).map((m) => m[0].split(PUNCTUATION_TOKENISER));
  const flattened = tokens.flat().filter((tok) => tok !== '');
  const combined = combine_and_or(flattened);
  const second = combined.map((tok) => tok.split(FULL_STOP_TOKENISER));
  return second.flat().filter((tok) => tok !== '');
}

/** Tag tokens with parts of speech (natural's Brill tagger). Returns (token, tag) pairs. */
export function pos_tag(tokens: readonly string[]): [string, string][] {
  return TAGGER.tag([...tokens]).taggedWords.map((w) => [w.token, w.tag]);
}

/** Combine ["and", "/", "or"] into a single "and/or" token. */
export function combine_and_or(tokens: readonly string[]): string[] {
  const AND_OR_PATTERN = ['and', '/', 'or'];
  const combined: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (
      tokens[i] === AND_OR_PATTERN[0] &&
      tokens[i + 1] === AND_OR_PATTERN[1] &&
      tokens[i + 2] === AND_OR_PATTERN[2]
    ) {
      combined.push('and/or');
      i += AND_OR_PATTERN.length;
    } else {
      combined.push(tokens[i] as string);
      i += 1;
    }
  }
  return combined;
}

const STEM_CACHE = new Map<string, string>();

/** Stem a token (natural's PorterStemmer), cached. */
export function stem(token: string): string {
  let s = STEM_CACHE.get(token);
  if (s === undefined) {
    s = STEMMER.stem(token);
    STEM_CACHE.set(token, s);
  }
  return s;
}

// Compiled `\b(singular)\b` patterns per distinct merged units table. Upstream recompiles them
// on every call; V8 caches compiled regexes by source but Hermes does not (≈0.7 ms per compile
// × 222 units × 4–6 calls per parse ≈ 460 ms/parse — docs/VERIFICATION.md D9). Entry order follows
// Python's `UNITS | custom_units`: UNITS keys first (a custom value overrides in place), then the
// custom keys not in UNITS in their own order. JS objects enumerate integer-like keys ("2", "10")
// before insertion order, so a custom_units OBJECT with such keys cannot reproduce Python's order
// (audit round 2, preprocess F3 / fuzz B13); no real unit has such a name.
type Expander = (groups: readonly (string | undefined)[]) => string;
const PLURALISE_TABLES = new Map<string, readonly (readonly [RegExp, Expander])[]>();

function pluraliseTable(custom_units: Readonly<Record<string, string>>): readonly (readonly [RegExp, Expander])[] {
  const merged = new Map<string, string>(Object.entries(UNITS));
  for (const [plural, singular] of Object.entries(custom_units)) merged.set(plural, singular);
  const entries = [...merged.entries()];
  const key = JSON.stringify(entries);
  let table = PLURALISE_TABLES.get(key);
  if (table === undefined) {
    // Upstream interpolates the unit into the pattern unescaped (units are plain words) and passes
    // the plural to re.sub as a replacement TEMPLATE (pyReTemplate: `\\1`, `\\n`, `\\g<0>` …).
    table = entries.map(([plural, singular]) => [new RegExp(`${PY_B}(${singular})${PY_B}`, 'gu'), pyReTemplate(plural, 1)] as const);
    PLURALISE_TABLES.set(key, table);
  }
  return table;
}

/** Pluralise any singular units (UNITS values plus custom units) found in `sentence`. */
export function pluralise_units(sentence: string, custom_units: Readonly<Record<string, string>>): string {
  for (const [regex, expand] of pluraliseTable(custom_units)) {
    sentence = sentence.replace(regex, (whole: string, g1: string) => expand([whole, g1]));
  }
  return sentence;
}

/** True if the two units are synonyms (after singularising). */
export function is_unit_synonym(unit1: string, unit2: string): boolean {
  if (!FLATTENED_UNITS_LIST.has(unit1) || !FLATTENED_UNITS_LIST.has(unit2)) return false;
  unit1 = dictGet(UNITS, unit1) ?? unit1;
  unit2 = dictGet(UNITS, unit2) ?? unit2;
  for (const synonyms of UNIT_SYNONYMS) {
    if (synonyms.has(unit1) && synonyms.has(unit2)) return true;
  }
  return false;
}

/** "1 and 1/2" → "1#1$2". */
export function combine_quantities_split_by_and(text: string): string {
  const matches = pyFindall(FRACTION_SPLIT_AND_PATTERN, text);
  for (const match of matches) {
    const replacement = (match[2] as string) + '#' + pyReplaceAll(match[3] as string, '/', '$');
    text = pyReplaceAll(text, match[1] as string, replacement);
  }
  return text;
}

/** "1 to 2" / "4 or 5" → "1-2" / "4-5". */
export function replace_string_range(text: string): string {
  return text.replace(STRING_RANGE_PATTERN, '$1-$5');
}

export interface ConvertToPintUnitOptions {
  volumetric_units_system?: string;
}

const PINT_UNIT_CACHE = new Map<string, string | Unit>();

/** Convert a unit to a pint Unit if the registry knows it, else return the input string. */
export function convert_to_pint_unit(unit: string, options: ConvertToPintUnitOptions = {}): string | Unit {
  const volumetric_units_system = options.volumetric_units_system ?? 'us_customary';
  const cacheKey = `${volumetric_units_system}\u0000${unit}`;
  const cached = PINT_UNIT_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  const result = ((): string | Unit => {
    if (unit.includes('-')) return unit;
    if (MISINTERPRETED_UNITS.includes(unit.toLowerCase())) return unit;
    for (const [regex, replacement] of UNIT_REPLACEMENTS) unit = unit.replace(regex, () => replacement);
    if (Object.hasOwn(VOLUMETRIC_UNITS_W_ALTERNATIVES, unit) && volumetric_units_system !== 'us_customary') {
      const alt = dictGet(VOLUMETRIC_UNITS_W_ALTERNATIVES[unit] as Record<string, string>, volumetric_units_system);
      if (alt) unit = alt;
    }
    if (unit !== '' && UREG.has(unit)) return UREG(unit).units;
    return unit;
  })();
  PINT_UNIT_CACHE.set(cacheKey, result);
  return result;
}

/** Convert a QTY token into a Fraction. */
export function to_frac(token: string): Fraction {
  if (FRACTION_TOKEN_PATTERN.test(token)) {
    const fraction_parts = token
      .split('#')
      .filter((p) => p !== '')
      .map((p) => pyReplaceAll(p, '$', '/'));
    return Fraction.sum(fraction_parts.map((p) => new Fraction(p)));
  }
  return new Fraction(token);
}

export interface IngredientAmountFactoryOptions {
  quantity: string;
  unit: string;
  text: string;
  confidence: number;
  starting_index: number;
  APPROXIMATE?: boolean;
  SINGULAR?: boolean;
  PREPARED_INGREDIENT?: boolean;
  string_units?: boolean;
  volumetric_units_system?: string;
  custom_units?: Readonly<Record<string, string>>;
}

/** Create an IngredientAmount from parts: pluralise units, parse the quantity, set RANGE/MULTIPLIER. */
export function ingredient_amount_factory(o: IngredientAmountFactoryOptions): IngredientAmount {
  let quantity = o.quantity;
  let text = o.text;
  const APPROXIMATE = o.APPROXIMATE ?? false;
  const SINGULAR = o.SINGULAR ?? false;
  const PREPARED_INGREDIENT = o.PREPARED_INGREDIENT ?? false;
  const string_units = o.string_units ?? false;
  const volumetric_units_system = o.volumetric_units_system ?? 'us_customary';
  const custom_units = o.custom_units ?? {};

  let RANGE = false;
  let MULTIPLIER = false;

  if (quantity.endsWith('x')) {
    MULTIPLIER = true;
    quantity = quantity.slice(0, -1);
  }

  let _quantity: Fraction | string;
  let quantity_max: Fraction | string;
  if (is_range(quantity)) {
    const range_parts = quantity.split('-').map((x) => to_frac(x));
    _quantity = Fraction.min(range_parts);
    quantity_max = Fraction.max(range_parts);
    RANGE = true;
  } else if (is_float(quantity) || FRACTION_TOKEN_PATTERN.test(quantity)) {
    _quantity = to_frac(quantity);
    quantity_max = _quantity;
  } else {
    _quantity = quantity;
    quantity_max = _quantity;
  }

  let _unit: string | Unit = o.unit;
  if (!string_units) {
    _unit = convert_to_pint_unit(_unit, { volumetric_units_system });
  }

  // Pluralise unit as necessary (`_quantity != 1 and _quantity != ""`).
  const notOne = _quantity instanceof Fraction ? !_quantity.equals(1) : _quantity !== '1';
  const notEmpty = _quantity instanceof Fraction ? true : _quantity !== '';
  if (notOne && notEmpty && !RANGE) {
    text = pluralise_units(text, custom_units);
    if (typeof _unit === 'string') _unit = pluralise_units(_unit, custom_units);
  }

  text = pyStrip(pyReplaceAll(pyReplaceAll(text, '#', ' '), '$', '/'));
  text = pyReplaceAll(text, '- ', '-');

  return new IngredientAmount({
    quantity: _quantity,
    quantity_max,
    unit: _unit,
    text,
    confidence: pyRound(o.confidence, 6),
    starting_index: o.starting_index,
    APPROXIMATE,
    SINGULAR,
    RANGE,
    MULTIPLIER,
    PREPARED_INGREDIENT,
  });
}
