// Verbatim conversion of ip-repo/tests/preprocess/test_singlarise_units.py @ ffd6ae3 (5 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { PreProcessor } from "../../../src/en/index.js";

describe("TestPreProcessor_singlarise_units", () => {
  it("test_embedded", () => {
    // The unit "cups" is replaced with "cup"
    const p = new PreProcessor("2.5 cups beer", { custom_units: {} });
    expect(p.tokenized_sentence.map((t) => t.text)).toEqual(["2.5", "cup", "beer"]);
    expect(p.singularised_indices).toEqual([1]);
  });

  it("test_capitalised", () => {
    // The unit "Boxes" is replaced with "Box", with the capitalisation maintained
    const p = new PreProcessor("2.5 Boxes Candy", { custom_units: {} });
    expect(p.tokenized_sentence.map((t) => t.text)).toEqual(["2.5", "Box", "Candy"]);
    expect(p.singularised_indices).toEqual([1]);
  });

  it("test_start", () => {
    // The unit "leaves" is replaced with "leaf"
    const p = new PreProcessor("leaves of basil", { custom_units: {} });
    expect(p.tokenized_sentence.map((t) => t.text)).toEqual(["leaf", "of", "basil"]);
    expect(p.singularised_indices).toEqual([0]);
  });

  it("test_start_capitalised", () => {
    // The unit "wedges" is replaced with "wedge", with the capitalisation maintained
    const p = new PreProcessor("Wedges of lemon", { custom_units: {} });
    expect(p.tokenized_sentence.map((t) => t.text)).toEqual(["Wedge", "of", "lemon"]);
    expect(p.singularised_indices).toEqual([0]);
  });

  it("test_multiple_units", () => {
    // The units "tablespoons" and "teaspoons" are replaced with "tablespoon" and
    // "teaspoon" respectively
    const p = new PreProcessor("2 tablespoons plus 2 teaspoons", { custom_units: {} });
    expect(p.tokenized_sentence.map((t) => t.text)).toEqual([
      "2",
      "tablespoon",
      "plus",
      "2",
      "teaspoon",
    ]);
    expect(p.singularised_indices).toEqual([1, 4]);
  });
});
