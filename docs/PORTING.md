# Porting notes

How this repository relates to [strangetom/ingredient-parser](https://github.com/strangetom/ingredient-parser),
what was decided and why, and how parity is defined and measured. Results and limits are in
[VERIFICATION.md](VERIFICATION.md); module-level design in [ARCHITECTURE.md](ARCHITECTURE.md);
model provenance in [MODELS.md](MODELS.md); corrections beyond upstream in [QUIRKS.md](QUIRKS.md).

## 1. What this is

Upstream is a Python library (MIT) that parses English recipe ingredient sentences
("2 tbsp olive oil, divided") into structured data — name, amounts, size, preparation,
comment, purpose, optional foundation-food matches — with a CRF sequence labeller. Its
runtime has no native dependencies: the model is quantized CRF weights in JSON, inference is
a Viterbi loop, and features are strings built from vocabulary tables, regular expressions,
a POS tagger and a stemmer. That makes a TypeScript port feasible, and useful anywhere
JavaScript runs — Node, browsers, and React Native on Hermes, where Python cannot go and
where as-you-type, on-device, offline parsing is the goal.

The port is the whole library, `foundationfoods/` included, so it is a true twin of the
upstream package rather than a subset.

## 2. Upstream pin

- Repository: https://github.com/strangetom/ingredient-parser
- Commit: `ffd6ae3c6efb9925c40fc9b4454d77b40469ef91` (release 2.7.0, identical to the
  `ingredient-parser-nlp==2.7.0` pip package)

Every parity claim refers to this commit. The git tag `v2.7.0-parity` marks the last
version whose default output is byte-identical to Python at the pin on every measured input.
From that tag on the port evolves independently (§8): upstream is tracked and its changes
adopted deliberately; nothing is contributed back.

## 3. Settled decisions, with the evidence behind them

1. **Output contract = upstream `ParsedIngredient`, bit-parity by default.** Upstream's
   test suite is the conformance suite; the output shape is not "improved" in the default
   mode. Corrections live behind an explicit option (§8).
2. **POS tagger = the Brill tagger from the `natural` npm package.** Retraining the CRF on
   natural's Brill tags instead of NLTK's perceptron tags costs 0.14 pt sentence accuracy
   (94.59% vs 94.73%; token 97.90% vs 97.97%; 81,416-sentence corpus, seed 42, 20% held out).
   Rejected: `pos` (same data as natural's Brill), `compromise` (own tokenizer, non-PTB
   tags, lower accuracy), `wink-nlp` (own tokenizer, coarser UD tags). The tagger is reproduced
   inside the port (`src/en/_brill.ts`, lexicon and rules vendored under `models/natural/`) and
   verified identical to natural 8.1.1 (VERIFICATION.md §2).
3. **Stemmer = natural's vanilla Porter stemmer.** Upstream stems with NLTK's Snowball
   `EnglishStemmer`, which no JS library implements. Retraining with Brill tags and Porter
   stems costs 0.13 pt sentence accuracy against the NLTK baseline (94.60% vs 94.73%) and is
   indistinguishable from the Brill-only model. The two stemmers disagree on 5.2% of the
   vocabulary and 2.3% of corpus token occurrences. The stemmer is ported step for step
   (`src/en/_porter.ts`) and verified identical to natural 8.1.1.
4. **The tagger and stemmer used at inference must be the ones used at training.** Any
   change to a linguistic component means a retrain (§6) and a recorded evaluation.
5. **Ship model = a full-data retrain with the same components.** `models/brill-porter.json.gz`
   is the seed-42 / 20%-held-out model and the only fair accuracy estimate (94.60 / 97.90).
   `models/brill-porter-full.json.gz`, trained on all 81,359 usable lines with the same
   trainer, parameters and export, is the runtime asset. It cannot be scored fairly on this
   corpus and no accuracy is claimed for it beyond the fold model's number; its behaviour
   against the fold model was measured line by line (VERIFICATION.md §4). Both are kept.
6. **Runtime floor: React Native 0.81+ on Hermes.** That Hermes runs the port byte-identical
   to Node (VERIFICATION.md §5) and natively supports everything the code uses: lookbehind,
   Unicode property escapes in string-built patterns, named groups, BigInt, `Object.hasOwn`,
   `Array.prototype.at`, `atob`, DataView. Classes, private fields and `import()` rely on
   Metro's standard Babel transforms. Older Hermes (RN 0.70 era) is not a target.
7. **Foundation foods on device is supported.** The FDC-side caches (tokenized descriptions,
   uSIF vectors and constants, BM25 idf) are precomputed at build time into the lazy asset
   by the runtime's own code and verified identical to the runtime computation on all
   11,362 entries. First foundation-foods parse on Hermes: 3.5 s → 0.17 s.
8. **The training corpus is vendored** at `training/data/training.sqlite3`, hash-identical
   to upstream's file at the pin, so the training pipeline stays replayable independently
   of upstream. It is not part of the published package.
9. **Model asset ships uncompressed** as a generated JavaScript module holding the JSON
   literal (~1.8 MB raw). Hermes has no zlib; a decision made for React Native rather than
   discovered there. Foundation-foods assets are generated modules referenced only from the
   separate entry point `ingredient-parser-typescript/foundation-foods` (`preload_foundation_foods()`),
   so bundles built from the main entry never contain them, on any bundler.
10. **No runtime dependency.** Up to 0.1.0 `natural` 8.1.1 was the one dependency, deep-imported
    for its Brill tagger and Porter stemmer; its package root nevertheless put 47 transitive
    packages (database clients, dotenv, WordNet data) into every consumer install and bundled
    its English data as 4.6 MB of JSON. The two components are now reproduced in the port
    (§3.2–3.3; data vendored in `models/natural/`, generated into `src/en/data/brill.en.ts`)
    and diffed live against natural 8.1.1, which stays a devDependency for that test and for the
    training maps. Measured on the parser-only bundle: 7.9 → 3.3 MB of JS, 1.09 → 0.87 MB
    gzipped; a consumer install: 48 packages / 86 MB → 1 package / 12 MB.

## 4. Parity discipline

CRF weights are keyed by exact feature strings; a one-character divergence silently degrades
accuracy with no error anywhere. The port therefore reproduces what Python *produces*, verified
by diff, rather than what the source looks like. Seams that bit during the port, now a
checklist:

- Python `json.dumps` vs `JSON.stringify`: every cross-language map and dump uses compact
  separators and raw unicode (`ensure_ascii=False`).
- Python `re` vs JS `RegExp`: `\d`, `\s`, `\w`, `\b`, `$` and case-insensitive folding are
  Unicode-aware in Python and (mostly) ASCII in JS. Every pattern is translated by behaviour
  (`src/_py.ts`), including CPython's extra `re.IGNORECASE` equivalences (İ/ı ↔ i).
- CPython semantics reimplemented rather than approximated: `float()`/`int()` acceptance,
  `str.strip`/`capitalize`/`isdigit`/`isnumeric`, `repr(str)`, `html.unescape`,
  code-point slicing, `statistics.mean` and `round()` on exact rationals, `re.sub`
  replacement templates, `str.split()` whitespace.
- numpy semantics: float32 dequantisation with weak-scalar promotion, `pairwise_sum`,
  `logaddexp` fold order, numpy's `round` on `np.float64` (scaled rint, not CPython's).
- Tie-breaks and iteration order: CPython `set` order for int-hashed keys is emulated where it
  reaches the output; dict insertion order is preserved through `Map`s where JS objects would
  reorder integer-like keys.
- Stemmer pairing: CRF features use natural's Porter stems; the foundation-foods matcher
  stems with a verified port of NLTK's Snowball stemmer because its tables are Snowball stems.
- Vendored linguistic components: the tagger and stemmer are in-repo reproductions of natural
  8.1.1, diffed against it over every corpus token list, every FDC description and adversarial
  tokens (`tests/harness/linguistics.test.ts`); a change to either is a retrain (§3.4).
- Engine floating point: `Math.exp`/`Math.log`/`Math.pow` differ from macOS libm by an ulp,
  which reaches confidences at ≤2.8e-14 and one BM25 idf value in 2,645. Apple Accelerate's
  float32 `sdot` is not reproducible even across Python processes; the port computes dots as
  the float32 rounding of a float64 sum. Bounds in VERIFICATION.md §3.
- The Python reference itself is only reproducible with `PYTHONHASHSEED` fixed: upstream's
  fuzzy ranker sums float32 accumulators in the iteration order of a set of strings.
  `training/dump-parsed.py` pins the seed and records it in every dump header.

**The differential harness is the definition of done.** Three levels:

1. **Decoder.** Python dumps feature dicts, labels and marginals for the 16,272-line held-out
   split; the TS Viterbi must reproduce the labels exactly from the same dicts.
2. **Features.** Python and TS feature extraction over all 81,416 corpus sentences plus the
   107 probe-fixture lines; feature strings, key order, tokens, POS tags and normalised
   sentences must be identical.
3. **Output.** Upstream's 45 pytest files recreated verbatim in vitest, plus `ParsedIngredient`
   over the full corpus and fixtures compared byte for byte under a canonical serialisation
   (Fraction → `Fraction(n, d)`, Unit → `<Unit('x')>`, floats in Python `repr`), with and
   without `foundation_foods`, plus the two secondary APIs.

The Python side of every level is committed, gzipped, under `tests/goldens/parity/`
(manifest with hashes and headers). `HARNESS=full pnpm harness` runs all levels from a clean
checkout without Python. Current results: VERIFICATION.md §2.

## 5. Architecture in one paragraph

`parse_ingredient(sentence)` → **PreProcessor** (`src/en/preprocess.ts`: normalisation,
tokenisation, per-token feature dicts using the vocabulary tables, regexes, the Brill tagger,
the Porter stemmer and NLTK-style sentence-structure chunking) → **NumpyCRFInference**
(`src/inference.ts`: Viterbi with transition constraints, forward–backward marginals) →
**PostProcessor** (`src/en/postprocess.ts`: amount grouping incl. composite and sizable-unit
patterns, name grouping with confidences, preparation/comment/purpose/size assembly, optional
foundation-food matching via BM25 + uSIF + fuzzy rankers over the FDC table). The output
contract carries pint units and exact fractions, so the port includes a mechanism-level
subset of pint 0.25.3 (`src/_pint.ts`, generated registry) and a bigint-backed `Fraction`.
Module map and per-module parity decisions: ARCHITECTURE.md.

## 6. Training pipeline

Python ≥ 3.12 with a venv is needed only for training and for regenerating the Python side
of the harness. The scripts expect a clone of upstream at the pin in `./ip-repo` (gitignored,
never pushed) for the Python code, and the venv inside it. Setup, from the repository root:

```
git clone https://github.com/strangetom/ingredient-parser ip-repo
cd ip-repo && git checkout ffd6ae3c6efb9925c40fc9b4454d77b40469ef91
python3 -m venv venv && venv/bin/pip install ingredient-parser-nlp python-crfsuite scikit-learn tabulate matplotlib flask
git apply ../training/preprocess-brill-patch.diff   # env-gated; inert unless BRILL_TAGS_FILE is set
cd ../training && npm i                               # natural 8.1.1, pinned exactly
```

The held-out retrain (what produced the accuracy estimate) is one script:

```
training/retrain.sh models/<name>.json.gz      # ≈15 min on an M-series laptop
```

It normalises and tokenises the corpus, tags the token lists with natural's Brill tagger and
stems the feature vocabulary with natural's Porter stemmer into JSONL maps, then runs
upstream's own `train.py` with the env-gated patch substituting those tags and stems, seed
42, 20% held out, and evaluates. The full-data retrain is `training/train-full.py` (same
trainer, parameters and export, no split). Switching the runtime asset to a model, archiving
the previous dumps, regenerating every dump and the committed references, and running the
whole harness is `training/ship-model.sh models/<name>.json.gz`. Script reference:
`training/README.md`; every artifact's provenance: MODELS.md.

## 7. Fixtures and licensing

`fixtures/probe-recipes.json` holds 107 real ingredient lines from 10 recipes, annotated with
the register or trap each exercises (US standard, dotted units, compound amounts, UK
comma-less metric, folk prose, page-chrome junk, unicode fractions, colon-editorial). Their
goldens are generated from the pin, never written by hand.

Upstream code and model: MIT (Tom Strange) — `LICENSE.upstream`, attribution kept. `natural`
8.1.1 (MIT): the Porter stemmer port and the vendored Brill lexicon and rules, whose own origin
is pos-js (LGPLv3) — `LICENSE.natural`, `models/natural/README.md`. natural's tagger sources
(GPL-3.0 headers) are not copied; `src/en/_brill.ts` is an independent implementation of the
same behaviour. NLTK (Apache 2.0) is training-side only. The vendored corpus is upstream's public file;
its sentences were scraped from the sources named in `training/data/README.md` and remain
theirs; it is not part of the published package.

## 8. Changes beyond upstream

From `v2.7.0-parity` on, this port evolves on its own terms: upstream is tracked and its
changes adopted deliberately; nothing is contributed back. Corrections of upstream behaviour
ship behind `quirks: 'fixed'` and API additions carry no option. The default output stays
byte-parity, so every harness level keeps running against the Python reference. The
user-facing list of corrections and additions is [QUIRKS.md](QUIRKS.md); every entry has a
test asserting both modes in `tests/quirks/`.

## 9. Publishing

Distribution: the public npm registry, unscoped, package name `ingredient-parser-typescript`
(`ingredient-parser-ts` was already taken by an unrelated package); repository
https://github.com/vnekhai-personal/ingredient-parser-typescript, public. A release is a model
version plus a green parity harness. Package
requirements: pure ESM with types, `sideEffects: false`, semver, the model as an
uncompressed module (§3.9), foundation-foods assets behind the separate entry point (done:
`./foundation-foods`, so Metro, which does not tree-shake, never bundles them for callers that
do not import it).
