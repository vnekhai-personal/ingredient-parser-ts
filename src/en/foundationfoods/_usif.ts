/**
 * Port of `ingredient_parser/en/foundationfoods/_usif.py` (pin ffd6ae3).
 *
 * numpy dtype emulation (parity core — every choice is a numpy fact, not a preference):
 * - GloVe rows are float32; `_embed` is float32 end to end (`Math.fround` after every op)
 *   except the no-token case, which is `np.zeros(dim) + a` — a FLOAT64 vector. The dtype
 *   of an `Embedding` is carried by its `vec` class (Float32Array vs Float64Array).
 * - `np.linalg.norm(token_vectors, axis=0)` reduces over rows: numpy's inner loop runs along
 *   the contiguous axis, so each column is a SEQUENTIAL float32 sum of float32 squares.
 * - `np.mean(weighted, axis=0)` on float32 stays float32: sequential row adds, then `/ k`.
 * - 1-D `np.linalg.norm` is `sqrt(x.dot(x))`: float32 goes through BLAS sdot (`norm32`, the
 *   documented last-ulp seam in `_np.ts`); float64 is a sequential float64 sum of squares.
 * - `np.dot` in `_cosine_similarity`: float32×float32 → `dot32`; any float64 operand
 *   upcasts to a float64 sequential dot. `norm1 * norm2` and the division follow the same
 *   promotion; `1 - float(...)` is float64.
 * - `(1 - 1 / vocab_size) ** n` is C `pow()` upstream; here `Math.pow` (V8 fdlibm) — libm seam,
 *   only observable through the `prob > threshold` count.
 */
import { dot32, f32, norm32 } from '../../_np.js';
import type { GloVeModel } from '../_embeddings.js';
import { load_embeddings_model } from '../_embeddings.js';
import { load_ff_cache, type FFCache } from '../_loaders.js';
import { FDCIngredientMatch, type FDCIngredient, type IngredientToken } from './_ff_dataclasses.js';
import { load_fdc_ingredients } from './_ff_utils.js';

export type EmbeddingVector = Float32Array | Float64Array;

export interface EmbeddingInit {
  vec: EmbeddingVector;
  norm: number;
}

/** Dataclass for holding an embedding vector and it's norm. */
export class Embedding {
  vec: EmbeddingVector;
  norm: number;

  constructor(f: EmbeddingInit) {
    this.vec = f.vec;
    this.norm = f.norm;
  }
}

/** `np.linalg.norm(vec)` for a 1-D vector, honouring its dtype (see module header). */
function norm_1d(vec: EmbeddingVector): number {
  if (vec instanceof Float32Array) return norm32(vec);
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += (vec[i] as number) * (vec[i] as number);
  return Math.sqrt(s);
}

/**
 * Modified implementation of Unsupervised Smooth Inverse Frequency [1] weighting scheme for
 * calculation of sentence embedding vectors (no piecewise common component removal).
 */
export class uSIF {
  embeddings: GloVeModel;
  embeddings_dimension: number;
  fdc_ingredients: FDCIngredient[];
  token_prob: Map<string, number>;
  min_prob: number;
  a: number;
  fdc_vectors: Embedding[];

  /**
   * With `cache` (the precomputed asset, docs/PORTING.md §3.7) the four derived members are loaded
   * instead of computed; they are what this same code computed at build time
   * (training/precompute-ff-caches.mjs), verified identical by tests/harness/ffcache.test.ts.
   */
  constructor(embeddings: GloVeModel, fdc_ingredients: FDCIngredient[], cache: FFCache | null = null) {
    this.embeddings = embeddings;
    this.embeddings_dimension = embeddings.dimension;

    this.fdc_ingredients = fdc_ingredients;
    if (cache !== null) {
      this.token_prob = this._load_token_probability(cache);
      this.min_prob = cache.raw.usif_min_prob;
      this.a = cache.raw.usif_a;
      this.fdc_vectors = this._load_fdc_vectors(cache);
      return;
    }
    this.token_prob = this._estimate_token_probability(this.fdc_ingredients);
    this.min_prob = Math.min(...this.token_prob.values());
    this.a = this._calculate_a_factor();

    this.fdc_vectors = this._embed_fdc_ingredients();
  }

  /** `_estimate_token_probability` from the cached counts: same insertion order, same `count / total`. */
  _load_token_probability(cache: FFCache): Map<string, number> {
    const token_prob = new Map<string, number>();
    const total = cache.raw.usif_token_total;
    for (const [idx, count] of cache.raw.usif_token_counts) {
      token_prob.set(cache.raw.tokens[idx] as string, count / total);
    }
    return token_prob;
  }

  /** `_embed_fdc_ingredients` from the cached float32 vectors and norms (views into one buffer). */
  _load_fdc_vectors(cache: FFCache): Embedding[] {
    const d = this.embeddings_dimension;
    const n = this.fdc_ingredients.length;
    if (cache.usif_vectors.length !== n * d || cache.usif_norms.length !== n) {
      throw new Error('foundation foods cache (data/ffcache.en.ts) does not match the FDC ingredients: run `pnpm model`');
    }
    const embedded: Embedding[] = [];
    for (let i = 0; i < n; i++) {
      embedded.push(new Embedding({ vec: cache.usif_vectors.subarray(i * d, (i + 1) * d), norm: cache.usif_norms[i] as number }));
    }
    return embedded;
  }

  /** Estimate word probability from the frequency of occurrence of token in FDC ingredient descriptions. */
  _estimate_token_probability(fdc_ingredients: FDCIngredient[]): Map<string, number> {
    const token_counts = new Map<string, number>();
    for (const ingredient of fdc_ingredients) {
      for (const token of ingredient.embedding_tokens) {
        token_counts.set(token, (token_counts.get(token) ?? 0) + 1);
      }
    }

    let total = 0;
    for (const count of token_counts.values()) total += count;
    const token_prob = new Map<string, number>();
    for (const [token, count] of token_counts) token_prob.set(token, count / total);
    return token_prob;
  }

  /** Calculate average sentence length for FDC ingredient descriptions. */
  _average_sentence_length(): number {
    let token_count = 0;
    let sentence_count = 0;
    for (const fdc of this.fdc_ingredients) {
      token_count += fdc.embedding_tokens.length;
      sentence_count += 1;
    }

    return Math.trunc(token_count / sentence_count);
  }

  /** Calculate 'a' factor used in token weight calculations. */
  _calculate_a_factor(): number {
    const average_sentence_length = this._average_sentence_length();

    const vocab_size = this.token_prob.size;
    // Python `float ** int` is C pow(); Math.pow is V8's fdlibm pow (libm seam, see header).
    const threshold = 1 - Math.pow(1 - 1 / vocab_size, average_sentence_length);
    let above = 0;
    for (const prob of this.token_prob.values()) if (prob > threshold) above += 1;
    const alpha = above / vocab_size;
    const Z = 0.5 * vocab_size;
    return (1 - alpha) / (alpha * Z);
  }

  /** Return weight for token (uSIF weight with a part-of-speech multiplier). */
  _weight(token: string, pos_tag: string): number {
    const weight = this.a / (0.5 * this.a + (this.token_prob.get(token) ?? this.min_prob));
    if (pos_tag.startsWith('NN')) {
      return 1.2 * weight;
    } else if (pos_tag.startsWith('JJ')) {
      return 1.05 * weight;
    } else if (pos_tag.startsWith('VB')) {
      return 0.7 * weight;
    } else {
      return weight;
    }
  }

  /** Calculate embedding vectors for all FDC ingredients. */
  _embed_fdc_ingredients(): Embedding[] {
    const embedded: Embedding[] = [];
    for (const fdc of this.fdc_ingredients) {
      const vec = this._embed(fdc.embedding_tokens, fdc.embedding_pos_tags, fdc.embedding_weights);
      const norm = norm_1d(vec);
      embedded.push(new Embedding({ vec, norm }));
    }

    return embedded;
  }

  /** Return single embedding vector for input tokens calculated from the weighted mean of the embeddings for each token. */
  _embed(
    tokens: readonly string[],
    pos_tags: readonly string[],
    phrase_weight: readonly number[],
  ): EmbeddingVector {
    // zip() truncates to the shortest input.
    const n = Math.min(tokens.length, pos_tags.length, phrase_weight.length);
    const tokens_in_vocab: [string, string, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = tokens[i] as string;
      if (this.embeddings.has(t)) tokens_in_vocab.push([t, pos_tags[i] as string, phrase_weight[i] as number]);
    }

    if (tokens_in_vocab.length === 0) {
      // np.zeros(dim) + a: float64.
      const zeros = new Float64Array(this.embeddings_dimension);
      for (let j = 0; j < zeros.length; j++) zeros[j] = 0 + this.a;
      return zeros;
    } else {
      const k = tokens_in_vocab.length;
      const d = this.embeddings_dimension;
      const token_vectors: Float32Array[] = tokens_in_vocab.map(([token]) => this.embeddings.get(token));

      // 1.0 / np.linalg.norm(token_vectors, axis=0): per column, sequential float32 sum of
      // float32 squares over rows, float32 sqrt, float32 reciprocal (weak Python scalar).
      const inv_norm = new Float64Array(d);
      for (let j = 0; j < d; j++) {
        let s = 0;
        for (let i = 0; i < k; i++) {
          const x = (token_vectors[i] as Float32Array)[j] as number;
          s = f32(s + f32(x * x));
        }
        inv_norm[j] = f32(1.0 / f32(Math.sqrt(s)));
      }

      // weighted[i] = (phrase_weight * weight) * normalised[i, :] — the float64 scalar product
      // is cast to float32 before the float32 multiply; np.mean(axis=0) is a sequential
      // float32 row sum divided by k in float32.
      const mean = new Float32Array(d);
      for (let i = 0; i < k; i++) {
        const [token, pos_tag, pw] = tokens_in_vocab[i] as [string, string, number];
        const w = f32(pw * this._weight(token, pos_tag));
        const row = token_vectors[i] as Float32Array;
        for (let j = 0; j < d; j++) {
          const normalised = f32((row[j] as number) * (inv_norm[j] as number));
          const weighted = f32(w * normalised);
          mean[j] = f32((mean[j] as number) + weighted);
        }
      }
      for (let j = 0; j < d; j++) mean[j] = f32((mean[j] as number) / k);
      return mean;
    }
  }

  /** Return cosine similarity score for input vectors. */
  _cosine_similarity(vec1: Embedding, vec2: Embedding): number {
    const both_f32 = vec1.vec instanceof Float32Array && vec2.vec instanceof Float32Array;
    let dot: number;
    if (both_f32) {
      dot = dot32(vec1.vec, vec2.vec);
    } else {
      // float32 operand upcast to float64; float64 dot (sequential — see header).
      dot = 0;
      for (let i = 0; i < vec1.vec.length; i++) dot += (vec1.vec[i] as number) * (vec2.vec[i] as number);
    }
    const norm_product = both_f32 ? f32(vec1.norm * vec2.norm) : vec1.norm * vec2.norm;
    const cosine = both_f32 ? f32(dot / norm_product) : dot / norm_product;
    return 1 - cosine;
  }

  /** Rank and score FDC Ingredients according to closest match to tokens. */
  rank_matches(tokens: readonly IngredientToken[]): FDCIngredientMatch[] {
    const vec = this._embed(
      tokens.map((t) => t.token),
      tokens.map((t) => t.pos_tag),
      tokens.map(() => 1),
    );
    const input_token_vector = new Embedding({ vec, norm: norm_1d(vec) });

    const candidates: FDCIngredientMatch[] = [];
    for (let idx = 0; idx < this.fdc_vectors.length; idx++) {
      const score = this._cosine_similarity(input_token_vector, this.fdc_vectors[idx] as Embedding);
      candidates.push(
        new FDCIngredientMatch({
          fdc: this.fdc_ingredients[idx] as FDCIngredient,
          score: score,
        }),
      );
    }

    // sorted(candidates, key=score): stable ascending.
    const sorted_candidates = candidates.slice().sort((x, y) => x.score - y.score);
    return sorted_candidates;
  }
}

let USIF_RANKER: uSIF | null = null;

/** Cached function for returning instantiated uSIF object. */
export function get_usif_ranker(): uSIF {
  if (USIF_RANKER === null) {
    const embeddings = load_embeddings_model();
    const fdc_ingredients = load_fdc_ingredients();
    USIF_RANKER = new uSIF(embeddings, fdc_ingredients, load_ff_cache());
  }
  return USIF_RANKER;
}
