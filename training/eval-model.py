"""Standalone evaluation of an exported model on the exact seed-42 20% test split.
Set BRILL_TAGS_FILE to evaluate a Brill-features model (features must match training)."""
import sys
sys.path.insert(0, 'ip-repo')
sys.path.insert(0, 'ip-repo/train')
from pathlib import Path
from sklearn.model_selection import train_test_split
from train.training_utils import load_datasets
from train.train_model import evaluate
from ingredient_parser.inference import NumpyCRFInference

if __name__ == '__main__':
    model_path = Path(sys.argv[1])
    vectors = load_datasets('training/data/training.sqlite3', 'en',
                            ["bbc", "cookstr", "nyt", "allrecipes", "tc", "manual"],
                            discard_other=True, combine_name_labels=False)
    (_, sentences_test, features_train, features_test, truth_train, truth_test,
     _, source_test, _, tokens_test) = train_test_split(
        vectors.sentences, vectors.features, vectors.labels, vectors.source, vectors.tokens,
        test_size=0.2, stratify=vectors.source, random_state=42)
    print(f"test vectors: {len(features_test):,}")
    tagger = NumpyCRFInference(model_path, False)
    labels_pred = []
    for X in features_test:
        labels, _scores = zip(*tagger.tag_from_features(X))
        labels_pred.append(list(labels))
    stats = evaluate(labels_pred, truth_test, 42, False)
    print(stats)
