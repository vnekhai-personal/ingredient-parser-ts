// Verbatim conversion of ip-repo/tests/parser/test_custom_units.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';

describe("TestParser_custom_units", () => {
  it("test_unrecognised_units", () => {
    // Test that the word "brillig" is not identified as a unit.
    const p = parse_ingredient("2 brillig sausages");
    expect(String(p.amount[0].unit)).toBe("");
    expect(p.amount[0].text).toBe("2");
  });

  it("test_custom_units", () => {
    // Test that brillig is recognised as a unit when provided as part of a custom
    // units dict.
    const p = parse_ingredient("2 brillig sausages", { custom_units: { brilligs: "brillig" } });
    expect(String(p.amount[0].unit)).toBe("brilligs");
    expect(p.amount[0].text).toBe("2 brilligs");
  });

  it("test_custom_unit_capitalised", () => {
    // Test that Brillig is recognised as a unit when provided as part of a custom
    // units dict, even though the capitalized version is not present in the custom
    // units dict.
    const p = parse_ingredient("2 Brillig sausages", { custom_units: { brilligs: "brillig" } });
    expect(String(p.amount[0].unit)).toBe("Brilligs");
    expect(p.amount[0].text).toBe("2 Brilligs");
  });
});
