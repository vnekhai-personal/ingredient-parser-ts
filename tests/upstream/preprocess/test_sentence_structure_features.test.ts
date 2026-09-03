// Verbatim conversion of ip-repo/tests/preprocess/test_sentence_structure_features.py @ ffd6ae3 (26 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

// CONVERSION NOTE: upstream's FeatureDict is `dict[str, str | bool]`; the port represents it
// as a plain object, so `token_features.get("key", False)` becomes
// `token_features["key"] ?? false`. Each asserted feature is a bool upstream, hence toBe(true/false).

describe("Test_multi_ingredient_phrase_features", () => {
  it("test_multi_ingredient_phrase_detection", () => {
    // Test that multi ingredient phrase is correctly identified.
    const p = new PreProcessor("2 tbsp chicken or beef stock", { custom_units: {} });
    expect(p.sentence_structure.mip_phrases).toEqual([[2, 3, 4, 5]]);
  });

  it("test_multi_ingredient_phrase_detection_with_name_mod", () => {
    // Test that multi ingredient phrase with name modifier is correctly identified.
    const p = new PreProcessor("2 tbsp hot chicken or beef stock", { custom_units: {} });
    expect(p.sentence_structure.mip_phrases).toEqual([[2, 3, 4, 5, 6]]);
  });

  it("test_extended_multi_ingredient_phrase_detection", () => {
    // Test that extended multi ingredient phrase is correctly identified.
    const p = new PreProcessor("2 tbsp olive, vegetable or sunflower oil", { custom_units: {} });
    expect(p.sentence_structure.mip_phrases).toEqual([[2, 3, 4, 5, 6, 7]]);
  });

  it("test_extended_multi_ingredient_phrase_detection_comma", () => {
    // Test that extended multi ingredient phrase is correctly identified.
    const p = new PreProcessor("2 tbsp olive, vegetable, or sunflower oil", { custom_units: {} });
    expect(p.sentence_structure.mip_phrases).toEqual([[2, 3, 4, 5, 6, 7, 8]]);
  });

  // PARITY-DELTA (tagger, docs/PORTING.md §3.2): expectation encodes NLTK tags
  // [CD NN NN NN CC DT JJ NN] → mip [[2,3,4,5,6,7]]. natural's Brill tags "grapeseed" and
  // "mild-flavored" VBN, and Python at the pin with BRILL_TAGS_FILE returns []. The port
  // reproduces Python-with-Brill exactly (verified 2026-09-02); `it.fails` keeps the upstream
  // expectation verbatim and asserts the delta is still present.
  it.fails("test_multi_ingredient_phrase_detection_determinant", () => {
    // Test that extended multi ingredient phrase is correctly identified.
    const p = new PreProcessor("½ c grapeseed oil or any mild-flavored oil", { custom_units: {} });
    expect(p.sentence_structure.mip_phrases).toEqual([[2, 3, 4, 5, 6, 7]]);
  });

  it("test_mip_start_feature_unit", () => {
    // Test that the start of the multi ingredient phrase is correctly identified by
    // ignoring the units.
    const p = new PreProcessor("2 tbsp olive, vegetable or sunflower oil", { custom_units: {} });

    // Assert that only the 3rd token has the `mip_start` feature.
    for (const [i, token_features] of p.sentence_features().entries()) {
      if (i === 2) {
        expect(token_features["mip_start"] ?? false).toBe(true);
      } else {
        expect(token_features["mip_start"] ?? false).toBe(false);
      }
    }
  });

  it("test_mip_start_feature_size", () => {
    // Test that the start of the multi ingredient phrase is correctly identified by
    // ignoring the size.
    const p = new PreProcessor("1 large sweet or Yukon Gold potato", { custom_units: {} });

    // Assert that only the 3rd token has the `mip_start` feature.
    for (const [i, token_features] of p.sentence_features().entries()) {
      if (i === 2) {
        expect(token_features["mip_start"] ?? false).toBe(true);
      } else {
        expect(token_features["mip_start"] ?? false).toBe(false);
      }
    }
  });

  it("test_mip_end_feature", () => {
    // Test that the end of the multi ingredient phrase is correctly identified.
    const p = new PreProcessor("2 tbsp hot chicken or beef stock", { custom_units: {} });

    // Assert that only the last token has the `mip_end` feature.
    for (const [i, token_features] of p.sentence_features().entries()) {
      if (i === p.sentence_features().length - 1) {
        expect(token_features["mip_end"] ?? false).toBe(true);
      } else {
        expect(token_features["mip_end"] ?? false).toBe(false);
      }
    }
  });
});

describe("Test_compound_sentence_features", () => {
  it("test_detect_compound_sentence_number_unit", () => {
    // Test that the or-number-unit sequence is identified as split point.
    const p = new PreProcessor("2 tbsp oil or 1 cup butter", { custom_units: {} });
    expect(p.sentence_structure.sentence_splits).toEqual([3]);
  });

  it("test_detect_compound_sentence_double_number_unit", () => {
    // Test that the or-number-number-unit sequence is identified as split point.
    const p = new PreProcessor(
      "1 1/4 cups squash, or 1 10-ounce package frozen squash", { custom_units: {} },
    );
    expect(p.sentence_structure.sentence_splits).toEqual([4]);
  });

  it("test_detect_compound_sentence_number_noun", () => {
    // Test that the or-number-noun sequence is identified as split point.
    const p = new PreProcessor("2 serrano peppers or 1 jalapeño pepper", { custom_units: {} });
    expect(p.sentence_structure.sentence_splits).toEqual([3]);
  });

  it("test_detect_compound_sentence_number_size", () => {
    // Test that the or-number-size sequence is identified as split point.
    const p = new PreProcessor("2 small carrots or 1 large carrot", { custom_units: {} });
    expect(p.sentence_structure.sentence_splits).toEqual([3]);
  });

  it("test_detect_compound_sentence_multiple_splits", () => {
    // Test that all or-number-noun sequences are identified as split points.
    const p = new PreProcessor(
      "2 medium-ripe tomatoes or 4 plum tomatoes or 8 to 10 cherry tomatoes",
      { custom_units: {} },
    );
    expect(p.sentence_structure.sentence_splits).toEqual([3, 7]);
  });

  it("test_after_sentence_split_feature", () => {
    // Test that the or-number-size sequence is identified as split point.
    const p = new PreProcessor("2 small carrots or 1 large carrot", { custom_units: {} });

    // Assert that only the tokens after 3 have after_sentence_split feature.
    for (const [i, token_features] of p.sentence_features().entries()) {
      if (i >= 3) {
        expect(token_features["after_sentence_split"] ?? false).toBe(true);
      } else {
        expect(token_features["after_sentence_split"] ?? false).toBe(false);
      }
    }
  });
});

describe("Test_example_phrase_features", () => {
  it("test_example_phrase_detection_like", () => {
    // Test phrase using "like" is detected
    const p = new PreProcessor(
      "2 tbsp chopped fresh herbs, like parsley and chives", { custom_units: {} },
    );
    expect(p.sentence_structure.example_phrases).toEqual([[6, 7, 8, 9]]);
  });

  it("test_example_phrase_detection_such_as", () => {
    // Test phrase using "such as" is detected
    const p = new PreProcessor(
      "2 tbsp chopped fresh herbs, such as parsley and chives", { custom_units: {} },
    );
    expect(p.sentence_structure.example_phrases).toEqual([[6, 7, 8, 9, 10]]);
  });

  it("test_example_phrase_detection_eg", () => {
    // Test phrase using "e.g." is detected
    const p = new PreProcessor(
      "2 tbsp chopped fresh herbs, e.g. parsley and chives", { custom_units: {} },
    );
    expect(p.sentence_structure.example_phrases).toEqual([[6, 7, 8, 9]]);
  });

  it("test_example_phrase_detection_invalid_start_adjective", () => {
    // Test phrase starting with invalid adjective is detected, and invalid adjective
    // is removed from phrase indices.
    const p = new PreProcessor(
      "1 bottle dry red wine, heavy and coarse like a Zinfandel", { custom_units: {} },
    );
    expect(p.sentence_structure.example_phrases).toEqual([[9, 10, 11]]);
  });

  // PARITY-DELTA (tagger, docs/PORTING.md §3.2): NLTK tags "lager" JJR → examples [[4,5],[10,11]];
  // Brill tags it NN and Python-with-BRILL_TAGS_FILE returns [[4,5,6,7,8],[10,11]], as the port does.
  it.fails("test_example_phrase_detection_multiple_examples", () => {
    // Test both phrases using "like" are detected.
    const p = new PreProcessor(
      "2 cups ale, like Boddingtons, or lager, like Carlsburg", { custom_units: {} },
    );
    expect(p.sentence_structure.example_phrases).toEqual([[4, 5], [10, 11]]);
  });

  // PARITY-DELTA (tagger, docs/PORTING.md §3.2): same as test_example_phrase_detection_multiple_examples;
  // Python-with-BRILL_TAGS_FILE returns [[4,5,6,7,8],[10,11]], as the port does.
  it.fails("test_example_phrase_detection_duplicate_examples", () => {
    // Test phrase using "like" are detected when both phrases are identical (in both
    // token text and part of speech tag).
    const p = new PreProcessor(
      "2 cups ale, like Carlsburg, or lager, like Carlsburg", { custom_units: {} },
    );
    expect(p.sentence_structure.example_phrases).toEqual([[4, 5], [10, 11]]);
  });

  it("test_example_phrase_detection_feature", () => {
    // Test that the example_phrase feature is correct set.
    const p = new PreProcessor(
      "1 bottle dry red wine, heavy and coarse like a Zinfandel", { custom_units: {} },
    );

    // Assert that only the tokens after 8 have example_phrase feature set True.
    for (const [i, token_features] of p.sentence_features().entries()) {
      if (i >= 9) {
        expect(token_features["example_phrase"] ?? false).toBe(true);
      } else {
        expect(token_features["example_phrase"] ?? false).toBe(false);
      }
    }
  });
});

describe("Test_dimensional_phrase_features", () => {
  it("test_dimensional_phrase_detection", () => {
    // Test dimensional phrase comprising number-unit-dimension is detected.
    const p = new PreProcessor("1 2 in thick piece of steak", { custom_units: {} });
    expect(p.sentence_structure.dimensional_phrases).toEqual([[1, 2, 3]]);
  });

  it("test_dimensional_phrase_no_dimension", () => {
    // Test dimensional phrase comprising number-unit is detected.
    const p = new PreProcessor("2in/5cm piece of ginger", { custom_units: {} });
    expect(p.sentence_structure.dimensional_phrases).toEqual([[0, 1, 2, 3, 4]]);
  });

  it("test_dimensional_phrase_with_parenthesis", () => {
    // Test dimensional phrase comprising two pair of number-unit, with the second pair
    // in parentheses, followed by a dimension is detected.
    const p = new PreProcessor("1 2 in (5 cm) long piece of steak", { custom_units: {} });
    expect(p.sentence_structure.dimensional_phrases).toEqual([[1, 2, 3, 4, 5, 6, 7]]);
  });

  it("test_dimensional_phrase_with_slash", () => {
    // Test dimensional phrase comprising two pair of number-unit, with the second pair
    // after a forward slash, followed by a dimension is detected.
    const p = new PreProcessor("1 2 in / 5 cm wide piece of steak", { custom_units: {} });
    expect(p.sentence_structure.dimensional_phrases).toEqual([[1, 2, 3, 4, 5, 6]]);
  });

  it("test_dimensional_phrase_with_preposition", () => {
    // Test dimensional phrase comprising number-unit-"in"-dimension is detected.
    const p = new PreProcessor("1 potato, 3 inches in diameter", { custom_units: {} });
    expect(p.sentence_structure.dimensional_phrases).toEqual([[3, 4, 5, 6]]);
  });
});
