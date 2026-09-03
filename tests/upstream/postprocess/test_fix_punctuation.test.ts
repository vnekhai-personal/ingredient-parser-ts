// Verbatim conversion of ip-repo/tests/postprocess/test_fix_punctuation.py @ ffd6ae3 (7 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

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

describe("TestPostProcessor_fix_punctuation", () => {
  it("test_space_following_open_parens", () => {
    // Test space following open parenthesis is removed
    const p = p_fixture();
    const input_sentence = "finely chopped ( diced)";
    expect(p._fix_punctuation(input_sentence)).toBe("finely chopped (diced)");
  });

  it("test_space_leading_close_parens", () => {
    // Test space before close parenthesis is removed
    const p = p_fixture();
    const input_sentence = "finely chopped (diced )";
    expect(p._fix_punctuation(input_sentence)).toBe("finely chopped (diced)");
  });

  it("test_multiple_space_before_comma", () => {
    // Test space before punctuation in middle of sentence is removed
    const p = p_fixture();
    const input_sentence = "finely chopped , diced";
    expect(p._fix_punctuation(input_sentence)).toBe("finely chopped, diced");
  });

  it("test_multiple_space_before_semicolon", () => {
    // Test space before punctuation in middle of sentence is removed
    const p = p_fixture();
    const input_sentence = "finely chopped ; diced";
    expect(p._fix_punctuation(input_sentence)).toBe("finely chopped; diced");
  });

  it("test_space_before_full_stop", () => {
    // Test space before punctuation in middle of sentence is removed
    const p = p_fixture();
    const input_sentence = "finely chopped .";
    expect(p._fix_punctuation(input_sentence)).toBe("finely chopped.");
  });

  it("test_space_before_question_mark", () => {
    // Test space before punctuation in middle of sentence is removed
    const p = p_fixture();
    const input_sentence = "finely chopped !";
    expect(p._fix_punctuation(input_sentence)).toBe("finely chopped!");
  });

  it("test_space_before_asterisk", () => {
    // Test space before asterisk is removed
    const p = p_fixture();
    const input_sentence = "chopped *";
    expect(p._fix_punctuation(input_sentence)).toBe("chopped*");
  });
});
