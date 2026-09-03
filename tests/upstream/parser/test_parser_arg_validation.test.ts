// Verbatim conversion of ip-repo/tests/parser/test_parser_arg_validation.py @ ffd6ae3 (3 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect, vi } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';

describe("TestParserArgumentValidation", () => {
  it("test_unsupported_language", () => {
    // Test that a ValueError is raised when an unsupported language is specified
    // Python: ValueError
    expect(() => parse_ingredient("1 apple", { lang: "es" })).toThrow(/Unsupported language/);
  });

  it("test_imperial_units_warning", () => {
    // Test that a DeprecationWarning is raised when imperial_units argument is
    // specified.
    // Python: DeprecationWarning (the port emits deprecations through console.warn)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    parse_ingredient("1 apple", { imperial_units: true });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/imperial_units=True argument is deprecated./),
    );
    warn.mockRestore();
  });

  it("test_unsupported_volumetric_units_system", () => {
    // Test that a ValueError is raised when an unsupported volumetric units system is
    // specified.
    // Python: ValueError
    expect(() => parse_ingredient("1 apple", { volumetric_units_system: "uk" })).toThrow(
      /Unsupported volumetric_units_system/,
    );
  });
});
