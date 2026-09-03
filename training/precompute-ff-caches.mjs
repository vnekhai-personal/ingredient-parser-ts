// Precompute the FDC-side caches the foundation-foods rankers would otherwise build on the
// first match (docs/PORTING.md: ~6.4 s on Hermes) into the lazy asset:
//   src/en/data/glove.en.ts + fdc.en.ts + the runtime code  ->  src/en/data/ffcache.en.ts
// Runs as the last step of `pnpm model`, AFTER extract-model.mjs and extract-ff-assets.mjs.
//
// The values are produced by the SAME runtime code the port ships — `tokenize_fdc_description`
// over every FDC row, the `uSIF` and `BM25` constructors — compiled with tsc into a scratch
// directory (node_modules/.cache/, so `natural` resolves) and run with the assets preloaded and
// the cache disabled. tests/harness/ffcache.test.ts recomputes them at runtime and asserts they
// are identical (typed arrays byte-equal, Maps entry-equal in order).
//
// Invalidation: the marker line records sha256 over every input — the two gz data files, every
// source module in the import closure of the computation (so a code change regenerates the
// cache), natural's version (tagger) and this script. Up to date -> no-op.
//
// Stored: the tokenized FDC descriptions (string tables + index arrays), the uSIF sentence
// vectors + norms (float32 LE) and token_prob / min_prob / a, the BM25 idf table + avgdl.
// NOT stored, on purpose: BM25 t2d/doc_len and the fuzzy per-entry vectors — loading them
// costs the same Map insertions / GloVe row lookups as building them from the cached tokens
// (measured: fuzzy 6 ms, BM25 22 ms on Node, vs 462 ms tokenization + 60 ms uSIF).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const OUT = resolve(ROOT, 'src/en/data/ffcache.en.ts');
const GLOVE_GZ = resolve(ROOT, 'models/upstream/ingredient_embeddings.35d.glove.txt.gz');
const FDC_GZ = resolve(ROOT, 'models/upstream/fdc_ingredients.csv.gz');
const BUILD_DIR = resolve(ROOT, 'node_modules/.cache/ingredient-parser-typescript/ffcache-build');
// Modules whose behaviour the cache freezes; their import closure (minus data/) is hashed.
const ROOTS = [
  'src/en/foundationfoods/_ff_utils.ts',
  'src/en/foundationfoods/_usif.ts',
  'src/en/foundationfoods/_bm25.ts',
  'src/en/_loaders.ts',
  'src/foundation-foods.ts',
];
const STUB = "import type { FFCacheRaw } from '../_loaders.js';\nexport const FFCACHE: FFCacheRaw | null = null;\n";

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const rel = (p) => relative(ROOT, p).split('\\').join('/');

// ---- inputs and marker ----
function sourceClosure(roots) {
  const seen = new Set();
  const stack = roots.map((r) => resolve(ROOT, r));
  const IMPORT_RE = /(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(IMPORT_RE)) {
      if (m[1].includes('/data/')) continue; // generated assets: hashed via the gz files
      const target = resolve(dirname(file), m[1].replace(/\.js$/, '.ts'));
      if (!existsSync(target)) throw new Error(`${rel(file)}: cannot resolve import ${m[1]}`);
      stack.push(target);
    }
  }
  return [...seen].sort();
}

const naturalVersion = JSON.parse(readFileSync(resolve(ROOT, 'node_modules/natural/package.json'), 'utf8')).version;
// The Brill lexicon + rules the tokenizer's POS tags come from, and the generator of glove/fdc modules.
const naturalData = ['lexicon_from_posjs.json', 'tr_from_posjs.txt'].map((f) =>
  resolve(ROOT, 'node_modules/natural/lib/natural/brill_pos_tagger/data/English', f),
);
const EXTRACT_FF = resolve(ROOT, 'training/extract-ff-assets.mjs');
const inputs = [
  [rel(GLOVE_GZ), sha(readFileSync(GLOVE_GZ))],
  [rel(FDC_GZ), sha(readFileSync(FDC_GZ))],
  ...sourceClosure(ROOTS).map((f) => [rel(f), sha(readFileSync(f))]),
  ['natural', naturalVersion],
  ...naturalData.map((f) => [rel(f), sha(readFileSync(f))]),
  [rel(EXTRACT_FF), sha(readFileSync(EXTRACT_FF))],
  [rel(SELF), sha(readFileSync(SELF))],
];
const marker = `// sha256(inputs) = ${sha(inputs.map(([k, v]) => `${k}=${v}`).join('\n'))}`;

if (existsSync(OUT) && readFileSync(OUT, 'utf8').includes(marker)) {
  console.log('src/en/data/ffcache.en.ts up to date');
  process.exit(0);
}

// ---- build the runtime into a scratch dir with the cache disabled ----
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `// STUB written by training/precompute-ff-caches.mjs while regenerating; rankers compute their caches.\n${STUB}`);
rmSync(BUILD_DIR, { recursive: true, force: true });
mkdirSync(BUILD_DIR, { recursive: true });
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const t0 = performance.now();
execFileSync(
  process.execPath,
  [tsc, '-p', resolve(ROOT, 'tsconfig.json'), '--outDir', BUILD_DIR, '--declaration', 'false', '--sourceMap', 'false'],
  { cwd: ROOT, stdio: 'inherit' },
);
console.log(`built runtime into ${rel(BUILD_DIR)} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

const mod = (p) => import(pathToFileURL(resolve(BUILD_DIR, p)).href);
const loaders = await mod('en/_loaders.js');
const ffEntry = await mod('foundation-foods.js');
const ffUtils = await mod('en/foundationfoods/_ff_utils.js');
const { uSIF } = await mod('en/foundationfoods/_usif.js');
const { BM25 } = await mod('en/foundationfoods/_bm25.js');
const { load_embeddings_model } = await mod('en/_embeddings.js');

await ffEntry.preload_foundation_foods();
if (loaders.load_ff_cache() !== null) throw new Error('scratch build loaded a cache; expected the stub');
const t1 = performance.now();
const rows = loaders.load_fdc_rows();
const fdc = ffUtils.load_fdc_ingredients();
const embeddings = load_embeddings_model();
const usif = new uSIF(embeddings, fdc);
const bm25 = new BM25(fdc, 1.5, 0.75);
console.log(`computed caches (${((performance.now() - t1) / 1000).toFixed(2)} s): ${fdc.length} of ${rows.length} rows`);

// ---- serialise ----
const assert = (cond, msg) => {
  if (!cond) throw new Error(`precompute-ff-caches: ${msg}`);
};
const sameStrings = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Which rows were dropped, and a self-check that the kept entries are the per-row tokenization.
const skipped_rows = [];
let k = 0;
for (let r = 0; r < rows.length; r++) {
  const td = ffUtils.tokenize_fdc_description(rows[r].description);
  if (td.embedding_tokens.length === 0) {
    skipped_rows.push(r);
    continue;
  }
  const e = fdc[k];
  assert(e !== undefined && e.fdc_id === rows[r].fdc_id, `row ${r}: entry order`);
  assert(
    sameStrings(e.tokens, td.tokens) &&
      sameStrings(e.pos_tags, td.pos_tags) &&
      sameStrings(e.embedding_tokens, td.embedding_tokens) &&
      e.embedding_pos_tags === e.pos_tags &&
      e.embedding_weights.length === td.embedding_weights.length &&
      e.embedding_weights.every((w, i) => Object.is(w, td.embedding_weights[i])),
    `row ${r}: load_fdc_ingredients differs from tokenize_fdc_description`,
  );
  k += 1;
}
assert(k === fdc.length, 'kept-row count');

const table = () => {
  const index = new Map();
  return {
    idx: (v) => {
      let i = index.get(v);
      if (i === undefined) {
        i = index.size;
        index.set(v, i);
      }
      return i;
    },
    values: () => [...index.keys()],
  };
};
const tokens = table();
const tags = table();
const weights = table();
const lengths = new Uint16Array(fdc.length * 2);
const token_idx = [];
const tag_idx = [];
const emb_idx = [];
const weight_idx = [];
fdc.forEach((e, i) => {
  assert(e.tokens.length < 65536 && e.embedding_tokens.length < 65536, 'entry length fits uint16');
  assert(e.tokens.length === e.pos_tags.length && e.embedding_tokens.length === e.embedding_weights.length, `entry ${i}: lengths`);
  lengths[2 * i] = e.tokens.length;
  lengths[2 * i + 1] = e.embedding_tokens.length;
  for (let j = 0; j < e.tokens.length; j++) {
    token_idx.push(tokens.idx(e.tokens[j]));
    tag_idx.push(tags.idx(e.pos_tags[j]));
  }
  for (let j = 0; j < e.embedding_tokens.length; j++) {
    emb_idx.push(tokens.idx(e.embedding_tokens[j]));
    assert(typeof e.embedding_weights[j] === 'number' && Number.isFinite(e.embedding_weights[j]), `entry ${i}: weight`);
    weight_idx.push(weights.idx(e.embedding_weights[j]));
  }
});
assert(tokens.values().length < 65536, 'token table fits uint16');
assert(tags.values().length < 256 && weights.values().length < 256, 'tag / weight tables fit uint8');

const d = embeddings.dimension;
const usif_vectors = new Float32Array(fdc.length * d);
const usif_norms = new Float32Array(fdc.length);
usif.fdc_vectors.forEach((emb, i) => {
  // Every kept FDC entry has ≥ 1 embedding token in vocabulary, so `_embed` never takes its
  // float64 `np.zeros(dim) + a` branch here; the cache format is float32 only.
  assert(emb.vec instanceof Float32Array && emb.vec.length === d, `entry ${i}: uSIF vector dtype/shape`);
  assert(Math.fround(emb.norm) === emb.norm, `entry ${i}: uSIF norm is not float32`);
  usif_vectors.set(emb.vec, i * d);
  usif_norms[i] = emb.norm;
});
// token_prob = count / total, in first-occurrence order (the Map's insertion order).
const counts = new Map();
for (const e of fdc) for (const t of e.embedding_tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
let usif_token_total = 0;
for (const c of counts.values()) usif_token_total += c;
const usif_token_counts = [];
const probKeys = [...usif.token_prob.keys()];
assert(probKeys.length === counts.size, 'token_prob size');
[...counts.entries()].forEach(([t, c], i) => {
  assert(probKeys[i] === t && Object.is(usif.token_prob.get(t), c / usif_token_total), `token_prob[${t}]`);
  usif_token_counts.push([tokens.idx(t), c]);
});
const bm25_idf = new Float64Array([...bm25.idf.values()]);
assert(bm25_idf.length === bm25.t2d.size, 'idf size');

// Explicit little-endian serialisation (host order is not assumed).
const le = (arr, bytesPer, setter) => {
  const bytes = new Uint8Array(arr.length * bytesPer);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < arr.length; i++) setter(view, i * bytesPer, arr[i]);
  return Buffer.from(bytes).toString('base64');
};
const b64f32 = (arr) => le(arr, 4, (v, o, x) => v.setFloat32(o, x, true));
const b64f64 = (arr) => le(arr, 8, (v, o, x) => v.setFloat64(o, x, true));
const b64u16 = (arr) => le(arr, 2, (v, o, x) => v.setUint16(o, x, true));
const b64u8 = (arr) => Buffer.from(Uint8Array.from(arr)).toString('base64');

const raw = {
  glove_sha256: inputs[0][1],
  fdc_sha256: inputs[1][1],
  dimension: d,
  entries: fdc.length,
  skipped_rows,
  tokens: tokens.values(),
  tags: tags.values(),
  weights: weights.values(),
  lengths_b64: b64u16(lengths),
  token_idx_b64: b64u16(token_idx),
  tag_idx_b64: b64u8(tag_idx),
  emb_idx_b64: b64u16(emb_idx),
  weight_idx_b64: b64u8(weight_idx),
  usif_vectors_b64: b64f32(usif_vectors),
  usif_norms_b64: b64f32(usif_norms),
  usif_token_counts,
  usif_token_total,
  usif_min_prob: usif.min_prob,
  usif_a: usif.a,
  bm25_idf_b64: b64f64(bm25_idf),
  bm25_avgdl: bm25.avgdl,
};
// JSON number literals round-trip every double exactly (shortest repr), so min_prob / a / avgdl
// and the weight table are bit-exact; the typed arrays travel as little-endian bytes.
const body = JSON.stringify(raw);
writeFileSync(
  OUT,
  `// GENERATED by training/precompute-ff-caches.mjs from src/en/data/glove.en.ts + fdc.en.ts and the runtime code. Do not edit.\n` +
    `${marker}\n` +
    `// inputs: ${inputs.map(([k, v]) => `${k}=${v.slice(0, 12)}`).join(' ')}\n` +
    `import type { FFCacheRaw } from '../_loaders.js';\n` +
    `export const FFCACHE: FFCacheRaw | null = ${body};\n`,
);
rmSync(BUILD_DIR, { recursive: true, force: true });
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`;
console.log(
  `wrote src/en/data/ffcache.en.ts (${mb(body.length)}: tokenization ${mb(
    raw.lengths_b64.length + raw.token_idx_b64.length + raw.tag_idx_b64.length + raw.emb_idx_b64.length + raw.weight_idx_b64.length + JSON.stringify(raw.tokens).length,
  )}, uSIF vectors+norms ${mb(raw.usif_vectors_b64.length + raw.usif_norms_b64.length)}, BM25 idf ${mb(raw.bm25_idf_b64.length)}; ` +
    `${fdc.length} entries, ${skipped_rows.length} rows skipped, ${raw.tokens.length} tokens, ${raw.tags.length} tags, ${raw.weights.length} weights)`,
);
