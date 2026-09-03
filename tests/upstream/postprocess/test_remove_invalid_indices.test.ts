// Verbatim conversion of ip-repo/tests/postprocess/test_remove_invalid_indices.py @ ffd6ae3 (5 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

/** Define a PostProcessor object to use for testing the PostProcessor
 * class methods.
 */
function p_fixture() {
  const sentence = "2, 14 ounce cans coconut milk: opened (not chilled)";
  const tokens = [
    "2",
    ",",
    "14",
    "ounce",
    "can",
    "coconut",
    "milk",
    ":",
    "opened",
    "(",
    "not",
    "chilled",
    ")",
  ];
  const pos_tags = [
    "CD",
    ",",
    "CD",
    "NN",
    "MD",
    "VB",
    "NN",
    ":",
    "VBN",
    "(",
    "RB",
    "VBN",
    ")",
  ];
  const labels = [
    "QTY",
    "PUNC",
    "QTY",
    "UNIT",
    "UNIT",
    "B_NAME_TOK",
    "I_NAME_TOK",
    "PUNC",
    "PREP",
    "PUNC",
    "COMMENT",
    "COMMENT",
    "PUNC",
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: 0,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
}

describe("TestPostProcessor_fix_punctuation", () => {
  it("test_leading_punctuation", () => {
    // Test index of starting punctuation is removed.
    const p = p_fixture();
    expect(p._remove_invalid_indices([1, 2, 3])).toEqual([2, 3]);
  });

  it("test_trailing_punctuation", () => {
    // Test index of tailing punctuation is removed.
    const p = p_fixture();
    expect(p._remove_invalid_indices([5, 6, 7])).toEqual([5, 6]);
  });

  it("test_open_parenthesis", () => {
    // Test index of open parenthesis is removed.
    const p = p_fixture();
    expect(p._remove_invalid_indices([8, 9, 10, 11])).toEqual([8, 10, 11]);
  });

  it("test_close_parenthesis", () => {
    // Test index of close parenthesis is removed.
    const p = p_fixture();
    expect(p._remove_invalid_indices([10, 11, 12])).toEqual([10, 11]);
  });

  it("test_valid_parenthesis", () => {
    // Test no indices are removed.
    const p = p_fixture();
    expect(p._remove_invalid_indices([8, 9, 10, 11, 12])).toEqual([8, 9, 10, 11, 12]);
  });
});
