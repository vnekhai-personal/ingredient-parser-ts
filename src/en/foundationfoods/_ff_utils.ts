/**
 * Port of `ingredient_parser/en/foundationfoods/_ff_utils.py` (pin ffd6ae3). Identifiers
 * verbatim; logging dropped.
 *
 * Stemming here is NLTK Snowball (`snowball_stem`), the stemmer upstream's `_utils.stem` is at
 * the pin — NOT natural's Porter that the CRF features use (`src/en/_utils.ts`); the
 * substitution tables below are written in Snowball stems.
 */
import { PY_ISNUMERIC_EXTRA } from '../_constants.js';
import { PY_PUNCTUATION, PY_S, pyChars } from '../../_py.js';
import { load_embeddings_model } from '../_embeddings.js';
import { load_fdc_rows, load_ff_cache, type FDCRow, type FFCache } from '../_loaders.js';
import { pos_tag, tokenize } from '../_utils.js';
import { AMBIGUOUS_ADJECTIVES, NEGATION_TOKENS, REDUCED_RELEVANCE_TOKENS } from './_ff_constants.js';
import { FDCIngredient, IngredientToken } from './_ff_dataclasses.js';
import { snowball_stem } from './_snowball.js';

export interface TokenizedFDCDescriptionInit {
  tokens: string[];
  pos_tags: string[];
  embedding_tokens: string[];
  embedding_pos_tags: string[];
  embedding_weights: number[];
}

export class TokenizedFDCDescription {
  tokens: string[];
  pos_tags: string[];
  embedding_tokens: string[];
  embedding_pos_tags: string[];
  embedding_weights: number[];

  constructor(d: TokenizedFDCDescriptionInit) {
    this.tokens = d.tokens;
    this.pos_tags = d.pos_tags;
    this.embedding_tokens = d.embedding_tokens;
    this.embedding_pos_tags = d.embedding_pos_tags;
    this.embedding_weights = d.embedding_weights;
  }
}

/** Key of a `(token, next_token)` tuple in `FDC_PHRASE_SUBSTITUTIONS` (TS-native; stems hold no spaces). */
export function phrase_key(token: string, next_token: string): string {
  return `${token} ${next_token}`;
}

// Phrase and token substitutions to normalise spelling of ingredient name tokens to the
// spellings used in the FDC ingredient descriptions.
// All tokens in these dicts are stemmed and lower case.
export const FDC_PHRASE_SUBSTITUTIONS: Map<string, readonly string[]> = new Map([
  // Prevent "cilantro" replacing "coriander" in the context of "coriander seeds".
  [phrase_key('coriand', 'seed'), ['coriand', 'seed']],
  [phrase_key('doubl', 'cream'), ['heavi', 'cream']],
  [phrase_key('garlic', 'granul'), ['garlic', 'powder']],
  [phrase_key('onion', 'granul'), ['onion', 'powder']],
  [phrase_key('glac', 'cherri'), ['maraschino', 'cherri']],
  [phrase_key('ice', 'sugar'), ['powder', 'sugar']],
  [phrase_key('mang', 'tout'), ['snow', 'pea']],
  [phrase_key('plain', 'flour'), ['all', 'purpos', 'flour']],
  [phrase_key('singl', 'cream'), ['light', 'cream']],
  [phrase_key('haa', 'avocado'), ['hass', 'avocado']],
  [phrase_key('broad', 'bean'), ['fava', 'bean']],
  [phrase_key('self', 'rais'), ['self', 'rise']],
  [phrase_key('appl', 'sauc'), ['applesauc']],
]);
export const FDC_TOKEN_SUBSTITUTIONS: Map<string, string> = new Map([
  ['aubergin', 'eggplant'],
  ['beetroot', 'beet'],
  ['capsicum', 'bell'],
  ['chile', 'chili'],
  ['chilli', 'chili'],
  ['coriand', 'cilantro'],
  ['cornflour', 'cornstarch'],
  ['courgett', 'zucchini'],
  ['filo', 'phyllo'],
  ['gherkin', 'pickl'],
  ['mangetout', 'snowpea'],
  ['mint', 'spearmint'],
  ['prawn', 'shrimp'],
  ['puré', 'pure'],
  ['rocket', 'arugula'],
  ['swede', 'rutabaga'],
  ['yoghurt', 'yogurt'],
  ['demerara', 'turbinado'], // i.e. sugar
  ['gruyèr', 'gruyer'], // Gruyère cheese
]);
export const FDC_TOKEN_TO_PHRASE_SUBSTITUTIONS: Map<string, readonly string[]> = new Map([
  ['lemongrass', ['lemon', 'grass']],
  ['low-sodium', ['low', 'sodium']],
  ['long-grain', ['long', 'grain']],
  ['medium-grain', ['medium', 'grain']],
  ['short-grain', ['short', 'grain']],
  ['bone-in', ['bone', 'in']],
  ['water', ['tap', 'water']],
  ['beansprout', ['bean', 'sprout']],
  ['breadcrumb', ['bread', 'crumb']],
]);

// Types of pasta that should be normalised to "pasta, dry". The names are stemmed.
// Note that spaghetti is excluded because it can also refer to a type of squash.
export const PASTA_TYPES: readonly string[] = [
  'bucatini',
  'conchigli', // conchiglie
  'ditalini',
  'farfall', // farfalle
  'fettuccin', // fettuccine
  'fusilli',
  'gemelli',
  'lasagn', // lasagne
  'lasagna',
  'linguin', // linguine
  'macaroni',
  'orecchiett', // orecchiette
  'orzo',
  'paccheri',
  'pappardell', // pappardelle
  'penn', // penne
  'rigatoni',
  'rotini',
  'stellin', // stelline
  'tagliatell', // tagliatelle
];
for (const type_ of PASTA_TYPES) {
  FDC_TOKEN_TO_PHRASE_SUBSTITUTIONS.set(type_, ['pasta', 'dri']);
}

/**
 * Normalise spelling in `tokens` to standard spellings used in FDC ingredient descriptions.
 * This also include substitution of certain ingredients to use the FDC version e.g.
 * courgette -> zucchini; coriander -> cilantro.
 */
export function normalise_spelling(tokens: readonly IngredientToken[]): IngredientToken[] {
  // Upstream iterates `enumerate(iter(tokens))` and skips the consumed next token with
  // `consume(itokens, 1)`. The enumerate counter `i` is NOT advanced by the skip, so after a
  // phrase substitution `i` lags the iterator position by one and `next_token` is read from
  // `tokens[i + 1]` — i.e. the CURRENT token — for the rest of the sentence. Mirrored: `pos`
  // is the iterator, `i` the enumerate counter.
  let pos = 0;
  let i = 0;

  const normalised_tokens: IngredientToken[] = [];
  while (pos < tokens.length) {
    const ing_token = tokens[pos] as IngredientToken;
    pos += 1;
    const token = ing_token.token.toLowerCase();
    let next_token: string;
    if (i < tokens.length - 1) {
      next_token = (tokens[i + 1] as IngredientToken).token.toLowerCase();
    } else {
      next_token = '';
    }

    const phrase = FDC_PHRASE_SUBSTITUTIONS.get(phrase_key(token, next_token));
    const to_phrase = phrase === undefined ? FDC_TOKEN_TO_PHRASE_SUBSTITUTIONS.get(token) : undefined;
    const single = phrase === undefined && to_phrase === undefined ? FDC_TOKEN_SUBSTITUTIONS.get(token) : undefined;
    if (phrase !== undefined) {
      for (const t of phrase) normalised_tokens.push(new IngredientToken({ token: t, pos_tag: ing_token.pos_tag }));
      // Jump forward to avoid processing next_token again.
      pos += 1;
    } else if (to_phrase !== undefined) {
      for (const t of to_phrase) normalised_tokens.push(new IngredientToken({ token: t, pos_tag: ing_token.pos_tag }));
    } else if (single !== undefined) {
      normalised_tokens.push(new IngredientToken({ token: single, pos_tag: ing_token.pos_tag }));
    } else {
      normalised_tokens.push(ing_token);
    }
    i += 1;
  }

  return normalised_tokens;
}

const PREPARE_TOKENS_CACHE = new Map<string, readonly IngredientToken[]>();
const PREPARE_TOKENS_CACHE_MAXSIZE = 512;
// Python str.isnumeric()/isdigit()/isdecimal(): every code point is category N or has a numeric
// value outside N (CJK numerals like 五 — PY_ISNUMERIC_EXTRA, generated from unicodedata).
const NUMERIC_CHAR_RE = /^\p{N}$/u;
function pyIsNumeric(tok: string): boolean {
  if (tok === '') return false;
  for (const ch of tok) {
    if (!NUMERIC_CHAR_RE.test(ch) && !PY_ISNUMERIC_EXTRA.has(ch.codePointAt(0) as number)) return false;
  }
  return true;
}
const SPACE_RE = new RegExp(`^${PY_S}+$`, 'u');

/**
 * Prepare tokens for use with embeddings model. This involves obtaining the stem for the
 * token and discarding tokens which are numeric, which are punctuation, or which are in
 * STOP_WORDS. Cached like upstream's `lru_cache(maxsize=512)`; returns a fresh array.
 */
export function prepare_tokens(tokens: readonly IngredientToken[]): IngredientToken[] {
  const key = tokens.map((t) => `${t.token}\u0000${t.pos_tag}`).join('\u0001');
  const cached = PREPARE_TOKENS_CACHE.get(key);
  if (cached !== undefined) return [...cached];

  // Split tokens on hyphens
  const split_tokens: IngredientToken[] = [];
  for (const ing_token of tokens) {
    if (ing_token.token.includes('-')) {
      const token_parts = ing_token.token.split('-').filter((t) => t !== '');
      for (const p of token_parts) split_tokens.push(new IngredientToken({ token: p, pos_tag: ing_token.pos_tag }));
    } else {
      split_tokens.push(ing_token);
    }
  }

  // str.isnumeric()/isdigit()/isdecimal() → every code point in Unicode category N;
  // str.isspace() → PY_S; `tok not in string.punctuation` is a SUBSTRING test; len() by code point.
  const stemmed_tokens: IngredientToken[] = [];
  for (const ing_token of split_tokens) {
    const tok = ing_token.token;
    if (
      !pyIsNumeric(tok) &&
      !SPACE_RE.test(tok) &&
      !PY_PUNCTUATION.includes(tok) &&
      pyChars(tok).length > 1
    ) {
      stemmed_tokens.push(new IngredientToken({ token: snowball_stem(tok.toLowerCase()), pos_tag: ing_token.pos_tag }));
    }
  }

  const result = normalise_spelling(stemmed_tokens);
  if (PREPARE_TOKENS_CACHE.size >= PREPARE_TOKENS_CACHE_MAXSIZE) {
    const oldest = PREPARE_TOKENS_CACHE.keys().next().value;
    if (oldest !== undefined) PREPARE_TOKENS_CACHE.delete(oldest);
  }
  PREPARE_TOKENS_CACHE.set(key, result);
  return [...result];
}

let FDC_INGREDIENTS: FDCIngredient[] | null = null;

/** Cached function for loading FDC ingredients from CSV. */
export function load_fdc_ingredients(): FDCIngredient[] {
  if (FDC_INGREDIENTS !== null) return FDC_INGREDIENTS;

  const cache = load_ff_cache();
  if (cache !== null) {
    FDC_INGREDIENTS = load_fdc_ingredients_from_cache(load_fdc_rows(), cache);
    return FDC_INGREDIENTS;
  }

  const foundation_foods: FDCIngredient[] = [];
  for (const row of load_fdc_rows()) {
    const tokenized_description = tokenize_fdc_description(row.description);
    if (tokenized_description.embedding_tokens.length === 0) {
      continue;
    }
    foundation_foods.push(
      new FDCIngredient({
        fdc_id: row.fdc_id,
        data_type: row.data_type,
        description: row.description,
        category: row.category,
        tokens: tokenized_description.tokens,
        pos_tags: tokenized_description.pos_tags,
        embedding_tokens: tokenized_description.embedding_tokens,
        // Upstream passes `pos_tags` here, not `embedding_pos_tags` — ported as is.
        embedding_pos_tags: tokenized_description.pos_tags,
        embedding_weights: tokenized_description.embedding_weights,
      }),
    );
  }

  FDC_INGREDIENTS = foundation_foods;
  return foundation_foods;
}

/**
 * The precomputed form of the loop above (training/precompute-ff-caches.mjs ran
 * `tokenize_fdc_description` over every row at build time): same rows kept, same field values,
 * `embedding_pos_tags` the same array as `pos_tags` (upstream's quirk, mirrored above).
 */
function load_fdc_ingredients_from_cache(rows: readonly FDCRow[], cache: FFCache): FDCIngredient[] {
  const foundation_foods: FDCIngredient[] = [];
  let entry = 0;
  let tok = 0;
  let emb = 0;
  for (let r = 0; r < rows.length; r++) {
    if (cache.skipped_rows.has(r)) continue;
    const row = rows[r] as FDCRow;
    const n_tokens = cache.lengths[2 * entry] as number;
    const n_emb = cache.lengths[2 * entry + 1] as number;
    const tokens = new Array<string>(n_tokens);
    const pos_tags = new Array<string>(n_tokens);
    for (let j = 0; j < n_tokens; j++) {
      tokens[j] = cache.raw.tokens[cache.token_idx[tok + j] as number] as string;
      pos_tags[j] = cache.raw.tags[cache.tag_idx[tok + j] as number] as string;
    }
    const embedding_tokens = new Array<string>(n_emb);
    const embedding_weights = new Array<number>(n_emb);
    for (let j = 0; j < n_emb; j++) {
      embedding_tokens[j] = cache.raw.tokens[cache.emb_idx[emb + j] as number] as string;
      embedding_weights[j] = cache.raw.weights[cache.weight_idx[emb + j] as number] as number;
    }
    tok += n_tokens;
    emb += n_emb;
    entry += 1;
    foundation_foods.push(
      new FDCIngredient({
        fdc_id: row.fdc_id,
        data_type: row.data_type,
        description: row.description,
        category: row.category,
        tokens,
        pos_tags,
        embedding_tokens,
        embedding_pos_tags: pos_tags,
        embedding_weights,
      }),
    );
  }
  if (entry !== cache.raw.entries || tok !== cache.token_idx.length || emb !== cache.emb_idx.length) {
    throw new Error('foundation foods cache (data/ffcache.en.ts) is inconsistent: run `pnpm model`');
  }
  return foundation_foods;
}

/**
 * Tokenize FDC ingredient description, returning tokens and weight for each token. Tokens that
 * are not compatible with the embeddings are discarded. Weights are 1 - 1e-3 × phrase index
 * (phrases split on commas); negated tokens (after "no", "not", "without") get 0; tokens after a
 * reduced-relevance token ("with", "on") lose 0.5.
 */
export function tokenize_fdc_description(description: string): TokenizedFDCDescription {
  const embeddings = load_embeddings_model();
  const tokens = tokenize(description.toLowerCase());
  const tagged = pos_tag(tokens);
  // `_, pos_tags = list(zip(*pos_tag(tokens)))` raises on an empty description.
  if (tagged.length === 0) throw new Error('not enough values to unpack (expected 2, got 0)'); // Python: ValueError
  const pos_tags = tagged.map((p) => p[1]);
  const prepared_tokens = prepare_tokens(
    tokens.map((tok, j) => new IngredientToken({ token: tok, pos_tag: pos_tags[j] as string })),
  );

  const embedding_weights: number[] = [];
  // Typed loosely because of the comma branch below, which appends a whole list as one
  // element exactly like upstream; that branch is unreachable at the pin ("," is not in the
  // embeddings vocabulary — if it were, upstream would raise `unhashable type: 'list'` downstream).
  const prepared_embedding_tokens: (string | string[])[] = [];
  const prepared_embedding_pos_tags: (string | string[])[] = [];
  let phrase_count = 0;
  // itertools.groupby(zip(tokens, pos_tags), key=lambda x: x[0] != ","): consecutive runs.
  let start = 0;
  while (start < tokens.length) {
    const is_phrase = tokens[start] !== ',';
    let end = start + 1;
    while (end < tokens.length && (tokens[end] !== ',') === is_phrase) end += 1;
    const group: [string, string][] = [];
    for (let j = start; j < end; j++) group.push([tokens[j] as string, pos_tags[j] as string]);
    start = end;

    if (!is_phrase) {
      // If not phrase (i.e. is the comma), set weight to 0 if token is in vocab.
      // These tokens will be discarded later anyway.
      // Upstream's `phrase` is the live groupby iterator: the `for` takes the first comma and,
      // if it is in vocab, the comprehensions drain the REST of the group (tokens, then an
      // already-exhausted iterator for the tags), after which the `for` loop ends.
      const first = group[0] as [string, string];
      if (embeddings.has(first[0])) {
        prepared_embedding_tokens.push(group.slice(1).map(([tok]) => tok));
        prepared_embedding_pos_tags.push([]);
        embedding_weights.push(0.0);
      }
      continue;
    }

    const phrase_tags = prepare_tokens(group.map(([t, tag]) => new IngredientToken({ token: t, pos_tag: tag })))
      .filter((tok) => embeddings.has(tok.token))
      .map((tok) => tok.pos_tag);
    const phrase = prepare_tokens(group.map(([t, tag]) => new IngredientToken({ token: t, pos_tag: tag })))
      .filter((tok) => embeddings.has(tok.token))
      .map((tok) => tok.token);
    const phrase_weights: number[] = new Array<number>(phrase.length).fill(1.0 - phrase_count * 1e-3);

    // Check for negated tokens and set weight to 0.
    for (const neg of NEGATION_TOKENS) {
      const neg_index = phrase.indexOf(neg);
      if (neg_index !== -1) {
        // Include negation token negated_tokens set since it won't hold any
        // further relevant semantic information.
        for (let neg_idx = neg_index; neg_idx < phrase.length; neg_idx++) {
          phrase_weights[neg_idx] = 0;
        }
      }
    }

    // Check for tokens that indicate reduced relevance and reduce their weight
    for (const rr of REDUCED_RELEVANCE_TOKENS) {
      const rr_index = phrase.indexOf(rr);
      if (rr_index !== -1) {
        for (let rr_idx = rr_index; rr_idx < phrase.length; rr_idx++) {
          phrase_weights[rr_idx] = Math.max((phrase_weights[rr_idx] as number) - 0.5, 0);
        }
      }
    }

    prepared_embedding_tokens.push(...phrase);
    prepared_embedding_pos_tags.push(...phrase_tags);
    embedding_weights.push(...phrase_weights);
    phrase_count += 1;
  }

  return new TokenizedFDCDescription({
    tokens: prepared_tokens.map((t) => t.token),
    pos_tags: prepared_tokens.map((t) => t.pos_tag),
    embedding_tokens: prepared_embedding_tokens as string[],
    embedding_pos_tags: prepared_embedding_pos_tags as string[],
    embedding_weights,
  });
}

/**
 * Strip ambiguous leading adjectives (e.g. "hot": temperature or spiciness) from the list of
 * tokens. If all tokens are ambiguous adjectives, return the original list rather than an
 * empty list.
 */
export function strip_ambiguous_leading_adjectives(tokens: readonly IngredientToken[]): IngredientToken[] {
  const original_tokens = tokens;
  let current = tokens;
  // `tokens[0]` on an empty list raises IndexError upstream; here a TypeError, same outcome.
  while (
    (current[0] as IngredientToken).pos_tag.startsWith('J') &&
    AMBIGUOUS_ADJECTIVES.includes((current[0] as IngredientToken).token)
  ) {
    current = current.slice(1);

    if (current.length === 0) break;
  }

  if (current.length === 0) return [...original_tokens];

  return [...current];
}
