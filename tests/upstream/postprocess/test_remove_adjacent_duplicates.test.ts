// Verbatim conversion of ip-repo/tests/postprocess/test_remove_adjacent_duplicates.py @ ffd6ae3 (2 tests).
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

describe("TestPostProcessor_remove_adjacent_duplicates", () => {
  it("test_adjacent_duplicate", () => {
    // Test that index of second "finely" is not returned
    const p = p_fixture();
    const input_list = ["finely", "finely", "chopped"];
    expect(p._remove_adjacent_duplicates(input_list)).toEqual([1, 2]);
  });

  it("test_non_adjacent_duplicate", () => {
    // Test that index of non-adjacent duplicate is returned
    const p = p_fixture();
    const input_list = ["finely", "chopped", "finely"];
    expect(p._remove_adjacent_duplicates(input_list)).toEqual([0, 1, 2]);
  });
});
