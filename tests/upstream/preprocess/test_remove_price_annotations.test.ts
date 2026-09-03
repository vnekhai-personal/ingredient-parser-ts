// Verbatim conversion of ip-repo/tests/preprocess/test_remove_price_annotations.py @ ffd6ae3 (24 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor("", { custom_units: {} });
}

describe("TestPreProcessor_remove_price_annotations", () => {
  it("test_remove_dollar_price", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ($0.20)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_remove_pound_price", () => {
    const p = p_fixture();
    const input_sentence = "2 eggs (£1.50)";
    expect(p._remove_price_annotations(input_sentence)).toBe("2 eggs ");
  });

  it("test_remove_euro_price", () => {
    const p = p_fixture();
    const input_sentence = "3 tomatoes (€2.00)";
    expect(p._remove_price_annotations(input_sentence)).toBe("3 tomatoes ");
  });

  it("test_remove_yen_price", () => {
    const p = p_fixture();
    const input_sentence = "1 onion (¥100)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 onion ");
  });

  it("test_remove_rupee_price", () => {
    const p = p_fixture();
    const input_sentence = "1 potato (₹10.50)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 potato ");
  });

  it("test_multiple_prices", () => {
    const p = p_fixture();
    const input_sentence = "1 apple ($0.50) and 1 orange (£0.30)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 apple  and 1 orange ");
  });

  it("test_no_price_annotation", () => {
    const p = p_fixture();
    const input_sentence = "1 cup sugar";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup sugar");
  });

  it("test_malformed_price_annotation", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ($0.20";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ($0.20");
  });

  it("test_price_with_comma", () => {
    const p = p_fixture();
    const input_sentence = "1 steak (€1,200.00)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 steak ");
  });

  it("test_price_with_multiple_decimals", () => {
    const p = p_fixture();
    const input_sentence = "1 cheese ($1.99) and 1 bread ($2.49)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cheese  and 1 bread ");
  });

  it("test_price_annotation_at_start", () => {
    const p = p_fixture();
    const input_sentence = "($0.20) 1 cup flour";
    expect(p._remove_price_annotations(input_sentence)).toBe(" 1 cup flour");
  });

  it("test_price_annotation_in_middle", () => {
    const p = p_fixture();
    const input_sentence = "1 cup ($0.20) flour";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup  flour");
  });

  it("test_price_annotation_at_end", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ($0.20)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_price_annotation_with_leading_space", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ( $0.20)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_price_annotation_with_inner_spaces", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ( $ 0.20 )";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_price_annotation_with_multiple_spaces", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour (  $  0.20  )";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_price_annotation_with_tab_spaces", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour (\t$0.20\t)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_price_annotation_with_mixed_whitespace", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ( \t $ 0.20  )";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_price_annotation_with_asterisk_suffix", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ($0.20**)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ");
  });

  it("test_non_price_parenthetical_remains", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour (organic)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour (organic)");
  });

  it("test_multiple_non_price_parentheticals", () => {
    const p = p_fixture();
    const input_sentence = "2 eggs (free-range) (large)";
    expect(p._remove_price_annotations(input_sentence)).toBe(
      "2 eggs (free-range) (large)",
    );
  });

  it("test_mixed_price_and_non_price_parentheticals", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ($0.20) (organic)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour  (organic)");
  });

  it("test_non_price_parenthetical_with_spaces", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour ( see note )";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour ( see note )");
  });

  it("test_non_price_parenthetical_with_numbers", () => {
    const p = p_fixture();
    const input_sentence = "1 cup flour (2nd batch)";
    expect(p._remove_price_annotations(input_sentence)).toBe("1 cup flour (2nd batch)");
  });
});
