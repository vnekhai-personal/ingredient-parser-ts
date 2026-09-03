// Verbatim conversion of ip-repo/tests/test_common.py @ ffd6ae3 (14 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.

import { describe, it, expect } from "vitest";

import {
  consume,
  group_consecutive_idx,
  is_float,
  is_range,
  show_model_card,
} from "../../src/_common.js";

// CONVERSION NOTE: Python `iter(range(0, 10))` / `next(it)` is mapped to a JS generator
// and `it.next().value`. A `pytest.raises(StopIteration)` after the iterator has been
// fully consumed maps to `expect(it.next().done).toBe(true)`: JS iterators signal
// exhaustion with `done: true` instead of raising.
function range_iter(start: number, stop: number): Generator<number, void, undefined> {
  return (function* () {
    for (let i = start; i < stop; i++) yield i;
  })();
}

describe("Test_consume", () => {
  it("test_conume", () => {
    // Test iterator advances by specified amount
    const it = range_iter(0, 10);
    expect(it.next().value).toBe(0);
    consume(it, 2);
    expect(it.next().value).toBe(3);
  });

  it("test_consume_all", () => {
    // Test iterator is consumed completely
    const it = range_iter(0, 10);
    expect(it.next().value).toBe(0);
    consume(it, null);
    // Python: StopIteration
    expect(it.next().done).toBe(true);
  });
});

describe("Test_is_float", () => {
  it("test_int", () => {
    // Test string "1" is correctly identified as convertable to float
    expect(is_float("1")).toBe(true);
  });

  it("test_float", () => {
    // Test string "2.5" is correctly identified as convertable to float
    expect(is_float("2.5")).toBe(true);
  });

  it("test_range", () => {
    // Test string "1-2" is correctly identified as not convertable to float
    expect(is_float("1-2")).toBe(false);
  });

  it("test_x", () => {
    // Test string "1x" is correctly identified as not convertable to float
    expect(is_float("1x")).toBe(false);
  });
});

describe("Test_is_range", () => {
  it("test_int", () => {
    // Test string "1" is correctly identified as not a range
    expect(is_range("1")).toBe(false);
  });

  it("test_float", () => {
    // Test string "2.5" is correctly identified as not a range
    expect(is_range("2.5")).toBe(false);
  });

  it("test_range", () => {
    // Test string "1-2" is correctly identified as not a range
    expect(is_range("1-2")).toBe(true);
  });

  it("test_range_extra", () => {
    // Test string "1-2 dozen" is correctly identified as not a range
    expect(is_range("1-2 dozen")).toBe(false);
  });

  it("test_x", () => {
    // Test string "1x" is correctly identified as not a range
    expect(is_range("1x")).toBe(false);
  });
});

describe("Test_group_consecutive_indices", () => {
  // CONVERSION NOTE: upstream `group_consecutive_idx` yields an iterator per group;
  // Python `[list(g) for g in groups]` maps to `[...groups].map((g) => [...g])`.
  it("test_single_group", () => {
    // Return single group
    const input_indices = [0, 1, 2, 3, 4];
    const groups = group_consecutive_idx(input_indices);
    expect([...groups].map((g) => [...g])).toEqual([input_indices]);
  });

  it("test_multiple_groups", () => {
    // Return groups of consecutive indices
    const input_indices = [0, 1, 2, 4, 5, 6, 8, 9];
    const groups = group_consecutive_idx(input_indices);
    expect([...groups].map((g) => [...g])).toEqual([
      [0, 1, 2],
      [4, 5, 6],
      [8, 9],
    ]);
  });
});

describe("Test_show_model_card", () => {
  // NOT PORTABLE: upstream patches `os.startfile` and `subprocess.call` with
  // `unittest.mock.patch` so that opening the model card (an OS-level action) is a no-op;
  // the port has no OS-level open to mock.
  it.skip("test_model_card_found", () => {
    // Test model card found at path derived from selected language.
    //
    // The calls to os.startfile and subprocess.call are mocked to prevent the model
    // card from actually opening.
    // Python: FileNotFoundError → pytest.fail("Model card not found.")
    expect(() => show_model_card("en")).not.toThrow();
  });
});
