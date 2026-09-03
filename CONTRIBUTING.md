# Contributing

This project has a single maintainer. Maintenance is discretionary: there is no support
commitment, no response-time expectation, and no roadmap obligation.

## Issues and pull requests

Issues and pull requests are welcome and may be accepted, reworked or declined at the
maintainer's sole discretion, without obligation to explain. Small, focused changes with a
test have the best chance.

By submitting a contribution you agree that its copyright is assigned to the maintainer, that
it may be modified or relicensed as part of the project, and that it is offered under the
project's MIT licence. Authorship of the project remains with the maintainer.

## What a change needs

- The default output must stay byte-identical to the Python reference at the pin
  (`docs/PORTING.md` §2). `pnpm typecheck && pnpm test` must pass, and any change that can
  touch parsing output must pass `HARNESS=full pnpm harness`.
- A behavioural correction goes behind an explicit option with a documented entry and a test
  asserting both modes. It does not change the default.
- Upstream identifiers stay verbatim; keyword arguments become one trailing options object
  (`tests/upstream/README.md`).
- Model files are write-once; a new model is a new file with a `docs/MODELS.md` entry made
  by the recorded pipeline. Generated files (`src/en/data/*`, `src/en/_constants.ts`,
  `src/en/_pintRegistry.ts`, `src/en/_htmlEntities.ts`) are never edited by hand.
- No runtime dependency beyond `natural` 8.1.1, no Node-only APIs in `src/`.

`CLAUDE.md` and `AGENTS.md` are the working rules for anyone, human or agent, changing the
code; `docs/PORTING.md` explains the decisions behind them.
