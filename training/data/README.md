# Vendored training corpus

`training.sqlite3` is a byte-for-byte copy of upstream's `train/data/training.sqlite3` at the pin
(strangetom/ingredient-parser `ffd6ae3c6efb9925c40fc9b4454d77b40469ef91`, release 2.7.0; the file's
last upstream change is commit `45523cc1f292de311fa5d0da3bb30cea2f24eb73`, 2026-05-25).

- sha256 `4deff487687f9640a7075119243a18e8798399e5dea84deecac84595f1a81d62`, 16,429,056 bytes
- one table `en`, 81,416 rows: allrecipes 15,006 · bbc 15,011 · cookstr 15,001 · manual 71 · nyt 30,009 · tc 6,318
  (81,359 usable after discarding OTHER labels — every number in `docs/MODELS.md` derives from this file)

Why it is here: the models are artifacts of a replayable pipeline
(CLAUDE.md I3) and the pipeline must stay replayable if upstream disappears. Every training and dump
script reads this path; `ip-repo/` is still cloned for the Python *code* at the pin.

Licensing: upstream distributes this file publicly under its MIT licence; the sentences were scraped
from the sources named above and remain theirs. This repository is private and the corpus is not
part of the published package (`package.json` `files` excludes `training/`). Write-once (I4): a new
corpus is a new file with a new entry here, never an edit.
