// Canonical serialisation of ParsedIngredient, byte-identical to training/dump-parsed.py's
// `ser()` + Python json.dumps(separators=(",", ":"), ensure_ascii=False): dataclass fields in
// definition order, Fraction → "Fraction(n, d)", Unit → "<Unit('name')>", floats in Python
// repr, ints plain, None → null.
import {
  CompositeIngredientAmount,
  FoundationFood,
  IngredientAmount,
  IngredientText,
  type ParsedIngredient,
} from '../../src/dataclasses.js';
import { Fraction } from '../../src/fraction.js';
import { Unit } from '../../src/_pint.js';
import { pyFloatRepr } from '../../src/_py.js';

const str = (s: string): string => JSON.stringify(s);
const flt = (x: number): string => pyFloatRepr(x);
const int = (x: number): string => String(x);
const bool = (b: boolean): string => (b ? 'true' : 'false');

function quantity(q: Fraction | string | number): string {
  if (q instanceof Fraction) return str(`Fraction(${q.n}, ${q.d})`);
  if (typeof q === 'number') return flt(q);
  return str(q);
}

function unit(u: string | Unit): string {
  return u instanceof Unit ? str(`<Unit('${u.toString()}')>`) : str(u);
}

function text(t: IngredientText | null): string {
  if (t === null) return 'null';
  return `{"text":${str(t.text)},"confidence":${flt(t.confidence)},"starting_index":${int(t.starting_index)}}`;
}

function amount(a: IngredientAmount): string {
  return (
    `{"quantity":${quantity(a.quantity)},"quantity_max":${quantity(a.quantity_max)},"unit":${unit(a.unit)},` +
    `"text":${str(a.text)},"confidence":${flt(a.confidence)},"starting_index":${int(a.starting_index)},` +
    `"unit_system":${str(a.unit_system)},"APPROXIMATE":${bool(a.APPROXIMATE)},"SINGULAR":${bool(a.SINGULAR)},` +
    `"RANGE":${bool(a.RANGE)},"MULTIPLIER":${bool(a.MULTIPLIER)},"PREPARED_INGREDIENT":${bool(a.PREPARED_INGREDIENT)}}`
  );
}

function composite(c: CompositeIngredientAmount): string {
  return (
    `{"amounts":[${c.amounts.map(amount).join(',')}],"join":${str(c.join)},"subtractive":${bool(c.subtractive)},` +
    `"text":${str(c.text)},"confidence":${flt(c.confidence)},"starting_index":${int(c.starting_index)},` +
    `"unit_system":${str(c.unit_system)}}`
  );
}

function foundationFood(f: FoundationFood): string {
  return (
    `{"text":${str(f.text)},"confidence":${flt(f.confidence)},"fdc_id":${int(f.fdc_id)},"category":${str(f.category)},` +
    `"data_type":${str(f.data_type)},"url":${str(f.url)},"name_index":${int(f.name_index)}}`
  );
}

export function serializeParsed(p: ParsedIngredient): string {
  const amounts = p.amount.map((a) => (a instanceof CompositeIngredientAmount ? composite(a) : amount(a)));
  return (
    `{"name":[${p.name.map(text).join(',')}],"size":${text(p.size)},"amount":[${amounts.join(',')}],` +
    `"preparation":${text(p.preparation)},"comment":${text(p.comment)},"purpose":${text(p.purpose)},` +
    `"foundation_foods":[${p.foundation_foods.map(foundationFood).join(',')}],"sentence":${str(p.sentence)}}`
  );
}
