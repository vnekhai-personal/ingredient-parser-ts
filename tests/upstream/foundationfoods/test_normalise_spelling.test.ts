// Verbatim conversion of ip-repo/tests/foundationfoods/test_normalise_spelling.py @ ffd6ae3 (4 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { IngredientToken } from '../../../src/en/foundationfoods/_ff_dataclasses.js';
import { normalise_spelling } from '../../../src/en/foundationfoods/_ff_utils.js';

// CONVERSION NOTE: upstream's IngredientToken is a NamedTuple built positionally,
// `IngredientToken(t, p)`. It is a record type, so the README's dataclass rule (one object
// of the fields) is applied: `new IngredientToken({ token: t, pos_tag: p })`.

describe("TestNormaliseSpelling", () => {
  it("test_phrase", () => {
    // Test "double cream" is normalised to "heavy cream"
    const tokens = ["doubl", "cream"];
    const pos_tags = ["", ""];
    const ing_tokens = tokens.map((t, i) => new IngredientToken({ token: t, pos_tag: pos_tags[i] }));
    const normalised_tokens = normalise_spelling(ing_tokens);
    expect(tokens.length).toBe(normalised_tokens.length);
    expect(normalised_tokens.map((t) => t.token)).toEqual(["heavi", "cream"]);
  });

  it("test_token_chilli", () => {
    // Test "chilli" is normalised to "chili"
    const tokens = ["red", "hot", "chilli"];
    const pos_tags = ["", "", ""];
    const ing_tokens = tokens.map((t, i) => new IngredientToken({ token: t, pos_tag: pos_tags[i] }));
    const normalised_tokens = normalise_spelling(ing_tokens);
    expect(tokens.length).toBe(normalised_tokens.length);
    expect(normalised_tokens.map((t) => t.token)).toEqual(["red", "hot", "chili"]);
  });

  it("test_token_chile", () => {
    // Test "chile" is normalised to "chili"
    const tokens = ["red", "hot", "chile"];
    const pos_tags = ["", "", ""];
    const ing_tokens = tokens.map((t, i) => new IngredientToken({ token: t, pos_tag: pos_tags[i] }));
    const normalised_tokens = normalise_spelling(ing_tokens);
    expect(tokens.length).toBe(normalised_tokens.length);
    expect(normalised_tokens.map((t) => t.token)).toEqual(["red", "hot", "chili"]);
  });

  it("test_token_rocket", () => {
    // Test "rocket" is normalised to "arugula"
    const tokens = ["rocket"];
    const pos_tags = [""];
    const ing_tokens = tokens.map((t, i) => new IngredientToken({ token: t, pos_tag: pos_tags[i] }));
    const normalised_tokens = normalise_spelling(ing_tokens);
    expect(tokens.length).toBe(normalised_tokens.length);
    expect(normalised_tokens.map((t) => t.token)).toEqual(["arugula"]);
  });
});
