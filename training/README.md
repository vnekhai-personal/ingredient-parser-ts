# Training pipeline

See docs/PORTING.md §6 for setup and the retrain cycle (~15 min per run). Paths assume the layout
described there (upstream clone as ./ip-repo, venv alongside). These scripts are the record of
proven runs, not a polished CLI.

- retrain.sh               THE frozen cycle: steps below in order, then train + eval (≈15 min)
- dump-tokens2.py          corpus → normalised token lists (the exact lists training looks up)
- brill-tag.mjs            token lists → natural Brill tags (JSONL map)
- dump-feat-tokens.py      token lists → unique stem-input vocabulary (tokens ∪ UNITS values ∪ "!num")
- porter-stem.mjs          vocabulary → natural vanilla PorterStemmer stems (JSONL map)
- preprocess-brill-patch.diff  env-gated upstream patch: BRILL_TAGS_FILE substitutes tags,
                           PORTER_STEMS_FILE substitutes stems (misses raise KeyError — no
                           silent fallback to NLTK); unset = stock upstream behavior
- gen-constants.py         GENERATES src/en/_constants.ts + _htmlEntities.ts from upstream / stdlib
- gen-pint.py              GENERATES src/en/_pintRegistry.ts from a fresh pint registry + pint_extensions.txt
- extract-model.mjs        models/brill-porter-full.json.gz → src/en/data/model.en.ts (runtime asset; `pnpm model`)
- train-full.py            full-data release retrain (no split; upstream trainer/params/export at the pin);
                           BRILL_TAGS_FILE + PORTER_STEMS_FILE required → models/<name>.json.gz + config json
- dump-parsed.py           level-3 dump; model = whatever extract-model.mjs points at (SHIP_MODEL env overrides);
                           pins VECLIB_MAXIMUM_THREADS=1 before numpy loads and re-execs with PYTHONHASHSEED=0 (VERIFICATION.md §3); --foundation-foods / --options / --lines / --limit
- dump-feature-hashes-lines.py  level-2 dump for an ad-hoc lines file, recording Python errors (error parity)
- dump-api.py              two-sided dump of parse_multiple_ingredients + inspect_parser over a lines file
- eval-variants.sh         level-3 diff under every parse-option variant (PARSE_OPTIONS); eval-fuzz.sh: two-sided
                           levels 2+3 incl. error parity for a lines file; eval-api.sh: custom_units + the two APIs
- gen-fuzz-lines.py        the round-1 adversarial line generator (corpus-derived + hand-written classes)
- ship-model.sh            switch the runtime model: seds extract-model.mjs, archives features-test/parsed/
                           parsed-ff dumps as *.<prev>.jsonl, regenerates model.en.ts + all dumps + the level-1
                           sample golden, prints the model-vs-model parse diff, runs suite + HARNESS=full
- extract-ff-assets.mjs    GENERATES src/en/data/glove.en.ts + fdc.en.ts (lazy foundation-foods assets) from
                           models/upstream/*.gz, Node only (`pnpm model`); gen-ff-assets.py is the Python cross-check
- precompute-ff-caches.mjs GENERATES src/en/data/ffcache.en.ts (`pnpm model`, last step): the FDC-side ranker caches
                           (tokenized descriptions, uSIF vectors/norms/constants, BM25 idf) computed by the runtime
                           code itself (tsc scratch build under node_modules/.cache/); marker = sha256 over the gz
                           inputs + the source import closure + natural's version, so any code change regenerates it.
                           Identity with the runtime computation: tests/harness/ffcache.test.ts
- compare-lines.sh         ad-hoc lines through Python AND the TS port, printed + diffed byte for byte
- dump-feature-hashes.py   harness level 2 dump over the full corpus + fixtures (feature-hashes.jsonl);
                           needs tag/stem maps that also cover fixture tokens — recipe below
- dump-features.py         harness level 1 dump: test-split feature dicts + Python labels/scores
                           (features-test.jsonl, ~275 MB, gitignored; same env vars as training)
- eval-model.py            standalone evaluation on the fixed seed-42 / 0.2 split (set the
                           same env vars the model was trained with)
- dump-lines.py            ad-hoc lines → token lists (for parse-time tagging)
- parse-brill.py           parse ad-hoc lines with a Brill model swapped into the clone (its default lines file
                           is a placeholder name — pass your own; superseded by compare-lines.sh)

Canonical JSON convention for every cross-language map (hard-won): compact separators
(",", ":"), raw unicode (ensure_ascii=False / default JSON.stringify). Guard any Python
entry point that uses process pools with `if __name__ == "__main__"` (macOS spawn).

Node deps live in `training/package.json` (`natural` pinned exactly — the tagger/stemmer at
training must match inference). Install with `cd training && npm i`; `brill-tag.mjs`
resolves `natural` from `training/node_modules` regardless of the cwd it is run from.

Level-2 corpus dump recipe (maps must cover corpus AND fixture tokens; from the repo root):
```
python -c "import json; [print(l) for e in json.load(open('fixtures/probe-recipes.json')).values() for l in e['lines']]" > /tmp/fx.txt
ip-repo/venv/bin/python training/dump-lines.py < /tmp/fx.txt > /tmp/fx-tokens.jsonl
cat corpus-tokens.jsonl /tmp/fx-tokens.jsonl > all-tokens.jsonl
(cd /tmp && cp $OLDPWD/all-tokens.jsonl corpus-tokens.jsonl && node $OLDPWD/training/brill-tag.mjs) && cp /tmp/brill-tags.jsonl all-tags.jsonl
ip-repo/venv/bin/python training/dump-feat-tokens.py all-tokens.jsonl all-feat-tokens.jsonl
node training/porter-stem.mjs all-feat-tokens.jsonl all-stems.jsonl
BRILL_TAGS_FILE=$PWD/all-tags.jsonl PORTER_STEMS_FILE=$PWD/all-stems.jsonl \
  ip-repo/venv/bin/python training/dump-feature-hashes.py feature-hashes.jsonl
```

Ad-hoc lines through BOTH sides (Python at the pin with the ship model vs the TS port), printed
side by side and diffed byte for byte: `training/compare-lines.sh lines.txt` (one line per
ingredient; builds the tag/stem maps for those lines, serialises with dump-parsed.py's `ser()`,
runs the level-3 harness on the result via `PARSED_DUMP`).

Foundation-foods goldens. Both `_utils.pos_tag` (used by the FDC description tokenizer) and
`preprocess` read BRILL_TAGS_FILE; stems on the foundation-foods path stay NLTK Snowball in Python
and the verified Snowball port in TS (PORTER_STEMS_FILE only affects CRF features). Steps, from the
repo root:
1. `fdc-tokens.jsonl`: one `{"t": tokenize(description.lower())}` per distinct FDC description
   (11,351 lists; a five-line Python snippet over fdc_ingredients.csv.gz with `_utils.tokenize`).
2. Tag them with `brill-tag.mjs` (it reads `corpus-tokens.jsonl` in its cwd) and concatenate onto
   `all-tags.jsonl` → `all-tags-ff.jsonl`.
3. `BRILL_TAGS_FILE=$PWD/all-tags-ff.jsonl PORTER_STEMS_FILE=$PWD/all-stems.jsonl
   ip-repo/venv/bin/python training/dump-parsed.py parsed-ff.jsonl --foundation-foods` (~20 min).
4. `snowball-stems.jsonl` for tests/harness/snowball.test.ts: NLTK `EnglishStemmer().stem(w)` over
   the corpus + FDC vocabulary (every token, its lowercase, and its hyphen-split parts).

The corpus is vendored at `training/data/training.sqlite3` (provenance: `training/data/README.md`); every
script above reads it from there. `dump-parsed.py` pins `PYTHONHASHSEED=0` (re-exec) and one BLAS thread and
records both in the dump header (VERIFICATION.md §3).
