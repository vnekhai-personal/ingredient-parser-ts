// Verbatim conversion of ip-repo/tests/foundationfoods/test_strip_ambiguous_leading_adjectives.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { IngredientToken } from '../../../src/en/foundationfoods/_ff_dataclasses.js';
import { strip_ambiguous_leading_adjectives } from '../../../src/en/foundationfoods/_ff_utils.js';

// CONVERSION NOTE: upstream's IngredientToken is a NamedTuple built positionally,
// `IngredientToken(t, p)`. It is a record type, so the README's dataclass rule (one object
// of the fields) is applied: `new IngredientToken({ token: t, pos_tag: p })`.

describe("TestStripAmbiguousLeadingAdjectievs", () => {
  it("test_leading_ambiguous_adjective", () => {
    // Test that "hot" is stripped from the start of tokens.
    const tokens = ["hot", "chicken", "stock"];
    const pos_tags = ["JJ", "NN", "NN"];
    const ing_tokens = tokens.map((t, i) => new IngredientToken({ token: t, pos_tag: pos_tags[i] }));
    expect(strip_ambiguous_leading_adjectives(ing_tokens)).toEqual(ing_tokens.slice(1));
  });

  it("test_ambiguous_adjective_but_not_first", () => {
    // Test that "hot" is not removed from okens.
    const tokens = ["red", "hot", "chilli"];
    const pos_tags = ["JJ", "JJ", "NN"];
    const ing_tokens = tokens.map((t, i) => new IngredientToken({ token: t, pos_tag: pos_tags[i] }));
    expect(strip_ambiguous_leading_adjectives(ing_tokens)).toEqual(ing_tokens);
  });

  it("test_all_ambiguous_adjectives", () => {
    // Test that the input tokens are returned because they are all ambiguous
    // adjectives.
    const tokens = ["hot", "hot", "hot"];
    const pos_tags = ["JJ", "JJ", "JJ"];
    const ing_tokens = tokens.map((t, i) => new IngredientToken({ token: t, pos_tag: pos_tags[i] }));
    expect(strip_ambiguous_leading_adjectives(ing_tokens)).toEqual(ing_tokens);
  });
});
