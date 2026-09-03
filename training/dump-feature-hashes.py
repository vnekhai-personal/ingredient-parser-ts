"""Harness level 2, full coverage (docs/PORTING.md §4): for every corpus sentence and every
fixtures/probe-recipes.json line, dump the normalised sentence, tokens, POS tags and a
sha256 of the canonical-JSON feature dicts. The TS PreProcessor must reproduce every hash.

Env: BRILL_TAGS_FILE and PORTER_STEMS_FILE must cover corpus + fixture tokens (see the
recipe in tests/upstream/README.md / docs/PORTING.md §4).

Usage: python training/dump-feature-hashes.py [out=feature-hashes.jsonl]
Output lines: {"src":"corpus"|"fixture:<recipe>","s":sentence,"n":normalised,"t":[tokens],
"p":[pos tags],"h":sha256hex}. Canonical JSON: compact separators, raw unicode.
"""
import hashlib, json, os, sqlite3, sys
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, 'ip-repo')

J = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False)

def work(item):
    from ingredient_parser.en import PreProcessor
    src, sentence = item
    p = PreProcessor(sentence, custom_units={})
    feats = p.sentence_features()
    return J({"src": src, "s": sentence, "n": p.sentence,
              "t": [t.text for t in p.tokenized_sentence],
              "p": [t.pos_tag for t in p.tokenized_sentence],
              "h": hashlib.sha256(J(feats).encode("utf-8")).hexdigest()})

if __name__ == "__main__":
    assert os.environ.get("BRILL_TAGS_FILE") and os.environ.get("PORTER_STEMS_FILE"), "set both env vars"
    out_path = sys.argv[1] if len(sys.argv) > 1 else "feature-hashes.jsonl"
    items = []
    db = sqlite3.connect("training/data/training.sqlite3")
    for (sentence,) in db.execute("select sentence from en"):
        items.append(("corpus", sentence))
    fixtures = json.load(open("fixtures/probe-recipes.json"))
    for recipe, entry in fixtures.items():
        for line in entry["lines"]:
            items.append((f"fixture:{recipe}", line))
    with ProcessPoolExecutor(max_workers=4) as ex, open(out_path, "w") as out:
        for line in ex.map(work, items, chunksize=500):
            out.write(line + "\n")
    print(f"wrote {len(items):,} lines -> {out_path}")
