#!/usr/bin/env bash
# Deep-evaluation run: parse_ingredient option variants, two-sided, over the seed-42 test split.
# Each variant: Python dump (ship model, Brill/Porter maps) → TS level-3 harness byte diff.
# Usage: training/eval-variants.sh <lines.txt> <outdir>
set -uo pipefail
cd "$(dirname "$0")/.."
LINES="$1"; OUT="$2"; mkdir -p "$OUT"
export BRILL_TAGS_FILE="$PWD/all-tags-ff.jsonl" PORTER_STEMS_FILE="$PWD/all-stems.jsonl"
PY=ip-repo/venv/bin/python
variants=(
  'default|{}'
  'string_units|{"string_units": true}'
  'imperial|{"volumetric_units_system": "imperial"}'
  'metric|{"volumetric_units_system": "metric"}'
  'australian|{"volumetric_units_system": "australian"}'
  'japanese|{"volumetric_units_system": "japanese"}'
  'no_separate_names|{"separate_names": false}'
  'keep_stop_words|{"discard_isolated_stop_words": false}'
  'no_expect_name|{"expect_name_in_output": false}'
  'all_off|{"separate_names": false, "discard_isolated_stop_words": false, "expect_name_in_output": false, "string_units": true}'
)
for v in "${variants[@]}"; do
  name="${v%%|*}"; opts="${v#*|}"
  echo "===== variant $name $opts"
  $PY training/dump-parsed.py "$OUT/parsed-$name.jsonl" --lines "$LINES" --options "$opts" 2>&1 | tail -1
  PARSED_DUMP="$OUT/parsed-$name.jsonl" PARSE_OPTIONS="$opts" HARNESS=full pnpm -s exec vitest run tests/harness/output.test.ts 2>&1 \
    | grep -E "lines [0-9]+; mismatches|\[(diff|threw|should-throw)\]" | head -30
done
echo "ALL VARIANTS DONE"
