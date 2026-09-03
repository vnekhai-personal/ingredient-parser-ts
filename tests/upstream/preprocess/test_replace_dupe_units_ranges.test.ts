// Verbatim conversion of ip-repo/tests/preprocess/test_replace_dupe_units_ranges.py @ ffd6ae3 (4 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_replace_dupe_units_ranges", () => {
  it("test_no_dupes", () => {
    // Input sentence is unchanged
    const p = p_fixture();
    const input_sentence = "100 g grated cheese";
    expect(p._replace_dupe_units_ranges(input_sentence)).toBe("100 g grated cheese");
  });

  it("test_no_dupe_range_pattern", () => {
    // Input sentence is unchanged
    const p = p_fixture();
    const input_sentence = "100 g - 20 oz goat's cheese";
    expect(p._replace_dupe_units_ranges(input_sentence)).toBe(
      "100 g - 20 oz goat's cheese",
    );
  });

  it("test_single_match", () => {
    // 14 oz - 17 oz is replaced by 14-17 oz
    const p = p_fixture();
    const input_sentence = "400-500 g/14 oz - 17 oz rhubarb";
    expect(p._replace_dupe_units_ranges(input_sentence)).toBe("400-500 g/14-17 oz rhubarb");
  });

  it("test_two_match", () => {
    // 400 g - 500 g is replaced by 400-500 g
    // and
    // 14 oz - 17 oz is replaced by 14-17 oz
    const p = p_fixture();
    const input_sentence = "400 g - 500 g/14 oz - 17 oz rhubarb";
    expect(p._replace_dupe_units_ranges(input_sentence)).toBe("400-500 g/14-17 oz rhubarb");
  });
});
