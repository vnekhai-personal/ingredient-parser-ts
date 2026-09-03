// Verbatim conversion of ip-repo/tests/preprocess/test_merge_quantity_x.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_replace_dupe_units_ranges", () => {
  it("test_no_x", () => {
    // Input sentence is unchanged
    const p = p_fixture();
    const input_sentence = "100 g grated cheese";
    expect(p._merge_quantity_x(input_sentence)).toBe("100 g grated cheese");
  });

  it("test_single_match", () => {
    // "1 x" is replaced with "1x"
    const p = p_fixture();
    const input_sentence = "1 x 390 g jar roasted red peppers";
    expect(p._merge_quantity_x(input_sentence)).toBe("1x 390 g jar roasted red peppers");
  });

  it("test_two_match", () => {
    // "1 x" is replaced with "1x" and "0.5 x" is replaced with "0.5x"
    const p = p_fixture();
    const input_sentence = "1 x can or 0.5 x large jar tomato paste";
    expect(p._merge_quantity_x(input_sentence)).toBe(
      "1x can or 0.5x large jar tomato paste",
    );
  });
});
