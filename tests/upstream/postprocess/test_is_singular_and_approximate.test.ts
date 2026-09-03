// Verbatim conversion of ip-repo/tests/postprocess/test_is_singular_and_approximate.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

describe("TestPostProcessor_is_singular_and_approximate", () => {
  it("test_is_singular_and_approximate", () => {
    // Test that QTY at index is indicated as approximate and singular
    const sentence = "each nearly 2 kg";
    const tokens = ["each", "nearly", "2", "kg"];
    const pos_tags = ["DT", "RB", "CD", "NN"];
    const labels = ["COMMENT", "COMMENT", "QTY", "UNIT"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_singular_and_approximate(2, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([1, 0]);
  });

  it("test_is_singular_and_approximate_or_so", () => {
    // Test that QTY at index is indicated as approximate and singular
    const sentence = "2 kg or so each";
    const tokens = ["2", "kg", "or", "so", "each"];
    const pos_tags = ["CD", "ND", "CC", "RB", "DT"];
    const labels = ["QTY", "UNIT", "COMMENT", "COMMENT", "COMMENT"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_singular_and_approximate(1, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([2, 3, 4]);
  });

  it("test_not_singular_and_approximate", () => {
    // Test that QTY at index is not indicated as approximate and singular
    const sentence = "both about 2 kg";
    const tokens = ["both", "about", "2", "kg"];
    const pos_tags = ["DT", "IN", "CD", "NNS"];
    const labels = ["COMMENT", "COMMENT", "QTY", "UNIT"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_singular_and_approximate(2, labelled_tokens)).toBe(false);
    expect(p.consumed).toEqual([]);
  });
});
