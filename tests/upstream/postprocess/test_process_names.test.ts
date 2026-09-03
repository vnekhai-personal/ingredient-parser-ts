// Verbatim conversion of ip-repo/tests/postprocess/test_process_names.py @ ffd6ae3 (6 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { IngredientText, LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

describe("TestPostProcessor_postprocess_names", () => {
  it("test_single_name", () => {
    // Test that a list containing a single IngredientText object is returned
    const sentence = "2 14 ounce cans of coconut milk";
    const tokens = ["2", "14", "ounce", "can", "of", "coconut", "milk"];
    const pos_tags = ["CD", "CD", "NN", "MD", "IN", "NN", "NN"];
    const labels = ["QTY", "QTY", "UNIT", "UNIT", "COMMENT", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const expected = [
      new IngredientText({ text: "coconut milk", confidence: 0, starting_index: 5 }),
    ];

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    const [names] = p._postprocess_names();
    expect(names).toEqual(expected);
  });

  it("test_multiple_independent_names", () => {
    // Test that a list containing two IngredientText objects is returned
    const sentence = "2 tbsp butter or olive oil";
    const tokens = ["2", "tbsp", "butter", "or", "olive", "oil"];
    const pos_tags = ["CD", "JJ", "NN", "CC", "JJ", "NN"];
    const labels = ["QTY", "UNIT", "B_NAME_TOK", "NAME_SEP", "B_NAME_TOK", "I_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const expected = [
      new IngredientText({ text: "butter", confidence: 0, starting_index: 2 }),
      new IngredientText({ text: "olive oil", confidence: 0, starting_index: 4 }),
    ];

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    const [names] = p._postprocess_names();
    expect(names).toEqual(expected);
  });

  it("test_multiple_variant_names", () => {
    // Test that a list containing two IngredientText objects is returned
    const sentence = "2 cups beef or vegetable stock";
    const tokens = ["2", "cup", "beef", "or", "vegetable", "stock"];
    const pos_tags = ["CD", "NN", "NN", "CC", "JJ", "NN"];
    const labels = ["QTY", "UNIT", "NAME_VAR", "NAME_SEP", "NAME_VAR", "B_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const expected = [
      new IngredientText({ text: "beef stock", confidence: 0, starting_index: 2 }),
      new IngredientText({ text: "vegetable stock", confidence: 0, starting_index: 4 }),
    ];

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    const [names] = p._postprocess_names();
    expect(names).toEqual(expected);
  });

  it("test_multiple_modified_names", () => {
    // Test that a list containing two IngredientText objects is returned
    const sentence = "1 handful of fresh basil or coriander";
    const tokens = ["1", "handful", "of", "fresh", "basil", "or", "coriander"];
    const pos_tags = ["CD", "NN", "IN", "JJ", "NN", "CC", "NN"];
    const labels = [
      "QTY",
      "UNIT",
      "COMMENT",
      "NAME_MOD",
      "B_NAME_TOK",
      "NAME_SEP",
      "B_NAME_TOK",
    ];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const expected = [
      new IngredientText({ text: "fresh basil", confidence: 0, starting_index: 3 }),
      new IngredientText({ text: "fresh coriander", confidence: 0, starting_index: 3 }),
    ];

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    const [names] = p._postprocess_names();
    expect(names).toEqual(expected);
  });

  it("test_multiple_modified_variant_names", () => {
    // Test that a list containing two IngredientText objects is returned
    const sentence = "2 cups hot beef or vegetable stock";
    const tokens = ["2", "cup", "hot", "beef", "or", "vegetable", "stock"];
    const pos_tags = ["CD", "NN", "JJ", "NN", "CC", "JJ", "NN"];
    const labels = [
      "QTY",
      "UNIT",
      "NAME_MOD",
      "NAME_VAR",
      "NAME_SEP",
      "NAME_VAR",
      "B_NAME_TOK",
    ];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const expected = [
      new IngredientText({ text: "hot beef stock", confidence: 0, starting_index: 2 }),
      new IngredientText({ text: "hot vegetable stock", confidence: 0, starting_index: 2 }),
    ];

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    const [names] = p._postprocess_names();
    expect(names).toEqual(expected);
  });

  it("test_deuplicate_ingredient_names", () => {
    // Test that a list containing one IngredientText objects is returned
    const sentence = "1/2 cup sugar plus 1 1/2 tablespoons sugar";
    const tokens = ["#1$2", "cup", "sugar", "plus", "1#1$2", "tablespoon", "sugar"];
    const pos_tags = ["CD", "NN", "NN", "CC", "CD", "NN", "NN"];
    const labels = ["QTY", "UNIT", "B_NAME_TOK", "COMMENT", "QTY", "UNIT", "B_NAME_TOK"];
    const labelled_tokens = tokens.map(
      (text, i) =>
        new LabelledToken({ index: i, text, pos_tag: pos_tags[i]!, label: labels[i]!, score: 0, plural: false }),
    );

    const expected = [
      new IngredientText({ text: "sugar", confidence: 0, starting_index: 2 }),
    ];

    const p = new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
    const [names] = p._postprocess_names();
    expect(names).toEqual(expected);
  });
});
