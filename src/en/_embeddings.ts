/**
 * Port of `ingredient_parser/en/_embeddings.py` (pin ffd6ae3). Identifiers verbatim; Python
 * dunder protocols map to `has` (`__contains__`), `get` (`__getitem__`), `get_default` (`get`),
 * `length` (`__len__`), `toString` (`__str__`).
 *
 * The vectors come from the generated asset (`load_glove_asset()`), which is decoded once by
 * `preload_foundation_foods()`; `_binarize_vectors` is not ported — nothing upstream reads
 * `binarized_vectors`.
 */
import { load_glove_asset, type GloVeAsset } from './_loaders.js';

/** Class to interact with GloVe embeddings. */
export class GloVeModel {
  /** Header value of the vec file (upstream stores the header, not the row count). */
  vocab_size: number;
  dimension: number;
  private readonly vectors: Map<string, Float32Array>;

  constructor(asset: GloVeAsset) {
    this.vocab_size = asset.vocab_size ?? asset.vocab.length;
    this.dimension = asset.dimension;
    this.vectors = new Map();
    // Dict semantics: rows in file order, a later duplicate token overwrites the earlier row.
    for (let i = 0; i < asset.vocab.length; i++) {
      const row = asset.vectors.subarray(i * asset.dimension, (i + 1) * asset.dimension);
      this.vectors.set(asset.vocab[i] as string, row);
    }
  }

  /** `__str__`. */
  toString(): string {
    return `GloVeModel(vocab_size=${this.vocab_size}, dimensions=${this.dimension})`;
  }

  /** `__len__`. */
  get length(): number {
    return this.vocab_size;
  }

  /** `__contains__`. */
  has(token: string): boolean {
    return this.vectors.has(token);
  }

  /** `__getitem__` — a read-only view of the row (no copy). */
  get(token: string): Float32Array {
    const v = this.vectors.get(token);
    if (v === undefined) throw new Error(`KeyError: ${token}`); // Python: KeyError
    return v;
  }

  /** If token in vector keys, return vector, otherwise return default. */
  get_default<T>(token: string, default_: T): Float32Array | T {
    const v = this.vectors.get(token);
    return v === undefined ? default_ : v;
  }
}

let MODEL: GloVeModel | null = null;
let MODEL_ASSET: GloVeAsset | null = null;

/** Cached function for loading the embeddings model (`_loaders.load_embeddings_model`). */
export function load_embeddings_model(): GloVeModel {
  const asset = load_glove_asset();
  if (MODEL === null || MODEL_ASSET !== asset) {
    MODEL = new GloVeModel(asset);
    MODEL_ASSET = asset;
  }
  return MODEL;
}
