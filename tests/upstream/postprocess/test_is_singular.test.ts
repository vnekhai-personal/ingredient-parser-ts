// Verbatim conversion of ip-repo/tests/postprocess/test_is_singular.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

describe("TestPostProcessor_is_singular", () => {
  it("test_is_singular", () => {
    // Test that UNIT at index is indicated as singular
    const sentence = "4 salmon fillets 2 pounds each";
    const tokens = ["4", "salmon", "fillets", "2", "pounds", "each"];
    const pos_tags = ["CD", "JJ", "NNS", "CD", "NNS", "DT"];
    const labels = ["QTY", "B_NAME_TOK", "I_NAME_TOK", "QTY", "UNIT", "COMMENT"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_singular(4, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([5]);
  });

  it("test_is_singular_in_brackets", () => {
    // Test that UNIT at index is indicated as singular
    const sentence = "4 salmon fillets 2 pounds (900 g) each";
    const tokens = ["4", "salmon", "fillets", "2", "pounds", "(", "900", "g", ")", "each"];
    const pos_tags = ["CD", "JJ", "NNS", "CD", "NNS", "(", "CD", "NN", ")", "DT"];
    const labels = [
      "QTY",
      "B_NAME_TOK",
      "I_NAME_TOK",
      "QTY",
      "UNIT",
      "COMMENT",
      "QTY",
      "UNIT",
      "COMMENT",
      "COMMENT",
    ];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_singular(7, labelled_tokens)).toBe(true);
    expect(p.consumed).toEqual([9]);
  });

  it("test_not_singular", () => {
    // Test that UNIT at index is not indicated as singular
    const sentence = "4 salmon fillets 2 pounds minimum";
    const tokens = ["4", "salmon", "fillets", "2", "pounds", "minimum"];
    const pos_tags = ["CD", "JJ", "NNS", "CD", "NNS", "JJ"];
    const labels = ["QTY", "B_NAME_TOK", "I_NAME_TOK", "QTY", "UNIT", "COMMENT"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    expect(p._is_singular(4, labelled_tokens)).toBe(false);
    expect(p.consumed).toEqual([]);
  });
});
