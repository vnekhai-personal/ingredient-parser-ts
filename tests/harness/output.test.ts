// Harness level 3 (docs/PORTING.md §4): parse_ingredient over the full corpus + probe fixtures,
// diffed byte for byte against training/dump-parsed.py output (parsed.jsonl).
// PARSED_DUMP=<file> selects another dump (ad-hoc lines via training/compare-lines.sh).
import { existsSync } from 'node:fs';
import { resolveDump } from './dumps.js';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reportLevel3, runLevel3 } from './level3.js';

const ROOT = resolve(import.meta.dirname, '../..');
const DUMP = resolveDump('parsed.jsonl', 'PARSED_DUMP');

describe('harness level 3 — ParsedIngredient over the full corpus + probe fixtures (parsed.jsonl)', () => {
  const wantFull = process.env['HARNESS'] === 'full';
  it.skipIf(!wantFull)('every sentence reproduces Python byte for byte', async () => {
    if (!existsSync(DUMP)) throw new Error('parsed.jsonl missing: see training/dump-parsed.py.');
    // PARSE_OPTIONS='{"string_units":true}' mirrors the dump's --options (the dump header also records them).
    const parse = JSON.parse(process.env['PARSE_OPTIONS'] ?? '{}') as Record<string, unknown>;
    const r = await runLevel3(DUMP, { parse });
    reportLevel3(r);
    expect(r.mismatches.length).toBe(0);
  });
});
