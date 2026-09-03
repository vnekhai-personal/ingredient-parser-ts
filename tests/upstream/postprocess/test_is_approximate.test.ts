// Verbatim conversion of ip-repo/tests/postprocess/test_is_approximate.py @ ffd6ae3 (9 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

describe("TestPostProcessor_is_approximate", () => {
  it("test_is_approximate_about", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "about 5 cups orange juice";
    const tokens = ["about", "5", "cups", "orange", "juice"];
    const pos_tags = ["IN", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(1, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([0]);
  });

  it("test_is_approximate_approx_period", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "approx. 5 cups orange juice";
    const tokens = ["approx", ".", "5", "cups", "orange", "juice"];
    const pos_tags = ["NN", ".", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "PUNC", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(2, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([1, 0]);
  });

  it("test_is_approximate_approx", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "approx 5 cups orange juice";
    const tokens = ["approx", "5", "cups", "orange", "juice"];
    const pos_tags = ["RB", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(1, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([0]);
  });

  it("test_is_approximate_approximately", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "approximately 5 cups orange juice";
    const tokens = ["approximately", "5", "cups", "orange", "juice"];
    const pos_tags = ["RB", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(1, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([0]);
  });

  it("test_is_approximate_nearly", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "nearly 5 cups orange juice";
    const tokens = ["nearly", "5", "cups", "orange", "juice"];
    const pos_tags = ["RB", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(1, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([0]);
  });

  it("test_is_approximate_generous", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "6 generous cups orange juice";
    const tokens = ["6", "generous", "cups", "orange", "juice"];
    const pos_tags = ["CD", "JJ", "NNS", "NN", "NN"];
    const labels = ["QTY", "UNIT", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(2, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([1]);
  });

  it("test_is_approximate_or_so_quantity", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "48 or so small black and green olives";
    const tokens = ["48", "or", "so", "small", "black", "and", "green", "olives"];
    const pos_tags = ["CD", "CC", "RB", "JJ", "JJ", "CC", "JJ", "NNS"];
    const labels = [
      "QTY",
      "COMMENT",
      "COMMENT",
      "SIZE",
      "NAME_VAR",
      "NAME_SEP",
      "NAME_VAR",
      "B_NAME_TOK",
    ];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(0, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([1, 2]);
  });

  it("test_is_approximate_or_so_unit", () => {
    // Test that QTY at index is indicated as approximate
    const sentence = "2/3 cup or so low-fat milk";
    const tokens = ["#2$3", "cup", "or", "so", "low-fat", "milk"];
    const pos_tags = ["CD", "NN", "CC", "RB", "JJ", "NN"];
    const labels = ["QTY", "UNIT", "COMMENT", "COMMENT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(1, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([2, 3]);
  });

  it("test_not_approximate", () => {
    // Test that QTY at index is not indicated as approximate
    const sentence = "maximum 5 cups orange juice";
    const tokens = ["maximum", "5", "cups", "orange", "juice"];
    const pos_tags = ["JJ", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_approximate(1, labelled_tokens)).toBe(false);
    expect(p.consumed).toEqual([]);
  });
});
