// Verbatim conversion of ip-repo/tests/postprocess/test_composite_amounts_pattern.py @ ffd6ae3 (14 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { CompositeIngredientAmount, LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";
import { ingredient_amount_factory } from "../../../src/en/_utils.js";

// CONVERSION NOTE: upstream's `for out, expected in zip(output, expected)` rebinds the
// loop variable over the outer `expected` list. TS cannot shadow a `const` in the same
// scope, so the loop element is named `exp`; lengths are asserted equal beforehand, so
// zip == index walk.

describe("TestPostProcessor_composite_amounts_pattern", () => {
  it("test_lb_oz_pattern", () => {
    // Test that the lb-oz pair are returned as a composite amounts
    const sentence = "500g/1lb 2oz pecorino romano cheese (or a vegetarian alternative)";
    const tokens = [
      "500",
      "g",
      "/",
      "1",
      "lb",
      "2",
      "oz",
      "pecorino",
      "romano",
      "cheese",
      "(",
      "or",
      "a",
      "vegetarian",
      "alternative",
      ")",
    ];
    const pos_tags = [
      "CD",
      "JJ",
      "$",
      "CD",
      "JJ",
      "CD",
      "NN",
      "NN",
      "NN",
      "NN",
      "(",
      "CC",
      "DT",
      "JJ",
      "NN",
      ")",
    ];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "B_NAME_TOK",
      "I_NAME_TOK",
      "I_NAME_TOK",
      "COMMENT",
      "COMMENT",
      "COMMENT",
      "COMMENT",
      "COMMENT",
      "COMMENT",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "lb",
            text: "1 lb",
            confidence: 0,
            starting_index: 3,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "oz",
            text: "2 oz",
            confidence: 0,
            starting_index: 5,
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_pint_fl_oz_pattern", () => {
    // Test that the pint-fl-oz pair are returned as a composite amounts
    const sentence = "1.5 litres/2 pints 12¾fl oz water";
    const tokens = ["1.5", "litre", "/", "2", "pint", "12.75", "fl", "oz", "water"];
    const pos_tags = ["CD", "JJ", "$", "CD", "NN", "CD", "NN", "NN", "NN"];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "UNIT",
      "B_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "2",
            unit: "pint",
            text: "2 pints",
            confidence: 0,
            starting_index: 3,
          }),
          ingredient_amount_factory({
            quantity: "12.75",
            unit: "floz",
            text: "12.75 fl oz",
            confidence: 0,
            starting_index: 5,
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_imperial_pint_fl_oz_pattern", () => {
    // Test that the pint-fl-oz pair are returned as a composite amounts
    // in imperial units.
    const sentence = "1.5 litres/2 pints 12¾fl oz water";
    const tokens = ["1.5", "litre", "/", "2", "pint", "12.75", "fl", "oz", "water"];
    const pos_tags = ["CD", "JJ", "$", "CD", "NN", "CD", "NN", "NN", "NN"];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "UNIT",
      "B_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, {
      custom_units: {},
      volumetric_units_system: "imperial",
    });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "2",
            unit: "pint",
            text: "2 pints",
            confidence: 0,
            starting_index: 3,
            volumetric_units_system: "imperial",
          }),
          ingredient_amount_factory({
            quantity: "12.75",
            unit: "fluid ounce",
            text: "12.75 fl oz",
            confidence: 0,
            starting_index: 5,
            volumetric_units_system: "imperial",
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_string_pint_fl_oz_pattern", () => {
    // Test that the pint-fl-oz pair are returned as strings in the units fields
    const sentence = "1.5 litres/2 pints 12¾fl oz water";
    const tokens = ["1.5", "litre", "/", "2", "pint", "12.75", "fl", "oz", "water"];
    const pos_tags = ["CD", "JJ", "$", "CD", "NN", "CD", "NN", "NN", "NN"];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "UNIT",
      "B_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {}, string_units: true });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "2",
            unit: "pints",
            text: "2 pints",
            confidence: 0,
            starting_index: 3,
            string_units: true,
          }),
          ingredient_amount_factory({
            quantity: "12.75",
            unit: "fl oz",
            text: "12.75 fl oz",
            confidence: 0,
            starting_index: 5,
            string_units: true,
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      // Python: pytest.raises(TypeError)
      // Can't combine amounts if units are strings
      expect(() => out.combined()).toThrow();
    }
  });

  it("test_plus_pattern", () => {
    // Test that the amounts either side of "plus" are returned as a composite amounts
    const sentence = "1 cup plus 2 tablespoons (about 5 ounces) all-purpose flour";
    const tokens = [
      "1",
      "cup",
      "plus",
      "2",
      "tablespoon",
      "(",
      "about",
      "5",
      "ounce",
      ")",
      "all-purpose",
      "flour",
    ];
    const pos_tags = [
      "CD",
      "NN",
      "CC",
      "CD",
      "NN",
      "(",
      "IN",
      "CD",
      "NN",
      ")",
      "JJ",
      "NN",
    ];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "B_NAME_TOK",
      "I_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "cup",
            text: "1 cup",
            confidence: 0,
            starting_index: 0,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "tablespoon",
            text: "2 tablespoons",
            confidence: 0,
            starting_index: 3,
          }),
        ],
        join: " plus ",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_plus_punc_pattern", () => {
    // Test that the amounts either side of "+" are returned as a composite amounts
    const sentence = "1 cup + 2 tablespoons (about 5 ounces) all-purpose flour";
    const tokens = [
      "1",
      "cup",
      "+",
      "2",
      "tablespoon",
      "(",
      "about",
      "5",
      "ounce",
      ")",
      "all-purpose",
      "flour",
    ];
    const pos_tags = [
      "CD",
      "NN",
      "VBD",
      "CD",
      "NN",
      "(",
      "IN",
      "CD",
      "NN",
      ")",
      "JJ",
      "NN",
    ];
    const labels = [
      "QTY",
      "UNIT",
      "PUNC",
      "QTY",
      "UNIT",
      "PUNC",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "B_NAME_TOK",
      "I_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "cup",
            text: "1 cup",
            confidence: 0,
            starting_index: 0,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "tablespoon",
            text: "2 tablespoons",
            confidence: 0,
            starting_index: 3,
          }),
        ],
        join: " + ",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_and_pattern", () => {
    // Test that the amounts either side of "and" are returned as a composite amounts
    const sentence = "1 cup and 2 tablespoons (about 5 ounces) all-purpose flour";
    const tokens = [
      "1",
      "cup",
      "and",
      "2",
      "tablespoon",
      "(",
      "about",
      "5",
      "ounce",
      ")",
      "all-purpose",
      "flour",
    ];
    const pos_tags = [
      "CD",
      "NN",
      "CC",
      "CD",
      "NN",
      "(",
      "IN",
      "CD",
      "NN",
      ")",
      "JJ",
      "NN",
    ];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "B_NAME_TOK",
      "I_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "cup",
            text: "1 cup",
            confidence: 0,
            starting_index: 0,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "tablespoon",
            text: "2 tablespoons",
            confidence: 0,
            starting_index: 3,
          }),
        ],
        join: " and ",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_minus_pattern", () => {
    // Test that the amounts either side of "minus" are returned as a composite amounts
    const sentence = "1 cup minus 2 tablespoons (about 5 ounces) all-purpose flour";
    const tokens = [
      "1",
      "cup",
      "minus",
      "2",
      "tablespoon",
      "(",
      "about",
      "5",
      "ounce",
      ")",
      "all-purpose",
      "flour",
    ];
    const pos_tags = [
      "CD",
      "NN",
      "CC",
      "CD",
      "NN",
      "(",
      "IN",
      "CD",
      "NN",
      ")",
      "JJ",
      "NN",
    ];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "B_NAME_TOK",
      "I_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "cup",
            text: "1 cup",
            confidence: 0,
            starting_index: 0,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "tablespoon",
            text: "2 tablespoons",
            confidence: 0,
            starting_index: 3,
          }),
        ],
        join: " minus ",
        subtractive: true,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_no_pattern", () => {
    // Test that the no composite amounts are returned if the pattern is not matched
    const sentence = "2 pints or 40 fl oz water";
    const tokens = ["2", "pint", "or", "40", "fl", "oz", "water"];
    const pos_tags = ["CD", "NN", "CC", "CD", "JJ", "JJ", "NN"];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "UNIT",
      "B_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output).toEqual([]);
  });

  it("test_plus_punc_comment_pattern", () => {
    // Test that the amounts either side of "plus" are returned as a composite amounts
    const sentence = "1 cup, plus 2 tablespoons (about 5 ounces) all-purpose flour";
    const tokens = [
      "1",
      "cup",
      ",",
      "plus",
      "2",
      "tablespoon",
      "(",
      "about",
      "5",
      "ounce",
      ")",
      "all-purpose",
      "flour",
    ];
    const pos_tags = [
      "CD",
      "NN",
      ",",
      "CC",
      "CD",
      "NN",
      "(",
      "IN",
      "CD",
      "NN",
      ")",
      "JJ",
      "NN",
    ];
    const labels = [
      "QTY",
      "UNIT",
      "PUNC",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "B_NAME_TOK",
      "I_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "cup",
            text: "1 cup",
            confidence: 0,
            starting_index: 0,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "tablespoon",
            text: "2 tablespoons",
            confidence: 0,
            starting_index: 4,
          }),
        ],
        join: " plus ",
        subtractive: false,
      }),
    ];
    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
    }
  });

  it("test_approximate_lb_oz_pattern", () => {
    // Test that the lb-oz pair are returned as a composite amounts marked as
    // approximate.
    const sentence = "About 1lb 2oz pecorino romano cheese (or a vegetarian alternative)";
    const tokens = [
      "About",
      "1",
      "lb",
      "2",
      "oz",
      "pecorino",
      "romano",
      "cheese",
      "(",
      "or",
      "a",
      "vegetarian",
      "alternative",
      ")",
    ];
    const pos_tags = [
      "RB",
      "CD",
      "JJ",
      "CD",
      "NN",
      "NN",
      "NN",
      "NN",
      "(",
      "CC",
      "DT",
      "JJ",
      "NN",
      ")",
    ];
    const labels = [
      "COMMENT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "B_NAME_TOK",
      "I_NAME_TOK",
      "I_NAME_TOK",
      "COMMENT",
      "COMMENT",
      "COMMENT",
      "COMMENT",
      "COMMENT",
      "COMMENT",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "lb",
            text: "1 lb",
            confidence: 0,
            starting_index: 1,
            APPROXIMATE: true,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "oz",
            text: "2 oz",
            confidence: 0,
            starting_index: 3,
            APPROXIMATE: true,
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
      for (const amount of out.amounts) {
        expect(amount.APPROXIMATE).toBe(true);
      }
    }
  });

  it("test_singular_lb_oz_pattern", () => {
    // Test that the lb-oz pair are returned as a composite amounts marked as
    // singular.
    const sentence = "1lb 2oz each pecorino romano and parmesan cheese";
    const tokens = [
      "1",
      "lb",
      "2",
      "oz",
      "each",
      "pecorino",
      "romano",
      "and",
      "parmesan",
      "cheese",
    ];
    const pos_tags = ["CD", "JJ", "CD", "IN", "DT", "NN", "NN", "CC", "NN", "NN"];
    const labels = [
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "COMMENT",
      "B_NAME_TOK",
      "I_NAME_TOK",
      "NAME_SEP",
      "B_NAME_TOK",
      "I_NAME_TOK",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "lb",
            text: "1 lb",
            confidence: 0,
            starting_index: 0,
            SINGULAR: true,
          }),
          ingredient_amount_factory({
            quantity: "2",
            unit: "oz",
            text: "2 oz",
            confidence: 0,
            starting_index: 2,
            SINGULAR: true,
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
      for (const amount of out.amounts) {
        expect(amount.SINGULAR).toBe(true);
      }
    }
  });

  it("test_singular_and_approximate_lb_oz_pattern", () => {
    // Test that the lb-oz pair are returned as a composite amounts marked as
    // approximate and singular.
    const sentence = "2 large butternut squash, each about 1lb 1 oz";
    const tokens = [
      "2",
      "large",
      "butternut",
      "squash",
      ",",
      "each",
      "about",
      "1",
      "lb",
      "1",
      "oz",
    ];
    const pos_tags = ["CD", "JJ", "NN", "NN", ",", "DT", "RB", "CD", "JJ", "CD", "NN"];
    const labels = [
      "QTY",
      "SIZE",
      "B_NAME_TOK",
      "I_NAME_TOK",
      "PUNC",
      "COMMENT",
      "COMMENT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "lb",
            text: "1 lb",
            confidence: 0,
            starting_index: 7,
            APPROXIMATE: true,
            SINGULAR: true,
          }),
          ingredient_amount_factory({
            quantity: "1",
            unit: "oz",
            text: "1 oz",
            confidence: 0,
            starting_index: 9,
            APPROXIMATE: true,
            SINGULAR: true,
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
      for (const amount of out.amounts) {
        expect(amount.APPROXIMATE).toBe(true);
        expect(amount.SINGULAR).toBe(true);
      }
    }
  });

  it("test_prepared_lb_oz_pattern", () => {
    // Test that the lb-oz pair are returned as a composite amounts marked as
    // approximate and singular.
    const sentence = "Strained homemade chicken stock, to yield 1 pint 3 fl oz";
    const tokens = [
      "Strained",
      "homemade",
      "chicken",
      "stock",
      ",",
      "to",
      "yield",
      "1",
      "pint",
      "3",
      "fl",
      "oz",
    ];

    const pos_tags = [
      "VBN",
      "JJ",
      "NN",
      "NN",
      ",",
      "TO",
      "VB",
      "CD",
      "NN",
      "CD",
      "NN",
      "NN",
    ];
    const labels = [
      "PREP",
      "B_NAME_TOK",
      "I_NAME_TOK",
      "I_NAME_TOK",
      "PUNC",
      "COMMENT",
      "COMMENT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "UNIT",
    ];
    const scores = Array(tokens.length).fill(0.0) as number[];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({
          index: i,
          text,
          pos_tag: pos_tags[i]!,
          label: labels[i]!,
          score: scores[i]!,
          plural: false,
        }),
    );
    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });

    const expected = [
      new CompositeIngredientAmount({
        amounts: [
          ingredient_amount_factory({
            quantity: "1",
            unit: "pint",
            text: "1 pint",
            confidence: 0,
            starting_index: 7,
            PREPARED_INGREDIENT: true,
          }),
          ingredient_amount_factory({
            quantity: "3",
            unit: "fl oz",
            text: "3 fl oz",
            confidence: 0,
            starting_index: 9,
            PREPARED_INGREDIENT: true,
          }),
        ],
        join: "",
        subtractive: false,
      }),
    ];

    // Don't check scores
    const output = p._composite_amounts_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.amounts).toEqual(exp.amounts);
      expect(out.join).toBe(exp.join);
      expect(out.confidence).toBe(exp.confidence);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.combined()).toEqual(exp.combined());
      for (const amount of out.amounts) {
        expect(amount.PREPARED_INGREDIENT).toBe(true);
      }
    }
  });
});
