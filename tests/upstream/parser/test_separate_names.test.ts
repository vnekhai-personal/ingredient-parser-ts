// Verbatim conversion of ip-repo/tests/parser/test_separate_names.py @ ffd6ae3 (2 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';

describe("Test_separate_names", () => {
  it("test_separate_names", () => {
    // Test that the two ingredient names are returned.
    const sentence = "200 ml beef or chicken stock";
    const parsed = parse_ingredient(sentence, { separate_names: true });
    expect(parsed.name.length).toBe(2);
  });

  it("test_not_separate_names", () => {
    // Test that the one ingredient name is returned.
    const sentence = "200 ml beef of chicken stock";
    const parsed = parse_ingredient(sentence, { separate_names: false });
    expect(parsed.name.length).toBe(1);
  });
});
