# The `quirks` option

`parse_ingredient`, `parse_multiple_ingredients` and `inspect_parser` accept
`quirks: 'upstream' | 'fixed'`.

- `'upstream'` (default) reproduces the Python library at the pin exactly, including its
  postprocessing quirks. This is what the parity harness verifies.
- `'fixed'` applies the corrections below. Each is asserted in both modes in
  `tests/quirks/quirks.test.ts`.

| Name | Upstream behaviour (default) | With `quirks: 'fixed'` |
|---|---|---|
| `duplicate_unit_tokens` | "1 teaspoon (tsp) salt" carries two unit tokens for one unit; they are joined ("teaspoon tsp") and pint reads the space as a product: `teaspoon ** 2` | unit tokens that all name the same unit (equal, equal after singularising, or listed synonyms) collapse to the first: unit `teaspoon`, text "1 teaspoon". Genuinely different units ("1 pound 2 ounce") are untouched |
| `name_pluralisation` | every text field is re-pluralised for unit-like words, so "flat-leaf parsley" becomes "flat-leaves parsley", "1 bay leaf" becomes "bay leaves", and brand names such as "Original Recipe" become "Recipes" | a name restores only the words the preprocessor singularised on the way in: "2 bay leaves" stays "bay leaves", "1 bay leaf" stays "bay leaf", "flat-leaf" is untouched. Over the training corpus this changes 930 names, each to the author's own word. Amounts and other fields keep upstream's behaviour |
| `section_headers` | a recipe section header without a colon, "For the sauce" or "To serve", comes back as a low-confidence name | when every token is a name token, the first is "For" or "To" and the name's confidence is below 0.6, the line is returned as `purpose` with an empty name, the same shape upstream produces for "For the sauce:" |
| `multiple_ingredients_default` | `parse_multiple_ingredients` defaults `volumetric_units_system` to `"us"`, which its own validation rejects | the default is `"us_customary"` |

Not changed, with reasons: a phrase like "A mess of greens" being labelled as a name is the
model's decision, not postprocessing. Unit words the model never saw (`mls`) are what
`custom_units` is for. Custom-unit singulars containing regex syntax are undefined on both
sides.

## `tag_ingredient`

An addition beyond the upstream API, independent of `quirks`:

```ts
tag_ingredient(sentence, options) // → { sentence, tokens, pos_tags, labels, scores }
```

The model's per-token labels and marginal scores exactly as `parse_ingredient` computes them —
same preprocessing, same model, same `expect_name_in_output` fallback, same `custom_units` —
without the postprocessor. A caller that builds its own structure from labels never meets a
postprocessing quirk or one of the raises upstream's postprocessor produces on some inputs
("dozen eggs or 2" raises in `parse_ingredient`; `tag_ingredient` returns its labels).
