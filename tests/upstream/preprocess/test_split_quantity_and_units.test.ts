// Verbatim conversion of ip-repo/tests/preprocess/test_split_quantity_and_units.py @ ffd6ae3 (8 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_split_quantity_and_units", () => {
  it("test_basic", () => {
    // A space is inserted between the integer quantity and the unit
    const p = p_fixture();
    const input_sentence = "100g plain flour";
    expect(p._split_quantity_and_units(input_sentence)).toBe("100 g plain flour");
  });

  it("test_decimal", () => {
    // A space is inserted between the decimal quantity and the unit
    const p = p_fixture();
    const input_sentence = "2.5cups orange juice";
    expect(p._split_quantity_and_units(input_sentence)).toBe("2.5 cups orange juice");
  });

  it("test_inch", () => {
    // No space is inserted between the quantity and the inches symbol
    const p = p_fixture();
    const input_sentence = '2.5" square chocolate';
    expect(p._split_quantity_and_units(input_sentence)).toBe('2.5" square chocolate');
  });

  it("test_hyphen_seperator", () => {
    // The hyphen between the quantity and unit is replaced by a space
    const p = p_fixture();
    const input_sentence = "2-pound whole chicken";
    expect(p._split_quantity_and_units(input_sentence)).toBe("2 pound whole chicken");
  });

  it("test_unit_then_number", () => {
    // A space is inserted between adjacent number and letters
    const p = p_fixture();
    const input_sentence = "2lb1oz cherry tomatoes";
    expect(p._split_quantity_and_units(input_sentence)).toBe(
      "2 lb 1 oz cherry tomatoes",
    );
  });

  it("test_unit_hyphen_number", () => {
    // A space is inserted between the letter and hyphen, and hyphen and number
    const p = p_fixture();
    const input_sentence = "2lb-1oz cherry tomatoes";
    expect(p._split_quantity_and_units(input_sentence)).toBe(
      "2 lb - 1 oz cherry tomatoes",
    );
  });

  it("test_non_unit_c", () => {
    // No space is inserted between 4 and chop, and the hyphen is retained.
    const p = p_fixture();
    const input_sentence = "1 4-chop rack of lamb";
    expect(p._split_quantity_and_units(input_sentence)).toBe("1 4-chop rack of lamb");
  });

  it("test_non_unit_g", () => {
    // No space is inserted between 5 and grain, and the hyphen is retained.
    const p = p_fixture();
    const input_sentence = "2 slices 5-grain bread";
    expect(p._split_quantity_and_units(input_sentence)).toBe("2 slices 5-grain bread");
  });
});
