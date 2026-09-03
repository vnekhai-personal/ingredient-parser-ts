/** Port of `ingredient_parser/parsers.py` (pin ffd6ae3). Identifiers verbatim. */
import { SUPPORTED_LANGUAGES } from './_common.js';
import type { ParsedIngredient, ParserDebugInfo } from './dataclasses.js';
import { inspect_parser_en, parse_ingredient_en } from './en/parser.js';

export const SUPPORTED_VOLUMEETRIC_UNITS_SYSTEMS: ReadonlySet<string> = new Set([
  'us_customary',
  'imperial',
  'metric',
  'australian',
  'japanese',
]);

export interface ParseIngredientOptions {
  lang?: string;
  separate_names?: boolean;
  discard_isolated_stop_words?: boolean;
  expect_name_in_output?: boolean;
  string_units?: boolean;
  /** Deprecated since 2.5.0: use `volumetric_units_system: "imperial"`. */
  imperial_units?: boolean;
  volumetric_units_system?: string;
  foundation_foods?: boolean;
  custom_units?: Readonly<Record<string, string>> | null;
}

function validate(
  options: ParseIngredientOptions,
  defaultSystem: string,
  deprecation = "imperial_units=True argument is deprecated. Use volumetric_units_system='imperial'",
): { lang: string; volumetric_units_system: string } {
  const lang = options.lang ?? 'en';
  // Only an absent option takes the default; Python rejects an explicit None (untyped JS callers can pass null).
  let volumetric_units_system: string | null =
    options.volumetric_units_system === undefined ? defaultSystem : options.volumetric_units_system;
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    throw new Error(`Unsupported language "${lang}"`); // Python: ValueError
  }
  if (options.imperial_units) {
    // Python: DeprecationWarning
    console.warn(deprecation);
    volumetric_units_system = 'imperial';
  }
  if (volumetric_units_system === null || !SUPPORTED_VOLUMEETRIC_UNITS_SYSTEMS.has(volumetric_units_system)) {
    throw new Error(`Unsupported volumetric_units_system "${volumetric_units_system ?? 'None'}"`); // Python: ValueError
  }
  return { lang, volumetric_units_system };
}

function enOptions(options: ParseIngredientOptions, volumetric_units_system: string) {
  return {
    separate_names: options.separate_names ?? true,
    discard_isolated_stop_words: options.discard_isolated_stop_words ?? true,
    expect_name_in_output: options.expect_name_in_output ?? true,
    string_units: options.string_units ?? false,
    volumetric_units_system,
    foundation_foods: options.foundation_foods ?? false,
    custom_units: options.custom_units ?? null,
  };
}

/** Parse an ingredient sentence into structured data. */
export function parse_ingredient(sentence: string, options: ParseIngredientOptions = {}): ParsedIngredient {
  const { lang, volumetric_units_system } = validate(options, 'us_customary');
  switch (lang) {
    case 'en':
      return parse_ingredient_en(sentence, enOptions(options, volumetric_units_system));
    default:
      throw new Error(`Unrecognised value "${lang}"`); // Python: ValueError
  }
}

/** Parse several sentences. Note upstream's default `volumetric_units_system="us"` here, mirrored. */
export function parse_multiple_ingredients(sentences: Iterable<string>, options: ParseIngredientOptions = {}): ParsedIngredient[] {
  return [...sentences].map((sentence) => parse_ingredient(sentence, { ...options, volumetric_units_system: options.volumetric_units_system ?? 'us' }));
}

/** Return the intermediate objects generated during parsing. */
export function inspect_parser(sentence: string, options: ParseIngredientOptions = {}): ParserDebugInfo {
  // Upstream's inspect_parser message carries a typo ("imperal"); mirrored.
  const { lang, volumetric_units_system } = validate(
    options,
    'us_customary',
    "imperial_units=True argument is deprecated. Use volumetric_units_system='imperal'",
  );
  switch (lang) {
    case 'en':
      return inspect_parser_en(sentence, enOptions(options, volumetric_units_system));
    default:
      throw new Error(`Unrecognised value "${lang}"`); // Python: ValueError
  }
}
