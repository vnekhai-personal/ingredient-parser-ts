# Vendored English Brill tagger data (from `natural` 8.1.1)

The POS tagger the ship model was trained with is `natural` 8.1.1's
`BrillPOSTagger(Lexicon('EN', 'NN', 'NNP'), RuleSet('EN'))` (docs/PORTING.md §3.2, CLAUDE.md I2).
The runtime no longer depends on the `natural` package: its two English data files are vendored
here, the tagger is reimplemented from natural's behaviour in `src/en/_brill.ts`, and the Porter
stemmer is ported from natural's MIT source in `src/en/_porter.ts`. Both are differentially tested
against natural 8.1.1 (a devDependency) in `tests/harness/linguistics.test.ts`, and the whole
corpus goes through every harness level as before.

Write-once (CLAUDE.md I4): a different lexicon or rule set is a different tagger, which means a
retrain and a new model entry.

| File | Origin (`natural@8.1.1`, `lib/natural/brill_pos_tagger/data/English/`) | sha256 | Bytes |
|---|---|---|---|
| `lexicon_from_posjs.json.gz` | `lexicon_from_posjs.json`, gzip -9 -n; 92,662 entries, word → list of categories | gz `47e3a857fcf4e8383fcb76c73325f76da896ce27b31d94039c00525fb260b2be`; uncompressed `260fe4ab86120907e60f69b18686633f5d92de841a558e1d4a474920dbff4af7` | 634,890 (4,014,030 raw) |
| `tr_from_posjs.txt` | verbatim; 18 transformation rules | `879eb8068ec0731a0bd4cd2f6d6bb3f3310f42522183c2d09d01f5144fe7a261` | 539 |

Generated from these by `training/extract-brill.mjs` (`pnpm model`): `src/en/data/brill.en.ts`,
which keeps only what the tagger reads, the first category of each entry, grouped by category
(71 categories; the one entry with an empty word and no categories is dropped).

## Provenance and licences

- `natural` (NaturalNode/natural) is published under the MIT licence (`LICENSE.natural` at the
  repository root carries the notice). Its `brill_pos_tagger/data/English/README.txt` records
  the origin of both files: the lexicon is from https://github.com/dariusk/pos-js and the rules
  are derived from that project's `BrillTransformationRules.js`.
- pos-js states it is licensed under the GNU LGPLv3; it is a JavaScript port of Mark Watson's
  FastTag tagger, itself based on Eric Brill's trained rule set and English lexicon (Brill,
  "A simple rule-based part of speech tagger", ANLC 1992).
- natural's own tagger implementation (`brill_pos_tagger/lib/*.js`, Hugo W.L. ter Doest) carries
  GPL-3.0 headers and is **not** copied: `src/en/_brill.ts` is written from the observed
  behaviour and verified by the differential test.
