/**
 * Port of `ingredient_parser/en/foundationfoods/_fuzzy.py` (pin ffd6ae3).
 *
 * numpy dtype emulation (parity core):
 * - `distances[i, j]` = `np.linalg.norm(a[:, None, :] - b[None, :, :], axis=2)`: element-wise
 *   float32 differences, float32 squares, numpy's float32 PAIRWISE sum along the contiguous
 *   last axis (`normLastAxis32`), float32 sqrt.
 * - `1 / (1 + np.exp(-1 / distances))` is float32 at every step (NEP 50: Python ints are weak
 *   scalars). numpy's float32 `exp` is its own kernel (libm `expf` on arm64); here
 *   `f32(Math.exp(x))` — a documented seam. `np.where(d == 0, 1.0, ...)` stays float32.
 * - The three membership accumulators become np.float32 as soon as a similarity is added
 *   (Python float + np.float32 → float32), so they are rounded to float32 after every add.
 *   The only path that stays float64 (every token an exact match in both) evaluates to
 *   exactly 1.0 in either dtype, so a single float32 emulation is bit-identical.
 * - `set(ingredient_tokens) | set(fdc_tokens)` is a set of STRINGS: CPython's str hash is
 *   randomised per process, so the iteration order — and, through float32 non-associativity,
 *   the last ulp of the accumulators — is NOT stable upstream either. The port iterates the
 *   distinct ingredient tokens in order, then the distinct FDC tokens not already seen.
 * - `rank_matches` iterates `fdc_ids` in the caller's set order (a `PySet`), which feeds the
 *   stable sort and is observable; the default is `set(cache.keys())` built the same way.
 */
import { f32, normLastAxis32 } from '../../_np.js';
import { PySet } from '../../_pyset.js';
import type { GloVeModel } from '../_embeddings.js';
import { load_embeddings_model } from '../_embeddings.js';
import { FDCIngredientMatch, type FDCIngredient, type IngredientToken } from './_ff_dataclasses.js';
import { load_fdc_ingredients } from './_ff_utils.js';

export interface FDCIngredientEmbeddingInit {
  fdc: FDCIngredient;
  vectors: Float32Array[];
}

/** Dataclass pairing an FDC ingredient with the embedding vectors of its tokens. */
export class FDCIngredientEmbedding {
  fdc: FDCIngredient;
  vectors: Float32Array[];

  constructor(f: FDCIngredientEmbeddingInit) {
    this.fdc = f.fdc;
    this.vectors = f.vectors;
  }
}

/** Implementation of fuzzy document distance metric [1] used to determine the most similar FDC ingredient to a given ingredient name. */
export class FuzzyEmbeddingMatcher {
  embeddings: GloVeModel;
  fdc_vector_cache: Map<number, FDCIngredientEmbedding>;
  private readonly _vector_cache = new Map<string, Float32Array>();

  constructor(embeddings: GloVeModel, fdc_ingredients: FDCIngredient[]) {
    this.embeddings = embeddings;

    // Pre-cache FDC token embedding so they aren't regenerated every time
    // `score_matches` is called.
    this.fdc_vector_cache = new Map();
    for (const fdc of fdc_ingredients) {
      this.fdc_vector_cache.set(
        fdc.fdc_id,
        new FDCIngredientEmbedding({
          fdc: fdc,
          vectors: fdc.embedding_tokens.map((t) => this._get_vector(t)),
        }),
      );
    }
  }

  /** Get embedding vector for token (exists solely so this operation can be cached). */
  _get_vector(token: string): Float32Array {
    let vec = this._vector_cache.get(token);
    if (vec === undefined) {
      vec = this.embeddings.get(token);
      this._vector_cache.set(token, vec);
    }
    return vec;
  }

  /** Calculate fuzzy document distance metric between ingredient name and FDC ingredient description (smaller = closer). */
  _fuzzy_document_distance(
    ingredient_tokens: readonly string[],
    fdc_tokens: readonly string[],
    ingredient_vectors: readonly Float32Array[],
    fdc_vectors: readonly Float32Array[],
  ): number {
    // Pre-calculate distances between all pairs of ingredient and FDC token vectors.
    // This is a matrix with shape (len(ingredient_tokens), len(fdc_tokens)).
    // Apply sigmoid transformation, forcing a value of 1 where the distance = 0, to
    // get the similarity scores between all pairs of ingredient and FDC tokens.
    const n = ingredient_vectors.length;
    const m = fdc_vectors.length;
    const similarities: number[][] = [];
    const diff = new Float32Array(n > 0 && m > 0 ? (ingredient_vectors[0] as Float32Array).length : 0);
    for (let i = 0; i < n; i++) {
      const a = ingredient_vectors[i] as Float32Array;
      const row: number[] = new Array<number>(m);
      for (let j = 0; j < m; j++) {
        const b = fdc_vectors[j] as Float32Array;
        for (let x = 0; x < diff.length; x++) diff[x] = f32((a[x] as number) - (b[x] as number));
        const distance = normLastAxis32(diff);
        if (distance === 0) {
          row[j] = 1.0;
        } else {
          row[j] = f32(1 / f32(1 + f32(Math.exp(f32(-1 / distance)))));
        }
      }
      similarities.push(row);
    }

    // Calculate fuzzy intersection from the tokens that are similar in both the
    // ingredient and FDC ingredient name, to the tokens that are similar to only
    // one of the ingredient or FDC name.
    let union_membership = 0.0;
    let ingred_membership = 0.0;
    let fdc_membership = 0.0;

    // SEAM: set(ingredient_tokens) | set(fdc_tokens) iterates in str-hash order (randomised
    // per Python process); see module header for the order used here.
    const token_union: string[] = [];
    const seen = new Set<string>();
    for (const token of [...ingredient_tokens, ...fdc_tokens]) {
      if (!seen.has(token)) {
        seen.add(token);
        token_union.push(token);
      }
    }
    for (const token of token_union) {
      let token_ingred_score = 0.0;
      let token_fdc_score = 0.0;
      const in_ingred = ingredient_tokens.includes(token);
      const in_fdc = fdc_tokens.includes(token);
      if (in_ingred && in_fdc) {
        // Exact match for token in both ingredient and FDC tokens.
        token_ingred_score = 1.0;
        token_fdc_score = 1.0;
      } else if (in_ingred && !in_fdc) {
        // Exact match for token in ingredient tokens.
        token_ingred_score = 1.0;
        // Select the best match in the FDC tokens.
        const ingred_idx = ingredient_tokens.indexOf(token);
        token_fdc_score = Math.max(...(similarities[ingred_idx] as number[]));
      } else if (!in_ingred && in_fdc) {
        // Exact match for token in FDC tokens.
        token_fdc_score = 1.0;
        // Select the best match in the ingredient tokens.
        const fdc_idx = fdc_tokens.indexOf(token);
        token_ingred_score = Math.max(...similarities.map((row) => row[fdc_idx] as number));
      }

      union_membership = f32(union_membership + f32(token_ingred_score * token_fdc_score));
      ingred_membership = f32(ingred_membership + token_ingred_score);
      fdc_membership = f32(fdc_membership + token_fdc_score);
    }

    // Protect against divide by zero errors
    let res: number;
    const denominator = f32(f32(ingred_membership + fdc_membership) - union_membership);
    if (denominator > 0) {
      res = f32(union_membership / denominator);
    } else {
      res = 0;
    }

    return f32(1 - res);
  }

  /** Rank and score FDC Ingredients according to closest match to tokens, optionally limited to `fdc_ids`. */
  rank_matches(tokens: readonly IngredientToken[], fdc_ids?: PySet | null): FDCIngredientMatch[] {
    if (fdc_ids === undefined || fdc_ids === null) {
      fdc_ids = new PySet(this.fdc_vector_cache.keys());
    }

    const token_vectors = tokens.map((t) => this._get_vector(t.token));

    const scored: FDCIngredientMatch[] = [];
    for (const fdc_id of fdc_ids) {
      const fdc_embedding = this.fdc_vector_cache.get(fdc_id);
      if (fdc_embedding === undefined) throw new Error(`KeyError: ${fdc_id}`); // Python: KeyError
      const score = this._fuzzy_document_distance(
        tokens.map((t) => t.token),
        fdc_embedding.fdc.embedding_tokens,
        token_vectors,
        fdc_embedding.vectors,
      );
      scored.push(new FDCIngredientMatch({ fdc: fdc_embedding.fdc, score: score }));
    }

    return scored.sort((x, y) => x.score - y.score);
  }
}

let FUZZY_RANKER: FuzzyEmbeddingMatcher | null = null;

/** Cached function for returning instantiated FuzzyEmbeddingMatcher object. */
export function get_fuzzy_ranker(): FuzzyEmbeddingMatcher {
  if (FUZZY_RANKER === null) {
    const embeddings = load_embeddings_model();
    const fdc_ingredients = load_fdc_ingredients();
    FUZZY_RANKER = new FuzzyEmbeddingMatcher(embeddings, fdc_ingredients);
  }
  return FUZZY_RANKER;
}
