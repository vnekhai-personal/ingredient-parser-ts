#!/usr/bin/env bash
# Deep-evaluation run over a lines file: build tag/stem maps for these lines, then level-2
# (feature hashes) and level-3 (ParsedIngredient) two-sided diffs, including error parity
# (where Python raises, the port must raise too).
#   training/eval-fuzz.sh fuzz-lines.txt <outdir>
set -uo pipefail
cd "$(dirname "$0")/.."
LINES="$1"; OUT="$2"; mkdir -p "$OUT"
PY=ip-repo/venv/bin/python
W="$OUT/maps"; mkdir -p "$W"
$PY training/dump-lines.py < "$LINES" > "$W/lines-tokens.jsonl"
cat corpus-tokens.jsonl fdc-tokens.jsonl "$W/lines-tokens.jsonl" > "$W/corpus-tokens.jsonl"
(cd "$W" && node "$OLDPWD/training/brill-tag.mjs" >/dev/null)
$PY training/dump-feat-tokens.py "$W/corpus-tokens.jsonl" "$W/feat.jsonl" >/dev/null
node training/porter-stem.mjs "$W/feat.jsonl" "$W/stems.jsonl" >/dev/null
export BRILL_TAGS_FILE="$W/brill-tags.jsonl" PORTER_STEMS_FILE="$W/stems.jsonl"
echo "===== level 2 (feature hashes)"
$PY training/dump-feature-hashes-lines.py "$LINES" "$OUT/feature-hashes.jsonl"
FEATURE_HASHES="$OUT/feature-hashes.jsonl" HARNESS=full pnpm -s exec vitest run tests/harness/corpus.test.ts 2>&1 | grep -E "lines [0-9]+|mismatches|\[(error|normalise|tokens|pos|features)\]" | head -40
echo "===== level 3 (ParsedIngredient)"
$PY training/dump-parsed.py "$OUT/parsed.jsonl" --lines "$LINES" 2>&1 | tail -1
echo "python errors: $(grep -c '"error"' "$OUT/parsed.jsonl")"
PARSED_DUMP="$OUT/parsed.jsonl" HARNESS=full pnpm -s exec vitest run tests/harness/output.test.ts 2>&1 | grep -E "lines [0-9]+; mismatches|\[(diff|threw|should-throw)\]" | head -60
echo "FUZZ DONE"
