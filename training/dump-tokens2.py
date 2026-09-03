"""Dump tokenize(normalised sentence) for every corpus sentence — the exact token
lists the training-time patch will look up."""
import json, sqlite3, sys
sys.path.insert(0, 'ip-repo')
from ingredient_parser.en.preprocess import PreProcessor
from ingredient_parser.en._utils import tokenize

norm = PreProcessor.__new__(PreProcessor)  # skip __init__ (which would tag)
norm.singularised_indices = []

db = sqlite3.connect('training/data/training.sqlite3')
seen = set()
with open('corpus-tokens.jsonl', 'w') as out:
    for (sentence,) in db.execute('select sentence from en'):
        toks = tokenize(norm._normalise(sentence))
        key = json.dumps(toks)
        if key in seen: continue
        seen.add(key)
        out.write(json.dumps({'t': toks}) + '\n')
print(len(seen), 'unique normalised token lists')
