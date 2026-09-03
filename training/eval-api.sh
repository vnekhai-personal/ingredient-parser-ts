#!/usr/bin/env bash
# Two-sided check of the API surfaces the corpus harness does not cover: custom_units,
# parse_multiple_ingredients (explicit units system — its upstream default raises), and
# inspect_parser (token labels + PostProcessor.parsed). Uses <lines.txt>; blank lines included.
#   training/eval-api.sh <lines.txt> <outdir>
set -uo pipefail
cd "$(dirname "$0")/.."
LINES="$1"; OUT="$2"; mkdir -p "$OUT"; PY=ip-repo/venv/bin/python
W="$OUT/maps"; mkdir -p "$W"
CUSTOM='{"punnets":"punnet","rashers":"rasher","glugs":"glug","tubz":"tubz","fl. oz":"fl. oz"}'
# custom singulars + capitalised forms (parse_ingredient_en adds them) must be in the stem map
EXTRA="punnet,Punnet,rasher,Rasher,glug,Glug,tubz,Tubz,fl. oz,Fl. oz,punnets,rashers,glugs"
$PY training/dump-lines.py < "$LINES" > "$W/lines-tokens.jsonl"
cat corpus-tokens.jsonl fdc-tokens.jsonl "$W/lines-tokens.jsonl" > "$W/corpus-tokens.jsonl"
(cd "$W" && node "$OLDPWD/training/brill-tag.mjs" >/dev/null)
$PY training/dump-feat-tokens.py "$W/corpus-tokens.jsonl" "$W/feat.jsonl" --extra "$EXTRA" >/dev/null
node training/porter-stem.mjs "$W/feat.jsonl" "$W/stems.jsonl" >/dev/null
export BRILL_TAGS_FILE="$W/brill-tags.jsonl" PORTER_STEMS_FILE="$W/stems.jsonl"
echo "===== custom_units (level 3)"
$PY training/dump-parsed.py "$OUT/parsed-custom.jsonl" --lines "$LINES" --options "{\"custom_units\": $CUSTOM}" 2>&1 | tail -1
echo "python errors: $(grep -c '"error"' "$OUT/parsed-custom.jsonl")"
PARSED_DUMP="$OUT/parsed-custom.jsonl" PARSE_OPTIONS="{\"custom_units\": $CUSTOM}" HARNESS=full pnpm -s exec vitest run tests/harness/output.test.ts 2>&1 | grep -E "lines [0-9]+; mismatches|\[(diff|threw|should-throw)\]" | head -30
echo "===== parse_multiple_ingredients + inspect_parser"
$PY training/dump-api.py "$LINES" "$OUT/api.jsonl" 2>&1 | tail -1
API_DUMP="$OUT/api.jsonl" HARNESS=full pnpm -s exec vitest run tests/harness/api.test.ts 2>&1 | grep -E "api:|\[(multiple|inspect)\]|Tests " | head -30
echo "API DONE"
