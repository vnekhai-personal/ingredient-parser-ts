import { existsSync } from 'node:fs';
import { resolveDump } from './dumps.js';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatStats, runLevel1 } from './level1.js';

const ROOT = resolve(import.meta.dirname, '../..');
// Confidences feed `round(x, 6)` upstream; anything far below 5e-7 cannot flip a rounded value
// except at an exact rounding boundary. The measured value is recorded in docs/VERIFICATION.md §3.
const SCORE_TOLERANCE = 1e-9;

function check(statsText: string, stats: Awaited<ReturnType<typeof runLevel1>>) {
  console.log(statsText);
  expect(stats.sequences).toBe(stats.header.count);
  expect(stats.labelMismatches.slice(0, 5)).toEqual([]);
  expect(stats.labelMismatches.length).toBe(0);
  expect(stats.scoreMaxAbsDiff).toBeLessThanOrEqual(SCORE_TOLERANCE);
}

describe('harness level 1 — decoder reproduces Python labels from dumped feature dicts', () => {
  it('committed sample (tests/goldens/level1-sample.jsonl)', async () => {
    const stats = await runLevel1(resolve(ROOT, 'tests/goldens/level1-sample.jsonl'), ROOT);
    check(formatStats(stats), stats);
  });

  const full = resolveDump('features-test.jsonl');
  const wantFull = process.env['HARNESS'] === 'full';
  it.skipIf(!wantFull)(
    'full seed-42 test split (features-test.jsonl, 16,272 sequences)',
    async () => {
      if (!existsSync(full)) {
        throw new Error(
          'features-test.jsonl missing: run training/dump-features.py (see its docstring) first.',
        );
      }
      const stats = await runLevel1(full, ROOT);
      check(formatStats(stats), stats);
    },
  );
});
