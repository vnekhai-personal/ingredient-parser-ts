import { existsSync } from 'node:fs';
import { resolveDump } from './dumps.js';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatLevel2, runLevel2 } from './level2.js';

const ROOT = resolve(import.meta.dirname, '../..');

describe('harness level 2 — feature extraction reproduces Python feature dicts from raw sentences', () => {
  it('committed sample (tests/goldens/level1-sample.jsonl)', async () => {
    const stats = await runLevel2(resolve(ROOT, 'tests/goldens/level1-sample.jsonl'));
    console.log(formatLevel2(stats));
    expect(stats.errors).toEqual([]);
    expect(stats.firstMismatches).toEqual([]);
    expect(stats.valueMismatchSeqs).toBe(0);
    expect(stats.orderOnlyMismatchSeqs).toBe(0);
  });

  const full = resolveDump('features-test.jsonl');
  const wantFull = process.env['HARNESS'] === 'full';
  it.skipIf(!wantFull)('full seed-42 test split (features-test.jsonl, 16,272 sentences)', async () => {
    if (!existsSync(full)) throw new Error('features-test.jsonl missing: run training/dump-features.py first.');
    const stats = await runLevel2(full);
    console.log(formatLevel2(stats));
    expect(stats.errors).toEqual([]);
    expect(stats.valueMismatchSeqs).toBe(0);
    expect(stats.orderOnlyMismatchSeqs).toBe(0);
  });
});
