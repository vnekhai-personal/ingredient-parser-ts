/**
 * Port of `ingredient_parser/en/foundationfoods/_ff_constants.py` (pin ffd6ae3). Identifiers
 * verbatim; tables transcribed mechanically (CLAUDE.md §3).
 */
import { FoundationFood } from '../../dataclasses.js';

/**
 * Key of a stemmed-token tuple in `FOUNDATION_FOOD_OVERRIDES` (TS-native: Map keys must be
 * primitives). Stems never contain whitespace, so the space-joined tuple is injective.
 */
export function override_key(tokens: readonly string[]): string {
  return tokens.join(' ');
}

/**
 * Dict of ingredient name tokens that bypass the usual foundation food matching process.
 * We do this because the embedding distance approach sometime gives poor results when the
 * name we're trying to match only has one token. The tokens in the dict keys are stemmed.
 *
 * Exactly like upstream, every entry is ONE shared `FoundationFood` instance that the matcher
 * mutates in place (`match.name_index = name_idx`) and returns — never copy on lookup.
 */
export const FOUNDATION_FOOD_OVERRIDES: Map<string, FoundationFood> = new Map<string, FoundationFood>([
  [
    override_key(['salt']),
    new FoundationFood({
      text: 'Salt, table, iodized',
      confidence: 1.0,
      fdc_id: 746775,
      category: 'Spices and Herbs',
      data_type: 'foundation_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['sea', 'salt']),
    new FoundationFood({
      text: 'Salt, table, iodized',
      confidence: 1.0,
      fdc_id: 746775,
      category: 'Spices and Herbs',
      data_type: 'foundation_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['pepper']),
    new FoundationFood({
      text: 'Spices, pepper, black',
      confidence: 1.0,
      fdc_id: 170931,
      category: 'Spices and Herbs',
      data_type: 'sr_legacy_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['white', 'pepper']),
    new FoundationFood({
      text: 'Spices, pepper, white',
      confidence: 1.0,
      fdc_id: 170933,
      category: 'Spices and Herbs',
      data_type: 'sr_legacy_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['egg']),
    new FoundationFood({
      text: 'Eggs, Grade A, Large, egg whole',
      confidence: 1.0,
      fdc_id: 748967,
      category: 'Dairy and Egg Products',
      data_type: 'foundation_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['butter']),
    new FoundationFood({
      text: 'Butter, stick, unsalted',
      confidence: 1.0,
      fdc_id: 789828,
      category: 'Dairy and Egg Products',
      data_type: 'foundation_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['all-purpos', 'flour']),
    new FoundationFood({
      text: 'Flour, wheat, all-purpose, unenriched, unbleached',
      confidence: 1.0,
      fdc_id: 790018,
      category: 'Cereal Grains and Pasta',
      data_type: 'foundation_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['all', 'purpos', 'flour']),
    new FoundationFood({
      text: 'Flour, wheat, all-purpose, unenriched, unbleached',
      confidence: 1.0,
      fdc_id: 790018,
      category: 'Cereal Grains and Pasta',
      data_type: 'foundation_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['sugar']),
    new FoundationFood({
      text: 'Sugar, NFS',
      confidence: 1.0,
      fdc_id: 2710257,
      category: 'Sugars and honey',
      data_type: 'survey_fndds_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['caster', 'sugar']),
    new FoundationFood({
      text: 'Sugar, NFS',
      confidence: 1.0,
      fdc_id: 2710257,
      category: 'Sugars and honey',
      data_type: 'survey_fndds_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['rice']),
    new FoundationFood({
      text: 'Rice, cooked, NFS',
      confidence: 1.0,
      fdc_id: 2708402,
      category: 'Rice',
      data_type: 'survey_fndds_food',
      name_index: 0,
    }),
  ],
  [
    override_key(['dill']),
    new FoundationFood({
      text: 'Dill weed, fresh',
      confidence: 1.0,
      fdc_id: 172233,
      category: 'Spices and Herbs',
      data_type: 'sr_legacy_food',
      name_index: 0,
    }),
  ],
]);

/**
 * Verb stems, the presence of which indicates the food is not raw and therefore should not be
 * biased towards a raw food.
 */
export const NON_RAW_FOOD_VERB_STEMS: Set<string> = new Set([
  'age',
  'bake',
  'black',
  'blanch',
  'boil',
  'brais',
  'brew',
  'broil',
  'butter',
  'can',
  'cook',
  'crisp',
  'cultur',
  'cure',
  'decaffein',
  'dehydr',
  'devil',
  'distil',
  'dri',
  'ferment',
  'flavor',
  'fortifi',
  'fresh',
  'fri',
  'grill',
  'ground',
  'heat',
  'hull',
  'microwav',
  'parboil',
  'pasteur',
  'pickl',
  'poach',
  'precook',
  'prepar',
  'preserv',
  'powder',
  'reconstitut',
  'refin',
  'refri',
  'reheat',
  'rehydr',
  'render',
  'roast',
  'simmer',
  'smoke',
  'soak',
  'spice',
  'steam',
  'stew',
  'toast',
  'unbak',
  'unsalt',
]);
// Also include "raw" so we don't add if again if already present
NON_RAW_FOOD_VERB_STEMS.add('raw');

/**
 * Noun stems, for foods that are implicitly not raw and therefore should not be biased towards
 * a raw food.
 */
export const NON_RAW_FOOD_NOUN_STEMS: Set<string> = new Set([
  'bread',
  'broth',
  'butter',
  'cream',
  'custard',
  'fat',
  'ketchup',
  'mayonnais',
  'milk',
  'oliv',
  'pasta',
  'pure', // puree/purée
  'salt',
  'sauce',
  'stock',
  'sugar',
  'syrup',
]);

/** Tokens that indicate following words are negated. NS = not specified. */
export const NEGATION_TOKENS: Set<string> = new Set(['no', 'not', 'without', 'NS']);

/** Tokens that indicate following words have reduced relevance to the ingredient. */
export const REDUCED_RELEVANCE_TOKENS: Set<string> = new Set(['with', 'on']);

/**
 * Ambiguous ingredient name adjectives.
 *
 * UPSTREAM QUIRK, ported faithfully: the Python list is missing the comma after `"strong"`, so
 * implicit string-literal concatenation turns `"strong"  "hard"` into the single element
 * `"stronghard"`. Neither "strong" nor "hard" is therefore ever stripped at the pin.
 */
export const AMBIGUOUS_ADJECTIVES: readonly string[] = [
  'hot', // temperature/spiciness
  'cool', // temperature/taste (e.g. cool mint)
  'stronghard', // "strong" (concentration/gluten content) + "hard" (texture/alcoholic) fused by the missing comma
];
