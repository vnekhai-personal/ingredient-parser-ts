# Upstream conformance suite — conversion conventions

Upstream's pytest suite at the pin (`ffd6ae3c6efb9925c40fc9b4454d77b40469ef91`, 2.7.0) is
this port's conformance suite (docs/PORTING.md). Every file under `ip-repo/tests/` is
recreated here **verbatim**: same file, same test names, same inputs, same expected values.
Expectations are never adjusted to make the port pass — a failing converted test is a
port bug (or a documented upstream-parity decision recorded in docs/PORTING.md).

## File mapping

| Upstream | Here |
|---|---|
| `tests/<dir>/test_x.py` | `tests/upstream/<dir>/test_x.test.ts` once its module is ported |
| (same, module not yet ported) | `tests/upstream/<dir>/test_x.pending.ts` — identical content; vitest only collects `*.test.ts`, so renaming the file is the whole "unskip" |
| `tests/test_common.py` | `tests/upstream/test_common.test.ts` / `.pending.ts` |

Each file starts with:
```ts
// Verbatim conversion of ip-repo/tests/<path> @ ffd6ae3 (<N> tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
```

## Module mapping (imports)

| Python import | TS import (relative to the test file) |
|---|---|
| `ingredient_parser` (`parse_ingredient`, `parse_multiple_ingredients`, `inspect_parser`, `UREG`, `SUPPORTED_LANGUAGES`) | `src/index.ts` |
| `ingredient_parser.dataclasses` | `src/dataclasses.ts` |
| `ingredient_parser._common` | `src/_common.ts` |
| `ingredient_parser.en` (`PreProcessor`, `PostProcessor`, `FeatureDict`) | `src/en/index.ts` |
| `ingredient_parser.en._utils` | `src/en/_utils.ts` |
| `ingredient_parser.en._constants` / `_regex` / `_structure_features` / `preprocess` / `postprocess` / `parser` | `src/en/<same stem>.ts` |
| `ingredient_parser.en.foundationfoods.<x>` | `src/en/foundationfoods/<x>.ts` |
| `fractions.Fraction` | `Fraction` from `src/fraction.ts` |

Test files import with `.js` extensions (NodeNext), e.g.
`import { PreProcessor } from '../../../src/en/index.js';`

## Identifier policy — verbatim

**All upstream identifiers keep their exact names, snake_case included**: functions,
methods, attributes, dataclass fields, constants, private `_underscore` names. This is
deliberate: dataclass fields are the output contract the level-3 harness diffs against
Python, and everything else reads side by side. Only TS-native additions (`Fraction`,
`Unit`, `logaddexp`) are free.

- `PreProcessor("1 cup", custom_units={})` → `new PreProcessor("1 cup", { custom_units: {} })`
- `p._is_unit("glass")` → `p._is_unit("glass")`
- `p.sentence_structure.mip_phrases` → `p.sentence_structure.mip_phrases`
- `parse_ingredient("1 apple", lang="es")` → `parse_ingredient("1 apple", { lang: "es" })`

## Call-shape rules

- Positional arguments stay positional, in upstream order.
- Keyword arguments are collected into ONE trailing options object with the same
  snake_case keys. Never mix: if upstream passes any kwargs, all kwargs go in the object.
- Dataclass constructors take a single object of their fields:
  `LabelledToken(index=i, text=t, pos_tag=g, label=l, score=s, plural=False)` →
  `new LabelledToken({ index: i, text: t, pos_tag: g, label: l, score: s, plural: false })`.
  Fields set by `__post_init__` / `field(init=False)` (`unit_system`, composite `text`,
  `confidence`, `starting_index`, `FoundationFood.url`) are not passed.
- Factories keep their Python name and kwargs → object: `ingredient_amount_factory({ quantity: "25", unit: "g", text: "25 g", confidence: 0, starting_index: 0 })`.

## Value mapping

| Python | TS |
|---|---|
| `None` | `null` (never `undefined`) |
| `Fraction(1, 2)` | `new Fraction(1, 2)`; `Fraction("1/2")` → `new Fraction("1/2")` |
| `amount.quantity == 25` (Fraction vs int) | `expect(amount.quantity).toEqual(new Fraction(25))` |
| `UREG("g").units` (pint Unit) | `UREG("g").units` — the TS `UREG` mirrors pint's registry call for unit expressions; `.units` returns a `Unit`. |
| `amount.unit == UREG("metric_tablespoon")` (Quantity compare) | `expect(amount.unit).toEqual(UREG("metric_tablespoon").units)` |
| `str(x)` / `repr(x)` | `x.toString()` / `x.repr()` |
| `"clove" in parsed.name[0].text` | `expect(parsed.name[0].text).toContain("clove")` |
| `"clove" not in parsed.amount[0].unit` (unit may be `str \| Unit`) | `expect(String(parsed.amount[0].unit)).not.toContain("clove")` |
| tuple `(a, b)` | array `[a, b]` |
| `set(...)` / set literal | `new Set([...])` compared with `toEqual` |
| `list[...]` equality | `toEqual` |
| dataclass equality (`assert p.foo() == IngredientText(...)`) | `toEqual(new IngredientText({ ... }))` |
| enum `UnitSystem.METRIC` | `UnitSystem.METRIC` |

## Assertion mapping

- `assert a == b` → `expect(a).toEqual(b)` for objects/arrays, `toBe(b)` for primitives.
- `assert f(x)` / `assert not f(x)` where `f` returns bool → `expect(f(x)).toBe(true)` / `toBe(false)`.
- `assert x is None` → `expect(x).toBeNull()`.
- `pytest.raises(ValueError, match="m")` → `expect(() => ...).toThrow(/m/)` with a comment
  naming the Python exception type.
- `pytest.warns(DeprecationWarning, match="m")` → the port emits deprecations through
  `console.warn`; use `const warn = vi.spyOn(console, "warn").mockImplementation(() => {})`,
  call, `expect(warn).toHaveBeenCalledWith(expect.stringMatching(/m/))`, `warn.mockRestore()`.
- `@pytest.mark.parametrize("a,b", CASES)` → `it.each(CASES)("test_name %#", (a, b) => ...)`.
- `@pytest.fixture def p(): return X` → a factory named `p_fixture()` at the top of the file
  (docstring kept as a comment); each test that took the fixture starts with
  `const p = p_fixture();` so the body reads exactly like the Python (fresh instance per
  test, like pytest's default function scope).
- Module-level constant lists (e.g. `OVERRIDE_EXAMPLES`) stay module-level constants.
- Test classes → `describe("TestClassName", ...)`; methods → `it("test_name", ...)`. Keep the
  docstring as a comment as the first line inside the `it` body.

## Not portable

When a test depends on something that cannot exist in the port (OS-level actions like
`show_model_card` opening a file, `unittest.mock.patch` of Python internals), keep the test
as `it.skip("test_name", ...)` with `// NOT PORTABLE: <reason>` and still convert the body as
faithfully as possible. Such skips are counted in the tracking table below.

## Tagger-delta tests (PARITY-DELTA)

Some upstream expectations encode NLTK's POS tags. The port's tagger is natural's Brill (docs/PORTING.md §3), settled). When a converted test fails, the verdict comes from Python at the pin run with
`BRILL_TAGS_FILE` (`training/dump-lines.py` → `brill-tag.mjs` → `PreProcessor`): if
Python-with-Brill produces the port's answer, the test is a tagger delta, not a port bug. Such
tests keep their upstream expectation verbatim, are marked `it.fails(...)` (asserting the delta is
still present), and carry a `// PARITY-DELTA (tagger, …)` comment with the NLTK vs Brill tags and
the Python-with-Brill result. Current list (all in `preprocess/test_sentence_structure_features`):
`test_multi_ingredient_phrase_detection_determinant`, `test_example_phrase_detection_multiple_examples`,
`test_example_phrase_detection_duplicate_examples`.

The same policy covers **model deltas**: upstream tests marked `@pytest.mark.model_dependent` encode
the stock model's labels; the port ships `models/brill-porter-full.json.gz`. The verdict comes from Python
at the pin with the ship model swapped in (`training/dump-parsed.py`'s loader patch). Current list:
`parser/test_expect_name_in_output`: `test_disabled`, `test_disabled_name_not_separate` (the ship model
labels "olive oil" as the name; the stock model labels it COMMENT).

Foundation-foods deltas (2026-09-02): `foundationfoods/test_tokenize_fdc_description`:
`test_simple_description`, `test_negated_tokens`, `test_reduced_relevance_tokens` (Brill tags
"vegetable" NN / "canned" JJ where NLTK had JJ / VBD; tokens and weights identical);
`foundationfoods/test_foundation_foods`: the "2 cooked red or green peppers" row of
`test_match_foundation_foods_bias` (Brill VBN + ship model PREP drops "cooked" from the names, so
the raw-food bias selects the raw peppers; Python with the ship model + Brill agrees byte for byte).

## Type checking

These files are verbatim conversions and keep Python's duck-typed access (e.g.
`parsed.amount[0].unit` on an `IngredientAmount | CompositeIngredientAmount`), so they are
excluded from `pnpm typecheck` (`tsconfig.test.json`) and run untyped under vitest. The harness
and helper tests stay strictly typed.

## Syntax check

Pending files cannot resolve their imports yet, so check syntax only:
```bash
node tests/helpers/syntaxCheck.mjs tests/upstream/<dir>/<file>.pending.ts
```

## Conventions that emerged during conversion (binding for the port's API)

- **Positional calls to factories/dataclasses** (`ingredient_amount_factory("2", "cups", "2 cups", 0, 0)`,
  `_PartialIngredientAmount("", [""], [0], 0)`) → object form with the values mapped onto the
  parameter names in upstream order. A TS function cannot have both shapes; the object form wins.
- **NamedTuples** (`IngredientToken(t, p)` in foundationfoods) → treated as records:
  `new IngredientToken({ token: t, pos_tag: p })`.
- **`dict.get(key, default)` on a `FeatureDict`** → `features["key"] ?? default` (FeatureDict is a
  plain object, matching the canonical-JSON harness dumps).
- **`Fraction` literals whose numerator exceeds 2^53** → string form `new Fraction("77110702900000017/80000000000000000")`.
  Consequence: the port's `Fraction` must be bigint-backed.
- **`Fraction == float`** (`quantity == 0.25`) → `toEqual(new Fraction(1, 4))` (Python compares exactly).
- **pint `Quantity` results** (`CompositeIngredientAmount.convert_to`) → `.magnitude` / `.units` kept verbatim.
- **`@cached_property`** (`PostProcessor.parsed`) → property access, not a call.
- **`pytest.raises(TypeError)` without `match`** → `toThrow()` + `// Python: TypeError` comment.
- **`unittest.mock.MagicMock` tagger** (parser `guess_ingredient_name` tests) → duck-typed
  `{ marginal(label, idx) }` object with the same lookup semantics.
- **Python iterators** (`iter(range(...))`, `next`, `StopIteration`) → generator + `it.next().value`
  / `it.next().done`.
- **Positional `custom_units` kwarg** on `PostProcessor(...)` → in the trailing options object with the
  other kwargs (never mix).

## Tracking (2026-09-02: all 45 upstream files converted; 458 tests by pytest's per-case count)

| Upstream file | TS file | Tests | Skipped (not portable) | Status |
|---|---|---|---|---|
| test_common.py | test_common.test.ts | 14 | 1 (`test_model_card_found`: OS-level open + mock.patch) | **ACTIVE, green** (2026-09-02) |
| test_utils.py | test_utils.test.ts | 27 | 0 | **ACTIVE, green** (2026-09-02, pint subset) |
| preprocess/test_collapse_ranges.py | preprocess/…test.ts | 5 | 0 | **ACTIVE, green** |
| preprocess/test_features.py | 〃 | 38 | 0 | **ACTIVE, green** |
| preprocess/test_identify_fractions.py | 〃 | 16 | 0 | **ACTIVE, green** |
| preprocess/test_merge_quantity_x.py | 〃 | 3 | 0 | **ACTIVE, green** |
| preprocess/test_preprocess.py | 〃 | 32 (2 + 29 normalise cases + 1) | 0 | **ACTIVE, green** |
| preprocess/test_remove_price_annotations.py | 〃 | 24 | 0 | **ACTIVE, green** |
| preprocess/test_remove_unit_trailing_period.py | 〃 | 4 | 0 | **ACTIVE, green** |
| preprocess/test_replace_dupe_units_ranges.py | 〃 | 4 | 0 | **ACTIVE, green** |
| preprocess/test_replace_en_em_dash.py | 〃 | 2 | 0 | **ACTIVE, green** |
| preprocess/test_replace_html_fractions.py | 〃 | 15 | 0 | **ACTIVE, green** |
| preprocess/test_replace_unicode_fractions.py | 〃 | 16 | 0 | **ACTIVE, green** |
| preprocess/test_sentence_structure_features.py | 〃 | 26 | 0 | **ACTIVE**: 23 green + 3 tagger-delta `it.fails` |
| preprocess/test_singlarise_units.py | 〃 | 5 | 0 | **ACTIVE, green** |
| preprocess/test_split_quantity_and_units.py | 〃 | 8 | 0 | **ACTIVE, green** |
| preprocess/test_tokenize.py | 〃 | 13 | 0 | **ACTIVE, green** |
| postprocess/test_CompositeIngredientAmount.py | postprocess/…test.ts | 3 | 0 | **ACTIVE, green** |
| postprocess/test_IngredientAmount.py | 〃 | 15 | 0 | **ACTIVE, green** |
| postprocess/test_composite_amounts_pattern.py | 〃 | 14 | 0 | **ACTIVE, green** |
| postprocess/test_distribute_related_flags.py | 〃 | 6 | 0 | **ACTIVE, green** |
| postprocess/test_fallback_pattern.py | 〃 | 14 | 0 | **ACTIVE, green** |
| postprocess/test_fix_punctuation.py | 〃 | 7 | 0 | **ACTIVE, green** |
| postprocess/test_is_approximate.py | 〃 | 9 | 0 | **ACTIVE, green** |
| postprocess/test_is_prepared.py | 〃 | 3 | 0 | **ACTIVE, green** |
| postprocess/test_is_singular.py | 〃 | 3 | 0 | **ACTIVE, green** |
| postprocess/test_is_singular_and_approximate.py | 〃 | 3 | 0 | **ACTIVE, green** |
| postprocess/test_match_pattern.py | 〃 | 8 | 0 | **ACTIVE, green** |
| postprocess/test_postprocess.py | 〃 | 11 | 0 | **ACTIVE, green** |
| postprocess/test_process_names.py | 〃 | 6 | 0 | **ACTIVE, green** |
| postprocess/test_remove_adjacent_duplicates.py | 〃 | 2 | 0 | **ACTIVE, green** |
| postprocess/test_remove_invalid_indices.py | 〃 | 5 | 0 | **ACTIVE, green** |
| postprocess/test_sizeable_unit_pattern.py | 〃 | 9 | 0 | **ACTIVE, green** |
| parser/test_cloves.py | parser/…test.ts | 6 | 0 | **ACTIVE, green** |
| parser/test_compound_units.py | 〃 | 14 (8 cases + 6) | 0 | **ACTIVE, green** |
| parser/test_custom_units.py | 〃 | 3 | 0 | **ACTIVE, green** |
| parser/test_expect_name_in_output.py | 〃 | 7 | 0 | **ACTIVE**: 5 green + 2 model-delta `it.fails` |
| parser/test_parser_arg_validation.py | 〃 | 3 | 0 | **ACTIVE, green** |
| parser/test_prepared_ingredient.py | 〃 | 5 | 0 | **ACTIVE, green** |
| parser/test_separate_names.py | 〃 | 2 | 0 | **ACTIVE, green** |
| foundationfoods/test_foundation_foods.py | foundationfoods/…test.ts | 36 (all `it.each`) | 0 | **ACTIVE**: 35 green + 1 tagger/model-delta `it.fails` |
| foundationfoods/test_foundation_foods_ordering.py | 〃 | 1 | 0 | **ACTIVE, green** |
| foundationfoods/test_normalise_spelling.py | 〃 | 4 | 0 | **ACTIVE, green** |
| foundationfoods/test_strip_ambiguous_leading_adjectives.py | 〃 | 3 | 0 | **ACTIVE, green** |
| foundationfoods/test_tokenize_fdc_description.py | 〃 | 4 | 0 | **ACTIVE**: 1 green + 3 tagger-delta `it.fails` |
| **Total** | 45 files | **458** | 1 | **all 45 files active**: 457 pass (incl. 9 `it.fails` deltas: 6 tagger, 2 model, 1 tagger+model) + 1 not-portable skip |

Verification at conversion time: every file passes `tests/helpers/syntaxCheck.mjs`; the preprocess
group was additionally cross-checked by a string-literal multiset diff against the Python source
(identical for all 15 files). Test counts per file match upstream 1:1.
