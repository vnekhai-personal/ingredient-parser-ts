// Verbatim conversion of ip-repo/tests/postprocess/test_sizeable_unit_pattern.py @ ffd6ae3 (9 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";
import { ingredient_amount_factory } from "../../../src/en/_utils.js";

// CONVERSION NOTE: upstream's `for out, expected in zip(output, expected)` rebinds the
// loop variable over the outer `expected` list. TS cannot shadow a `const` in the same
// scope, so the loop element is named `exp` (as upstream itself does in
// test_no_count_pattern); lengths are asserted equal beforehand, so zip == index walk.

describe("TestPostProcessor_sizeable_unit_pattern", () => {
  it("test_long_pattern", () => {
    // Test that 4 quantity and unit amounts are returned, with the first
    // made up of the first quantity and last unit.
    const sentence = "1 28 ounce (400 g / 2 cups) can chickpeas";
    const tokens = [
      "1",
      "28",
      "ounce",
      "(",
      "400",
      "g",
      "/",
      "2",
      "cup",
      ")",
      "can",
      "chickpeas",
    ];
    const pos_tags = [
      "CD",
      "CD",
      "NN",
      "(",
      "CD",
      "NN",
      "VBD",
      "CD",
      "NN",
      ")",
      "MD",
      "VB",
    ];
    const labels = [
      "QTY",
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "COMMENT",
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
      ingredient_amount_factory({ quantity: "1", unit: "can", text: "1 can", confidence: 0, starting_index: 0 }),
      ingredient_amount_factory({
        quantity: "28",
        unit: "ounce",
        text: "28 ounces",
        confidence: 0,
        SINGULAR: true,
        starting_index: 1,
      }),
      ingredient_amount_factory({
        quantity: "400",
        unit: "g",
        text: "400 g",
        confidence: 0,
        starting_index: 4,
        SINGULAR: true,
      }),
      ingredient_amount_factory({
        quantity: "2",
        unit: "cup",
        text: "2 cups",
        confidence: 0,
        starting_index: 7,
        SINGULAR: true,
      }),
    ];

    // Don't check scores
    const output = p._sizeable_unit_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.quantity).toEqual(exp.quantity);
      expect(out.unit).toEqual(exp.unit);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.SINGULAR).toBe(exp.SINGULAR);
      expect(out.APPROXIMATE).toBe(exp.APPROXIMATE);
    }
  });

  it("test_medium_pattern", () => {
    // Test that 3 quantity and unit amounts are returned, with the first
    // made up of the first quantity and last unit.
    const sentence = "1 28 ounce (400 g) can chickpeas";
    const tokens = [
      "1",
      "28",
      "ounce",
      "(",
      "400",
      "g",
      ")",
      "can",
      "chickpeas",
    ];
    const pos_tags = ["CD", "CD", "NN", "(", "CD", "NN", ")", "MD", "VB"];
    const labels = [
      "QTY",
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "COMMENT",
      "UNIT",
      "NAME",
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
      ingredient_amount_factory({ quantity: "1", unit: "can", text: "1 can", confidence: 0, starting_index: 0 }),
      ingredient_amount_factory({
        quantity: "28",
        unit: "ounce",
        text: "28 ounces",
        confidence: 0,
        starting_index: 1,
        SINGULAR: true,
      }),
      ingredient_amount_factory({
        quantity: "400",
        unit: "g",
        text: "400 g",
        confidence: 0,
        starting_index: 4,
        SINGULAR: true,
      }),
    ];

    // Don't check scores
    const output = p._sizeable_unit_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.quantity).toEqual(exp.quantity);
      expect(out.unit).toEqual(exp.unit);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.SINGULAR).toBe(exp.SINGULAR);
      expect(out.APPROXIMATE).toBe(exp.APPROXIMATE);
    }
  });

  it("test_short_pattern", () => {
    // Test that 4 quantity and unit amounts are returned, with the first
    // made up of the first quantity and last unit.
    const sentence = "1 28 ounce can chickpeas";
    const tokens = [
      "1",
      "28",
      "ounce",
      "can",
      "chickpeas",
    ];
    const pos_tags = ["CD", "CD", "NN", "MD", "VB"];
    const labels = [
      "QTY",
      "QTY",
      "UNIT",
      "UNIT",
      "NAME",
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
      ingredient_amount_factory({ quantity: "1", unit: "can", text: "1 can", confidence: 0, starting_index: 0 }),
      ingredient_amount_factory({
        quantity: "28",
        unit: "ounce",
        text: "28 ounces",
        confidence: 0,
        starting_index: 1,
        SINGULAR: true,
      }),
    ];

    // Don't check scores
    const output = p._sizeable_unit_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.quantity).toEqual(exp.quantity);
      expect(out.unit).toEqual(exp.unit);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.SINGULAR).toBe(exp.SINGULAR);
      expect(out.APPROXIMATE).toBe(exp.APPROXIMATE);
    }
  });

  it("test_no_pattern", () => {
    // Test that None is return if pattern is not matched
    const sentence = "400 g chickpeas or black beans";
    const tokens = ["400", "g", "chickpeas", "or", "black", "beans"];
    const pos_tags = ["CD", "JJ", "NNS", "CC", "JJ", "NNS"];
    const labels = ["QTY", "UNIT", "NAME", "NAME", "NAME", "NAME"];
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
    expect(p._sizeable_unit_pattern(labelled_tokens)).toEqual([]);
  });

  it("test_mixed_pattern", () => {
    // Test that 3 quantity and unit amounts are returned, with the first
    // made up of the first quantity and last unit.
    const sentence = "2 cups or 1 28 ounce can chickpeas";
    const tokens = ["2", "cup", "or", "1", "28", "ounce", "can", "chickpeas"];
    const pos_tags = ["CD", "NN", "CC", "CD", "CD", "NN", "MD", "VB"];
    const labels = ["QTY", "UNIT", "COMMENT", "QTY", "QTY", "UNIT", "UNIT", "NAME"];
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
      ingredient_amount_factory({ quantity: "1", unit: "can", text: "1 can", confidence: 0, starting_index: 3 }),
      ingredient_amount_factory({
        quantity: "28",
        unit: "ounce",
        text: "28 ounces",
        confidence: 0,
        starting_index: 4,
        SINGULAR: true,
      }),
    ];

    // Don't check scores
    const output = p._sizeable_unit_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.quantity).toEqual(exp.quantity);
      expect(out.unit).toEqual(exp.unit);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.SINGULAR).toBe(exp.SINGULAR);
      expect(out.APPROXIMATE).toBe(exp.APPROXIMATE);
    }
  });

  it("test_mixed_pattern_imperial", () => {
    // Test that 3 quantity and unit amounts are returned, with the first
    // made up of the first quantity and last unit.
    // Imperial units should be returned where the US customary and imperial
    // units differ.
    const sentence = "2 cups or 1 28 ounce can chickpeas";
    const tokens = ["2", "cup", "or", "1", "28", "ounce", "can", "chickpeas"];
    const pos_tags = ["CD", "NN", "CC", "CD", "CD", "NN", "MD", "VB"];
    const labels = ["QTY", "UNIT", "COMMENT", "QTY", "QTY", "UNIT", "UNIT", "NAME"];
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
      ingredient_amount_factory({ quantity: "1", unit: "can", text: "1 can", confidence: 0, starting_index: 3 }),
      ingredient_amount_factory({
        quantity: "28",
        unit: "ounce",
        text: "28 ounces",
        confidence: 0,
        starting_index: 4,
        SINGULAR: true,
        volumetric_units_system: "imperial",
      }),
    ];

    // Don't check scores
    const output = p._sizeable_unit_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.quantity).toEqual(exp.quantity);
      expect(out.unit).toEqual(exp.unit);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.SINGULAR).toBe(exp.SINGULAR);
      expect(out.APPROXIMATE).toBe(exp.APPROXIMATE);
    }
  });

  it("test_mixed_pattern_string_units", () => {
    // Test that 3 quantity and unit amounts are returned, with the first
    // made up of the first quantity and last unit.
    // Imperial units should be returned where the US customary and imperial
    // units differ.
    const sentence = "2 cups or 1 28 ounce can chickpeas";
    const tokens = ["2", "cup", "or", "1", "28", "ounce", "can", "chickpeas"];
    const pos_tags = ["CD", "NN", "CC", "CD", "CD", "NN", "MD", "VB"];
    const labels = ["QTY", "UNIT", "COMMENT", "QTY", "QTY", "UNIT", "UNIT", "NAME"];
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
      ingredient_amount_factory({ quantity: "1", unit: "can", text: "1 can", confidence: 0, starting_index: 3 }),
      ingredient_amount_factory({
        quantity: "28",
        unit: "ounce",
        text: "28 ounces",
        confidence: 0,
        starting_index: 4,
        SINGULAR: true,
        string_units: true,
      }),
    ];

    // Don't check scores
    const output = p._sizeable_unit_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.quantity).toEqual(exp.quantity);
      expect(out.unit).toEqual(exp.unit);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.SINGULAR).toBe(exp.SINGULAR);
      expect(out.APPROXIMATE).toBe(exp.APPROXIMATE);
    }
  });

  it("test_no_count_pattern", () => {
    // Test [QTY, UNIT, UNIT] pattern where there is no leading count.
    // E.g., "15 ounce can chickpeas" should produce an implied-count
    // container amount and a weight amount.
    const sentence = "15 ounce can chickpeas";
    const tokens = ["15", "ounce", "can", "chickpeas"];
    const pos_tags = ["CD", "NN", "MD", "VB"];
    const labels = ["QTY", "UNIT", "UNIT", "B_NAME_TOK"];
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
      ingredient_amount_factory({ quantity: "1", unit: "can", text: "1 can", confidence: 0, starting_index: 0 }),
      ingredient_amount_factory({
        quantity: "15",
        unit: "ounce",
        text: "15 ounces",
        confidence: 0,
        starting_index: 0,
        SINGULAR: true,
      }),
    ];

    const output = p._sizeable_unit_pattern(labelled_tokens);
    expect(output.length).toBe(expected.length);
    for (const [i, out] of output.entries()) {
      const exp = expected[i]!;
      expect(out.quantity).toEqual(exp.quantity);
      expect(out.unit).toEqual(exp.unit);
      expect(out.text).toBe(exp.text);
      expect(out.starting_index).toBe(exp.starting_index);
      expect(out.SINGULAR).toBe(exp.SINGULAR);
      expect(out.APPROXIMATE).toBe(exp.APPROXIMATE);
    }
  });

  it("test_no_count_pattern_non_container_end", () => {
    // Test that [QTY, UNIT, UNIT] does not match when the end unit is not
    // in the end_units list (e.g., "cup" is not a container).
    const sentence = "15 ounce cup chickpeas";
    const tokens = ["15", "ounce", "cup", "chickpeas"];
    const pos_tags = ["CD", "NN", "NN", "NNS"];
    const labels = ["QTY", "UNIT", "UNIT", "B_NAME_TOK"];
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

    expect(p._sizeable_unit_pattern(labelled_tokens)).toEqual([]);
  });
});
