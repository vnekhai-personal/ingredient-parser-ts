// Verbatim conversion of ip-repo/tests/test_utils.py @ ffd6ae3 (27 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.

import { describe, it, expect } from "vitest";

import {
  UREG,
  combine_quantities_split_by_and,
  convert_to_pint_unit,
  is_unit_synonym,
  pluralise_units,
  replace_string_range,
} from "../../src/en/_utils.js";

describe("TestUtils_pluralise_units", () => {
  it("test_single", () => {
    // Each singular unit gets pluralised
    expect(pluralise_units("teaspoon", {})).toBe("teaspoons");
    expect(pluralise_units("cup", {})).toBe("cups");
    expect(pluralise_units("loaf", {})).toBe("loaves");
    expect(pluralise_units("leaf", {})).toBe("leaves");
    expect(pluralise_units("chunk", {})).toBe("chunks");
    expect(pluralise_units("Box", {})).toBe("Boxes");
    expect(pluralise_units("Wedge", {})).toBe("Wedges");
  });

  it("test_embedded", () => {
    // The unit embedded in each sentence gets pluralised
    expect(pluralise_units("2 tablespoon olive oil", {})).toBe("2 tablespoons olive oil");
    expect(pluralise_units("3 cup (750 milliliter) milk", {})).toBe(
      "3 cups (750 milliliters) milk",
    );
  });
});

describe("Test_convert_to_pint_unit", () => {
  it("test_empty_string", () => {
    // Test an empty string is returned if input
    expect(convert_to_pint_unit("")).toBe("");
  });

  it("test_simple_cases", () => {
    // Test simple cases of units and plural variations are correctly
    // matched to pint.Unit objects.
    // This doesn't need to be comprehensive because we don't need to test
    // pint works.
    expect(convert_to_pint_unit("g")).toEqual(UREG("g").units);
    expect(convert_to_pint_unit("gram")).toEqual(UREG("g").units);
    expect(convert_to_pint_unit("grams")).toEqual(UREG("g").units);
    expect(convert_to_pint_unit("oz")).toEqual(UREG("oz").units);
    expect(convert_to_pint_unit("ounce")).toEqual(UREG("oz").units);
    expect(convert_to_pint_unit("ounces")).toEqual(UREG("oz").units);
  });

  it("test_modified_cases", () => {
    // Test cases where we need to swap to unit to a version pint recognises
    expect(convert_to_pint_unit("fl oz")).toEqual(UREG("fluid_ounce").units);
    expect(convert_to_pint_unit("fluid oz")).toEqual(UREG("fluid_ounce").units);
    expect(convert_to_pint_unit("fl ounce")).toEqual(UREG("fluid_ounce").units);
    expect(convert_to_pint_unit("fluid ounce")).toEqual(UREG("fluid_ounce").units);
    expect(convert_to_pint_unit("Cl")).toEqual(UREG("centiliter").units);
    expect(convert_to_pint_unit("G")).toEqual(UREG("gram").units);
    expect(convert_to_pint_unit("Ml")).toEqual(UREG("milliliter").units);
    expect(convert_to_pint_unit("Pt")).toEqual(UREG("pint").units);
    expect(convert_to_pint_unit("Tb")).toEqual(UREG("tablespoon").units);
    expect(convert_to_pint_unit("C")).toEqual(UREG("cup").units);
    expect(convert_to_pint_unit("c")).toEqual(UREG("cup").units);
  });

  it("test_alternative_pints", () => {
    // Test that imperial pints are returned when imperial is requested.
    // Test that australian pints are return when australian is requested.
    // There's no such thing as a metric pint, so test that the default pint
    // (i.e. US customary is returned.)
    expect(convert_to_pint_unit("pint", { volumetric_units_system: "imperial" })).toEqual(
      UREG("imperial_pint").units,
    );
    expect(convert_to_pint_unit("pint", { volumetric_units_system: "australian" })).toEqual(
      UREG("aus_pint").units,
    );
    expect(convert_to_pint_unit("pint", { volumetric_units_system: "metric" })).toEqual(
      UREG("pint").units,
    );
  });

  it("test_imperial_units", () => {
    // Test that imperial units are returned where appropriate
    expect(convert_to_pint_unit("fl oz", { volumetric_units_system: "imperial" })).toEqual(
      UREG("imperial_fluid_ounce").units,
    );
    expect(convert_to_pint_unit("cup", { volumetric_units_system: "imperial" })).toEqual(
      UREG("imperial_cup").units,
    );
    expect(convert_to_pint_unit("quart", { volumetric_units_system: "imperial" })).toEqual(
      UREG("imperial_quart").units,
    );
    expect(convert_to_pint_unit("pint", { volumetric_units_system: "imperial" })).toEqual(
      UREG("imperial_pint").units,
    );
    expect(convert_to_pint_unit("gallon", { volumetric_units_system: "imperial" })).toEqual(
      UREG("imperial_gallon").units,
    );
  });

  it("test_metric_volumetric_units", () => {
    // Test that metric volumetric units are returned where appropriate
    expect(convert_to_pint_unit("cup", { volumetric_units_system: "metric" })).toEqual(
      UREG("metric_cup").units,
    );
    expect(convert_to_pint_unit("tbsp", { volumetric_units_system: "metric" })).toEqual(
      UREG("metric_tbsp").units,
    );
    expect(convert_to_pint_unit("teaspoon", { volumetric_units_system: "metric" })).toEqual(
      UREG("metric_teaspoon").units,
    );
  });

  it("test_australian_units", () => {
    // Test that australian tbsp is returned, and metric cup and tsp.
    expect(convert_to_pint_unit("cup", { volumetric_units_system: "australian" })).toEqual(
      UREG("metric_cup").units,
    );
    expect(convert_to_pint_unit("tbsp", { volumetric_units_system: "australian" })).toEqual(
      UREG("aus_tbsp").units,
    );
    expect(
      convert_to_pint_unit("teaspoon", { volumetric_units_system: "australian" }),
    ).toEqual(UREG("metric_teaspoon").units);
  });

  it("test_japanese_units", () => {
    // Test that japanese cup is returned, and metric tbsp and tsp.
    expect(convert_to_pint_unit("cup", { volumetric_units_system: "japanese" })).toEqual(
      UREG("jp_cup").units,
    );
    expect(convert_to_pint_unit("tbsp", { volumetric_units_system: "japanese" })).toEqual(
      UREG("metric_tbsp").units,
    );
    expect(convert_to_pint_unit("teaspoon", { volumetric_units_system: "japanese" })).toEqual(
      UREG("metric_teaspoon").units,
    );
  });

  it("test_unit_with_hypen", () => {
    // Test that units containing hyphens always return string.
    // This example isn't actually a unit, but can be mislablled as one, so
    // we need to check this case.
    expect(convert_to_pint_unit("medium-size")).toBe("medium-size");
  });

  it("test_misinterpretted_units", () => {
    // Test cases that pint would misinterpret as a different, incorrect unit
    expect(convert_to_pint_unit("pinch")).toBe("pinch");
    // Plural
    expect(convert_to_pint_unit("bars")).toBe("bars");
    // Title case
    expect(convert_to_pint_unit("Tin")).toBe("Tin");
    // Title case + plural
    expect(convert_to_pint_unit("Links")).toBe("Links");
    expect(convert_to_pint_unit("shake")).toBe("shake");
  });
});

describe("Testcombine_quantities_split_by_and", () => {
  it("test_half", () => {
    // "1 and 1/2" is replaced by 1#1$2
    const input_sentence = "1 and 1/2 tsp salt";
    expect(combine_quantities_split_by_and(input_sentence)).toBe("1#1$2 tsp salt");
  });

  it("test_quarter", () => {
    // "1 and 1/4" is replaced by 1#1$4
    const input_sentence = "1 and 1/4 tsp salt";
    expect(combine_quantities_split_by_and(input_sentence)).toBe("1#1$4 tsp salt");
  });

  it("test_three_quarters", () => {
    // "1 and 3/4" is replaced by 1#3$4
    const input_sentence = "1 and 3/4 tsp salt";
    expect(combine_quantities_split_by_and(input_sentence)).toBe("1#3$4 tsp salt");
  });

  it("test_third", () => {
    // "1 and 1/3" is replaced by 1#1$3
    const input_sentence = "1 and 1/3 tsp salt";
    expect(combine_quantities_split_by_and(input_sentence)).toBe("1#1$3 tsp salt");
  });
});

describe("Test_replace_string_range", () => {
  it("test_integers", () => {
    // Test range with format <num> or <num> where <num> are integers
    const input_sentence = "4 9 or 10 inch flour tortillas";
    expect(replace_string_range(input_sentence)).toBe("4 9-10 inch flour tortillas");
  });

  it("test_decimals", () => {
    // Test range with format <num> or <num> where <num> are decimals
    const input_sentence = "1 15.5 or 16 ounce can black beans";
    expect(replace_string_range(input_sentence)).toBe("1 15.5-16 ounce can black beans");
  });

  it("test_decimals_less_than_one", () => {
    // Test range with format <num> or <num> where <num> are decimals
    const input_sentence = "0.5 to 0.75 teaspoon hot Hungarian paprika";
    expect(replace_string_range(input_sentence)).toBe(
      "0.5-0.75 teaspoon hot Hungarian paprika",
    );
  });

  it("test_hyphens", () => {
    // Test range where the numbers are followed by hyphens
    const input_sentence = "1 6- or 7-ounce can of wild salmon";
    expect(replace_string_range(input_sentence)).toBe("1 6-7-ounce can of wild salmon");
  });

  it("test_hyphens_with_spaces", () => {
    // Test range where the numbers are followed by hyphens, where the hyphens are
    // surrounded by spaces.
    const input_sentence = "1 6 - or 7 - ounce can of wild salmon";
    expect(replace_string_range(input_sentence)).toBe("1 6-7 - ounce can of wild salmon");
  });

  it("test_first_starts_with_zero", () => {
    // Test (false) range where the first of the numbers starts with 0
    const input_sentence = "Type 00 or 1 flour";
    expect(replace_string_range(input_sentence)).toBe("Type 00 or 1 flour");
  });

  it("test_second_starts_with_zero", () => {
    // Test (false) range where the second of the numbers starts with 0
    const input_sentence = "Type 1 or 00 flour";
    expect(replace_string_range(input_sentence)).toBe("Type 1 or 00 flour");
  });
});

describe("Test_is_unit_synonym", () => {
  it("test_singular", () => {
    expect(is_unit_synonym("oz", "ounce")).toBe(true);
  });

  it("test_plural_singular", () => {
    expect(is_unit_synonym("cups", "c")).toBe(true);
  });

  it("test_plural", () => {
    expect(is_unit_synonym("lbs", "pounds")).toBe(true);
  });

  it("test_not_synonym", () => {
    expect(is_unit_synonym("kg", "gram")).toBe(false);
  });
});
