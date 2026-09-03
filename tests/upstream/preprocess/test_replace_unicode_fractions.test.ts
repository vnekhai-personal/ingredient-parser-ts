// Verbatim conversion of ip-repo/tests/preprocess/test_replace_unicode_fractions.py @ ffd6ae3 (16 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_replace_unicode_fractions", () => {
  it("test_half", () => {
    // The unicode fraction ½ is converted to 1/2
    // There is no space between the preceding character and the unicode fraction
    const p = p_fixture();
    const input_sentence = "3½ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3 1/2 potatoes");
  });

  it("test_third", () => {
    // The unicode fraction ⅓ is converted to 1/3
    // There is no space between the preceding character and the unicode fraction
    const p = p_fixture();
    const input_sentence = "3⅓ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3 1/3 potatoes");
  });

  it("test_two_thirds", () => {
    // The unicode fraction ⅔ is converted to 2/3
    // There is no space between the preceding character and the unicode fraction
    const p = p_fixture();
    const input_sentence = "3⅔ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3 2/3 potatoes");
  });

  it("test_quarter", () => {
    // The unicode fraction ¼ is converted to 1/4
    // There is no space between the preceding character and the unicode fraction
    const p = p_fixture();
    const input_sentence = "3¼ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3 1/4 potatoes");
  });

  it("test_three_quarters", () => {
    // The unicode fraction ¾ is converted to 3/4
    // There is no space between the preceding character and the unicode fraction
    const p = p_fixture();
    const input_sentence = "3¾ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3 3/4 potatoes");
  });

  it("test_fifth", () => {
    // The unicode fraction ⅕ is converted to 1/5
    const p = p_fixture();
    const input_sentence = "3 ⅕ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  1/5 potatoes");
  });

  it("test_two_fifth", () => {
    // The unicode fraction ⅖ is converted to 2/5
    const p = p_fixture();
    const input_sentence = "3 ⅖ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  2/5 potatoes");
  });

  it("test_three_fifth", () => {
    // The unicode fraction ⅗ is converted to 3/5
    const p = p_fixture();
    const input_sentence = "3 ⅗ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  3/5 potatoes");
  });

  it("test_four_fifth", () => {
    // The unicode fraction ⅘ is converted to 4/5
    const p = p_fixture();
    const input_sentence = "3 ⅘ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  4/5 potatoes");
  });

  it("test_one_sixth", () => {
    // The unicode fraction ⅙ is converted to 1/6
    const p = p_fixture();
    const input_sentence = "3 ⅙ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  1/6 potatoes");
  });

  it("test_five_sixths", () => {
    // The unicode fraction ⅚ is converted to 5/6
    const p = p_fixture();
    const input_sentence = "3 ⅚ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  5/6 potatoes");
  });

  it("test_one_eighth", () => {
    // The unicode fraction ⅛ is converted to 1/8
    const p = p_fixture();
    const input_sentence = "3 ⅛ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  1/8 potatoes");
  });

  it("test_three_eighths", () => {
    // The unicode fraction ⅜ is converted to 3/8
    const p = p_fixture();
    const input_sentence = "3 ⅜ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  3/8 potatoes");
  });

  it("test_five_eighths", () => {
    // The unicode fraction ⅝ is converted to 5/8
    const p = p_fixture();
    const input_sentence = "3 ⅝ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  5/8 potatoes");
  });

  it("test_seven_eighths", () => {
    // The unicode fraction ⅞ is converted to 7/8
    const p = p_fixture();
    const input_sentence = "3 ⅞ potatoes";
    expect(p._replace_unicode_fractions(input_sentence)).toBe("3  7/8 potatoes");
  });

  it("test_range", () => {
    // The unicode fractions are converted to fake fractions, but no space hyphen
    // is inserted after the hyphen
    const p = p_fixture();
    const input_sentence = "¼-½ teaspoon";
    expect(p._replace_unicode_fractions(input_sentence)).toBe(" 1/4-1/2 teaspoon");
  });
});
