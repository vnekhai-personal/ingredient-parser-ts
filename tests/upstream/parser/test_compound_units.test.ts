// Verbatim conversion of ip-repo/tests/parser/test_compound_units.py @ ffd6ae3 (14 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';
import { Fraction } from '../../../src/fraction.js';

describe("TestParser_compound_units_no_count", () => {
  // Test parsing of "X ounce/oz can/jar/bottle" patterns where there is no
  // leading count. The weight (e.g. "15 ounce") describes the container size,
  // not the primary measurement.
  //
  // These depend on the CRF model producing [QTY, UNIT, UNIT] labels for the
  // weight+container pattern. If the model is retrained and labeling changes,
  // these tests may need updating even if the postprocessor logic is correct.

  it.each<[string, string, number, string]>([
    ["15 ounce can black beans", "can", 15, "black beans"],
    ["15 oz can chickpeas", "can", 15, "chickpeas"],
    ["28 ounce can crushed tomatoes", "can", 28, "crushed tomatoes"],
    ["6 ounce can tomato paste", "can", 6, "tomato paste"],
    ["10 ounce can tomato sauce", "can", 10, "tomato sauce"],
    ["8 ounce can tomato sauce", "can", 8, "tomato sauce"],
    ["12-ounce jar apricot preserves", "jar", 12, "apricot preserves"],
    ["16-ounce bag baby spinach", "bag", 16, "baby spinach"],
  ])(
    "test_no_count_compound_unit %#",
    (sentence, expected_container, expected_weight_qty, expected_name) => {
      const parsed = parse_ingredient(sentence);

      expect(parsed.amount.length).toBe(2);
      // Primary amount: quantity of 1, container unit
      expect(parsed.amount[0].quantity).toEqual(new Fraction(1));
      expect(parsed.amount[0].unit.toString()).toBe(expected_container);
      // Secondary amount: weight
      expect(parsed.amount[1].quantity).toEqual(new Fraction(expected_weight_qty));
      expect(parsed.amount[1].unit.toString()).toBe("ounce");
      expect(parsed.name[0].text).toBe(expected_name);
    },
  );
});

describe("TestParser_compound_units_regression", () => {
  // Regression tests ensuring that patterns with an explicit leading count
  // still work correctly after adding the no-count pattern.

  it("test_1_parenthesized_15oz_can", () => {
    const parsed = parse_ingredient("1 (15 oz) can black beans");

    expect(parsed.amount.length).toBe(2);
    expect(parsed.amount[0].quantity).toEqual(new Fraction(1));
    expect(parsed.amount[0].unit.toString()).toBe("can");
    expect(parsed.amount[1].quantity).toEqual(new Fraction(15));
    expect(parsed.amount[1].unit.toString()).toBe("ounce");
    expect(parsed.name[0].text).toBe("black beans");
  });

  it("test_2_parenthesized_6oz_cans", () => {
    const parsed = parse_ingredient("2 (6-oz) cans tomato paste");

    expect(parsed.amount.length).toBe(2);
    expect(parsed.amount[0].quantity).toEqual(new Fraction(2));
    expect(parsed.amount[0].unit.toString()).toBe("cans");
    expect(parsed.amount[1].quantity).toEqual(new Fraction(6));
    expect(parsed.amount[1].unit.toString()).toBe("ounce");
    expect(parsed.name[0].text).toBe("tomato paste");
  });

  it("test_1_28_ounce_can", () => {
    const parsed = parse_ingredient("1 28-ounce can crushed tomatoes");

    expect(parsed.amount.length).toBe(2);
    expect(parsed.amount[0].quantity).toEqual(new Fraction(1));
    expect(parsed.amount[0].unit.toString()).toBe("can");
    expect(parsed.amount[1].quantity).toEqual(new Fraction(28));
    expect(parsed.amount[1].unit.toString()).toBe("ounce");
    expect(parsed.name[0].text).toBe("crushed tomatoes");
  });

  it("test_simple_15_ounces_butter", () => {
    // 15 ounces of a simple ingredient should not trigger the container pattern.
    const parsed = parse_ingredient("15 ounces butter");

    expect(parsed.amount.length).toBe(1);
    expect(parsed.amount[0].quantity).toEqual(new Fraction(15));
    expect(parsed.amount[0].unit.toString()).toBe("ounce");
    expect(parsed.name[0].text).toBe("butter");
  });

  it("test_simple_2_cups_flour", () => {
    const parsed = parse_ingredient("2 cups flour");

    expect(parsed.amount.length).toBe(1);
    expect(parsed.amount[0].quantity).toEqual(new Fraction(2));
    expect(parsed.name[0].text).toBe("flour");
  });

  it("test_simple_1_clove_garlic", () => {
    const parsed = parse_ingredient("1 clove garlic");

    expect(parsed.amount.length).toBe(1);
    expect(parsed.amount[0].quantity).toEqual(new Fraction(1));
    expect(parsed.amount[0].unit.toString()).toBe("clove");
    expect(parsed.name[0].text).toBe("garlic");
  });
});
