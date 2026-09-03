// Verbatim conversion of ip-repo/tests/postprocess/test_CompositeIngredientAmount.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { Fraction } from "../../../src/fraction.js";
import { CompositeIngredientAmount, UnitSystem } from "../../../src/dataclasses.js";
import { UREG, ingredient_amount_factory } from "../../../src/en/_utils.js";

// CONVERSION NOTE: upstream calls ingredient_amount_factory positionally here
// ("2", "cups", "2 cups", 0, 0). The TS factory takes one object of its parameters
// (README "Factories keep their Python name and kwargs → object"), so the positional
// arguments are mapped onto their parameter names in upstream order:
// quantity, unit, text, confidence, starting_index.

describe("TestPostProcessor_CompositeIngredientAmount", () => {
  it("test_composite_ingredient_amount_us_customary", () => {
    // Test that the unit system for a composite ingredient amount is correct set.
    const am1 = ingredient_amount_factory({ quantity: "2", unit: "cups", text: "2 cups", confidence: 0, starting_index: 0 });
    const am2 = ingredient_amount_factory({ quantity: "2", unit: "tbsp", text: "2 tbsp", confidence: 0, starting_index: 0 });

    const amount = new CompositeIngredientAmount({
      amounts: [am1, am2],
      join: "",
      subtractive: false,
    });

    expect(amount.unit_system).toBe(UnitSystem.US_CUSTOMARY);
  });

  it("test_composite_ingredient_amount_imperial", () => {
    // Test that the unit system for a composite ingredient amount is correct set when
    // one of the units is imperial and the other US customary.
    const am1 = ingredient_amount_factory({
      quantity: "1",
      unit: "cup",
      text: "1 cup",
      confidence: 0,
      starting_index: 0,
      volumetric_units_system: "imperial",
    });
    const am2 = ingredient_amount_factory({
      quantity: "2",
      unit: "tbsp",
      text: "2 tbsp",
      confidence: 0,
      starting_index: 0,
      volumetric_units_system: "imperial",
    });

    const amount = new CompositeIngredientAmount({
      amounts: [am1, am2],
      join: "",
      subtractive: false,
    });

    expect(amount.unit_system).toBe(UnitSystem.IMPERIAL);
  });
});

describe("TestPostProcessor_CompositeIngredientAmount_convert_to", () => {
  it("test_composite_ingredient_amount", () => {
    // Test composite ingredient amount conversion to metric.
    const am1 = ingredient_amount_factory({ quantity: "2", unit: "lbs", text: "2 lb", confidence: 0, starting_index: 0 });
    const am2 = ingredient_amount_factory({ quantity: "2", unit: "oz", text: "2 oz", confidence: 0, starting_index: 0 });

    const amount = new CompositeIngredientAmount({
      amounts: [am1, am2],
      join: "",
      subtractive: false,
    });
    const converted = amount.convert_to("kg");

    // CONVERSION NOTE: Fraction(77110702900000017, 80000000000000000) — the numerator
    // exceeds 2^53, so a numeric literal would silently lose precision. Written in the
    // README's string form to keep the exact upstream value.
    expect(converted.magnitude).toEqual(new Fraction("77110702900000017/80000000000000000"));
    expect(converted.units).toEqual(UREG("kg").units);
  });
});
