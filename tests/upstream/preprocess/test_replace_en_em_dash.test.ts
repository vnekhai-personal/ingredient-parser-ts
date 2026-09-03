// Verbatim conversion of ip-repo/tests/preprocess/test_replace_en_em_dash.py @ ffd6ae3 (2 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_replace_en_em_dash", () => {
  it("test_en_dash", () => {
    // The en-dash is replaced with a hyphen.
    const p = p_fixture();
    const input_sentence = "2 cups flour – white or self-raising";
    expect(p._replace_en_em_dash(input_sentence)).toBe(
      "2 cups flour - white or self-raising",
    );
  });

  it("test_em_dash", () => {
    // The em-dash is replaced with a hyphen.
    const p = p_fixture();
    const input_sentence = "2 cups flour — white or self-raising";
    expect(p._replace_en_em_dash(input_sentence)).toBe(
      "2 cups flour  -  white or self-raising",
    );
  });
});
