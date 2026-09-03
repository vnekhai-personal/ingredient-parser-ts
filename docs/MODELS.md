# Model provenance ledger

Append-only. Every artifact in `models/` has an entry here recording what made it
(CLAUDE.md I3). Artifacts are write-once (I4): a new experiment produces a new file and a
new entry; superseded entries stay.

All numbers: corpus table `en`, datasets bbc/cookstr/nyt/allrecipes/tc/manual, 81,416
sentences (81,359 usable, 57 discarded for OTHER labels), `train_test_split(test_size=0.2,
stratify=source, random_state=42)` → 65,087 train / 16,272 test. Upstream trainer params
at the pin: c1=0.6, c2=0.5, L-BFGS, max_iterations=1500, delta=5e-5, feature.minfreq=0,
possible_states/transitions=True; export quantize_bits=16, min_abs_weight=None.

| Model | Tagger | Stemmer | Sentence | Token | Role |
|---|---|---|---|---|---|
| NLTK/NLTK retrain, same seed-42 split (first session; no artifact kept) | NLTK averaged perceptron | NLTK Snowball `EnglishStemmer` | 94.73% | 97.97% | fair baseline, not shipped |
| upstream stock artifact (`ip-repo/.../model.en.json.gz`, random 80% fold) | NLTK averaged perceptron | NLTK Snowball `EnglishStemmer` | 97.11% | 99.02% | NOT comparable: trained on most of this test split (2026-09-03 evaluation, docs/VERIFICATION.md D4) |
| `brill-pos.json.gz` | natural 8.1.1 Brill | NLTK Snowball `EnglishStemmer` | 94.59% | 97.90% | experiment, superseded |
| `brill-porter.json.gz` | natural 8.1.1 Brill | natural 8.1.1 `PorterStemmer` | 94.60% | 97.90% | seed-42 / 0.2 fold: **the accuracy estimate** for the ship configuration; kept as fallback |
| `brill-porter-full.json.gz` | natural 8.1.1 Brill | natural 8.1.1 `PorterStemmer` | (97.57%) | (99.22%) | **SHIP MODEL** — all 81,359 lines, no held-out split; bracketed numbers are train-set (leaked) scores, NOT an estimate |

Component note (2026-09-03): since the `natural` dependency was vendored, the runtime's tagger and
stemmer are in-repo reproductions of natural 8.1.1 (`src/en/_brill.ts` from the lexicon and rules
under `models/natural/`; `src/en/_porter.ts`), kept identical to the package by
`tests/harness/linguistics.test.ts` (every corpus and fixture token list, every FDC description,
adversarial sets). No model changed; every entry above still describes the shipped components.

---

## 2026-09-02 — `models/brill-porter-full.json.gz` — full-data release retrain (SHIP)

- **Why:** the 80/20 model (`brill-porter.json.gz`) is an evaluation-fold artifact: 20% of the
  corpus never contributed weights. Upstream's own release is also a fold model, so shipping the fold
  was defensible for parity but leaves accuracy on the table. Same linguistic components as the fold model (CLAUDE.md I2),
  so the port's feature pipeline is unchanged; only the weights differ.
- **Upstream pin:** `ffd6ae3c6efb9925c40fc9b4454d77b40469ef91` (2.7.0) + `training/preprocess-brill-patch.diff`
- **Tagger / stemmer:** identical to `brill-porter.json.gz` (natural 8.1.1 Brill via `BRILL_TAGS_FILE`,
  natural 8.1.1 `PorterStemmer` via `PORTER_STEMS_FILE`, same corpus maps `brill-tags.jsonl` /
  `porter-stems.jsonl`)
- **Split:** none — all 81,359 usable vectors (57 discarded for OTHER labels), `split: 0.0`
- **Command (repo root):** `BRILL_TAGS_FILE=$PWD/brill-tags.jsonl PORTER_STEMS_FILE=$PWD/porter-stems.jsonl
  ip-repo/venv/bin/python training/train-full.py models/brill-porter-full.json.gz`
  (`train-full.py` = upstream `IngredientParserTrainer` with the exact `train_parser_model` params at the
  pin, `export_crfsuite_to_json(quantize_bits=16, min_abs_weight=None)`, `write_model_config`)
- **Environment:** Python 3.12.13, python-crfsuite 0.9.12, nltk 3.10.3, scikit-learn 1.9.0,
  numpy 2.5.2, Node 22.22.2, macOS arm64
- **Training:** 690 L-BFGS iterations, 22 min 31 s (1,352 s), stopping reason "L-BFGS terminated with the
  stopping criteria", trained 2026-09-02T20:48:08
- **sha256:** `7ffe5bb98e7b422a716996caac1870908cda50ac13701bb012bf1f84bfc281c3` (338,651 bytes gz)
- **Shape:** 12 labels, 37,134 state features (net +3,893 vs the fold model: 8,322 added, 4,429 dropped;
  attributes 17,454 = 2,800 added − 1,212 dropped, all 2,800 new attributes also occur in the fold's train
  split; only 239 of the new state features have test-only attributes — VERIFICATION.md §4),
  134 transitions, 16-bit quantized
- **Accuracy:** no fair held-out number exists for this artifact and none is claimed. The estimate for
  the shipped configuration is the fold model's **94.60% sentence / 97.90% token** (same components,
  20% less data — a lower bound in expectation). For the record, `eval-model.py` on the seed-42 / 0.2
  split scores this model at sentence 97.57% / token 99.22%; every one of those lines was in its
  training set, so this is a train-set score and must not be quoted as accuracy.
- **Switch:** `training/ship-model.sh models/brill-porter-full.json.gz` — points `extract-model.mjs` at
  it, archives the fold model's dumps (`features-test.brill-porter.jsonl`, `parsed.brill-porter.jsonl`,
  `parsed-ff.brill-porter.jsonl`), regenerates `src/en/data/model.en.ts`, `features-test.jsonl`,
  `tests/goldens/level1-sample.jsonl`, `parsed.jsonl`, `parsed-ff.jsonl`, prints the model-vs-model
  parse diff, then runs the suite and every harness level. Result recorded in docs/PORTING.md / §7.
- **Kept:** `brill-porter.json.gz` and its archived dumps stay (I4) as the fallback should the full-data
  model ever prove worse. Switching back = `training/ship-model.sh models/brill-porter.json.gz`.
- **Upstream `write_model_config` output** (was `models/brill-porter-full.json`, folded here and removed):
  ```json
  {"feature.minfreq": 0.0, "feature.possible_states": true, "feature.possible_transitions": true,
   "c1": 0.6, "c2": 0.5, "max_iterations": 1500, "num_memories": 3, "epsilon": 1e-05, "period": 10,
   "delta": 5e-05, "linesearch": "MoreThuente", "max_linesearch": 5,
   "datetime": "2026-09-02T20:48:08.851300",
   "stopping_reason": "L-BFGS terminated with the stopping criteria",
   "quantize_bits": 16, "min_abs_weight": null, "split": 0.0, "training_vectors": 81359,
   "sha256": "7ffe5bb98e7b422a716996caac1870908cda50ac13701bb012bf1f84bfc281c3"}
  ```

---

## 2026-09-02 — `models/brill-porter.json.gz` — Brill tags + vanilla Porter stems (accuracy estimate; shipped until the full-data switch)

- **Upstream pin:** `ffd6ae3c6efb9925c40fc9b4454d77b40469ef91` (2.7.0) + `training/preprocess-brill-patch.diff`
- **Tagger:** `natural` 8.1.1 `BrillPOSTagger(Lexicon('EN','NN','NNP'), RuleSet('EN'))` via `BRILL_TAGS_FILE`
- **Stemmer:** `natural` 8.1.1 `PorterStemmer.stem` via `PORTER_STEMS_FILE` (replaces NLTK Snowball
  `EnglishStemmer` — note: upstream at the pin uses Snowball/Porter2, not `PorterStemmer(NLTK_EXTENSIONS)`
  as the porting notes originally said; corrected)
- **Seed / split:** 42 / 0.2
- **Command (repo root):** `training/retrain.sh models/brill-porter.json.gz`
  (= dump-tokens2.py → brill-tag.mjs → dump-feat-tokens.py → porter-stem.mjs →
  `BRILL_TAGS_FILE=… PORTER_STEMS_FILE=… python ip-repo/train.py train --database
  ip-repo/train/data/training.sqlite3 --seed 42 --split 0.2 --save-model models/brill-porter.json.gz`
  → eval-model.py)
- **Environment:** Python 3.12.13, python-crfsuite 0.9.12, nltk 3.10.3, scikit-learn 1.9.0,
  numpy 2.5.2, Node 22.22.2, macOS arm64
- **Training:** 632 L-BFGS iterations, 16 min 42 s, stopping reason "L-BFGS terminated with the
  stopping criteria", trained 2026-09-02T13:26:50
- **sha256:** `5e3e60e4627fad8518d9c06e6e16d090eae9efea41845f392ce9b49eb0705e52` (305,252 bytes gz)
- **Shape:** 12 labels, 33,241 state features, 128 transitions, 16-bit quantized (keys: attributes, labels,
  quantization_scale, quantization_zero_offset, state_features, transitions)
- **Result (train.py table):** sentence **94.60%**, token **97.90%** (micro P 97.88 / R 97.90 / F1 97.88)
- **Standalone re-eval (`eval-model.py`, same env vars):** sentence 0.946042, token 0.979006 — identical
- **Per-label F1:** QTY .997, UNIT .995, PUNC 1.000, PREP .979, B_NAME_TOK .971, I_NAME_TOK .972,
  PURPOSE .969, NAME_SEP .965, SIZE .960, COMMENT .941, NAME_VAR .831, NAME_MOD .583 (support 176)
- **Deltas:** vs the NLTK/NLTK retrain on the same split −0.13pt sentence / −0.07pt token; vs Brill/Snowball +0.01 / 0.00.
  (The released upstream artifact is an 80%-fold model on a random split and scores 97.11/99.02 here
  because it has seen most of these lines; it is not a valid comparison. Equivalence to the released
  package has not been shown. Both this model and upstream's release are 80/20-fold artifacts;
  the full-data retrain below is the release model.)
  Acceptance criterion (combined delta ≲0.3pt) met → SETTLED.
- **Stem divergence measured before training:** Snowball vs natural Porter differ on 544 / 10,553
  vocabulary tokens (5.2%), covering 12,346 / 531,450 corpus token occurrences (2.3%). Most frequent:
  plus→plu, thinly→thinli (Snowball: thin), parsley→parslei, dry→dry (Snowball: dri), freshly→freshli,
  mL→mL (Snowball: ml — natural returns tokens shorter than 3 chars unchanged and un-lowercased).
- **Upstream `write_model_config` output** (was `models/brill-porter.json`, folded here and removed so
  `models/` holds artifacts only):
  ```json
  {"feature.minfreq": 0.0, "feature.possible_states": true, "feature.possible_transitions": true,
   "c1": 0.6, "c2": 0.5, "max_iterations": 1500, "num_memories": 3, "epsilon": 1e-05, "period": 10,
   "delta": 5e-05, "linesearch": "MoreThuente", "max_linesearch": 5,
   "datetime": "2026-09-02T13:26:50.448792",
   "stopping_reason": "L-BFGS terminated with the stopping criteria",
   "quantize_bits": 16, "min_abs_weight": null,
   "sha256": "5e3e60e4627fad8518d9c06e6e16d090eae9efea41845f392ce9b49eb0705e52"}
  ```

## 2026-09-02 (earlier session) — `models/brill-pos.json.gz` — Brill tags, NLTK stems (superseded)

- **Upstream pin:** `ffd6ae3` + the original `preprocess-brill-patch.diff` (BRILL_TAGS_FILE hunk only)
- **Tagger:** `natural` 8.1.1 Brill; **Stemmer:** NLTK Snowball `EnglishStemmer` (upstream stock)
- **Seed / split:** 42 / 0.2
- **Command:** docs/PORTING.md cycle as originally written (`dump-tokens2.py` → `brill-tag.mjs` →
  `BRILL_TAGS_FILE=$PWD/brill-tags.jsonl python ip-repo/train.py train --database
  ip-repo/train/data/training.sqlite3 --seed 42 --split 0.2 --save-model brill-pos.json.gz`);
  reproducible today as `training/retrain.sh models/<new-name>.json.gz --no-stems`
- **Training:** 678–719 L-BFGS iterations (range observed across that session's runs), ~11 min
- **sha256:** `665f451f3000c0a3736c94f38258d8ca8a68b62f73e7adae656fa79688e02e66` (303,541 bytes gz)
- **Shape:** 12 labels, 33,070 state features, 128 transitions, 16-bit quantized
- **Result:** sentence 94.59%, token 97.90% (delta vs baseline −0.14 / −0.07). Settled the tagger
  question (docs/PORTING.md §3.2). Cannot ship: expects NLTK Snowball stems at inference.

## 2026-09-03 — `models/upstream/` — vendored upstream data assets (write-once)

Copied verbatim from `ip-repo/ingredient_parser/en/data/` at the pin
`ffd6ae3c6efb9925c40fc9b4454d77b40469ef91` (MIT, © Tom Strange; the FDC descriptions derive from
USDA FoodData Central, public domain). They exist so `pnpm model` can generate the lazy
foundation-foods modules with Node only (docs/VERIFICATION.md §7); `training/gen-ff-assets.py` is the
Python cross-check and produces byte-identical modules.

| File | sha256 | Generates |
|---|---|---|
| `ingredient_embeddings.35d.glove.txt.gz` (3,429,085 bytes; header 19850 × 35, 19,851 rows) | `eb84ab23474c78527652ab086cff381429802430a5642b43d1c6475955b2998b` | `src/en/data/glove.en.ts` |
| `fdc_ingredients.csv.gz` (144,792 bytes; 11,371 rows) | `900e89e6e23cd6319d16c3a9bfe986114d84caf768f57091fbf0dba161a21dd2` | `src/en/data/fdc.en.ts` |
