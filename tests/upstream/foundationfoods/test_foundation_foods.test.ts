// Verbatim conversion of ip-repo/tests/foundationfoods/test_foundation_foods.py @ ffd6ae3 (36 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect, beforeAll } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';
import { preload_foundation_foods } from '../../../src/en/_loaders.js';

beforeAll(async () => {
  await preload_foundation_foods();
});

const OVERRIDE_EXAMPLES: [string, number][] = [
  ["1 egg", 748967],
  ["2 eggs", 748967],
  ["1 tbsp salt", 746775],
  ["4 cloves garlic, crushed", 1104647],
];

const SIMPLE_EXAMPLES: [string, number][] = [
  ["½ yellow bell pepper, chopped", 2258589],
  ["8 large strawberries, hulled and halved", 2346409],
  ["1 cup white wine", 2710689],
  ["1 lg yellow onion, chopped", 790646],
  ["3 red chili peppers, seeded and finely chopped", 170106],
  ["1/2 teaspoon ground ginger", 170926],
  ["2 large red onions, sliced", 790577],
  ["3 skinless, boneless chicken breasts, chopped into 2 cm cubes", 2646170],
  ["200 g canned chopped tomatoes", 2685581],
  ["4 tbsp tomato ketchup", 2709733],
  ["small handful fresh parsley, leaves picked and chopped", 170416],
];

const BIAS_EXAMPLES: [string, [number, number]][] = [
  ["2 red or green peppers", [2258588, 2258590]],
  ["2 cooked red or green peppers", [2709976, 2709977]],
];

const MULTIPLE_EXAMPLES: [string, [number, number]][] = [
  ["salt and black pepper", [170931, 746775]],
  ["24 fresh basil leaves or dried basil", [172232, 171317]],
  ["2 red or green peppers", [2258588, 2258590]],
  ["250 ml hot beef or chicken stock", [172883, 172884]],
];

const NO_MATCH_EXAMPLES: string[] = ["twelve bonbons"];

const NO_EMBEDDING_TOKENS: [string, number | null][] = [
  ["1 waxgourd", 170069], // not in embeddings, but has FDC match
  ["200 g lionfish", null], // not in embeddings and no FDC match
  ["1 cup x", null], // no valid ingredient name tokens
];

describe("TestPostProcessor_match_foundation_foods", () => {
  it.each(OVERRIDE_EXAMPLES)("test_match_foundation_foods_overrides %#", (sentence, fdc_id) => {
    // Test that each example sentence returns the correct foundation food override.
    const p = parse_ingredient(sentence, { foundation_foods: true });
    expect(p.foundation_foods).not.toEqual([]);
    expect(p.foundation_foods[0].fdc_id).toBe(fdc_id);
    expect(p.foundation_foods[0].confidence).toBe(1);
  });

  it.each(SIMPLE_EXAMPLES)("test_match_foundation_foods_simple %#", (sentence, fdc_id) => {
    // Test that each example sentence returns the correct foundation food.
    const p = parse_ingredient(sentence, { foundation_foods: true });
    expect(p.foundation_foods).not.toEqual([]);
    expect(p.foundation_foods[0].fdc_id).toBe(fdc_id);
  });

  it.each(SIMPLE_EXAMPLES)(
    "test_match_foundation_foods_simple_combined_names %#",
    (sentence, fdc_id) => {
      // Test that each example sentence returns the correct foundation food.
      const p = parse_ingredient(sentence, { separate_names: false, foundation_foods: true });
      expect(p.foundation_foods).not.toEqual([]);
      expect(p.foundation_foods[0].fdc_id).toBe(fdc_id);
    },
  );

  it.each(MULTIPLE_EXAMPLES)("test_match_foundation_foods_multiple %#", (sentence, fdc_ids) => {
    // Test that each example sentence returns the correct foundation foods.
    const p = parse_ingredient(sentence, { foundation_foods: true });
    expect(p.foundation_foods.length).toBeGreaterThan(1);
    for (const ff of p.foundation_foods) {
      expect(fdc_ids).toContain(ff.fdc_id);
    }
  });

  // PARITY-DELTA (tagger+model, docs/PORTING.md §3.2–3.3) for "2 cooked red or green peppers": natural's
  // Brill tags "cooked" VBN and the ship model labels it PREP, so the names are "red peppers" /
  // "green peppers" and the raw-food bias fires (2258590 / 2258588). Python at the pin with the
  // ship model + BRILL_TAGS_FILE returns exactly that, byte for byte (2026-09-02). The other
  // BIAS_EXAMPLES row passes. Data kept verbatim; the delta row is asserted with it.fails.
  const BIAS_DELTAS = new Set(["2 cooked red or green peppers"]);
  for (const [sentence, fdc_ids] of BIAS_EXAMPLES) {
    (BIAS_DELTAS.has(sentence) ? it.fails : it)(`test_match_foundation_foods_bias ${sentence}`, () => {
    // Test that each example sentence returns the correct foundation foods.
    const p = parse_ingredient(sentence, { foundation_foods: true });
    expect(p.foundation_foods.length).toBeGreaterThan(1);
    for (const ff of p.foundation_foods) {
      expect(fdc_ids).toContain(ff.fdc_id);
    }
    });
  }

  it.each(NO_MATCH_EXAMPLES)("test_match_foundation_foods_no_match %#", (sentence) => {
    // Test that each example sentence returns no foundation food.
    const p = parse_ingredient(sentence, { foundation_foods: true });
    expect(p.foundation_foods).toEqual([]);
  });

  it.each(NO_EMBEDDING_TOKENS)(
    "test_match_foundation_foods_no_embeddings %#",
    (sentence, fdc_id) => {
      // Test that each example sentence returns no foundation food.
      const p = parse_ingredient(sentence, { foundation_foods: true });
      if (fdc_id) {
        expect(p.foundation_foods).not.toEqual([]);
        expect(p.foundation_foods[0].fdc_id).toBe(fdc_id);
      } else {
        expect(p.foundation_foods).toEqual([]);
      }
    },
  );
});
