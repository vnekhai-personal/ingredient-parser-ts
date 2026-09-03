"""Dump the unique token vocabulary the stem feature is computed over.

Reads token-list JSONL (corpus-tokens.jsonl from dump-tokens2.py, or dump-lines.py output)
and writes one {"w": token} line per unique value of the set that upstream's
PreProcessor._tokenise() passes to stem(): raw tokens ∪ singularised UNITS values ∪ "!num".
A superset is fine — the patched stem lookup raises on any miss, so nothing can silently
fall back to the Python stemmer.

Usage: python training/dump-feat-tokens.py [in.jsonl=corpus-tokens.jsonl] [out.jsonl=feat-tokens.jsonl] [--extra tok1,tok2]
"""
import json, sys
sys.path.insert(0, 'ip-repo')
from ingredient_parser.en._constants import UNITS

src = sys.argv[1] if len(sys.argv) > 1 else 'corpus-tokens.jsonl'
dst = sys.argv[2] if len(sys.argv) > 2 else 'feat-tokens.jsonl'
# Extra tokens (e.g. custom-unit singulars and their capitalised forms): --extra a,b,c
extra = sys.argv[sys.argv.index('--extra') + 1].split(',') if '--extra' in sys.argv else []

vocab = {"!num"}
vocab.update(UNITS.values())
vocab.update(t for t in extra if t)
with open(src) as f:
    for line in f:
        vocab.update(json.loads(line)['t'])

with open(dst, 'w') as out:
    for w in sorted(vocab):
        out.write(json.dumps({'w': w}, separators=(",", ":"), ensure_ascii=False) + '\n')
print(len(vocab), 'unique tokens ->', dst)
