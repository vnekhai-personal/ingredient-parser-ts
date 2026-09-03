// Verbatim conversion of ip-repo/tests/postprocess/test_distribute_related_flags.py @ ffd6ae3 (6 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";
import { _PartialIngredientAmount } from "../../../src/en/postprocess.js";

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

// CONVERSION NOTE: upstream constructs _PartialIngredientAmount positionally
// ("", [""], [0], 0, ...). It is a dataclass, so per the README it takes one object of
// its fields; the positional values are mapped onto quantity, unit, confidence,
// starting_index in upstream order.

describe("TestPostProcessor_distribute_related_flags", () => {
  it("test_distribute_approximate", () => {
    // Test that all amounts get the APPROXIMATE flag set to True
    const p = p_fixture();
    const amounts = [
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, APPROXIMATE: true }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, related_to_previous: true }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, related_to_previous: true }),
    ];
    const outputs = p._distribute_related_flags(amounts);
    const approximate_flags = outputs.map((am) => am.APPROXIMATE);
    const singular_flags = outputs.map((am) => am.SINGULAR);

    expect(approximate_flags.every(Boolean)).toBe(true);
    expect(singular_flags.every(Boolean)).toBe(false);
  });

  it("test_distribute_singular", () => {
    // Test that all amounts get the SINGULAR flag set to True
    const p = p_fixture();
    const amounts = [
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0 }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, related_to_previous: true }),
      new _PartialIngredientAmount({
        quantity: "",
        unit: [""],
        confidence: [0],
        starting_index: 0,
        related_to_previous: true,
        SINGULAR: true,
      }),
    ];
    const outputs = p._distribute_related_flags(amounts);
    const approximate_flags = outputs.map((am) => am.APPROXIMATE);
    const singular_flags = outputs.map((am) => am.SINGULAR);

    expect(approximate_flags.every(Boolean)).toBe(false);
    expect(singular_flags.every(Boolean)).toBe(true);
  });

  it("test_no_distribute", () => {
    // Test that all amounts get the SINGULAR flag set to True
    const p = p_fixture();
    const amounts = [
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, APPROXIMATE: true }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0 }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, SINGULAR: true }),
    ];
    const outputs = p._distribute_related_flags(amounts);

    expect(outputs.map((a) => a.APPROXIMATE)).toEqual([true, false, false]);
    expect(outputs.map((a) => a.SINGULAR)).toEqual([false, false, true]);
  });

  it("test_mixed_distribute", () => {
    // Test that all amounts get the SINGULAR flag set to True
    const p = p_fixture();
    const amounts = [
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0 }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, APPROXIMATE: true }),
      new _PartialIngredientAmount({
        quantity: "",
        unit: [""],
        confidence: [0],
        starting_index: 0,
        related_to_previous: true,
        SINGULAR: true,
      }),
    ];
    const outputs = p._distribute_related_flags(amounts);

    expect(outputs.map((a) => a.APPROXIMATE)).toEqual([false, true, true]);
    expect(outputs.map((a) => a.SINGULAR)).toEqual([false, true, true]);
  });

  it("test_singular_after_multiplier", () => {
    // Test that all related amounts after the amount with a multiplier quantity
    // (i.e. ends with "x") have SINGULAR set True.
    const p = p_fixture();
    const amounts = [
      new _PartialIngredientAmount({ quantity: "2x", unit: [""], confidence: [0], starting_index: 0 }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, related_to_previous: true }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, related_to_previous: true }),
    ];
    const outputs = p._distribute_related_flags(amounts);

    expect(outputs.map((a) => a.SINGULAR)).toEqual([false, true, true]);
  });

  it("test_singular_after_multiplier_only_related", () => {
    // Test that all related amounts after the amount with a multiplier quantity
    // (i.e. ends with "x") have SINGULAR set True.
    const p = p_fixture();
    const amounts = [
      new _PartialIngredientAmount({ quantity: "2x", unit: [""], confidence: [0], starting_index: 0 }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, related_to_previous: true }),
      new _PartialIngredientAmount({ quantity: "", unit: [""], confidence: [0], starting_index: 0, related_to_previous: false }),
    ];
    const outputs = p._distribute_related_flags(amounts);

    expect(outputs.map((a) => a.SINGULAR)).toEqual([false, true, false]);
  });
});
