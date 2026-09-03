# Verification

What has been checked, how, the numbers, and the limits. Everything here is reproducible from
the repository: the Python side of every comparison is committed under `tests/goldens/parity/`
and `HARNESS=full pnpm harness` replays it without Python. Upstream pin
`ffd6ae3c6efb9925c40fc9b4454d77b40469ef91` (2.7.0); parity tag `v2.7.0-parity`.

## 1. Method

Two-sided differential testing: the same input goes through Python at the pin — running the
same model, with natural's Brill tags and Porter stems substituted through an env-gated patch
(`training/preprocess-brill-patch.diff`) — and through the port; outputs are compared byte for
byte under a canonical serialisation. Three levels (feature dicts and labels; feature strings
over the corpus; `ParsedIngredient` over the corpus), plus option variants, adversarial input,
primitive-level fuzzing against CPython/numpy/pint, and a Hermes run. Two independent audit
rounds (code faithfulness module by module, claims and test integrity, adversarial input,
runtime) re-derived every number below; the defects they found are fixed and covered by the
harness and the adversarial sets.

## 2. Parity results (current head, ship model `brill-porter-full`)

| Level | Input | Result |
|---|---|---|
| 1 — decoder | 16,272 held-out sequences, 117,369 tokens | labels exact; confidences bit-exact 115,952 / 117,369, max diff 2.8e-14 |
| 2 — features | 16,272 sequences recomputed from text; 81,416 corpus + 107 fixture lines hashed | 0 mismatches (values, key order, tokens, POS tags, normalised sentence) |
| 3 — output | 81,523 lines, `parse_ingredient` | 81,523 / 81,523 byte-identical, including the lines where Python raises |
| 3 — foundation foods | 81,523 lines, `foundation_foods: true` | 0 semantic mismatches (same FDC entry, index, text); 3,456 lines (4.24%) differ only in the match confidence, 3,396 by exactly 1e-6, max 9.3e-5 (§3) |
| API | 107 fixture lines through `parse_multiple_ingredients` and `inspect_parser` | 0 mismatches |
| Upstream tests | 45 files recreated verbatim, 458 cases | all active; 9 expected failures are documented tagger/model deltas (§6), verified in Python |
| Snowball stemmer port | 13,839 vocabulary tokens vs NLTK | 0 mismatches |
| Brill tagger + Porter stemmer (vendored, `_brill.ts` / `_porter.ts`) vs natural 8.1.1 live | every corpus + fixture token list (81,523), every FDC description (11,371), adversarial lists; every token, lowercased and hyphen-split | identical |
| FDC caches | 11,362 precomputed entries vs runtime computation | identical |

Option coverage: every combination of `separate_names`, `discard_isolated_stop_words`,
`expect_name_in_output`, `string_units` and the five `volumetric_units_system` values (92
combinations × 287 lines), `custom_units` (36 dictionaries × 95 lines, incl. integer-like
keys, prototype-property names, regex specials and replacement-template escapes),
`imperial_units`, `foundation_foods`: 0 semantic mismatches.

Adversarial input, two-sided, cumulative: 4,590 generated lines (Unicode fractions and
whitespace, HTML entities, BOM/ZWSP/NBSP, emoji, headers, price annotations, mutated corpus
sentences), a further 344-line Unicode/entity set, 6,410 preprocessing probes, 4,828 lines
targeting every Python `raise` reachable from `parse_ingredient`, and 483 lines with
40–400-digit integers: 0 divergences; every Python raise is matched by a throw. 192 lines with
astronomical exponents (`1e40000000000`): the 127 Python cannot finish (unbounded `10**exp`)
are exactly the 127 the port rejects with `RangeError`; the 65 both complete are identical.

## 3. Numerical seams and their bounds

- **Engine libm.** V8's `Math.exp`/`Math.log1p` differ from macOS libm by an ulp; through the
  forward–backward recursion that is ≤2.8e-14 on 1.2% of confidences, never a label. Upstream
  rounds confidences to six decimals, so a flip needs a value within ~1e-14 of a boundary; none
  observed. BM25 idf: 1 ulp on 14 of 2,645 values, no ranking effect observed.
- **Foundation-food confidence.** Two sources upstream itself does not control: Apple
  Accelerate's float32 `sdot` (±1 ulp from correctly rounded 43% of the time, not reproducible
  even between Python processes) and the hash-seed-dependent iteration order of a string set in
  the fuzzy metric. Effect: the last digit of the rounded confidence on ~4% of matched lines,
  at most 9.3e-5 where score normalisation amplifies it. Which food is matched never differs
  over the corpus; a match whose fused score sits within that variance of a decision threshold
  could in principle flip between "matched" and "no match", and one such line was observed
  under an unpinned hash seed. The harness asserts zero semantic mismatches and bounds the
  confidence deviation.
- **Precomputed caches** freeze the build machine's V8 values for `Math.pow`/`Math.log` inside
  the FDC-side tables on every engine — the values the harness verified.

## 4. Model

| Model | Components | Sentence / token accuracy | Role |
|---|---|---|---|
| NLTK tagger + NLTK Snowball, retrained on the seed-42 split | upstream's | 94.73% / 97.97% | fair baseline |
| `brill-pos.json.gz` | natural Brill tags, NLTK stems | 94.59% / 97.90% | experiment |
| `brill-porter.json.gz` | natural Brill tags, natural Porter stems | 94.60% / 97.90% | accuracy estimate for the shipped configuration; kept as fallback |
| `brill-porter-full.json.gz` | same, all 81,359 lines, no split | none claimed (train-set score 97.57 / 99.22 is not accuracy) | ship model |

Upstream's released artifact scores 97.11 / 99.02 on this split only because it was trained on
a random 80% fold that contains most of these lines; it is not a comparable number.

Fold model vs full model, scored against the corpus gold labels: whole corpus 96.97% → 97.55%
exact sentences (98.95% → 99.22% tokens). The two parse 1,003 lines (1.23%) differently. On the
546 of those the fold model never saw, the full model matches gold on 465 (it trained on
them). On the 443 both trained on, fold 166 vs full 156 exact — equal within noise, the
flips going both ways on the same construction (alternatives joined by "or"/commas, the
weakest labels). All 1,003 were read side by side: no new failure class.

## 5. Runtime

Hermes (React Native 0.81.5, bytecode v96), one bundle built from the head through esbuild,
the React Native Babel preset and `hermesc`: 4,814 / 4,814 canonical serialisations
byte-identical to Node across the 107 fixtures, 2,000 test-split lines and 300 fuzz lines,
each with foundation foods off and on; 0 confidence-only differences. Re-run on the build with
the vendored tagger and stemmer (PORTING.md §3.10): again 4,814 / 4,814 identical to Node, and
identical to the previous build's output; the bytecode of that full bundle (parser, foundation
foods, driver) went from 14.8 MB to 11.2 MB. No Node API, no polyfill, no runtime dependency.

Costs (CPU time on an M-series laptop; wall time under load was higher): plain parse ~5–6 ms
on Hermes, ~1.5 ms on Node; foundation-foods parse ~60 ms on Hermes, ~10 ms on Node;
`preload_foundation_foods()` 1.2–3.1 s on Hermes (base64 decoding of ~10 MB of assets), 0.1 s
on Node; first foundation-foods parse after preload 0.17–0.75 s. Peak RSS on Hermes 61–72 MB
plain, 118–132 MB with foundation foods. Bundle from the main entry (esbuild, no minification):
3.3 MB of JS, 0.87 MB gzipped — the CRF model 1.8 MB, the Brill lexicon 1.0 MB, code and tables
0.4 MB (0.1.0 with `natural` bundled: 7.9 MB, 1.09 MB gzipped). The foundation-foods entry point
adds its 8.6 MB of assets only to apps that import it.

## 6. Documented limits and deviations

- **Unicode version.** Node 22 carries Unicode 16/17, CPython 3.12 carries 15.0: 9,661 more
  word characters and 90 more digits under Node. Lines containing code points assigned after
  15.0 can tokenise differently under Node. Hermes 0.81.5 carries Unicode 15.0, so the target
  device agrees with Python; the seam is Node-only. Not fixable without shipping Unicode 15.0
  tables.
- **Unbounded Python computation.** Quantities with astronomical exponents make CPython compute
  `10**exp` without limit; the port throws `RangeError` (§2).
- **Exception classes.** Where Python raises, the port throws, on the same inputs, with the same
  message for the parser-level `ValueError`s (including upstream's "imperal" typo) but generic
  `Error`/`RangeError` classes rather than `IndexError`/`ZeroDivisionError`/pint's errors.
  NLTK's "Warning: parsing empty text" stdout print before raising is not mirrored.
- **Regex syntax in custom-unit singulars.** Both sides interpolate the singular into a regex
  unescaped; the two regex grammars differ, so such inputs are undefined on both sides. Custom
  singulars are plain words upstream too.
- **Integer-like custom-unit keys.** A plain JS object cannot preserve insertion order for keys
  like `"2"`; the units table follows Python's merge order otherwise. Identical on every tested
  dictionary; a dictionary where two such pairs share a singular could still order differently.
- **API deviations, by necessity.** Foundation-food assets load lazily from the separate entry
  point `ingredient-parser-typescript/foundation-foods`: call `await preload_foundation_foods()`
  once before `foundation_foods: true`. `show_model_card()`
  throws (no model card file is shipped). `JSON.stringify` on a parse result throws on the
  bigint `Fraction`; use its `toString()` or a replacer.
- **Expected upstream-test failures (9), kept verbatim and marked as such**: three
  sentence-structure tests encode NLTK POS tags, three foundation-foods tokenisation tests
  likewise, one foundation-foods end-to-end test and two `expect_name_in_output` tests encode
  the stock model's labels. Python at the pin with the port's tagger and model gives the port's
  answer in every case (`tests/upstream/README.md`).

## 7. Reproducing

```
pnpm install && pnpm typecheck && pnpm test      # suite incl. committed samples (no Python)
HARNESS=full pnpm harness                         # every level from tests/goldens/parity/*.gz
EVAL=1 pnpm exec vitest run tests/eval            # primitive goldens vs CPython/numpy/pint
```

Regenerating the Python side (needs the venv and clone from PORTING.md §6):
`training/ship-model.sh models/<model>.json.gz` regenerates every dump and reference,
archives the previous ones and runs the whole harness; `training/compare-lines.sh lines.txt`
runs ad-hoc lines through both sides and diffs them; `training/eval-fuzz.sh` and
`training/eval-api.sh` are the adversarial and API-surface runs. Script reference:
`training/README.md`.
