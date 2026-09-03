"""Release retrain on ALL usable corpus lines (no held-out split) with exactly the trainer,
hyper-parameters and export used by upstream's train.py at the pin. The seed-42 / 0.2 held-out
model (models/brill-porter.json.gz, 94.60 / 97.90) remains the accuracy estimate; a full-data
model cannot be scored fairly on this corpus. Env: BRILL_TAGS_FILE + PORTER_STEMS_FILE (corpus maps).

Usage (repo root): python training/train-full.py models/<name>.json.gz
"""
import logging, os, sys, time
from pathlib import Path
sys.path.insert(0, 'ip-repo'); sys.path.insert(0, 'ip-repo/train')
import pycrfsuite
from train.export import export_crfsuite_to_json
from train.trainers import IngredientParserTrainer
from train.training_utils import load_datasets

if __name__ == '__main__':
    assert os.environ.get('BRILL_TAGS_FILE') and os.environ.get('PORTER_STEMS_FILE'), 'set both env vars'
    logging.basicConfig(level=logging.INFO, format='[%(levelname)s] (%(name)s) %(message)s')
    save_model = Path(sys.argv[1])
    vectors = load_datasets('training/data/training.sqlite3', 'en',
                            ['bbc', 'cookstr', 'nyt', 'allrecipes', 'tc', 'manual'],
                            discard_other=True, combine_name_labels=False)
    print(f'{len(vectors.features):,} training vectors (all usable lines, no split)')
    trainer = IngredientParserTrainer(verbose=True)
    # Identical to train_parser_model at the pin.
    trainer.set_params({'feature.minfreq': 0, 'feature.possible_states': True, 'feature.possible_transitions': True,
                        'c1': 0.6, 'c2': 0.5, 'max_linesearch': 5, 'num_memories': 3, 'period': 10,
                        'max_iterations': 1500, 'delta': 5e-5})
    for X, y in zip(vectors.features, vectors.labels):
        trainer.append(X, y)
    crfsuite_path = save_model.parent / (save_model.stem + '.crfsuite')
    t0 = time.time()
    trainer.train(str(crfsuite_path))
    print(f'trained in {time.time() - t0:.0f} s')
    tagger = pycrfsuite.Tagger(); tagger.open(str(crfsuite_path))
    export_crfsuite_to_json(tagger, save_model, quantize_bits=16, min_abs_weight=None)
    config = trainer.write_model_config(save_model, extra_parameters={'quantize_bits': 16, 'min_abs_weight': None, 'split': 0.0, 'training_vectors': len(vectors.features)})
    crfsuite_path.unlink(missing_ok=True)
    print('wrote', save_model, 'config', config)
