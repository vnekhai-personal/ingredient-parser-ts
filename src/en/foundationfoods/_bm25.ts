/**
 * Port of `ingredient_parser/en/foundationfoods/_bm25.py` (pin ffd6ae3). Identifiers verbatim;
 * logging dropped. Dicts are `Map`s so insertion order (and hence tie order) matches Python.
 */
import { pyMean } from '../../_py.js';
import { load_ff_cache, type FFCache } from '../_loaders.js';
import { FDCIngredient, FDCIngredientMatch, type IngredientToken } from './_ff_dataclasses.js';
import { load_fdc_ingredients } from './_ff_utils.js';

/**
 * Implementation of ATIRE BM25 ranking function [1].
 *
 * [1] Trotman, A., Jia, X.F., Crane, M.: Towards an efficient and effective search engine.
 *     In: SIGIR 2012 Workshop on Open Source Information Retrieval, pp. 40–47, Portland (2012)
 */
export class BM25 {
  /** Constant used for influencing the term frequency saturation. */
  k1: number;
  /** Constant used for influencing the effects of different document lengths. */
  b: number;
  /** Average length of ingredient in `corpus`. */
  avgdl: number;
  /** token → (ingredient index in corpus → frequency of the term in that ingredient). */
  t2d: Map<string, Map<number, number>>;
  /** Pre computed inverse document frequency score for every term. */
  idf: Map<string, number>;
  /** List of ingredient lengths. */
  doc_len: number[];
  /** FDC ingredient corpus. */
  corpus: readonly FDCIngredient[];

  /**
   * With `cache` (the precomputed asset, docs/PORTING.md §3.7) `avgdl` and `idf` are loaded instead of
   * computed. `t2d` / `doc_len` are still built here: filling them from a serialised form costs
   * the same Map insertions as building them from the (cached) tokens, so they are not stored.
   */
  constructor(fdc_ingredients: readonly FDCIngredient[], k1: number, b: number, cache: FFCache | null = null) {
    this.k1 = k1;
    this.b = b;

    this.avgdl = 0;
    this.t2d = new Map();
    this.idf = new Map();
    this.doc_len = [];
    this.corpus = [];
    this._initialize(fdc_ingredients, cache);
  }

  get corpus_size(): number {
    return this.doc_len.length;
  }

  /** Calculates frequencies of terms in documents and in corpus. Also computes inverse document frequencies. */
  _initialize(fdc_ingredients: readonly FDCIngredient[], cache: FFCache | null = null): void {
    this.corpus = fdc_ingredients;

    for (let i = 0; i < fdc_ingredients.length; i++) {
      const ingredient = fdc_ingredients[i] as FDCIngredient;
      this.doc_len.push(ingredient.tokens.length);

      for (const token of ingredient.tokens) {
        let docs = this.t2d.get(token);
        if (docs === undefined) {
          docs = new Map();
          this.t2d.set(token, docs);
        }
        docs.set(i, (docs.get(i) ?? 0) + 1);
      }
    }

    if (cache !== null) {
      if (cache.bm25_idf.length !== this.t2d.size) {
        throw new Error('foundation foods cache (data/ffcache.en.ts) does not match the FDC ingredients: run `pnpm model`');
      }
      this.avgdl = cache.raw.bm25_avgdl;
      let k = 0;
      for (const token of this.t2d.keys()) {
        this.idf.set(token, cache.bm25_idf[k] as number);
        k += 1;
      }
      return;
    }

    this.avgdl = pyMean(this.doc_len);

    for (const [token, ingredients] of this.t2d) {
      this.idf.set(token, Math.log(this.corpus_size / ingredients.size));
    }
  }

  /** Rank and score FDC Ingredients according to closest match to tokens; best first. */
  rank_matches(tokens: readonly IngredientToken[]): FDCIngredientMatch[] {
    const ingredient_nouns = new Set<string>();
    for (const t of tokens) if (t.pos_tag.startsWith('N')) ingredient_nouns.add(t.token);

    // defaultdict(float): keys in first-touch order.
    const scores = new Map<number, number>();
    for (const ing_token of tokens) {
      const docs = this.t2d.get(ing_token.token);
      if (docs !== undefined) {
        const idf = this.idf.get(ing_token.token) as number;
        for (const [index, freq] of docs) {
          const denom_constant = this.k1 * (1 - this.b + (this.b * (this.doc_len[index] as number)) / this.avgdl);
          scores.set(index, (scores.get(index) ?? 0) + (idf * freq * (this.k1 + 1)) / (denom_constant + freq));
        }
      }
    }

    // sorted(..., key=score, reverse=True): stable, ties keep insertion order.
    const ranked = [...scores.entries()].sort((x, y) => y[1] - x[1]);
    const matches: FDCIngredientMatch[] = [];
    for (const [index, score] of ranked) {
      const fdc = this.corpus[index] as FDCIngredient;
      if (!fdc.tokens.some((tok) => ingredient_nouns.has(tok))) {
        // Skip any FDC entries that don't share any nouns with the ingredient name tokens.
        continue;
      }

      matches.push(new FDCIngredientMatch({ fdc, score }));
    }

    return matches;
  }
}

let RANKER: BM25 | null = null;

/** Cached function for returning instantiated BM25 object. */
export function get_bm25_ranker(): BM25 {
  if (RANKER === null) {
    const fdc_ingredients = load_fdc_ingredients();
    RANKER = new BM25(fdc_ingredients, 1.5, 0.75, load_ff_cache());
  }
  return RANKER;
}
