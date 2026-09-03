"""Two-sided dump for parse_multiple_ingredients and inspect_parser over a lines file.
One JSON line: {"s": sentence, "multiple": <ser(parse_multiple_ingredients([s], volumetric_units_system="us_customary")[0])>,
"inspect": {"labels": [...], "scores": [...], "parsed": <ser(info.PostProcessor.parsed)>}} — errors recorded per field.
Usage: python training/dump-api.py <lines.txt> <out.jsonl>   (env maps as usual)
"""
import json, sys, importlib.util
sys.path.insert(0, 'ip-repo')
spec = importlib.util.spec_from_file_location("dp", "training/dump-parsed.py"); dp = importlib.util.module_from_spec(spec); spec.loader.exec_module(dp)
dp._patch_model()
from ingredient_parser import parse_multiple_ingredients, inspect_parser
J = dp.J
n = 0
with open(sys.argv[2], 'w') as out:
    for line in open(sys.argv[1], encoding='utf-8'):
        s = line.rstrip('\n'); n += 1
        row = {"s": s}
        try:
            row["multiple"] = dp.ser(parse_multiple_ingredients([s], volumetric_units_system="us_customary")[0])
        except Exception as e:
            row["multiple_error"] = f"{type(e).__name__}: {e}"
        try:
            info = inspect_parser(s)
            row["inspect"] = {"labels": [t.label for t in info.PostProcessor.tokens], "scores": [t.score for t in info.PostProcessor.tokens], "parsed": dp.ser(info.PostProcessor.parsed)}
        except Exception as e:
            row["inspect_error"] = f"{type(e).__name__}: {e}"
        out.write(J(row) + "\n")
print(f"wrote {n} lines -> {sys.argv[2]}")
