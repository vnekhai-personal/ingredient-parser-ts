/**
 * Port of `ingredient_parser/dataclasses.py` (pin ffd6ae3) — the token dataclasses needed by
 * the PreProcessor. IngredientAmount, CompositeIngredientAmount, IngredientText,
 * FoundationFood, ParsedIngredient and ParserDebugInfo land with step 3.
 * Field names are upstream's verbatim: they are the level-3 output contract.
 */

/** enum.StrEnum with auto() values = lower-cased member names. */
export enum UnitSystem {
  METRIC = 'metric',
  US_CUSTOMARY = 'us_customary',
  IMPERIAL = 'imperial',
  AUSTRALIAN = 'australian',
  JAPANESE = 'japanese',
  OTHER = 'other',
  NONE = 'none',
}

export interface TokenFeaturesInit {
  stem: string;
  shape: string;
  is_capitalised: boolean;
  is_unit: boolean;
  is_punc: boolean;
  is_ambiguous_unit: boolean;
}

/** Common token features. */
export class TokenFeatures implements TokenFeaturesInit {
  stem: string;
  shape: string;
  is_capitalised: boolean;
  is_unit: boolean;
  is_punc: boolean;
  is_ambiguous_unit: boolean;

  constructor(f: TokenFeaturesInit) {
    this.stem = f.stem;
    this.shape = f.shape;
    this.is_capitalised = f.is_capitalised;
    this.is_unit = f.is_unit;
    this.is_punc = f.is_punc;
    this.is_ambiguous_unit = f.is_ambiguous_unit;
  }
}

export interface TokenInit {
  index: number;
  text: string;
  feat_text: string;
  pos_tag: string;
  features: TokenFeatures;
}

/** A token from an ingredient sentence. */
export class Token implements TokenInit {
  index: number;
  text: string;
  feat_text: string;
  pos_tag: string;
  features: TokenFeatures;

  constructor(t: TokenInit) {
    this.index = t.index;
    this.text = t.text;
    this.feat_text = t.feat_text;
    this.pos_tag = t.pos_tag;
    this.features = t.features;
  }
}

export interface LabelledTokenInit {
  index: number;
  text: string;
  pos_tag: string;
  label: string;
  score: number;
  plural: boolean;
}

/** A labelled token from an ingredient sentence. */
export class LabelledToken implements LabelledTokenInit {
  index: number;
  text: string;
  pos_tag: string;
  label: string;
  score: number;
  plural: boolean;

  constructor(t: LabelledTokenInit) {
    this.index = t.index;
    this.text = t.text;
    this.pos_tag = t.pos_tag;
    this.label = t.label;
    this.score = t.score;
    this.plural = t.plural;
  }
}

// ---------------------------------------------------------------------------------------
// Output dataclasses (step 3)
// ---------------------------------------------------------------------------------------
import { Fraction } from './fraction.js';
import { type DensityContext, Quantity, Unit, UREG } from './_pint.js';
import { pyFormatG, pyMean, PY_S } from './_py.js';

/** Default density used by convert_to: water, `1000 * UREG("kg/m^3")` (a float magnitude in pint). */
export function default_density(): Quantity {
  return UREG('kg/m^3').mul(1000);
}

export interface IngredientAmountInit {
  quantity: Fraction | string;
  quantity_max: Fraction | string;
  unit: string | Unit;
  text: string;
  confidence: number;
  starting_index: number;
  APPROXIMATE?: boolean;
  SINGULAR?: boolean;
  RANGE?: boolean;
  MULTIPLIER?: boolean;
  PREPARED_INGREDIENT?: boolean;
}

const METRIC_PARTS = new Set(['g', 'gram', 'kg', 'kilogram', 'l', 'liter', 'litre', 'ml', 'milliliter', 'millilitre']);
const CUSTOMARY_PARTS = new Set([
  'lb', 'pound', 'oz', 'ounce', 'fluid_ounce', 'st', 'stone', 'c', 'cup', 'tsp', 'teaspoon', 'tbsp', 'tablespoon',
  'pt', 'pint', 'in', 'inch',
]);

/** A parsed ingredient amount. */
const PY_SPLIT_WS = new RegExp(`${PY_S}+`, 'u');

export class IngredientAmount {
  quantity: Fraction | string;
  quantity_max: Fraction | string;
  unit: string | Unit;
  text: string;
  confidence: number;
  starting_index: number;
  unit_system: UnitSystem;
  APPROXIMATE: boolean;
  SINGULAR: boolean;
  RANGE: boolean;
  MULTIPLIER: boolean;
  PREPARED_INGREDIENT: boolean;

  constructor(a: IngredientAmountInit) {
    this.quantity = a.quantity;
    this.quantity_max = a.quantity_max;
    this.unit = a.unit;
    this.text = a.text;
    this.confidence = a.confidence;
    this.starting_index = a.starting_index;
    this.APPROXIMATE = a.APPROXIMATE ?? false;
    this.SINGULAR = a.SINGULAR ?? false;
    this.RANGE = a.RANGE ?? false;
    this.MULTIPLIER = a.MULTIPLIER ?? false;
    this.PREPARED_INGREDIENT = a.PREPARED_INGREDIENT ?? false;
    this.unit_system = this._determine_unit_system();
  }

  /** `copy.deepcopy(self)`. */
  _copy(): IngredientAmount {
    const c = new IngredientAmount({
      quantity: this.quantity,
      quantity_max: this.quantity_max,
      unit: this.unit instanceof Unit ? new Unit(this.unit._units) : this.unit,
      text: this.text,
      confidence: this.confidence,
      starting_index: this.starting_index,
      APPROXIMATE: this.APPROXIMATE,
      SINGULAR: this.SINGULAR,
      RANGE: this.RANGE,
      MULTIPLIER: this.MULTIPLIER,
      PREPARED_INGREDIENT: this.PREPARED_INGREDIENT,
    });
    c.unit_system = this.unit_system;
    return c;
  }

  /**
   * Convert to `unit`; mass ↔ volume through `density` (default water). Raises where any of
   * quantity, quantity_max or unit is a string (Python: TypeError).
   */
  convert_to(unit: string, density: Quantity = default_density()): IngredientAmount {
    if (typeof this.unit === 'string' || typeof this.quantity === 'string' || typeof this.quantity_max === 'string') {
      throw new TypeError('Cannot convert where quantity or unit is a string.');
    }
    const q = new Quantity(this.quantity, this.unit);
    const q_max = new Quantity(this.quantity_max, this.unit);
    const ctx: DensityContext = { p: density };
    const q_converted = q.to(unit, ctx);
    const q_max_converted = q_max.to(unit, ctx);
    const converted_amount = this._copy();
    converted_amount.quantity = q_converted.magnitude as Fraction | string;
    converted_amount.quantity_max = q_max_converted.magnitude as Fraction | string;
    converted_amount.unit = q_converted.units;
    converted_amount.unit_system = converted_amount._determine_unit_system();
    const mag = q_converted.magnitude;
    const asFloat = mag instanceof Fraction ? mag.toNumber() : mag;
    converted_amount.text = `${pyFormatG(asFloat)} ` + q_converted.units.format('P');
    // Python assigns the raw magnitude (a float after mass<->volume); keep that type.
    if (!(mag instanceof Fraction)) {
      (converted_amount as { quantity: unknown }).quantity = mag;
      (converted_amount as { quantity_max: unknown }).quantity_max = q_max_converted.magnitude;
    }
    return converted_amount;
  }

  _determine_unit_system(): UnitSystem {
    // Python `self.unit == ""` is also True for a dimensionless pint Unit.
    if (this.unit === '' || (this.unit instanceof Unit && this.unit._units.size === 0)) return UnitSystem.NONE;
    let str_unit = this.unit instanceof Unit ? this.unit.toString() : this.unit;
    const imperial_unit = str_unit.includes('imperial_');
    const metric_unit = str_unit.includes('metric_');
    const aus_unit = str_unit.includes('aus_');
    const jpn_unit = str_unit.includes('jp_');
    str_unit = str_unit.split('imperial_').join('');
    str_unit = str_unit.split('metric_').join('');
    str_unit = str_unit.split('aus_').join('');
    str_unit = str_unit.split('jp_').join('');
    // Python `str.split()` splits on str.isspace() characters (U+001C–1F and U+0085 included, U+FEFF not).
    for (const part of str_unit.split(PY_SPLIT_WS).filter((p) => p !== '')) {
      const lower = part.toLowerCase();
      if (METRIC_PARTS.has(lower)) return UnitSystem.METRIC;
      if (CUSTOMARY_PARTS.has(lower)) {
        if (imperial_unit) return UnitSystem.IMPERIAL;
        if (metric_unit) return UnitSystem.METRIC;
        if (aus_unit) return UnitSystem.AUSTRALIAN;
        if (jpn_unit) return UnitSystem.JAPANESE;
        return UnitSystem.US_CUSTOMARY;
      }
    }
    return UnitSystem.OTHER;
  }
}

export interface CompositeIngredientAmountInit {
  amounts: IngredientAmount[];
  join: string;
  subtractive: boolean;
}

/** An amount made of several IngredientAmounts, e.g. "1 lb 2 oz" or "2 cups plus 1 tablespoon". */
export class CompositeIngredientAmount {
  amounts: IngredientAmount[];
  join: string;
  subtractive: boolean;
  text: string;
  confidence: number;
  starting_index: number;
  unit_system: UnitSystem;

  constructor(c: CompositeIngredientAmountInit) {
    this.amounts = c.amounts;
    this.join = c.join;
    this.subtractive = c.subtractive;
    if (this.join === '') this.text = this.amounts.map((a) => a.text).join(' ');
    else this.text = this.amounts.map((a) => a.text).join(this.join);
    this.starting_index = Math.min(...this.amounts.map((a) => a.starting_index));
    this.confidence = pyMean(this.amounts.map((a) => a.confidence));
    const unit_systems = new Set(this.amounts.map((a) => a.unit_system));
    if (unit_systems.size > 1 && unit_systems.has(UnitSystem.AUSTRALIAN)) this.unit_system = UnitSystem.AUSTRALIAN;
    else if (unit_systems.size > 1 && unit_systems.has(UnitSystem.JAPANESE)) this.unit_system = UnitSystem.JAPANESE;
    else if (unit_systems.size > 1) this.unit_system = UnitSystem.OTHER;
    else this.unit_system = [...unit_systems][0] as UnitSystem;
  }

  /** Combined amount as a single Quantity; raises unless every amount has a Fraction quantity and a Unit. */
  combined(): Quantity {
    for (const amount of this.amounts) {
      if (!(amount.quantity instanceof Fraction && amount.unit instanceof Unit)) {
        const q_type = amount.quantity instanceof Fraction ? 'Fraction' : 'str';
        const u_type = amount.unit instanceof Unit ? 'Unit' : 'str';
        throw new TypeError(`Incompatible quantity <${q_type}> and unit <${u_type}> for combining.`);
      }
    }
    const quantities = this.amounts.map((a) => new Quantity(a.quantity as Fraction, a.unit as Unit));
    let acc = quantities[0] as Quantity;
    for (const q of quantities.slice(1)) acc = this.subtractive ? acc.sub(q) : acc.add(q);
    return acc;
  }

  convert_to(unit: string, density: Quantity = default_density()): Quantity {
    return this.combined().to(unit, { p: density });
  }
}

export interface IngredientTextInit {
  text: string;
  confidence: number;
  starting_index: number;
}

export class IngredientText implements IngredientTextInit {
  text: string;
  confidence: number;
  starting_index: number;

  constructor(t: IngredientTextInit) {
    this.text = t.text;
    this.confidence = t.confidence;
    this.starting_index = t.starting_index;
  }
}

export interface FoundationFoodInit {
  text: string;
  confidence: number;
  fdc_id: number;
  category: string;
  data_type: string;
  name_index: number;
}

export class FoundationFood {
  text: string;
  confidence: number;
  fdc_id: number;
  category: string;
  data_type: string;
  url: string;
  name_index: number;

  constructor(f: FoundationFoodInit) {
    this.text = f.text;
    this.confidence = f.confidence;
    this.fdc_id = f.fdc_id;
    this.category = f.category;
    this.data_type = f.data_type;
    this.name_index = f.name_index;
    this.url = `https://fdc.nal.usda.gov/food-details/${this.fdc_id}/nutrients`;
  }

  /** `__eq__`: equality by fdc_id. */
  equals(other: unknown): boolean {
    return other instanceof FoundationFood && this.fdc_id === other.fdc_id;
  }
}

export interface ParsedIngredientInit {
  name: IngredientText[];
  size: IngredientText | null;
  amount: (IngredientAmount | CompositeIngredientAmount)[];
  preparation: IngredientText | null;
  comment: IngredientText | null;
  purpose: IngredientText | null;
  foundation_foods: FoundationFood[];
  sentence: string;
}

/** The parsed values for an input sentence — the output contract. */
export class ParsedIngredient {
  name: IngredientText[];
  size: IngredientText | null;
  amount: (IngredientAmount | CompositeIngredientAmount)[];
  preparation: IngredientText | null;
  comment: IngredientText | null;
  purpose: IngredientText | null;
  foundation_foods: FoundationFood[];
  sentence: string;

  constructor(p: ParsedIngredientInit) {
    this.name = p.name;
    this.size = p.size;
    this.amount = p.amount;
    this.preparation = p.preparation;
    this.comment = p.comment;
    this.purpose = p.purpose;
    this.foundation_foods = p.foundation_foods;
    this.sentence = p.sentence;
    this.__post_init__();
  }

  /** Set PREPARED_INGREDIENT on amounts that follow/precede the preparation text relative to the names. */
  private __post_init__(): void {
    if (this.name.length === 0 || !this.preparation) return;
    const first_name_starting_index = Math.min(...this.name.map((n) => n.starting_index));
    const last_name_starting_index = Math.max(...this.name.map((n) => n.starting_index));
    const prep = this.preparation.starting_index;
    for (const amount of this.amount) {
      if (
        (amount.starting_index < prep && prep < first_name_starting_index) ||
        (last_name_starting_index < prep && prep < amount.starting_index)
      ) {
        if (amount instanceof CompositeIngredientAmount) {
          for (const composite_amount of amount.amounts) composite_amount.PREPARED_INGREDIENT = true;
        } else {
          amount.PREPARED_INGREDIENT = true;
        }
      }
    }
  }
}

/** Intermediate objects generated during parsing (inspect_parser). */
export interface ParserDebugInfo {
  sentence: string;
  PreProcessor: unknown;
  PostProcessor: unknown;
  tagger: unknown;
}
