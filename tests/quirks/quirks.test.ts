// Every correction in docs/QUIRKS.md is asserted twice — the default ('upstream') keeps
// Python's behaviour at the pin, 'fixed' applies the correction. Parity numbers stay true.
import { describe, expect, it } from 'vitest';
import { inspect_parser, parse_ingredient, parse_multiple_ingredients, tag_ingredient } from '../../src/index.js';
import type { IngredientAmount } from '../../src/index.js';
import type { PostProcessor } from '../../src/en/index.js';

const unit = (a: unknown): string => String((a as IngredientAmount).unit);

describe('quirks: upstream (default) vs fixed', () => {
  it('duplicate_unit_tokens — "1 teaspoon (tsp) salt"', () => {
    const up = parse_ingredient('1 teaspoon (tsp) salt');
    expect(unit(up.amount[0])).toBe('teaspoon ** 2');
    expect(up.amount[0]!.text).toBe('1 teaspoon tsp');
    const fx = parse_ingredient('1 teaspoon (tsp) salt', { quirks: 'fixed' });
    expect(unit(fx.amount[0])).toBe('teaspoon');
    expect(fx.amount[0]!.text).toBe('1 teaspoon');
    expect(fx.name[0]!.text).toBe('salt');
    // pluralised variant
    const fx2 = parse_ingredient('2 tablespoons (tbsp) olive oil', { quirks: 'fixed' });
    expect(unit(fx2.amount[0])).toBe('tablespoon');
    expect(fx2.amount[0]!.text).toBe('2 tablespoons');
    // genuinely different units are NOT collapsed
    const keep = parse_ingredient('1 pound 2 ounce chicken', { quirks: 'fixed' });
    expect(keep.amount.length).toBeGreaterThan(0);
  });

  it('name_pluralisation — "flat-leaf parsley"', () => {
    expect(parse_ingredient('1 cup flat-leaf parsley, chopped').name[0]!.text).toBe('flat-leaves parsley');
    const fx = parse_ingredient('1 cup flat-leaf parsley, chopped', { quirks: 'fixed' });
    expect(fx.name[0]!.text).toBe('flat-leaf parsley');
    expect(fx.amount[0]!.text).toBe('1 cup'); // amounts still pluralise as upstream
    expect(parse_ingredient('2 cup flour', { quirks: 'fixed' }).amount[0]!.text).toBe('2 cups');
    // a real-world line
    const h = parse_ingredient('A big handful of chopped flat-leaf parsley', { quirks: 'fixed' });
    expect(h.name[0]!.text).toBe('flat-leaf parsley');
    expect(h.amount[0]!.text).toBe('1 big handful');
    // genuinely plural names keep their plural (the preprocessor singularises "leaves"), singular stay singular
    expect(parse_ingredient('2 bay leaves', { quirks: 'fixed' }).name[0]!.text).toBe('bay leaves');
    expect(parse_ingredient('1 bay leaf', { quirks: 'fixed' }).name[0]!.text).toBe('bay leaf');
    expect(parse_ingredient('1 bay leaf').name[0]!.text).toBe('bay leaves'); // upstream
  });

  it('section_headers — "For the sauce" / "To serve"', () => {
    const up = parse_ingredient('For the sauce');
    expect(up.name.map((n) => n.text)).toEqual(['For the sauce']);
    expect(up.purpose).toBeNull();
    const fx = parse_ingredient('For the sauce', { quirks: 'fixed' });
    expect(fx.name).toEqual([]);
    expect(fx.purpose?.text).toBe('For the sauce');
    expect(parse_ingredient('To serve', { quirks: 'fixed' }).purpose?.text).toBe('To serve');
    // a real ingredient starting with "To" or with an amount is untouched
    expect(parse_ingredient('Tomatoes, diced', { quirks: 'fixed' }).name[0]!.text).toBe('Tomatoes');
    expect(parse_ingredient('1 cup sauce for the chicken', { quirks: 'fixed' }).name.length).toBe(1);
  });

  it('multiple_ingredients_default — upstream default "us" raises, fixed does not', () => {
    expect(() => parse_multiple_ingredients(['1 cup flour'])).toThrow(/Unsupported volumetric_units_system "us"/);
    const fx = parse_multiple_ingredients(['1 cup flour', '2 tsp salt'], { quirks: 'fixed' });
    expect(fx.map((p) => p.name[0]!.text)).toEqual(['flour', 'salt']);
  });
});

describe('tag_ingredient (addition beyond upstream)', () => {
  it('returns the same labels and scores parse_ingredient uses, without the postprocessor', () => {
    const s = '2 tbsp chopped flat-leaf parsley';
    const t = tag_ingredient(s);
    const info = inspect_parser(s);
    const tokens = (info.PostProcessor as PostProcessor).tokens;
    expect(t.tokens).toEqual(tokens.map((x) => x.text));
    expect(t.labels).toEqual(tokens.map((x) => x.label));
    expect(t.scores).toEqual(tokens.map((x) => x.score));
    expect(t.pos_tags.length).toBe(t.tokens.length);
    expect(t.sentence).toBe('2 tbsp chopped flat-leaf parsley');
    expect(t.labels).toEqual(['QTY', 'UNIT', 'PREP', 'B_NAME_TOK', 'I_NAME_TOK']);
  });
  it('never runs the postprocessor: a line whose upstream postprocessing raises still tags', () => {
    // "dozen" first with nothing before it: upstream's fallback pattern raises IndexError (mirrored).
    expect(() => parse_ingredient('dozen eggs or 2')).toThrow();
    const t = tag_ingredient('dozen eggs or 2');
    expect(t.tokens.length).toBe(t.labels.length);
    expect(t.labels[0]).toBe('QTY');
  });
  it('honours expect_name_in_output and custom_units like parse_ingredient', () => {
    expect(tag_ingredient('1 cup, plus 2 tablespoons olive oil', { expect_name_in_output: false }).labels.some((l) => l.includes('NAME'))).toBe(true);
    const cu = tag_ingredient('2 punnets strawberries', { custom_units: { punnets: 'punnet' } });
    expect(cu.labels[1]).toBe('UNIT');
  });
});
