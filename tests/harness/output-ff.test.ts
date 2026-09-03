// Harness level 3 with foundation_foods=True (docs/PORTING.md step 4): parsed-ff.jsonl from
// `training/dump-parsed.py parsed-ff.jsonl --foundation-foods` (Brill tags for FDC descriptions,
// Snowball stems, ship model). Raw float32 scores cannot be bit-exact (BLAS accumulation order,
// see src/_np.ts), so this reports the end-to-end FoundationFood mismatch rate and asserts it
// stays under the recorded bound.
import { existsSync } from 'node:fs';
import { resolveDump } from './dumps.js';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preload_foundation_foods } from '../../src/en/_loaders.js';
import { reportLevel3, runLevel3 } from './level3.js';

const ROOT = resolve(import.meta.dirname, '../..');
const DUMP = resolveDump('parsed-ff.jsonl', 'PARSED_FF_DUMP');
/** Semantic mismatches (which FDC entry, name_index, text) must be zero. */
const MAX_SEMANTIC_RATE = Number(process.env['FF_MAX_MISMATCH_RATE'] ?? '0');
/** Confidence-only deviations: measured max 9.3e-5 over the corpus (docs/PORTING.md); bound with headroom. */
const MAX_CONF_DIFF = 1e-3;

describe('harness level 3 — foundation_foods=True over the full corpus + fixtures (parsed-ff.jsonl)', () => {
  const wantFull = process.env['HARNESS'] === 'full';
  // ~10 min unloaded, 26 min measured on a loaded machine: generous per-test timeout.
  it.skipIf(!wantFull)('every sentence reproduces Python (foundation foods included)', { timeout: 3_600_000 }, async () => {
    if (!existsSync(DUMP)) throw new Error('parsed-ff.jsonl missing: see training/dump-parsed.py --foundation-foods.');
    await preload_foundation_foods();
    const r = await runLevel3(DUMP, { parse: { foundation_foods: true }, classifyConfidenceOnly: true });
    reportLevel3(r, 60);
    const semantic = r.mismatches.filter((m) => m.kind !== 'conf-only');
    const confOnly = r.mismatches.filter((m) => m.kind === 'conf-only');
    const within1e6 = confOnly.filter((m) => (m.confDiff ?? 0) <= 1.5e-6).length;
    const maxConf = confOnly.reduce((mx, m) => Math.max(mx, m.confDiff ?? 0), 0);
    console.log(
      `foundation-foods: semantic mismatches ${semantic.length} (${((semantic.length / r.lines) * 100).toFixed(3)}%); ` +
        `confidence-only ${confOnly.length} (${((confOnly.length / r.lines) * 100).toFixed(3)}%), of which exactly 1e-6: ${within1e6}, max |Δ| ${maxConf}`,
    );
    expect(semantic.length / r.lines).toBeLessThanOrEqual(MAX_SEMANTIC_RATE);
    expect(maxConf).toBeLessThanOrEqual(MAX_CONF_DIFF);
  });
});
