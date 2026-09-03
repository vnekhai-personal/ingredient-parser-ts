// Verbatim conversion of ip-repo/tests/postprocess/test_is_prepared.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

describe("TestPostProcessor_is_prepared", () => {
  it("test_is_prepared_to_make", () => {
    // Test that QTY at index is indicated as prepared
    const sentence = "to make 5 cups orange juice";
    const tokens = ["to", "make", "5", "cups", "orange", "juice"];
    const pos_tags = ["TO", "VB", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "COMMENT", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_prepared(2, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([1, 0]);
  });

  it("test_is_prepared_to_yield", () => {
    // Test that QTY at index is indicated as prepared
    const sentence = "to yield 5 cups orange juice";
    const tokens = ["to", "yield", "5", "cups", "orange", "juice"];
    const pos_tags = ["TO", "VB", "CD", "NNS", "NN", "NN"];
    const labels = ["COMMENT", "COMMENT", "QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_prepared(2, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([1, 0]);
  });

  it("test_is_prepared_and_approximate", () => {
    // Test that QTY at index is indicated as prepared and approximate
    const sentence = "to yield about 250 g";
    const tokens = ["to", "yield", "about", "250", "g"];
    const pos_tags = ["TO", "VB", "RB", "CD", "NNS"];
    const labels = ["COMMENT", "COMMENT", "COMMENT", "QTY", "UNIT"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_prepared(3, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([1, 0]);
  });
});
