/**
 * Entry point `ingredient-parser-typescript/foundation-foods`: loads the foundation-foods assets
 * (GloVe vectors, the FDC table and the precomputed ranker caches — ~8 MB of generated modules).
 * It is the ONLY module that references those data files, so a bundle built from the main entry
 * never contains them: bundlers that follow dynamic imports (Metro) still only pull them into
 * apps that import this entry point. Call `await preload_foundation_foods()` once before
 * `parse_ingredient(…, { foundation_foods: true })`.
 */
import { decode_ff_cache, decodeFloat32LE, set_foundation_foods_assets } from './en/_loaders.js';

export { set_foundation_foods_assets };

/** Load the embeddings, FDC and precomputed-cache assets (dynamic imports of the generated modules). Idempotent. */
export async function preload_foundation_foods(): Promise<void> {
  if (loaded) return;
  const [glove, fdc, ffcache] = await Promise.all([
    import('./en/data/glove.en.js'),
    import('./en/data/fdc.en.js'),
    import('./en/data/ffcache.en.js'),
  ]);
  const vectors = decodeFloat32LE(glove.VECTORS_B64);
  if (vectors.length !== glove.VOCAB.length * glove.DIMENSION) throw new Error('glove asset: vector payload size mismatch');
  const cache = decode_ff_cache(ffcache.FFCACHE);
  if (cache !== null) {
    // The cache is only meaningful for the exact assets it was derived from (`pnpm model`
    // regenerates all three together); a mismatch is a build inconsistency, never a fallback.
    if (cache.raw.glove_sha256 !== glove.SHA256 || cache.raw.fdc_sha256 !== fdc.SHA256) {
      throw new Error('foundation foods cache (data/ffcache.en.ts) was built from different assets: run `pnpm model`');
    }
    if (cache.raw.dimension !== glove.DIMENSION || cache.raw.entries + cache.raw.skipped_rows.length !== fdc.FDC_ROWS.length) {
      throw new Error('foundation foods cache (data/ffcache.en.ts) does not match the assets: run `pnpm model`');
    }
  }
  set_foundation_foods_assets({ vocab: glove.VOCAB, vocab_size: glove.VOCAB_SIZE, dimension: glove.DIMENSION, vectors }, fdc.FDC_ROWS, cache);
  loaded = true;
}
let loaded = false;
