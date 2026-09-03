#!/usr/bin/env bash
# Two-sided ad-hoc check: parse each line of <file> with Python at the pin (ship model, Brill
# tags + Porter stems) AND with the TS port, print both summaries, diff byte for byte.
#   training/compare-lines.sh lines.txt            (from the repo root)
set -euo pipefail
cd "$(dirname "$0")/.."
LINES="$(realpath "${1:?usage: training/compare-lines.sh <lines.txt>}")"
PY=ip-repo/venv/bin/python
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
grep -v '^\s*$' "$LINES" > "$W/lines.txt"
$PY training/dump-lines.py < "$W/lines.txt" > "$W/corpus-tokens.jsonl"
(cd "$W" && node "$OLDPWD/training/brill-tag.mjs" >/dev/null)
$PY training/dump-feat-tokens.py "$W/corpus-tokens.jsonl" "$W/feat.jsonl" >/dev/null
node training/porter-stem.mjs "$W/feat.jsonl" "$W/stems.jsonl" >/dev/null
export BRILL_TAGS_FILE="$W/brill-tags.jsonl" PORTER_STEMS_FILE="$W/stems.jsonl"
echo "================ PYTHON (pin ffd6ae3 + ship model)"
$PY - "$W/lines.txt" "$W/parsed.jsonl" <<'PYEOF'
import sys, importlib.util
sys.path.insert(0, 'ip-repo')
spec = importlib.util.spec_from_file_location("dp", "training/dump-parsed.py"); dp = importlib.util.module_from_spec(spec); spec.loader.exec_module(dp)
dp._patch_model()
from ingredient_parser import parse_ingredient
lines = [l.rstrip("\n") for l in open(sys.argv[1])]
with open(sys.argv[2], 'w') as out:
    out.write(dp.J({"model": dp.MODEL_REL, "count": len(lines)}) + "\n")
    for s in lines:
        p = parse_ingredient(s)
        out.write(dp.J({"src": "adhoc", "s": s, "parsed": dp.ser(p)}) + "\n")
        amt = lambda a: a.text if hasattr(a, 'amounts') else (f"{a.quantity}" + (f"-{a.quantity_max}" if a.RANGE else "") + f" {a.unit}").strip() + (" ~" if a.APPROXIMATE else "")
        f = lambda t: f"{t.text} ({t.confidence:.2f})" if t else "-"
        print(f"{s}\n   name: {' | '.join(f'{n.text} ({n.confidence:.2f})' for n in p.name) or '-'}   amount: {' ; '.join(amt(a) for a in p.amount) or '-'}\n   size: {f(p.size)}   prep: {f(p.preparation)}   comment: {f(p.comment)}   purpose: {f(p.purpose)}")
PYEOF
echo "================ TYPESCRIPT (dist/)"
pnpm -s build >/dev/null
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { parse_ingredient } from './dist/index.js';
const amt = (a) => 'amounts' in a ? a.text : (String(a.quantity) + (a.RANGE ? '-' + a.quantity_max : '') + ' ' + String(a.unit)).trim() + (a.APPROXIMATE ? ' ~' : '');
const f = (t) => t ? t.text + ' (' + t.confidence.toFixed(2) + ')' : '-';
for (const s of readFileSync(process.argv[1], 'utf8').split('\n').filter(Boolean)) {
  const p = parse_ingredient(s);
  console.log(s + '\n   name: ' + (p.name.map(n => n.text + ' (' + n.confidence.toFixed(2) + ')').join(' | ') || '-') + '   amount: ' + (p.amount.map(amt).join(' ; ') || '-') + '\n   size: ' + f(p.size) + '   prep: ' + f(p.preparation) + '   comment: ' + f(p.comment) + '   purpose: ' + f(p.purpose));
}" "$W/lines.txt" 2>&1 | grep -v "injected env"
echo "================ BYTE-FOR-BYTE DIFF"
PARSED_DUMP="$W/parsed.jsonl" HARNESS=full pnpm -s exec vitest run tests/harness/output.test.ts 2>&1 | grep -E "lines [0-9]+; mismatches|\[(diff|threw|should-throw)\]"
