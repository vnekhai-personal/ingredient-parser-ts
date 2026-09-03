// Verbatim conversion of ip-repo/tests/postprocess/test_IngredientAmount.py @ ffd6ae3 (15 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { Fraction } from "../../../src/fraction.js";
import { UnitSystem } from "../../../src/dataclasses.js";
import { UREG, ingredient_amount_factory } from "../../../src/en/_utils.js";

describe("TestPostProcessor_IngredientAmount", () => {
  it("test_float_quantity", () => {
    // Test that the string quantity is correctly converted to a float
    // and that quantity_max is set to the same value
    const amount = ingredient_amount_factory({
      quantity: "25",
      unit: "g",
      text: "25 g",
      confidence: 0,
      starting_index: 0,
    });

    expect(amount.quantity).toEqual(new Fraction(25));
    expect(amount.quantity_max).toEqual(new Fraction(25));
    expect(amount.unit_system).toBe(UnitSystem.METRIC);
  });

  it("test_range_quantity", () => {
    // Test that the string quantity is correctly identified as a range
    // and that quantity and quantity_max are set correctly, and the RANGE
    // flag is also set.
    const amount = ingredient_amount_factory({
      quantity: "25-30",
      unit: "g",
      text: "25 g",
      confidence: 0,
      starting_index: 0,
    });

    expect(amount.quantity).toEqual(new Fraction(25));
    expect(amount.quantity_max).toEqual(new Fraction(30));
    expect(amount.RANGE).toBe(true);
    expect(amount.unit_system).toBe(UnitSystem.METRIC);
  });

  it("test_multiplier_quantity", () => {
    // Test the string quantity is correctly identified as a multiplier and
    // that the quantity and quantity_max field as set the same value, and the
    // MULTIPLIER flag is also set.
    const amount = ingredient_amount_factory({
      quantity: "1x",
      unit: "can",
      text: "1x can",
      confidence: 0,
      starting_index: 0,
    });

    expect(amount.quantity).toEqual(new Fraction(1));
    expect(amount.quantity_max).toEqual(new Fraction(1));
    expect(amount.MULTIPLIER).toBe(true);
    expect(amount.unit_system).toBe(UnitSystem.OTHER);
  });

  it("test_pluralisation_string_unit", () => {
    // Test that the unit in the string in the unit and text fields
    // are pluralised correctly.
    const amount = ingredient_amount_factory({
      quantity: "2",
      unit: "can",
      text: "2 can",
      confidence: 0,
      starting_index: 0,
    });

    expect(amount.unit).toBe("cans");
    expect(amount.text).toBe("2 cans");
    expect(amount.unit_system).toBe(UnitSystem.OTHER);
  });

  it("test_pluralisation_pint_unit", () => {
    // Test that the unit in the string in the text field is pluralised correctly.
    const amount = ingredient_amount_factory({
      quantity: "200",
      unit: "gram",
      text: "200 grams",
      confidence: 0,
      starting_index: 0,
    });

    expect(amount.unit).toEqual(UREG("gram").units);
    expect(amount.text).toBe("200 grams");
    expect(amount.unit_system).toBe(UnitSystem.METRIC);
  });

  it("test_fraction_range_quantity", () => {
    // Test that the string quantity is correctly identified as a range
    // and that quantity and quantity_max are set correctly, and the RANGE
    // flag is also set.
    const amount = ingredient_amount_factory({
      quantity: "#1$4-#1$2",
      unit: "tsp",
      text: "1/4-1/2 tsp",
      confidence: 0,
      starting_index: 0,
    });

    // CONVERSION NOTE: upstream compares against the floats 0.25 / 0.5; Python's
    // Fraction == float compares exactly, so these are the exact rationals 1/4 and 1/2.
    expect(amount.quantity).toEqual(new Fraction(1, 4));
    expect(amount.quantity_max).toEqual(new Fraction(1, 2));
    expect(amount.text).toBe("1/4-1/2 tsp");
    expect(amount.RANGE).toBe(true);
    expect(amount.unit_system).toBe(UnitSystem.US_CUSTOMARY);
  });
});

describe("Test_IngredientAmountVolumetricUnitSystem", () => {
  it("test_metric_volumentric_measurements", () => {
    // Test that tbsp is interpreted as a metric tablespoon when volumetric_unit_system
    // is set to "metric".
    const amount = ingredient_amount_factory({
      quantity: "1",
      unit: "tbsp",
      text: "1 tbsp",
      confidence: 0,
      starting_index: 0,
      volumetric_units_system: "metric",
    });

    expect(amount.unit_system).toBe(UnitSystem.METRIC);
    expect(amount.unit).toEqual(UREG("metric_tablespoon").units);
  });

  it("test_imperial_volumentric_measurements", () => {
    // Test that pint is interpreted as a imperial pint when volumetric_unit_system
    // is set to "imperial".
    const amount = ingredient_amount_factory({
      quantity: "1",
      unit: "pint",
      text: "1 pint",
      confidence: 0,
      starting_index: 0,
      volumetric_units_system: "imperial",
    });

    expect(amount.unit_system).toBe(UnitSystem.IMPERIAL);
    expect(amount.unit).toEqual(UREG("imperial_pint").units);
  });

  it("test_japanese_volumentric_measurements", () => {
    // Test that cup is interpreted as japanese cup when volumetric_unit_system
    // is set to "japanese".
    const amount = ingredient_amount_factory({
      quantity: "1",
      unit: "cup",
      text: "1 cup",
      confidence: 0,
      starting_index: 0,
      volumetric_units_system: "japanese",
    });

    expect(amount.unit_system).toBe(UnitSystem.JAPANESE);
    expect(amount.unit).toEqual(UREG("jp_cup").units);
  });

  it("test_australian_volumentric_measurements", () => {
    // Test that pint is interpreted as a australian pint when volumetric_unit_system
    // is set to "australian".
    const amount = ingredient_amount_factory({
      quantity: "1",
      unit: "pint",
      text: "1 pint",
      confidence: 0,
      starting_index: 0,
      volumetric_units_system: "australian",
    });

    expect(amount.unit_system).toBe(UnitSystem.AUSTRALIAN);
    expect(amount.unit).toEqual(UREG("aus_pint").units);
  });
});

describe("Test_IngredientAmount_convert_to", () => {
  it("test_convert", () => {
    // Test that 1.2 kg is convert to 1,200 g
    const amount = ingredient_amount_factory({
      quantity: "1.2",
      unit: "kg",
      text: "1.2 kg",
      confidence: 0,
      starting_index: 0,
    });

    const converted = amount.convert_to("g");

    // CONVERSION NOTE: `1000 * amount.quantity` is Fraction arithmetic in Python
    // (amount.quantity is a Fraction here); written with the TS Fraction's `mul`.
    expect(converted.quantity).toEqual(new Fraction(1000).mul(amount.quantity as Fraction));
    expect(converted.quantity_max).toEqual(new Fraction(1000).mul(amount.quantity_max as Fraction));
    expect(converted.unit).toEqual(UREG("gram").units);
    expect(converted.text).toBe("1200 gram");
    expect(converted.unit_system).toBe(UnitSystem.METRIC);
  });

  it("test_convert_metric_to_us_customary", () => {
    // Test that 500 ml is converted to ... cups
    const amount = ingredient_amount_factory({
      quantity: "500",
      unit: "ml",
      text: "500 ml",
      confidence: 0,
      starting_index: 0,
    });

    const converted = amount.convert_to("cup");

    expect(converted.quantity).toEqual(new Fraction(4226752837730377, 2000000000000000));
    expect(converted.quantity_max).toEqual(new Fraction(4226752837730377, 2000000000000000));
    expect(converted.unit).toEqual(UREG("cup").units);
    expect(converted.text).toBe("2.11338 cup");
    expect(converted.unit_system).toBe(UnitSystem.US_CUSTOMARY);
  });

  it("test_convert_metric_to_imperial", () => {
    // Test that 500 ml is converted to ... cups
    const amount = ingredient_amount_factory({
      quantity: "500",
      unit: "ml",
      text: "500 ml",
      confidence: 0,
      starting_index: 0,
    });

    const converted = amount.convert_to("imperial_cup");

    expect(converted.quantity).toEqual(new Fraction(879876993196351, 500000000000000));
    expect(converted.quantity_max).toEqual(new Fraction(879876993196351, 500000000000000));
    expect(converted.unit).toEqual(UREG("imperial_cup").units);
    expect(converted.text).toBe("1.75975 imperial_cup");
    expect(converted.unit_system).toBe(UnitSystem.IMPERIAL);
  });

  it("test_string_unit", () => {
    // Test that TypeError is raised when unit is a string
    const amount = ingredient_amount_factory({
      quantity: "1",
      unit: "can",
      text: "1 can",
      confidence: 0,
      starting_index: 0,
    });

    // Python: pytest.raises(TypeError)
    expect(() => amount.convert_to("ml")).toThrow();
  });

  it("test_string_quantity", () => {
    // Test that TypeError is raised when quantity is a string
    const amount = ingredient_amount_factory({
      quantity: "dozen",
      unit: "ml",
      text: "dozen ml",
      confidence: 0,
      starting_index: 0,
    });

    // Python: pytest.raises(TypeError)
    expect(() => amount.convert_to("ml")).toThrow();
  });
});
