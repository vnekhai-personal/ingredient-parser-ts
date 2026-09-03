// Verbatim conversion of ip-repo/tests/parser/test_expect_name_in_output.py @ ffd6ae3 (7 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from 'vitest';

import { parse_ingredient } from '../../../src/index.js';
import { guess_ingredient_name } from '../../../src/en/parser.js';

// CONVERSION NOTE: upstream builds the tagger with unittest.mock.MagicMock and sets
// `mock_tagger.marginal.side_effect = lambda label, idx: ...`. The port has no MagicMock;
// the most literal equivalent is a duck-typed object exposing the one method that
// guess_ingredient_name calls, `marginal(label, idx)`, with the same lookup semantics
// (`mock_marginals.get(idx, {}).get(label, 0.0)`).
function make_mock_tagger(mock_marginals: Record<number, Record<string, number>>) {
  return {
    marginal: (label: string, idx: number): number =>
      (mock_marginals[idx] ?? {})[label] ?? 0.0,
  };
}

describe("Test_expect_name_in_output", () => {
  // @pytest.mark.model_dependent
  it("test_enabled", () => {
    // Test that the return name is not []
    const sentence = "1 cup, plus 2 tablespoons olive oil";
    const parsed = parse_ingredient(sentence, { expect_name_in_output: true });
    expect(parsed.name).not.toEqual([]);
  });

  // @pytest.mark.model_dependent
  // PARITY-DELTA (model, docs/PORTING.md §3.2–2.4): the stock model labels "2 tablespoons olive oil"
  // COMMENT so no name exists; the ship model labels QTY UNIT B_NAME_TOK I_NAME_TOK and
  // Python with it returns name ["olive oil"], as the port does (verified 2026-09-02 with
  // models/brill-porter.json.gz and again with models/brill-porter-full.json.gz via
  // `training/dump-parsed.py --lines --options`). Expectation kept verbatim; it.fails asserts the delta.
  it.fails("test_disabled", () => {
    // Test that the returned name is []
    const sentence = "1 cup, plus 2 tablespoons olive oil";
    const parsed = parse_ingredient(sentence, { expect_name_in_output: false });
    expect(parsed.name).toEqual([]);
  });

  // @pytest.mark.model_dependent
  // PARITY-DELTA (model): same as test_disabled; Python with the ship model (both artifacts) returns ["olive oil"].
  it.fails("test_disabled_name_not_separate", () => {
    // Test that the returned name is [] when not separating names
    const sentence = "1 cup, plus 2 tablespoons olive oil";
    const parsed = parse_ingredient(sentence, {
      expect_name_in_output: false,
      separate_names: false,
    });
    expect(parsed.name).toEqual([]);
  });

  // @pytest.mark.model_dependent
  it("test_enabled_but_no_name", () => {
    // Test that the return name is None even though guess_name_fallback is enabled.
    const sentence = "2 tablespoons";
    const parsed = parse_ingredient(sentence, { expect_name_in_output: true });
    expect(parsed.name).toEqual([]);
  });
});

describe("Test_guess_ingredient_name", () => {
  it("test_simple", () => {
    // Test that the first COMMENT label gets converted to B_NAME_TOK and the second
    // COMMENT label gets converted to I_NAME_TOK.
    const labels = ["QTY", "UNIT", "COMMENT", "COMMENT"];
    const scores = [1.0, 1.0, 0.6, 0.5];

    const mock_marginals: Record<number, Record<string, number>> = {
      2: {
        B_NAME_TOK: 0.3,
        I_NAME_TOK: 0.0,
        NAME_SEP: 0.0,
        NAME_VAR: 0.05,
        NAME_MOD: 0.07,
      },
      3: {
        B_NAME_TOK: 0.02,
        I_NAME_TOK: 0.35,
        NAME_SEP: 0.0,
        NAME_VAR: 0.15,
        NAME_MOD: 0.02,
      },
    };
    const mock_tagger = make_mock_tagger(mock_marginals);

    const [new_labels, new_scores] = guess_ingredient_name(mock_tagger, labels, scores);
    expect(new_labels).toEqual(["QTY", "UNIT", "B_NAME_TOK", "I_NAME_TOK"]);
    expect(new_scores).toEqual([1.0, 1.0, 0.3, 0.35]);
  });

  it("test_below_threshold", () => {
    // Test that the first COMMENT label gets converted to B_NAME_TOK and the second
    // COMMENT label does not get modified because the highest NAME label score does
    // not exceed the threshold.
    const labels = ["QTY", "UNIT", "COMMENT", "COMMENT"];
    const scores = [1.0, 1.0, 0.6, 0.5];

    const mock_marginals: Record<number, Record<string, number>> = {
      2: {
        B_NAME_TOK: 0.3,
        I_NAME_TOK: 0.0,
        NAME_SEP: 0.0,
        NAME_VAR: 0.05,
        NAME_MOD: 0.07,
      },
      3: {
        B_NAME_TOK: 0.02,
        I_NAME_TOK: 0.15,
        NAME_SEP: 0.0,
        NAME_VAR: 0.15,
        NAME_MOD: 0.02,
      },
    };
    const mock_tagger = make_mock_tagger(mock_marginals);

    const [new_labels, new_scores] = guess_ingredient_name(mock_tagger, labels, scores);
    expect(new_labels).toEqual(["QTY", "UNIT", "B_NAME_TOK", "COMMENT"]);
    expect(new_scores).toEqual([1.0, 1.0, 0.3, 0.5]);
  });

  it("test_multiple_options", () => {
    // Test that the PREP labels are converted to NAME labels because they are a longer
    // sequence of consecutive labels than the two COMMENT labels.
    const labels = ["QTY", "UNIT", "COMMENT", "COMMENT", "PUNC", "PREP", "PREP", "PREP"];
    const scores = [1.0, 1.0, 0.6, 0.5, 1.0, 0.4, 0.45, 0.28];

    const mock_marginals: Record<number, Record<string, number>> = {
      2: {
        B_NAME_TOK: 0.3,
        I_NAME_TOK: 0.0,
        NAME_SEP: 0.0,
        NAME_VAR: 0.05,
        NAME_MOD: 0.07,
      },
      3: {
        B_NAME_TOK: 0.02,
        I_NAME_TOK: 0.27,
        NAME_SEP: 0.0,
        NAME_VAR: 0.15,
        NAME_MOD: 0.02,
      },
      5: {
        B_NAME_TOK: 0.3,
        I_NAME_TOK: 0.0,
        NAME_SEP: 0.0,
        NAME_VAR: 0.05,
        NAME_MOD: 0.07,
      },
      6: {
        B_NAME_TOK: 0.02,
        I_NAME_TOK: 0.52,
        NAME_SEP: 0.0,
        NAME_VAR: 0.15,
        NAME_MOD: 0.02,
      },
      7: {
        B_NAME_TOK: 0.22,
        I_NAME_TOK: 0.3,
        NAME_SEP: 0.0,
        NAME_VAR: 0.05,
        NAME_MOD: 0.07,
      },
    };
    const mock_tagger = make_mock_tagger(mock_marginals);

    const [new_labels, new_scores] = guess_ingredient_name(mock_tagger, labels, scores);
    expect(new_labels).toEqual([
      "QTY",
      "UNIT",
      "COMMENT",
      "COMMENT",
      "PUNC",
      "B_NAME_TOK",
      "I_NAME_TOK",
      "I_NAME_TOK",
    ]);
    expect(new_scores).toEqual([1.0, 1.0, 0.6, 0.5, 1.0, 0.3, 0.52, 0.3]);
  });
});
