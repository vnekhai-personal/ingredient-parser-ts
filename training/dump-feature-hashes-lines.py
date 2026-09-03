"""Level-2 dump (normalised sentence, tokens, tags, feature-dict sha256) for an ad-hoc lines
file, recording Python errors so the port's error parity can be checked.
Usage: python training/dump-feature-hashes-lines.py <lines.txt> <out.jsonl>   (env vars as usual)
"""
import hashlib, json, sys
sys.path.insert(0, 'ip-repo')
from ingredient_parser.en import PreProcessor

J = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False)
n = 0
errs = 0
with open(sys.argv[2], 'w') as out:
    for line in open(sys.argv[1], encoding='utf-8'):
        s = line.rstrip('\n')
        n += 1
        try:
            p = PreProcessor(s, custom_units={})
            out.write(J({"src": "lines", "s": s, "n": p.sentence,
                         "t": [t.text for t in p.tokenized_sentence],
                         "p": [t.pos_tag for t in p.tokenized_sentence],
                         "h": hashlib.sha256(J(p.sentence_features()).encode("utf-8")).hexdigest()}) + "\n")
        except Exception as e:
            errs += 1
            out.write(J({"src": "lines", "s": s, "error": f"{type(e).__name__}: {e}"}) + "\n")
print(f"level-2 dump: {n} lines, {errs} python errors")
