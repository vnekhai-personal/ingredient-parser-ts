// Verbatim conversion of ip-repo/tests/preprocess/test_collapse_ranges.py @ ffd6ae3 (5 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_collapse_ranges", () => {
  it("test_no_range", () => {
    // Input sentence is unchanged
    const p = p_fixture();
    const input_sentence = "100-200 g grated cheese";
    expect(p._collapse_ranges(input_sentence)).toBe(input_sentence);
  });

  it("test_left_hand_expand", () => {
    // Spaces before hyphen are removed
    const p = p_fixture();
    const input_sentence = "100 -200 g grated cheese";
    expect(p._collapse_ranges(input_sentence)).toBe("100-200 g grated cheese");
  });

  it("test_right_hand_expand", () => {
    // Spaces after hyphen are removed
    const p = p_fixture();
    const input_sentence = "100-  200 g grated cheese";
    expect(p._collapse_ranges(input_sentence)).toBe("100-200 g grated cheese");
  });

  it("test_both_sides_expanded", () => {
    // Spaces before and after hyphen are removed
    const p = p_fixture();
    const input_sentence = "100 -  200 g grated cheese";
    expect(p._collapse_ranges(input_sentence)).toBe("100-200 g grated cheese");
  });

  it("test_fake_fraction", () => {
    // Spaces before and after hyphen are removed
    const p = p_fixture();
    const input_sentence = "#1$2 - #3$4 cups grated cheese";
    expect(p._collapse_ranges(input_sentence)).toBe("#1$2-#3$4 cups grated cheese");
  });
});
