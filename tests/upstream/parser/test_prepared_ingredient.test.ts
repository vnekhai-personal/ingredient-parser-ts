// Verbatim conversion of ip-repo/tests/parser/test_prepared_ingredient.py @ ffd6ae3 (5 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';

describe("Test_prepared_ingredient", () => {
  it("test_no_preparation", () => {
    // Test that PREPARED_INGREDIENT for all amounts is False
    const sentence = "3 cups (750 g) flour";
    const parsed = parse_ingredient(sentence);
    for (const amount of parsed.amount) {
      expect(amount.PREPARED_INGREDIENT).toBe(false);
    }
  });

  it("test_preparation_between_amount_and_name", () => {
    // Test that PREPARED_INGREDIENT for all amounts is True
    const sentence = "3 cups (750 g) sifted flour";
    const parsed = parse_ingredient(sentence);
    for (const amount of parsed.amount) {
      expect(amount.PREPARED_INGREDIENT).toBe(true);
    }
  });

  it("test_preparation_between_name_and_amount", () => {
    // Test that PREPARED_INGREDIENT for all amounts is True
    const sentence = "Onion, finely chopped (about 1 cup)";
    const parsed = parse_ingredient(sentence);
    for (const amount of parsed.amount) {
      expect(amount.PREPARED_INGREDIENT).toBe(true);
    }
  });

  it("test_preparation_after_amount_and_name", () => {
    // Test that PREPARED_INGREDIENT for all amounts is False
    const sentence = "3 cups (750 g) flour, sifted";
    const parsed = parse_ingredient(sentence);
    for (const amount of parsed.amount) {
      expect(amount.PREPARED_INGREDIENT).toBe(false);
    }
  });

  it("test_multiple_names", () => {
    // Test that PREPARED_INGREDIENT for all amounts is True
    const sentence = "3 cups (750 ml) strained beef or vegetable stock";
    const parsed = parse_ingredient(sentence);
    for (const amount of parsed.amount) {
      expect(amount.PREPARED_INGREDIENT).toBe(true);
    }
  });
});
