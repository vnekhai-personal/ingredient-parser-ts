/**
 * Port of `ingredient_parser/en/_loaders.py` (pin ffd6ae3) — the parser model only. The
 * embeddings model and ingredient tagdict belong to foundation foods / NLTK tagging and are
 * not ported (steps 4 and 2 respectively).
 *
 * The CRF model ships eagerly as generated TS (`data/model.en.ts`, from
 * `models/brill-porter.json.gz` via `pnpm model`): no zlib, no filesystem, so Hermes can run it.
 */
import { NumpyCRFInference, type CRFModelJson } from '../inference.js';
import model from './data/model.en.js';

let TAGGER: NumpyCRFInference | null = null;
let MODEL: CRFModelJson = model;

/** Replace the bundled model (tests / experiments). Resets the cached tagger. */
export function set_parser_model(data: CRFModelJson): void {
  MODEL = data;
  TAGGER = null;
}

/** Load the parser model (cached, like upstream's `lru_cache`). */
export function load_parser_model(): NumpyCRFInference {
  if (TAGGER === null) TAGGER = new NumpyCRFInference(MODEL);
  return TAGGER;
}

// ---- foundation-foods assets (lazy) ----
// Upstream loads the GloVe file and FDC csv on first use (lru_cache). JavaScript cannot block
// on a lazy import, so consumers call `await preload_foundation_foods()` (the `foundation-foods` entry point) once before passing
// `foundation_foods: true`; the sync loaders below then behave like upstream's cached ones.
// Consumers that never do so pay nothing (docs/PORTING.md step 4).
//
// The third lazy module, `data/ffcache.en.ts` (training/precompute-ff-caches.mjs, docs/PORTING.md §3.7), carries the FDC-side caches the rankers would otherwise build on the first match:
// the tokenized FDC descriptions, the uSIF sentence vectors + norms and constants, and the
// BM25 idf table — computed at build time by THIS runtime code and verified identical to a
// runtime computation (tests/harness/ffcache.test.ts). When it is absent (`FFCACHE = null`,
// or assets injected without a cache) every ranker computes exactly as before.
export interface GloVeAsset {
  vocab: readonly string[];
  /** Header value of the vec file (upstream's `vocab_size`; the file has one more row). */
  vocab_size?: number;
  dimension: number;
  /** vocab_size × dimension float32, row-major. */
  vectors: Float32Array;
}
export interface FDCRow {
  fdc_id: number;
  data_type: string;
  description: string;
  category: string;
}

/** Serialised form of the precomputed caches (the generated `data/ffcache.en.ts`). */
export interface FFCacheRaw {
  /** sha256 of the gz inputs the cache was derived from; checked against the sibling assets. */
  glove_sha256: string;
  fdc_sha256: string;
  dimension: number;
  /** Number of FDC ingredients kept by `load_fdc_ingredients` (rows minus `skipped_rows`). */
  entries: number;
  /** Indices into `FDCRow[]` of the rows dropped (no embedding tokens), ascending. */
  skipped_rows: readonly number[];
  /** String tables the per-entry index arrays point into. */
  tokens: readonly string[];
  tags: readonly string[];
  weights: readonly number[];
  /** Uint16 LE, 2 per entry: (tokens.length, embedding_tokens.length). */
  lengths_b64: string;
  /** Uint16 LE, `tokens` indices of every entry's `tokens`, concatenated. */
  token_idx_b64: string;
  /** Uint8, `tags` indices of every entry's `pos_tags`, concatenated (same lengths as tokens). */
  tag_idx_b64: string;
  /** Uint16 LE, `tokens` indices of every entry's `embedding_tokens`, concatenated. */
  emb_idx_b64: string;
  /** Uint8, `weights` indices of every entry's `embedding_weights`, concatenated. */
  weight_idx_b64: string;
  /** float32 LE, entries × dimension: uSIF `fdc_vectors[i].vec` (always float32 for FDC entries). */
  usif_vectors_b64: string;
  /** float32 LE, entries: uSIF `fdc_vectors[i].norm`. */
  usif_norms_b64: string;
  /** uSIF `token_prob` as (`tokens` index, count) in insertion order; prob = count / total. */
  usif_token_counts: readonly (readonly [number, number])[];
  usif_token_total: number;
  usif_min_prob: number;
  usif_a: number;
  /** float64 LE, BM25 `idf` values in `t2d` insertion order. */
  bm25_idf_b64: string;
  bm25_avgdl: number;
}

/** Decoded caches (typed arrays), what `load_fdc_ingredients` / the rankers consume. */
export interface FFCache {
  raw: FFCacheRaw;
  skipped_rows: ReadonlySet<number>;
  lengths: Uint16Array;
  token_idx: Uint16Array;
  tag_idx: Uint8Array;
  emb_idx: Uint16Array;
  weight_idx: Uint8Array;
  usif_vectors: Float32Array;
  usif_norms: Float32Array;
  bm25_idf: Float64Array;
}

let GLOVE: GloVeAsset | null = null;
let FDC: readonly FDCRow[] | null = null;
let FFCACHE: FFCache | null = null;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charCodeAt(i)] = i;

/** Standard base64 → bytes, pure JS (no `atob`/`Buffer`, so it runs on any engine). */
export function decodeBase64(b64: string): Uint8Array {
  let len = b64.length;
  while (len > 0 && b64.charCodeAt(len - 1) === 61) len -= 1; // trailing '='
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const v = B64_LOOKUP[b64.charCodeAt(i)] ?? -1;
    if (v < 0) throw new Error('invalid base64');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/** Little-endian float32 payload → Float32Array (a view when the host is little-endian, else converted). */
export function decodeFloat32LE(b64: string): Float32Array {
  const bytes = decodeBase64(b64);
  const n = Math.floor(bytes.byteLength / 4);
  if (HOST_LITTLE_ENDIAN && bytes.byteOffset % 4 === 0) return new Float32Array(bytes.buffer, bytes.byteOffset, n);
  const out = new Float32Array(n);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}

/** Little-endian float64 payload → Float64Array. */
export function decodeFloat64LE(b64: string): Float64Array {
  const bytes = decodeBase64(b64);
  const n = Math.floor(bytes.byteLength / 8);
  if (HOST_LITTLE_ENDIAN && bytes.byteOffset % 8 === 0) return new Float64Array(bytes.buffer, bytes.byteOffset, n);
  const out = new Float64Array(n);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n; i++) out[i] = view.getFloat64(i * 8, true);
  return out;
}

/** Little-endian uint16 payload → Uint16Array. */
export function decodeUint16LE(b64: string): Uint16Array {
  const bytes = decodeBase64(b64);
  const n = Math.floor(bytes.byteLength / 2);
  if (HOST_LITTLE_ENDIAN && bytes.byteOffset % 2 === 0) return new Uint16Array(bytes.buffer, bytes.byteOffset, n);
  const out = new Uint16Array(n);
  for (let i = 0; i < n; i++) out[i] = (bytes[2 * i] as number) | ((bytes[2 * i + 1] as number) << 8);
  return out;
}

/** Decode the generated cache module's payloads; `null` stays `null` (compute path). */
export function decode_ff_cache(raw: FFCacheRaw | null): FFCache | null {
  if (raw === null) return null;
  return {
    raw,
    skipped_rows: new Set(raw.skipped_rows),
    lengths: decodeUint16LE(raw.lengths_b64),
    token_idx: decodeUint16LE(raw.token_idx_b64),
    tag_idx: decodeBase64(raw.tag_idx_b64),
    emb_idx: decodeUint16LE(raw.emb_idx_b64),
    weight_idx: decodeBase64(raw.weight_idx_b64),
    usif_vectors: decodeFloat32LE(raw.usif_vectors_b64),
    usif_norms: decodeFloat32LE(raw.usif_norms_b64),
    bm25_idf: decodeFloat64LE(raw.bm25_idf_b64),
  };
}

/** Inject assets directly (tests / custom bundling). Without `ffcache` the rankers compute their caches. */
export function set_foundation_foods_assets(glove: GloVeAsset, fdc: readonly FDCRow[], ffcache: FFCache | null = null): void {
  GLOVE = glove;
  FDC = fdc;
  FFCACHE = ffcache;
}

const NOT_LOADED = 'foundation foods assets are not loaded: `await preload_foundation_foods()` from "ingredient-parser-typescript/foundation-foods" before parsing with foundation_foods=true';

/** `load_embeddings_model()` (GloVeModel wrapper, cached) lives in src/en/_embeddings.ts; re-exported here as upstream. */
export { load_embeddings_model } from './_embeddings.js';

/** `load_embeddings_model()`'s raw asset; the GloVeModel wrapper lives in src/en/_embeddings.ts. */
export function load_glove_asset(): GloVeAsset {
  if (GLOVE === null) throw new Error(NOT_LOADED);
  return GLOVE;
}

/** Rows of fdc_ingredients.csv, for `load_fdc_ingredients()`. */
export function load_fdc_rows(): readonly FDCRow[] {
  if (FDC === null) throw new Error(NOT_LOADED);
  return FDC;
}

/** The precomputed FDC-side caches, or `null` when the rankers must compute them. */
export function load_ff_cache(): FFCache | null {
  return FFCACHE;
}
