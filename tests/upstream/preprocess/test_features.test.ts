// Verbatim conversion of ip-repo/tests/preprocess/test_features.py @ ffd6ae3 (38 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// Define an empty PreProcessor object to use for testing the PreProcessor
// class methods.
function p_fixture() {
  return new PreProcessor(".", { custom_units: {} });
}

describe("TestPreProcessor_is_unit", () => {
  it("test_true", () => {
    // "glass" is a unit
    const p = p_fixture();
    expect(p._is_unit("glass")).toBe(true);
  });

  it("test_false", () => {
    // "watt" is not a unit
    const p = p_fixture();
    expect(p._is_unit("watt")).toBe(false);
  });
});

describe("TestPreProcessor_is_punc", () => {
  it("test_true", () => {
    // "/" is a punctuation mark
    const p = p_fixture();
    expect(p._is_punc("/")).toBe(true);
  });

  it("test_false", () => {
    // "beer" is not punctuation
    const p = p_fixture();
    expect(p._is_punc("beer")).toBe(false);
  });
});

describe("TestPreProcessor_is_numeric", () => {
  it("test_integer", () => {
    // "1" is numeric
    const p = p_fixture();
    expect(p._is_numeric("1")).toBe(true);
  });

  it("test_decimal", () => {
    // "2.667" is numeric
    const p = p_fixture();
    expect(p._is_numeric("2.667")).toBe(true);
  });

  it("test_integer_range", () => {
    // "1-2" is numeric
    const p = p_fixture();
    expect(p._is_numeric("1-2")).toBe(true);
  });

  it("test_decimal_range", () => {
    // "3.5-5.5" is numeric
    const p = p_fixture();
    expect(p._is_numeric("3.5-5.5")).toBe(true);
  });

  it("test_mixed_range", () => {
    // "1-1.5" is numeric
    const p = p_fixture();
    expect(p._is_numeric("1-1.5")).toBe(true);
  });

  it("test_false", () => {
    // "1/2" is not numeric
    const p = p_fixture();
    expect(p._is_numeric("1/2")).toBe(false);
  });

  it("test_false_range", () => {
    // "red-wine" is not numeric
    const p = p_fixture();
    expect(p._is_numeric("red-wine")).toBe(false);
  });

  it("test_dozen", () => {
    // "dozen" is numeric
    const p = p_fixture();
    expect(p._is_numeric("dozen")).toBe(true);
  });

  it("test_quart", () => {
    // "one-quarter" is numeric
    const p = p_fixture();
    expect(p._is_numeric("one-quarter")).toBe(true);
  });
});

describe("TestPreProcessor_is_capitalised", () => {
  it("test_capitalised", () => {
    // "Cheese" is capitalised
    const p = p_fixture();
    expect(p._is_capitalised("Cheese")).toBe(true);
  });

  it("test_embeded_capital", () => {
    // "lemon-Zest" is not capitalised
    const p = p_fixture();
    expect(p._is_capitalised("lemon-Zest")).toBe(false);
  });

  it("test_no_captials", () => {
    // "sausage" is not capitalised
    const p = p_fixture();
    expect(p._is_capitalised("sausage")).toBe(false);
  });
});

describe("TestPreProcessor_is_inside_parentheses", () => {
  it("test_inside", () => {
    // Token index is inside parens
    const input_sentence = "8-10 teaspoons pine nuts (ground), toasted";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._is_inside_parentheses(5)).toBe(true);
  });

  it("test_before", () => {
    // Token index is before parens
    const input_sentence = "8-10 teaspoons pine nuts (ground), toasted";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._is_inside_parentheses(2)).toBe(false);
  });

  it("test_after", () => {
    // Token index is before parens
    const input_sentence = "8-10 teaspoons pine nuts (ground), toasted";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._is_inside_parentheses(7)).toBe(false);
  });

  it("test_open_parens", () => {
    // Token index is (
    const input_sentence = "8-10 teaspoons pine nuts (ground), toasted";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._is_inside_parentheses(4)).toBe(true);
  });

  it("test_close_parens", () => {
    // Token index is (
    const input_sentence = "8-10 teaspoons pine nuts (ground), toasted";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._is_inside_parentheses(6)).toBe(true);
  });

  it("test_multiple_parens", () => {
    const input_sentence = "8-10 teaspoons (10 ml) pine nuts (ground), toasted";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._is_inside_parentheses(3)).toBe(true);
    expect(p._is_inside_parentheses(6)).toBe(false);
    expect(p._is_inside_parentheses(9)).toBe(true);
  });
});

describe("TestPreProcess_follows_plus", () => {
  it("test_no_plus", () => {
    // No "plus" in input
    const input_sentence = "freshly ground black pepper";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_plus(2)).toBe(false);
  });

  it("test_before_plus", () => {
    // Token index is before "plus"
    const input_sentence = "freshly ground black pepper, plus more to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_plus(1)).toBe(false);
  });

  it("test_after_plus", () => {
    // Token index is after "plus"
    const input_sentence = "freshly ground black pepper, plus more to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_plus(7)).toBe(true);
  });

  it("test_index_is_plus", () => {
    // Token at index is "plus"
    const input_sentence = "freshly ground black pepper, plus more to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_plus(5)).toBe(false);
  });

  it("test_index_is_plus_and_follows_plus", () => {
    // Token at index is "plus" and follows another "plus"
    const input_sentence =
      "freshly ground black pepper, plus white pepper, plus more to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_plus(9)).toBe(true);
  });
});

describe("TestPreProcess_follows_comma", () => {
  it("test_no_comma", () => {
    // No comma in input
    const input_sentence = "freshly ground black pepper";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_comma(2)).toBe(false);
  });

  it("test_before_comma", () => {
    // Token index is before comma
    const input_sentence = "freshly ground black pepper, to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_comma(1)).toBe(false);
  });

  it("test_after_comma", () => {
    // Token index is after comma
    const input_sentence = "freshly ground black pepper, to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_comma(5)).toBe(true);
  });

  it("test_index_is_comma", () => {
    // Token at index is comma
    const input_sentence = "freshly ground black pepper, to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_comma(4)).toBe(false);
  });

  it("test_index_is_comma_and_follows_comma", () => {
    // Token at index is comma and follows another comma
    const input_sentence = "freshly ground black pepper, or white pepper, to taste";
    const p = new PreProcessor(input_sentence, { custom_units: {} });
    expect(p._follows_comma(8)).toBe(true);
  });
});

describe("TestPreProcessor_is_ambiguous_unit", () => {
  it("test_clove", () => {
    // Clove is indicated as ambiguous unit
    const p = p_fixture();
    expect(p._is_ambiguous_unit("clove")).toBe(true);
  });

  it("test_leaves", () => {
    // Leaves is indicated as ambiguous unit
    const p = p_fixture();
    expect(p._is_ambiguous_unit("leaves")).toBe(true);
  });

  it("test_slabs", () => {
    // Clove is indicated as ambiguous unit
    const p = p_fixture();
    expect(p._is_ambiguous_unit("slab")).toBe(true);
  });

  it("test_wedges", () => {
    // Clove is indicated as ambiguous unit
    const p = p_fixture();
    expect(p._is_ambiguous_unit("wedges")).toBe(true);
  });

  it("test_cup", () => {
    // Cup is not indicated as ambiguous unit
    const p = p_fixture();
    expect(p._is_ambiguous_unit("cup")).toBe(false);
  });
});

describe("TestPreProcessor_word_shape", () => {
  it("test_word_shape", () => {
    // Test words are transformed into correct shape pattern.
    const p = p_fixture();
    // Lower case
    expect(p._word_shape("pepper")).toBe("xxxxxx");
    // Upper case
    expect(p._word_shape("Pepper")).toBe("Xxxxxx");
    // Accents
    expect(p._word_shape("béchamel")).toBe("xxxxxxxx");
    // Numbers
    expect(p._word_shape("2-pound")).toBe("d-xxxxx");
    // Punctuation
    expect(p._word_shape(",")).toBe(",");
  });
});
