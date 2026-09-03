#!/usr/bin/env bash
# Frozen retrain cycle (docs/PORTING.md §6). Run from the repo root:
#   training/retrain.sh models/<name>.json.gz [--no-stems]
# Produces the model with natural's Brill tags AND natural's vanilla Porter stems
# substituted for NLTK's (both env-gated via training/preprocess-brill-patch.diff).
# --no-stems reproduces the Brill-tags-only variant (models/brill-pos.json.gz).
# ≈15 min on an M-series laptop. Intermediates (*-tokens.jsonl, *-tags.jsonl,
# porter-stems.jsonl) are regenerable and gitignored.
set -euo pipefail
cd "$(dirname "$0")/.."
MODEL="${1:?usage: training/retrain.sh models/<name>.json.gz [--no-stems]}"
PY=ip-repo/venv/bin/python
export BRILL_TAGS_FILE="$PWD/brill-tags.jsonl"
if [[ "${2:-}" != "--no-stems" ]]; then
  export PORTER_STEMS_FILE="$PWD/porter-stems.jsonl"
fi

echo "== 1/5 corpus -> normalised token lists"
$PY training/dump-tokens2.py
echo "== 2/5 token lists -> Brill tags (natural $(node -p "require('./training/node_modules/natural/package.json').version"))"
node training/brill-tag.mjs
echo "== 3/5 token vocabulary -> Porter stems"
$PY training/dump-feat-tokens.py corpus-tokens.jsonl feat-tokens.jsonl
node training/porter-stem.mjs feat-tokens.jsonl porter-stems.jsonl
echo "== 4/5 train (seed 42, split 0.2) -> $MODEL"
echo "   BRILL_TAGS_FILE=$BRILL_TAGS_FILE"
echo "   PORTER_STEMS_FILE=${PORTER_STEMS_FILE:-<unset: NLTK Snowball stems>}"
$PY ip-repo/train.py train --database training/data/training.sqlite3 \
  --seed 42 --split 0.2 --save-model "$MODEL"
echo "== 5/5 standalone re-eval on the same split"
$PY training/eval-model.py "$MODEL"
