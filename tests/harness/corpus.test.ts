// Harness level 2, full coverage: every corpus sentence + every probe-fixture line.
// Compares normalised sentence, tokens, POS tags and the sha256 of the canonical-JSON
// feature dicts against training/dump-feature-hashes.py output (feature-hashes.jsonl).
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { openDump, resolveDump } from './dumps.js';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { describe, expect, it } from 'vitest';
import { PreProcessor } from '../../src/en/index.js';

const ROOT = resolve(import.meta.dirname, '../..');
const DUMP = resolveDump('feature-hashes.jsonl', 'FEATURE_HASHES');

interface Row {
  src: string;
  s: string;
  n: string;
  t: string[];
  p: string[];
  h: string;
  /** Python raised (ad-hoc dumps): the port must raise too. */
  error?: string;
}
interface Mismatch {
  src: string;
  sentence: string;
  stage: 'error' | 'normalise' | 'tokens' | 'pos' | 'features';
  detail: string;
}

async function run(): Promise<{ lines: number; fixtureLines: number; mismatches: Mismatch[] }> {
  const rl = createInterface({ input: openDump(DUMP), crlfDelay: Infinity });
  let lines = 0;
  let fixtureLines = 0;
  const mismatches: Mismatch[] = [];
  for await (const line of rl) {
    const row = JSON.parse(line) as Row;
    lines += 1;
    if (row.src !== 'corpus') fixtureLines += 1;
    let p: PreProcessor;
    try {
      p = new PreProcessor(row.s, { custom_units: {} });
    } catch (e) {
      if (row.error === undefined) mismatches.push({ src: row.src, sentence: row.s, stage: 'error', detail: String(e) });
      continue;
    }
    if (row.error !== undefined) {
      mismatches.push({ src: row.src, sentence: row.s, stage: 'error', detail: `Python raised ${row.error}; port did not` });
      continue;
    }
    if (p.sentence !== row.n) {
      mismatches.push({ src: row.src, sentence: row.s, stage: 'normalise', detail: `expected ${JSON.stringify(row.n)} got ${JSON.stringify(p.sentence)}` });
      continue;
    }
    const tokens = p.tokenized_sentence.map((t) => t.text);
    if (JSON.stringify(tokens) !== JSON.stringify(row.t)) {
      mismatches.push({ src: row.src, sentence: row.s, stage: 'tokens', detail: `expected ${JSON.stringify(row.t)} got ${JSON.stringify(tokens)}` });
      continue;
    }
    const pos = p.tokenized_sentence.map((t) => t.pos_tag);
    if (JSON.stringify(pos) !== JSON.stringify(row.p)) {
      mismatches.push({ src: row.src, sentence: row.s, stage: 'pos', detail: `expected ${JSON.stringify(row.p)} got ${JSON.stringify(pos)}` });
      continue;
    }
    const h = createHash('sha256').update(JSON.stringify(p.sentence_features()), 'utf8').digest('hex');
    if (h !== row.h) {
      mismatches.push({ src: row.src, sentence: row.s, stage: 'features', detail: 'feature-dict hash differs (run training/dump-features-style diff on this sentence)' });
    }
  }
  return { lines, fixtureLines, mismatches };
}

describe('harness level 2 — full corpus + probe fixtures (feature-hashes.jsonl)', () => {
  const wantFull = process.env['HARNESS'] === 'full';
  it.skipIf(!wantFull)('every sentence reproduces normalisation, tokens, tags and feature hash', async () => {
    if (!existsSync(DUMP)) throw new Error('feature-hashes.jsonl missing: see training/dump-feature-hashes.py.');
    const r = await run();
    const byStage: Record<string, number> = {};
    for (const m of r.mismatches) byStage[m.stage] = (byStage[m.stage] ?? 0) + 1;
    console.log(`lines ${r.lines} (fixture lines ${r.fixtureLines}); mismatches ${r.mismatches.length} ${JSON.stringify(byStage)}`);
    for (const m of r.mismatches.slice(0, 25)) console.log(`  [${m.stage}] ${m.src} "${m.sentence}": ${m.detail}`);
    expect(r.mismatches.length).toBe(0);
  });
});
