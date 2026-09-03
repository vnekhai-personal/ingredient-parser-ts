// Verbatim conversion of ip-repo/tests/postprocess/test_fallback_pattern.py @ ffd6ae3 (14 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { Fraction } from "../../../src/fraction.js";
import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";
import { ingredient_amount_factory } from "../../../src/en/_utils.js";

/** Define a PostProcessor object to use for testing the PostProcessor
 * class methods.
 */
function p_fixture() {
  const sentence = "2 14 ounce cans coconut milk";
  const tokens = ["2", "14", "ounce", "can", "coconut", "milk"];
  const pos_tags = ["CD", "CD", "NN", "MD", "VB", "NN"];
  const labels = ["QTY", "QTY", "UNIT", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
  const scores = [
    0.9991370577083561,
    0.9725378063405858,
    0.9978510889596651,
    0.9922350007952175,
    0.9886087821704076,
    0.9969237827902526,
  ];
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

  return new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
}

describe("TestPostProcessor_fallback_pattern", () => {
  it("test_basic", () => {
    // Test that a single IngredientAmount object with quantity "3" and
    // unit "large handfuls" is returned.
    const p = p_fixture();

    const tokens = ["3", "large", "handful", "cherry", "tomatoes"];
    const labels = ["QTY", "UNIT", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const plurals = [false, false, true, false, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "3",
        unit: "large handful",
        text: "3 large handful",
        confidence: 0,
        starting_index: 0,
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_imperial", () => {
    // Test that imperial units are returned for 'cup'
    const p = new PostProcessor("", [], { custom_units: {}, volumetric_units_system: "imperial" });
    const tokens = ["About", "2", "cup", "flour"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK"];
    const plurals = [false, false, true, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "2",
        unit: "cup",
        text: "2 cup",
        confidence: 0,
        starting_index: 1,
        APPROXIMATE: true,
        volumetric_units_system: "imperial",
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_string_units", () => {
    // Test that the returned unit is 'cups'
    const p = new PostProcessor("", [], { custom_units: {}, string_units: true });
    const tokens = ["About", "2", "cup", "flour"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK"];
    const plurals = [false, false, true, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "2",
        unit: "cup",
        text: "2 cup",
        confidence: 0,
        starting_index: 1,
        APPROXIMATE: true,
        string_units: true,
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_approximate", () => {
    // Test that a single IngredientAmount object with the APPROXIMATE flag set
    // is returned
    const p = p_fixture();
    const tokens = ["About", "2", "cup", "flour"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK"];
    const plurals = [false, false, true, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "2",
        unit: "cup",
        text: "2 cup",
        confidence: 0,
        starting_index: 1,
        APPROXIMATE: true,
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_singular", () => {
    // Test that a single IngredientAmount object with the SINGULAR flag set
    // is returned
    const p = p_fixture();
    const tokens = ["2", "bananas", ",", "4", "ounce", "each"];
    const labels = ["QTY", "B_NAME_TOK", "PUNC", "QTY", "UNIT", "COMMENT"];
    const plurals = [false, false, false, false, true, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    p.consumed = [0, 1, 2, 3];

    const expected = [
      ingredient_amount_factory({
        quantity: "2",
        unit: "",
        text: "2",
        confidence: 0,
        starting_index: 0,
      }),
      ingredient_amount_factory({
        quantity: "4",
        unit: "ounce",
        text: "4 ounce",
        confidence: 0,
        starting_index: 3,
        SINGULAR: true,
        APPROXIMATE: false,
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_singular_and_approximate", () => {
    // Test that a single IngredientAmount object with the APPROXIMATE and
    // SINGULAR flags set is returned
    const p = p_fixture();
    const tokens = ["2", "bananas", ",", "each", "about", "4", "ounce"];
    const labels = ["QTY", "B_NAME_TOK", "PUNC", "COMMENT", "COMMENT", "QTY", "UNIT"];
    const plurals = [false, false, false, false, false, true, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "2",
        unit: "",
        text: "2",
        confidence: 0,
        starting_index: 0,
      }),
      ingredient_amount_factory({
        quantity: "4",
        unit: "ounce",
        text: "4 ounce",
        confidence: 0,
        starting_index: 5,
        SINGULAR: true,
        APPROXIMATE: true,
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_prepared", () => {
    // Test that a single IngredientAmount object with the APPROXIMATE and
    // SINGULAR flags set is returned
    const p = p_fixture();
    const tokens = [
      "2",
      "bananas",
      ",",
      "mashed",
      ",",
      "to",
      "yield",
      "1",
      "cup",
      "(",
      "200",
      "g",
      ")",
    ];
    const labels = [
      "QTY",
      "B_NAME_TOK",
      "PUNC",
      "PREP",
      "PUNC",
      "COMMENT",
      "COMMENT",
      "QTY",
      "UNIT",
      "PUNC",
      "QTY",
      "UNIT",
      "PUNC",
    ];
    const plurals = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "2",
        unit: "",
        text: "2",
        confidence: 0,
        starting_index: 0,
      }),
      ingredient_amount_factory({
        quantity: "1",
        unit: "cup",
        text: "1 cup",
        confidence: 0,
        starting_index: 7,
        PREPARED_INGREDIENT: true,
      }),
      ingredient_amount_factory({
        quantity: "200",
        unit: "g",
        text: "200 g",
        confidence: 0,
        starting_index: 10,
        PREPARED_INGREDIENT: true,
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_dozen", () => {
    // Test that the token "dozen" is combined with the preceding QTY token in a
    // single IngredientAmount object.
    const p = p_fixture();
    const tokens = ["2", "dozen", "bananas", ",", "each", "about", "4", "ounce"];
    const labels = [
      "QTY",
      "QTY",
      "B_NAME_TOK",
      "PUNC",
      "COMMENT",
      "COMMENT",
      "QTY",
      "UNIT",
    ];
    const plurals = [false, false, false, false, false, false, false, true];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "2 dozen",
        unit: "",
        text: "2 dozen",
        confidence: 0,
        starting_index: 0,
      }),
      ingredient_amount_factory({
        quantity: "4",
        unit: "ounce",
        text: "4 ounce",
        confidence: 0,
        starting_index: 6,
        SINGULAR: true,
        APPROXIMATE: true,
      }),
    ];

    expect(p._fallback_pattern(labelled_tokens)).toEqual(expected);
  });

  it("test_range", () => {
    // Test that the range 1-2 is correctly parsed to set the RANGE flag and
    // quantity_max fields in the IngredientAmount object
    const p = p_fixture();
    const tokens = ["1-2", "tablespoon", "local", "honey"];
    const labels = ["QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const plurals = [false, true, false, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "1-2",
        unit: "tablespoon",
        text: "1-2 tablespoon",
        confidence: 0,
        starting_index: 0,
      }),
    ];

    const actual = p._fallback_pattern(labelled_tokens);
    expect(actual).toEqual(expected);
    expect(actual[0]!.RANGE).toBe(true);
    expect(actual[0]!.quantity).toEqual(new Fraction(1));
    expect(actual[0]!.quantity_max).toEqual(new Fraction(2));
  });

  it("test_multiplier", () => {
    // Test that the multiplier "1x" is correctly parsed to set the MULTIPLIER
    // flag, quantity and quantity_max fields in the IngredientAmount object
    const p = p_fixture();
    const tokens = ["1x", "tin", "condensed", "milk"];
    const labels = ["QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const plurals = [false, false, false, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0.0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "1x",
        unit: "tin",
        text: "1x tin",
        confidence: 0,
        starting_index: 0,
      }),
    ];

    const actual = p._fallback_pattern(labelled_tokens);
    expect(actual).toEqual(expected);
    expect(actual[0]!.MULTIPLIER).toBe(true);
    expect(actual[0]!.quantity).toEqual(new Fraction(1));
  });

  it("test_implicit_quantity", () => {
    // Test that the amount is given an implicit quantity of 1.
    const p = p_fixture();
    const tokens = ["#1$4", "inch", "piece", "of", "ginger"];
    const labels = ["SIZE", "SIZE", "UNIT", "COMMENT", "B_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0, plural: false }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "1",
        unit: "piece",
        text: "1 piece",
        confidence: 0,
        starting_index: 2,
      }),
    ];

    const actual = p._fallback_pattern(labelled_tokens);
    expect(actual).toEqual(expected);
    expect(actual[0]!.quantity).toEqual(new Fraction(1));
  });

  it("test_no_implicit_quantity_plural", () => {
    // Test that the amount has no quantity because the unit is plural.
    const p = p_fixture();
    const tokens = ["Chervil", "sprig", "(", "optional", ")"];
    const labels = ["B_NAME_TOK", "UNIT", "PUNC", "COMMENT", "PUNC"];
    const plurals = [false, true, false, false, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "",
        unit: "sprigs",
        text: "sprigs",
        confidence: 0,
        starting_index: 1,
      }),
    ];

    const actual = p._fallback_pattern(labelled_tokens);
    expect(actual).toEqual(expected);
    expect(actual[0]!.quantity).toBe("");
  });

  it("test_no_implicit_quantity_multiple_units", () => {
    // Test that the amount has no quantity because the second unit token is plural.
    const p = p_fixture();
    const tokens = ["Thin", "slice", "peach"];
    const labels = ["UNIT", "UNIT", "B_NAME_TOK"];
    const plurals = [false, true, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "",
        unit: "Thin slices",
        text: "Thin slices",
        confidence: 0,
        starting_index: 0,
      }),
    ];

    const actual = p._fallback_pattern(labelled_tokens);
    expect(actual).toEqual(expected);
    expect(actual[0]!.quantity).toBe("");
  });

  it("test_no_implicit_quantity_indefinite_quantifier", () => {
    // Test that the amount has no quantity because the sentence contains an indefinite
    // quantifier prior to the unit.
    const p = p_fixture();
    const tokens = ["Several", "sprig", "fresh", "rosemary"];
    const labels = ["COMMENT", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    // Note that we've set the plural flag for "sprigs" to False to test the
    // indefinite quantifier behaviour, even through it's actually plural.
    const plurals = [false, false, false, false];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: "", label: labels[i]!, score: 0, plural: plurals[i]! }),
    );

    const expected = [
      ingredient_amount_factory({
        quantity: "",
        unit: "sprig",
        text: "sprig",
        confidence: 0,
        starting_index: 1,
      }),
    ];

    const actual = p._fallback_pattern(labelled_tokens);
    expect(actual).toEqual(expected);
    expect(actual[0]!.quantity).toBe("");
  });
});
