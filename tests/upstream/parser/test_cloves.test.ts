// Verbatim conversion of ip-repo/tests/parser/test_cloves.py @ ffd6ae3 (6 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';

describe("TestParser_cloves", () => {
  // Cloves can be a unit or an ingredient, but the parser struggled to get it right.

  it("test_clove_ingredient_singular", () => {
    // "clove" is marked as a name
    const parsed = parse_ingredient("1 clove");

    expect(parsed.name[0].text).toContain("clove");
    expect(String(parsed.amount[0].unit)).not.toContain("clove");
  });

  it("test_clove_ingredient_plural", () => {
    // "cloves" is marked as a name
    const parsed = parse_ingredient("1 tsp cloves");

    expect(parsed.name[0].text).toContain("cloves");
    expect(String(parsed.amount[0].unit)).not.toBe("cloves");
  });

  it("test_clove_unit_singular", () => {
    // "clove" is marked as a unit
    const parsed = parse_ingredient("1 garlic clove");

    expect(parsed.name[0].text).not.toContain("clove");
    expect(String(parsed.amount[0].unit)).toContain("clove");
  });

  it("test_clove_unit_singular_switched_order", () => {
    // "clove" is marked as a unit
    const parsed = parse_ingredient("1 clove garlic");

    expect(parsed.name[0].text).not.toContain("clove");
    expect(String(parsed.amount[0].unit)).toContain("clove");
  });

  it("test_clove_unit_plural", () => {
    // "cloves" is marked as a unit
    const parsed = parse_ingredient("2 garlic cloves");

    expect(parsed.name[0].text).not.toContain("cloves");
    expect(String(parsed.amount[0].unit)).toContain("cloves");
  });

  it("test_clove_unit_plural_switched_order", () => {
    // "cloves" is marked as a unit
    const parsed = parse_ingredient("2 cloves garlic");

    expect(parsed.name[0].text).not.toContain("cloves");
    expect(String(parsed.amount[0].unit)).toContain("cloves");
  });
});
