"""Harness level 1 dump (docs/PORTING.md §4): the seed-42 / 0.2 test split's ready-made feature
dicts plus the labels and confidences the Python decoder assigns them with a given model.
The TS decoder must reproduce the labels exactly from the same dicts.

Set the SAME env vars the model was trained with (retrain.sh sets both):
  BRILL_TAGS_FILE=$PWD/brill-tags.jsonl PORTER_STEMS_FILE=$PWD/porter-stems.jsonl \
    python training/dump-features.py models/brill-porter.json.gz features-test.jsonl

Output: first line {"model":..., "sha256":..., "count":...}; then one line per sequence
{"features":[{feat: str|bool,...},...], "labels":[...], "scores":[...]} in canonical JSON
(compact separators, raw unicode). Floats are Python repr = shortest round-trip, same as JS.
"""
import hashlib, json, sys
sys.path.insert(0, 'ip-repo')
sys.path.insert(0, 'ip-repo/train')
from pathlib import Path
from sklearn.model_selection import train_test_split
from train.training_utils import load_datasets
from ingredient_parser.inference import NumpyCRFInference

if __name__ == '__main__':
    model_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('features-test.jsonl')
    vectors = load_datasets('training/data/training.sqlite3', 'en',
                            ["bbc", "cookstr", "nyt", "allrecipes", "tc", "manual"],
                            discard_other=True, combine_name_labels=False)
    (_, sentences_test, _, features_test, _, truth_test, _, _, _, tokens_test) = train_test_split(
        vectors.sentences, vectors.features, vectors.labels, vectors.source, vectors.tokens,
        test_size=0.2, stratify=vectors.source, random_state=42)
    tagger = NumpyCRFInference(model_path, False)
    sha = hashlib.file_digest(open(model_path, 'rb'), 'sha256').hexdigest()
    dumps = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False)
    with open(out_path, 'w') as out:
        out.write(dumps({"model": str(model_path), "sha256": sha, "count": len(features_test),
                         "seed": 42, "split": 0.2}) + '\n')
        for X, sentence, truth in zip(features_test, sentences_test, truth_test):
            labels, scores = zip(*tagger.tag_from_features(X))
            out.write(dumps({"sentence": sentence, "features": X, "truth": truth,
                             "labels": list(labels), "scores": list(scores)}) + '\n')
    print(f"wrote {len(features_test):,} sequences -> {out_path}")
