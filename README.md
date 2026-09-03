# ingredient-parser-typescript

A TypeScript port of [strangetom/ingredient-parser](https://github.com/strangetom/ingredient-parser)
(Python, MIT): a CRF-based parser that turns English recipe ingredient sentences into
structured data — name, amounts, size, preparation, comment, purpose, and optional
foundation-food (USDA FDC) matches.

Pure ESM, no native dependencies, no Node-only APIs: it runs in Node, in browsers and on
React Native 0.81+ (Hermes), where it parses as the user types, on device, offline.

## Usage

```ts
import { parse_ingredient } from 'ingredient-parser-typescript';

const p = parse_ingredient('2 tbsp olive oil, divided');
p.name[0].text;          // 'olive oil'
p.amount[0].quantity;    // Fraction(2, 1) — exact rational, bigint-backed
p.amount[0].unit;        // pint-style Unit: tablespoon
p.preparation?.text;     // 'divided'

// Options mirror upstream: separate_names, discard_isolated_stop_words, expect_name_in_output,
// string_units, volumetric_units_system ('us_customary' | 'imperial' | 'metric' | 'australian' |
// 'japanese'), custom_units ({ plural: singular }), foundation_foods.
parse_ingredient('250 mls chicken broth', { custom_units: { mls: 'ml' } }).amount[0].text; // '250 mls'
```

Foundation foods live behind a separate entry point, so their ~8 MB of assets are only bundled
by apps that import it. Call the preload once, then pass the flag:

```ts
import { parse_ingredient } from 'ingredient-parser-typescript';
import { preload_foundation_foods } from 'ingredient-parser-typescript/foundation-foods';
await preload_foundation_foods();
parse_ingredient('1 large red onion', { foundation_foods: true }).foundation_foods[0].fdc_id; // 790577
```

Two additions beyond the upstream API:

```ts
// Upstream's postprocessing quirks, corrected. The default reproduces Python exactly;
// 'fixed' applies the documented corrections (docs/QUIRKS.md).
parse_ingredient('1 teaspoon (tsp) salt', { quirks: 'fixed' }).amount[0].unit; // teaspoon (upstream: teaspoon ** 2)
parse_ingredient('1 cup flat-leaf parsley', { quirks: 'fixed' }).name[0].text;  // 'flat-leaf parsley' (upstream: 'flat-leaves parsley')

// The model's labels without the postprocessor, for callers that build their own structure.
import { tag_ingredient } from 'ingredient-parser-typescript';
tag_ingredient('2 tbsp chopped flat-leaf parsley');
// { tokens: ['2','tbsp','chopped','flat-leaf','parsley'], labels: ['QTY','UNIT','PREP','B_NAME_TOK','I_NAME_TOK'], scores, pos_tags, sentence }
```

`parse_multiple_ingredients` and `inspect_parser` are exported as upstream defines them.

## Fidelity

By default the parser reproduces the Python library at commit
`ffd6ae3c6efb9925c40fc9b4454d77b40469ef91` (release 2.7.0) byte for byte on every input that
has been measured: all 81,416 corpus sentences and 107 fixture lines under every option
combination, about 60,000 adversarial lines, and the same on Hermes. With `foundation_foods`
it selects the same FDC entries; the match confidence can differ in its last digit on about
4% of lines, a float32 seam inherited from upstream's own nondeterminism. The Python side of
every comparison is committed and the whole harness replays without Python. Details, numbers
and the documented limits: [docs/VERIFICATION.md](docs/VERIFICATION.md).

The parity version is the git tag `v2.7.0-parity`. From there the port evolves on its own
terms: upstream is tracked and its changes adopted deliberately, while corrections ship behind
`quirks: 'fixed'` with before/after tests ([docs/QUIRKS.md](docs/QUIRKS.md)).

## Model

The shipped model is a CRF retrained with the port's own linguistic components — the Brill
tagger and Porter stemmer from the `natural` package, the one runtime dependency — on all
81,359 usable corpus lines. The accuracy estimate for that configuration is the same
components trained with 20% held out: 94.60% of sentences and 97.90% of tokens exact, against
94.73% / 97.97% for upstream's NLTK components retrained on the same split. Provenance of
every artifact: [docs/MODELS.md](docs/MODELS.md).

## Layout

```
src/                    runtime, one module per upstream file (docs/ARCHITECTURE.md)
tests/                  vitest: upstream's suite recreated verbatim, the differential harness,
                        committed Python references, quirks tests, opt-in primitive goldens
models/                 write-once model artifacts and vendored upstream data
training/               retrain, dump and evaluation pipeline; vendored training corpus
fixtures/               107 annotated real ingredient lines
docs/                   PORTING.md · VERIFICATION.md · QUIRKS.md · ARCHITECTURE.md · MODELS.md
```

```
pnpm install && pnpm typecheck && pnpm test   # no Python needed
HARNESS=full pnpm harness                      # every parity level from the committed references
```

## Status and support

Ported, verified, in production use. Single maintainer, discretionary maintenance: see
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. Upstream code, model and data are MIT © Tom Strange (`LICENSE.upstream`); this port keeps
that attribution. `natural` is MIT. The FDC descriptions derive from USDA FoodData Central
(public domain).
