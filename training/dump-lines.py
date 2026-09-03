"""Dump normalised token lists for ad-hoc lines (stdin) -> jsonl for brill tagging."""
import json, sys
sys.path.insert(0, 'ip-repo')
from ingredient_parser.en.preprocess import PreProcessor
from ingredient_parser.en._utils import tokenize
norm = PreProcessor.__new__(PreProcessor)
norm.singularised_indices = []
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    print(json.dumps({'t': tokenize(norm._normalise(line))}))
