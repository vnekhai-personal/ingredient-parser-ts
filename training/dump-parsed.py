"""Harness level 3 dump (docs/PORTING.md §4): parse_ingredient() over every corpus sentence and
every probe-fixture line with the SHIP MODEL, serialised canonically. The TS port must
reproduce every line byte for byte.

Env: BRILL_TAGS_FILE / PORTER_STEMS_FILE covering corpus + fixture tokens (all-tags.jsonl /
all-stems.jsonl, see training/README.md).
Usage: python training/dump-parsed.py [out=parsed.jsonl] [--limit N] [--foundation-foods]
(--foundation-foods needs BRILL_TAGS_FILE to also cover the FDC description token lists: all-tags-ff.jsonl)

Canonical serialisation (mirrored by tests/harness/serialize.ts): dataclasses → objects with
fields in definition order; Fraction → "Fraction(n, d)"; pint Unit → "<Unit('name')>";
str stays str; enums → value; floats → Python repr (json.dumps); None → null.
"""
# DETERMINISM OF THE REFERENCE (audit round 2, VERIFICATION.md §3). Upstream's fuzzy ranker sums float32
# accumulators in the iteration order of a set of STRINGS, i.e. in CPython's per-process hash order,
# so foundation-food confidences (and, on knife-edge lines, the match itself) depend on
# PYTHONHASHSEED. Hash randomisation is fixed at interpreter start, so the script re-executes itself
# with PYTHONHASHSEED=0 when it was started without it (pool workers inherit the env). BLAS is pinned
# to one thread as well: not required for determinism (verified: seed 0 is stable at 8 threads) but
# it keeps the Python side free of Accelerate's multithreaded rounding wobble on shared machines.
# Both pins are recorded in the dump header. Set explicitly by callers that import this module.
import os, sys
HASH_SEED = '0'
if os.environ.get('PYTHONHASHSEED') != HASH_SEED and sys.argv and sys.argv[0].endswith('.py'):
    os.environ['PYTHONHASHSEED'] = HASH_SEED
    os.execv(sys.executable, [sys.executable] + sys.argv)
os.environ.setdefault('VECLIB_MAXIMUM_THREADS', '1')
os.environ.setdefault('OMP_NUM_THREADS', '1')
import re
import json, os, sys
from fractions import Fraction
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
sys.path.insert(0, 'ip-repo')

# The ship model is whatever training/extract-model.mjs points at (the runtime asset's single source
# of truth), so the Python side of every level-3 dump is keyed on the same artifact as the port.
# SHIP_MODEL=models/<m>.json.gz overrides for experiments.
def _ship_model():
    env = os.environ.get('SHIP_MODEL', '').strip()
    if env:
        return env
    m = re.search(r"const SRC = new URL\('\.\./(models/[^']+)', import\.meta\.url\)", Path('training/extract-model.mjs').read_text())
    assert m, 'training/extract-model.mjs: SRC line not found'
    return m.group(1)
MODEL_REL = _ship_model()
MODEL = Path(MODEL_REL).resolve()
assert MODEL.is_file(), f'model not found: {MODEL}'
FOUNDATION_FOODS = '--foundation-foods' in sys.argv
def _flag_value(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None
# --options '{"string_units": true, ...}' → extra parse_ingredient kwargs (JSON); --lines FILE →
# parse these lines (one per line) instead of the corpus + fixtures.
OPTIONS = json.loads(_flag_value('--options') or '{}')
LINES_FILE = _flag_value('--lines')
J = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False)

def _patch_model():
    import ingredient_parser.en.parser as P
    from ingredient_parser.inference import NumpyCRFInference
    from functools import lru_cache
    P.load_parser_model = lru_cache(lambda: NumpyCRFInference(MODEL))

def ser(v):
    import pint
    from ingredient_parser.dataclasses import (IngredientAmount, CompositeIngredientAmount, IngredientText,
                                                FoundationFood, ParsedIngredient, UnitSystem)
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, Fraction):
        return f"Fraction({v.numerator}, {v.denominator})"
    if isinstance(v, pint.Unit):
        return f"<Unit('{v}')>"
    if isinstance(v, UnitSystem):
        return v.value
    if isinstance(v, list):
        return [ser(x) for x in v]
    if isinstance(v, IngredientAmount):
        return {"quantity": ser(v.quantity), "quantity_max": ser(v.quantity_max), "unit": ser(v.unit), "text": v.text,
                "confidence": v.confidence, "starting_index": v.starting_index, "unit_system": ser(v.unit_system),
                "APPROXIMATE": v.APPROXIMATE, "SINGULAR": v.SINGULAR, "RANGE": v.RANGE, "MULTIPLIER": v.MULTIPLIER,
                "PREPARED_INGREDIENT": v.PREPARED_INGREDIENT}
    if isinstance(v, CompositeIngredientAmount):
        return {"amounts": ser(v.amounts), "join": v.join, "subtractive": v.subtractive, "text": v.text,
                "confidence": v.confidence, "starting_index": v.starting_index, "unit_system": ser(v.unit_system)}
    if isinstance(v, IngredientText):
        return {"text": v.text, "confidence": v.confidence, "starting_index": v.starting_index}
    if isinstance(v, FoundationFood):
        return {"text": v.text, "confidence": v.confidence, "fdc_id": v.fdc_id, "category": v.category,
                "data_type": v.data_type, "url": v.url, "name_index": v.name_index}
    if isinstance(v, ParsedIngredient):
        return {"name": ser(v.name), "size": ser(v.size), "amount": ser(v.amount), "preparation": ser(v.preparation),
                "comment": ser(v.comment), "purpose": ser(v.purpose), "foundation_foods": ser(v.foundation_foods),
                "sentence": v.sentence}
    raise TypeError(f"unserialisable {type(v)}")

def work(item):
    _patch_model()
    from ingredient_parser import parse_ingredient
    src, sentence = item
    try:
        parsed = ser(parse_ingredient(sentence, foundation_foods=FOUNDATION_FOODS, **OPTIONS))
        return J({"src": src, "s": sentence, "parsed": parsed})
    except Exception as e:  # upstream raised: record it, the port must raise too
        return J({"src": src, "s": sentence, "error": f"{type(e).__name__}: {e}"})

if __name__ == "__main__":
    assert os.environ.get("BRILL_TAGS_FILE") and os.environ.get("PORTER_STEMS_FILE"), "set both env vars"
    args = [a for a in sys.argv[1:] if not a.startswith('--') and sys.argv[sys.argv.index(a) - 1] not in ('--limit', '--options', '--lines')]
    out_path = Path(args[0]) if args else Path('parsed.jsonl')
    limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
    import sqlite3
    items = []
    if LINES_FILE:
        for line in open(LINES_FILE, encoding='utf-8'):
            items.append(("lines", line.rstrip("\n")))
    else:
        db = sqlite3.connect('training/data/training.sqlite3')
        for (sentence,) in db.execute('select sentence from en'):
            items.append(("corpus", sentence))
        for recipe, entry in json.load(open('fixtures/probe-recipes.json')).items():
            for line in entry['lines']:
                items.append((f"fixture:{recipe}", line))
    if limit: items = items[:limit]
    with ProcessPoolExecutor(max_workers=4) as ex, open(out_path, 'w') as out:
        out.write(J({"model": MODEL_REL, "count": len(items), "options": OPTIONS, "foundation_foods": FOUNDATION_FOODS,
                     "pythonhashseed": os.environ.get("PYTHONHASHSEED"), "blas_threads": os.environ.get("VECLIB_MAXIMUM_THREADS")}) + '\n')
        for line in ex.map(work, items, chunksize=200):
            out.write(line + '\n')
    print(f"wrote {len(items):,} lines -> {out_path}")
