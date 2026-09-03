#!/usr/bin/env bash
# Switch the ship model to <model.json.gz> and regenerate everything that is keyed on it:
# runtime asset, level-1 dump + committed sample, level-3 dumps (plain and foundation foods),
# then run the whole suite and all harness levels. Run from the repo root.
#   training/ship-model.sh models/<name>.json.gz
set -euo pipefail
cd "$(dirname "$0")/.."
MODEL="${1:?usage: training/ship-model.sh models/<name>.json.gz}"
PY=ip-repo/venv/bin/python
[ -f "$MODEL" ] || { echo "no such model: $MODEL"; exit 1; }
sed -i '' "s|const SRC = new URL('../models/[^']*', import.meta.url);|const SRC = new URL('../$MODEL', import.meta.url);|" training/extract-model.mjs
grep -q "$MODEL" training/extract-model.mjs || { echo "extract-model.mjs not updated"; exit 1; }
# Keep the previous model's dumps (write-once spirit): archive them under its name.
PREV="$(grep -o "models/[^']*" training/extract-model.mjs.orig 2>/dev/null | head -1 || true)"
[ -f parsed.jsonl ] && { P="$(head -1 parsed.jsonl | sed -E 's/.*"model":"models\/([^"]+)\.json\.gz".*/\1/')"; for f in features-test parsed parsed-ff; do [ -f "$f.jsonl" ] && cp -n "$f.jsonl" "$f.$P.jsonl"; done; echo "archived previous dumps as *.$P.jsonl"; }
rm -f src/en/data/model.en.ts && pnpm -s model
echo "== level 1 dump"
BRILL_TAGS_FILE=$PWD/brill-tags.jsonl PORTER_STEMS_FILE=$PWD/porter-stems.jsonl $PY training/dump-features.py "$MODEL" features-test.jsonl
$PY - "$MODEL" <<'PYEOF'
import json, sys
N = 60
src = open('features-test.jsonl'); out = open('tests/goldens/level1-sample.jsonl', 'w')
hdr = json.loads(next(src))
hdr.update({"count": N, "sampled_from": "features-test.jsonl (first %d of %d sequences, in split order)" % (N, hdr["count"]),
            "generated_by": "training/dump-features.py %s + head; regenerate, never hand-edit (CLAUDE.md I4)" % sys.argv[1]})
out.write(json.dumps(hdr, separators=(",", ":"), ensure_ascii=False) + '\n')
for i, line in zip(range(N), src): out.write(line)
PYEOF
echo "== level 3 dumps (plain, then foundation foods ≈ 25 min)"
BRILL_TAGS_FILE=$PWD/all-tags-ff.jsonl PORTER_STEMS_FILE=$PWD/all-stems.jsonl $PY training/dump-parsed.py parsed.jsonl
head -1 parsed.jsonl | grep -q "\"model\":\"$MODEL\"" || { echo "parsed.jsonl was not produced with $MODEL"; exit 1; }
BRILL_TAGS_FILE=$PWD/all-tags-ff.jsonl PORTER_STEMS_FILE=$PWD/all-stems.jsonl $PY training/dump-parsed.py parsed-ff.jsonl --foundation-foods
echo "== API dump (parse_multiple_ingredients + inspect_parser over the probe fixtures)"
$PY -c "import json; print('\n'.join(l for e in json.load(open('fixtures/probe-recipes.json')).values() for l in e['lines']))" > fixture-lines.txt
BRILL_TAGS_FILE=$PWD/all-tags-ff.jsonl PORTER_STEMS_FILE=$PWD/all-stems.jsonl $PY training/dump-api.py fixture-lines.txt api.jsonl
echo "== difference vs the previous ship model over the same lines"
$PY - <<'PYEOF'
import json, glob
# Confidences differ for every line under new weights; compare the structure and texts only.
def strip(o):
    if isinstance(o, dict): return {k: strip(v) for k, v in o.items() if k != 'confidence'}
    if isinstance(o, list): return [strip(x) for x in o]
    return o
new = [json.loads(l) for l in open('parsed.jsonl')][1:]
prev_files = [f for f in glob.glob('parsed.*.jsonl') if not f.startswith('parsed-ff')]
for pf in prev_files:
    prev = [json.loads(l) for l in open(pf)][1:]
    if len(prev) != len(new): print(pf, "different line count"); continue
    diffs = [(a['s'], a.get('parsed'), b.get('parsed')) for a, b in zip(prev, new) if strip(a.get('parsed')) != strip(b.get('parsed')) or a.get('error') != b.get('error')]
    print(f"{pf}: {len(diffs)} of {len(new)} lines parse differently ignoring confidences ({100*len(diffs)/len(new):.2f}%)")
    for s, a, b in diffs[:12]:
        na = [n['text'] for n in (a or {}).get('name', [])]; nb = [n['text'] for n in (b or {}).get('name', [])]
        aa = [x.get('text') for x in (a or {}).get('amount', [])]; ab = [x.get('text') for x in (b or {}).get('amount', [])]
        print(f"   {s!r}\n      prev: name={na} amount={aa}\n      new:  name={nb} amount={ab}")
PYEOF
echo "== refresh the committed pinned reference (tests/goldens/parity, gzip -6)"
for f in features-test feature-hashes parsed parsed-ff api snowball-stems; do [ -f "$f.jsonl" ] && gzip -6 -c "$f.jsonl" > "tests/goldens/parity/$f.jsonl.gz"; done
echo "   (update tests/goldens/parity/MANIFEST.md: sha256, sizes, headers, harness numbers)"
echo "== suite"
pnpm -s exec vitest run tests/upstream tests/harness 2>&1 | grep -E "Test Files|Tests |×"
echo "== harness (all levels)"
HARNESS=full pnpm -s exec vitest run tests/harness 2>&1 | grep -E "labels:|value mismatches|lines [0-9]+; mismatches|foundation-foods:|Tests "
echo "SHIP-MODEL DONE for $MODEL"
