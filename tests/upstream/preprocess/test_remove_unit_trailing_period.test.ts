// Verbatim conversion of ip-repo/tests/preprocess/test_remove_unit_trailing_period.py @ ffd6ae3 (4 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_remove_unit_trailing_period", () => {
  it("test_tsp", () => {
    // "tsps." is replaced by "tsps"
    const p = p_fixture();
    const input_sentence = "2 tsps. ground cinnamon";
    expect(p._remove_unit_trailing_period(input_sentence)).toBe("2 tsps ground cinnamon");
  });

  it("test_tbsp", () => {
    // "tbsp." is replaced by "tbsp"
    const p = p_fixture();
    const input_sentence = "1 tbsp. tomato sauce";
    expect(p._remove_unit_trailing_period(input_sentence)).toBe("1 tbsp tomato sauce");
  });

  it("test_lb", () => {
    // "lbs." is replaced by "lbs"
    const p = p_fixture();
    const input_sentence = "3 lbs. minced beef";
    expect(p._remove_unit_trailing_period(input_sentence)).toBe("3 lbs minced beef");
  });

  it("test_oz", () => {
    // "oz." is replaced by "oz"
    const p = p_fixture();
    const input_sentence = "1 12oz. can chopped tomatoes";
    expect(p._remove_unit_trailing_period(input_sentence)).toBe(
      "1 12oz can chopped tomatoes",
    );
  });
});
