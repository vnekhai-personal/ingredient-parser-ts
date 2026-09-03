// Identity of the precomputed foundation-foods caches (src/en/data/ffcache.en.ts, from
// training/precompute-ff-caches.mjs; docs/PORTING.md §3.7) with what the runtime code computes:
// the tokenized FDC descriptions, the uSIF members (token_prob in insertion order, min_prob, a,
// per-entry float32 vectors + norms) and the BM25 members (avgdl, idf in t2d order). Typed
// arrays must be element-identical (`Object.is`, so -0 and 0 differ), Maps entry-identical in
// order. Always on for a row sample + the full rankers; every FDC row under HARNESS=full.
import { describe, expect, it } from 'vitest';
import { load_embeddings_model } from '../../src/en/_embeddings.js';
import { load_fdc_rows, load_ff_cache, preload_foundation_foods } from '../../src/en/_loaders.js';
import { BM25, get_bm25_ranker } from '../../src/en/foundationfoods/_bm25.js';
import { load_fdc_ingredients, tokenize_fdc_description } from '../../src/en/foundationfoods/_ff_utils.js';
import { get_usif_ranker, uSIF } from '../../src/en/foundationfoods/_usif.js';

const wantFull = process.env['HARNESS'] === 'full';

function expectSameNumbers(actual: ArrayLike<number>, expected: ArrayLike<number>, what: string): void {
  expect(actual.length, `${what}: length`).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      throw new Error(`${what}[${i}]: loaded ${actual[i]} !== computed ${expected[i]}`);
    }
  }
}

function expectSameMap<K, V>(actual: Map<K, V>, expected: Map<K, V>, what: string): void {
  expect(actual.size, `${what}: size`).toBe(expected.size);
  const a = [...actual.entries()];
  const e = [...expected.entries()];
  for (let i = 0; i < a.length; i++) {
    const [ak, av] = a[i] as [K, V];
    const [ek, ev] = e[i] as [K, V];
    if (ak !== ek) throw new Error(`${what}: entry ${i} key ${String(ak)} !== ${String(ek)} (order)`);
    if (!Object.is(av, ev)) throw new Error(`${what}[${String(ak)}]: loaded ${String(av)} !== computed ${String(ev)}`);
  }
}

describe('precomputed foundation-foods caches are identical to the runtime computation', () => {
  it('the cache is present and the cached rankers use it', async () => {
    await preload_foundation_foods();
    const cache = load_ff_cache();
    expect(cache).not.toBeNull();
    if (cache === null) return;
    expect(cache.raw.entries).toBe(load_fdc_ingredients().length);
    // The singleton rankers built their members from the cache (views into its buffers).
    const u = get_usif_ranker();
    expect((u.fdc_vectors[0]?.vec as Float32Array).buffer).toBe(cache.usif_vectors.buffer);
    expect(get_bm25_ranker().avgdl).toBe(cache.raw.bm25_avgdl);
  });

  it(`load_fdc_ingredients: every ${wantFull ? '' : '50th '}FDC row re-tokenizes to the cached entry`, async () => {
    await preload_foundation_foods();
    const rows = load_fdc_rows();
    const cached = load_fdc_ingredients();
    const cache = load_ff_cache();
    expect(cache).not.toBeNull();
    let k = 0;
    let checked = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] as (typeof rows)[number];
      const skipped = cache?.skipped_rows.has(r) ?? false;
      if (!wantFull && r % 50 !== 0 && !skipped) {
        k += 1;
        continue;
      }
      const td = tokenize_fdc_description(row.description);
      if (td.embedding_tokens.length === 0) {
        expect(skipped, `row ${r} (${row.description}) has no embedding tokens but is not skipped`).toBe(true);
        continue;
      }
      expect(skipped, `row ${r} is skipped but has embedding tokens`).toBe(false);
      const e = cached[k];
      expect(e, `entry ${k} for row ${r}`).toBeDefined();
      if (e === undefined) return;
      expect(e.fdc_id).toBe(row.fdc_id);
      expect(e.description).toBe(row.description);
      expect(e.data_type).toBe(row.data_type);
      expect(e.category).toBe(row.category);
      expect(e.tokens).toEqual(td.tokens);
      expect(e.pos_tags).toEqual(td.pos_tags);
      expect(e.embedding_tokens).toEqual(td.embedding_tokens);
      // Upstream passes `pos_tags` as `embedding_pos_tags` (mirrored: the same array).
      expect(e.embedding_pos_tags).toBe(e.pos_tags);
      expectSameNumbers(e.embedding_weights, td.embedding_weights, `row ${r} embedding_weights`);
      k += 1;
      checked += 1;
    }
    expect(k).toBe(cached.length);
    console.log(`ffcache: ${checked} FDC rows re-tokenized identically (${cache?.skipped_rows.size ?? 0} skipped rows)`);
  });

  it('uSIF: token_prob (in order), min_prob, a, fdc_vectors + norms', async () => {
    await preload_foundation_foods();
    const cache = load_ff_cache();
    expect(cache).not.toBeNull();
    const embeddings = load_embeddings_model();
    const fdc = load_fdc_ingredients();
    const computed = new uSIF(embeddings, fdc);
    const loaded = new uSIF(embeddings, fdc, cache);
    expectSameMap(loaded.token_prob, computed.token_prob, 'token_prob');
    expect(Object.is(loaded.min_prob, computed.min_prob), 'min_prob').toBe(true);
    expect(Object.is(loaded.a, computed.a), 'a').toBe(true);
    expect(loaded.fdc_vectors.length).toBe(computed.fdc_vectors.length);
    for (let i = 0; i < computed.fdc_vectors.length; i++) {
      const c = computed.fdc_vectors[i] as (typeof computed.fdc_vectors)[number];
      const l = loaded.fdc_vectors[i] as (typeof loaded.fdc_vectors)[number];
      expect(l.vec.constructor, `fdc_vectors[${i}].vec dtype`).toBe(c.vec.constructor);
      expectSameNumbers(l.vec, c.vec, `fdc_vectors[${i}].vec`);
      if (!Object.is(l.norm, c.norm)) throw new Error(`fdc_vectors[${i}].norm: loaded ${l.norm} !== computed ${c.norm}`);
    }
  });

  it('BM25: avgdl, idf (in t2d order); t2d and doc_len are computed on both paths', async () => {
    await preload_foundation_foods();
    const cache = load_ff_cache();
    expect(cache).not.toBeNull();
    const fdc = load_fdc_ingredients();
    const computed = new BM25(fdc, 1.5, 0.75);
    const loaded = new BM25(fdc, 1.5, 0.75, cache);
    expect(Object.is(loaded.avgdl, computed.avgdl), 'avgdl').toBe(true);
    expectSameMap(loaded.idf, computed.idf, 'idf');
    expectSameNumbers(loaded.doc_len, computed.doc_len, 'doc_len');
    expect(loaded.t2d.size).toBe(computed.t2d.size);
    const lk = [...loaded.t2d.keys()];
    const ck = [...computed.t2d.keys()];
    expect(lk).toEqual(ck);
    for (const token of ck) expectSameMap(loaded.t2d.get(token) as Map<number, number>, computed.t2d.get(token) as Map<number, number>, `t2d[${token}]`);
  });
});
