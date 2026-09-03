// Verbatim conversion of ip-repo/tests/preprocess/test_identify_fractions.py @ ffd6ae3 (16 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_identify_fractions", () => {
  it("test_less_than_one", () => {
    // The fake fraction 1/2 is replaced with 0.5.
    const p = p_fixture();
    const input_sentence = "1/2 cup sugar";
    expect(p._identify_fractions(input_sentence)).toBe("#1$2 cup sugar");
  });

  it("test_greater_than_one", () => {
    // The fake fraction 3 1/3 is replaced with 3.333.
    const p = p_fixture();
    const input_sentence = "1 pound melted butter, about 3 1/3 cups";
    expect(p._identify_fractions(input_sentence)).toBe(
      "1 pound melted butter, about 3#1$3 cups",
    );
  });

  it("test_no_fraction", () => {
    // There is no fake fraction in the input.
    const p = p_fixture();
    const input_sentence = "pinch of salt";
    expect(p._identify_fractions(input_sentence)).toBe(input_sentence);
  });

  it("test_leading_space", () => {
    // The fake fraction 1/2 is replaced with 0.5.
    // The input sentence starts with a space.
    const p = p_fixture();
    const input_sentence = " 1/2 cup sugar";
    expect(p._identify_fractions(input_sentence)).toBe(" #1$2 cup sugar");
  });

  it("test_vulgar_fraction", () => {
    // The unicode vulgar fraction (using FRACTION SLASH (U+2044)) is replaced
    // with #1$2.
    const p = p_fixture();
    const input_sentence = "1⁄2 x 20g pack fresh thyme, leaves only";
    expect(p._identify_fractions(input_sentence)).toBe(
      "#1$2 x 20g pack fresh thyme, leaves only",
    );
  });

  it("test_multiple_fractions", () => {
    // The integer and fraction in the prep instructions are not combined.
    const p = p_fixture();
    const input_sentence = "1/2 baguette, cut diagonally into about 1/4-inch slices";
    expect(p._identify_fractions(input_sentence)).toBe(
      "#1$2 baguette, cut diagonally into about #1$4-inch slices",
    );
  });

  it("test_percentage_ratio_lean_grade_beef", () => {
    // Lean-to-fat ratios like 80/20 sum to 100 and are not fractions; the
    // slash should be left alone so downstream tokenization splits the ratio
    // into its constituent tokens (e.g. ['80', '/', '20']).
    const p = p_fixture();
    const input_sentence = "1 lb 80/20 ground beef";
    expect(p._identify_fractions(input_sentence)).toBe("1 lb 80/20 ground beef");
  });

  it("test_percentage_ratio_lean_grade_turkey", () => {
    // 93/7 (sum=100) is a turkey lean grade, not a fraction.
    const p = p_fixture();
    const input_sentence = "1 lb 93/7 ground turkey";
    expect(p._identify_fractions(input_sentence)).toBe("1 lb 93/7 ground turkey");
  });

  it("test_percentage_ratio_50_50", () => {
    // Boundary case: 50/50 sums to 100 and is a ratio (e.g. 50/50 blend), not
    // the fraction 1.
    const p = p_fixture();
    const input_sentence = "1 lb 50/50 ground beef";
    expect(p._identify_fractions(input_sentence)).toBe("1 lb 50/50 ground beef");
  });

  it("test_percentage_ratio_99_1", () => {
    // 99/1 (sum=100, white-meat-only ground turkey) is a ratio, not a fraction.
    const p = p_fixture();
    const input_sentence = "1 lb 99/1 ground turkey";
    expect(p._identify_fractions(input_sentence)).toBe("1 lb 99/1 ground turkey");
  });

  it("test_compound_no_space_keeps_fraction_form", () => {
    // Mixed fractions written without a space (e.g. '11/2 teaspoons' meaning
    // '1 1/2 teaspoons') don't sum to 100 and are kept as `#X$Y` form to
    // match existing corpus behaviour. This is the regression-guard against
    // a simpler discriminator (n <= d) that would have broken these rows.
    const p = p_fixture();
    const input_sentence = "11/2 teaspoons sea salt";
    expect(p._identify_fractions(input_sentence)).toBe("#11$2 teaspoons sea salt");
  });

  it("test_compound_no_space_thirteen_quarters", () => {
    // '13/4 oz' (n+d=17) keeps its `#X$Y` form.
    const p = p_fixture();
    const input_sentence = "50g/13/4oz unsalted butter, cubed";
    expect(p._identify_fractions(input_sentence)).toBe(
      "50g/#13$4oz unsalted butter, cubed",
    );
  });

  it("test_one_over_ninety_nine_documented_edge_case", () => {
    // 1/99 sums to 100 and is bypassed under the n+d==100 rule. This trades
    // off the rare improper-true-fraction case in favour of catching all
    // observed lean-grade ratios; no corpus row uses 1/99 as a true fraction.
    // Asserting current behaviour so the trade-off is captured rather than
    // implicit.
    const p = p_fixture();
    const input_sentence = "1/99 cup of vinegar";
    expect(p._identify_fractions(input_sentence)).toBe("1/99 cup of vinegar");
  });

  it("test_ratio_adjacent_to_word_no_space", () => {
    // '80/20ground' (no space between ratio and following word) is still
    // matched by the regex and bypassed cleanly.
    const p = p_fixture();
    const input_sentence = "80/20ground beef";
    expect(p._identify_fractions(input_sentence)).toBe("80/20ground beef");
  });

  it("test_two_digit_denominator_small_numerator", () => {
    // '1/16 inch' has a two-digit denominator. Sums to 17, so it stays a
    // fraction. Regression-guard against any future refactor that mistakenly
    // rejects fractions with multi-digit denominators.
    const p = p_fixture();
    const input_sentence = "1/16 inch slices";
    expect(p._identify_fractions(input_sentence)).toBe("#1$16 inch slices");
  });

  it("test_two_digit_denominator_close_to_one", () => {
    // '15/16 inch' has a two-digit denominator and a numerator close to it
    // (proper fraction, value just under 1). Sums to 31, so it stays a
    // fraction. Regression-guard against any future refactor that narrowed
    // the discriminator.
    const p = p_fixture();
    const input_sentence = "15/16 inch thick";
    expect(p._identify_fractions(input_sentence)).toBe("#15$16 inch thick");
  });
});
