// Verbatim conversion of ip-repo/tests/preprocess/test_replace_html_fractions.py @ ffd6ae3 (15 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_replace_html_fractions", () => {
  it("test_half", () => {
    // The HTML fraction &frac12; is converted to the unicode symbol ½
    // There is no space between the preceding character and the start of the html
    // fraction
    const p = p_fixture();
    const input_sentence = "3&frac12; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3½ potatoes");
  });

  it("test_one_third", () => {
    // The HTML fraction &frac13; is converted to the unicode symbol ⅓
    // There is no space between the preceding character and the start of the html
    // fraction
    const p = p_fixture();
    const input_sentence = "3&frac13; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3⅓ potatoes");
  });

  it("test_two_thirds", () => {
    // The HTML fraction &frac23; is converted to the unicode symbol ⅔
    // There is no space between the preceding character and the start of the html
    // fraction
    const p = p_fixture();
    const input_sentence = "3&frac23; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3⅔ potatoes");
  });

  it("test_one_quarter", () => {
    // The HTML fraction &frac14; is converted to the unicode symbol ¼
    // There is no space between the preceding character and the start of the html
    // fraction
    const p = p_fixture();
    const input_sentence = "3&frac14; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3¼ potatoes");
  });

  it("test_three_quarters", () => {
    // The HTML fraction &frac34; is converted to the unicode symbol ¾
    // There is no space between the preceding character and the start of the html
    // fraction
    const p = p_fixture();
    const input_sentence = "3&frac34; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3¾ potatoes");
  });

  it("test_fifth", () => {
    // The HTML fraction &frac15; is converted to the unicode symbol ⅕
    const p = p_fixture();
    const input_sentence = "3 &frac15; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅕ potatoes");
  });

  it("test_two_fifth", () => {
    // The HTML fraction &frac25; is converted to the unicode symbol ⅖
    const p = p_fixture();
    const input_sentence = "3 &frac25; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅖ potatoes");
  });

  it("test_three_fifth", () => {
    // The HTML fraction &frac35; is converted to the unicode symbol ⅗
    const p = p_fixture();
    const input_sentence = "3 &frac35; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅗ potatoes");
  });

  it("test_four_fifth", () => {
    // The HTML fraction &frac45; is converted to the unicode symbol ⅘
    const p = p_fixture();
    const input_sentence = "3 &frac45; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅘ potatoes");
  });

  it("test_one_sixth", () => {
    // The HTML fraction &frac16; is converted to the unicode symbol ⅙
    const p = p_fixture();
    const input_sentence = "3 &frac16; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅙ potatoes");
  });

  it("test_five_sixths", () => {
    // The HTML fraction &frac56; is converted to the unicode symbol ⅚
    const p = p_fixture();
    const input_sentence = "3 &frac56; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅚ potatoes");
  });

  it("test_one_eighth", () => {
    // The HTML fraction &frac18; is converted to the unicode symbol ⅛
    const p = p_fixture();
    const input_sentence = "3 &frac18; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅛ potatoes");
  });

  it("test_three_eighths", () => {
    // The HTML fraction &frac38; is converted to the unicode symbol ⅜
    const p = p_fixture();
    const input_sentence = "3 &frac38; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅜ potatoes");
  });

  it("test_five_eighths", () => {
    // The HTML fraction &frac58; is converted to the unicode symbol ⅝
    const p = p_fixture();
    const input_sentence = "3 &frac58; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅝ potatoes");
  });

  it("test_seven_eighths", () => {
    // The HTML fraction &frac78; is converted to the unicode symbol ⅞
    const p = p_fixture();
    const input_sentence = "3 &frac78; potatoes";
    expect(p._replace_html_fractions(input_sentence)).toBe("3 ⅞ potatoes");
  });
});
