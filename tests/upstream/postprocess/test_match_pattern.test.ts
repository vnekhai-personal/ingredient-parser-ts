// Verbatim conversion of ip-repo/tests/postprocess/test_match_pattern.py @ ffd6ae3 (8 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import { LabelledToken } from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";

describe("TestPostProcessor_match_pattern", () => {
  it("test_long_pattern_match", () => {
    // Test that correct start and stop indices are returned for long pattern
    const pattern = ["QTY", "QTY", "UNIT", "QTY", "UNIT", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "UNIT",
      "QTY",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: true })).toEqual([
      [2, 3, 4, 5, 6, 7, 8, 9],
    ]);
  });

  it("test_medium_pattern_match", () => {
    // Test that correct start and stop indices are returned for medium pattern
    const pattern = ["QTY", "QTY", "UNIT", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "QTY",
      "UNIT",
      "QTY",
      "UNIT",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: true })).toEqual([
      [0, 1, 2, 3, 4, 5],
    ]);
  });

  it("test_short_pattern_match", () => {
    // Test that correct start and stop indices are returned for long pattern
    const pattern = ["QTY", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "UNIT",
      "QTY",
      "QTY",
      "UNIT",
      "UNIT",
      "QTY",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: true })).toEqual([
      [2, 3, 4, 5],
    ]);
  });

  it("test_impossible_match", () => {
    // Test that empty list is returned when match is impossible beacause pattern
    // is longer than list of labels
    const pattern = ["QTY", "QTY", "UNIT", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "QTY",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: true })).toEqual([]);
  });

  it("test_multiple_non_consecutive_matches", () => {
    // Test that multiple non-overlapping matches are returned
    const pattern = ["QTY", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "QTY",
      "UNIT",
      "UNIT",
      "QTY",
      "QTY",
      "QTY",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: true })).toEqual([
      [0, 1, 2, 3],
      [5, 6, 7, 8],
    ]);
  });

  it("test_multiple_consecutive_matches", () => {
    // Test that multiple consecutive non-overlapping matches are returned
    const pattern = ["QTY", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "QTY",
      "UNIT",
      "UNIT",
      "QTY",
      "QTY",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: true })).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });

  it("test_interrupted_pattern_without_ignore", () => {
    // Test that an interrupted pattern is not matched if ignore_other_labels set False
    const pattern = ["QTY", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "QTY",
      "COMMENT",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: false })).toEqual([]);
  });

  it("test_interrupted_pattern_with_ignore", () => {
    // Test that an interrupted pattern is matched if ignore_other_labels set True
    const pattern = ["QTY", "QTY", "UNIT", "UNIT"];

    const token_labels = [
      "QTY",
      "QTY",
      "COMMENT",
      "UNIT",
      "UNIT",
    ];
    const labelled_tokens = token_labels.map(
      (label, i) =>
        new LabelledToken({
          index: i,
          text: "",
          pos_tag: "",
          label,
          score: 0,
          plural: false,
        }),
    );
    const p = new PostProcessor("", [], { custom_units: {} });

    expect(p._match_pattern(labelled_tokens, pattern, { ignore_other_labels: true })).toEqual([
      [0, 1, 3, 4],
    ]);
  });
});
