# AGENTS.md — coordination rules

How autonomous agents work in this repository. "The maintainer's word" means an explicit
instruction given in the session, never an inference.

## Repository structure

The authoritative tree is in `CLAUDE.md` §1. Do not create files outside it; no new
top-level directories without approval.

- `src/` — the TS runtime, one module per upstream file. The parity boundary: everything
  here must pass the differential harness.
- `models/` — trained model artifacts. Write-once; every file has a provenance entry in
  `docs/MODELS.md`.
- `training/` — the Python-side retrain, dump and evaluation pipeline, plus the vendored
  corpus (`training/data/`).
- `fixtures/` — `probe-recipes.json`, trap-annotated real ingredient lines. Goldens are
  generated from the pin, never written by hand.
- `tests/` — vitest: `upstream/` (upstream's pytest suite recreated verbatim), `harness/`
  (the differential levels), `goldens/` (generated samples and the committed Python
  references), `quirks/` (both-modes tests for every correction), `eval/` (opt-in
  primitive goldens).
- `docs/` — `PORTING.md`, `VERIFICATION.md`, `QUIRKS.md`, `ARCHITECTURE.md`, `MODELS.md`.
- `notes/` — gitignored private working material (`notes/README.md`); never referenced from
  public docs.
- Root — `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, `LICENSE*`, configs only.

## Session start

1. Read `CLAUDE.md` (constraints, invariants, measured facts).
2. Read `docs/PORTING.md` (decisions, parity discipline) and `docs/QUIRKS.md`.
3. `git log --oneline -15` — what happened since the docs were written.
4. `pnpm typecheck && pnpm test` before changing anything.

## Session end

1. Tests and the relevant harness level pass; accuracy claims carry the seed-42 / 20%
   held-out numbers.
2. Docs updated per the mapping table in `CLAUDE.md` §6.
3. Commit with a message stating what was proven (numbers included), what is in flight, and
   the exact next command.

## File responsibilities

- `docs/PORTING.md` §3 (settled decisions) and `docs/QUIRKS.md` — the maintainer's.
  Reopening a decision needs the maintainer's word and new evidence, recorded in the same
  change; a correction needs a test asserting both modes.
- `models/` — the training pipeline's. Never hand-edit a model; a new experiment is a new
  file with a `docs/MODELS.md` entry.
- `training/preprocess-brill-patch.diff` — the record of a proven run. Extend it with the same
  env-gated pattern; never make it unconditional.
- `fixtures/probe-recipes.json` — append entries with a `style` annotation naming the trap;
  never edit existing lines.
- `src/**` — each module names its upstream counterpart in a header comment; its parity
  status lives in `docs/ARCHITECTURE.md`, updated in the same change.
- The upstream pin (`docs/PORTING.md` §2) — the maintainer's. A pin change is: word → new pin
  → full harness re-run → diff report committed.

## Rules

- The default output is byte-parity with Python at the pin; a change that alters it
  silently is an incident. Corrections go behind `quirks: 'fixed'` with a `docs/QUIRKS.md`
  entry and a both-modes test. Nothing is contributed upstream.
- Never mix taggers or stemmers across the training/inference boundary; any
  linguistic-component change means a retrain and a recorded evaluation.
- Never mutate a shipped or measured model artifact; never hand-edit goldens or the committed
  Python references — regenerate from the pin.
- Never claim parity or accuracy without the harness level or evaluation numbers to show.
- Never break the canonical JSON convention (compact separators, raw unicode) in any
  cross-language map or dump.
- Never change the upstream pin, publish, add a runtime dependency (there are none), or
  accept an accuracy regression beyond the recorded deltas without the maintainer's word.
- Text the maintainer supplies verbatim ships character for character.
- When the maintainer asks a question or describes a problem, the deliverable is the
  assessment; do not change code or state until told. "Stop" means stop immediately.
- No secret ever enters a transcript, a log, or a commit.
- Never commit `venv/`, `node_modules/`, `ip-repo/`, regenerable dumps, or `.env*`.
- Run the tests before committing; never force-push the default branch.
