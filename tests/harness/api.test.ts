// Two-sided check of parse_multiple_ingredients and inspect_parser against training/dump-api.py.
import { existsSync } from 'node:fs';
import { openDump, resolveDump } from './dumps.js';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { describe, expect, it } from 'vitest';
import { inspect_parser, parse_multiple_ingredients } from '../../src/index.js';
import type { PostProcessor } from '../../src/en/postprocess.js';
import { serializeParsed } from './serialize.js';
import { pyFloatRepr } from '../../src/_py.js';

const ROOT = resolve(import.meta.dirname, '../..');
const DUMP = resolveDump('api.jsonl', 'API_DUMP');

interface Row {
  s: string;
  multiple?: unknown;
  multiple_error?: string;
  inspect?: { labels: string[]; scores: number[]; parsed: unknown };
  inspect_error?: string;
}

describe('harness — parse_multiple_ingredients and inspect_parser (api.jsonl)', () => {
  const wantFull = process.env['HARNESS'] === 'full';
  it.skipIf(!wantFull)('both APIs reproduce Python', async () => {
    if (!existsSync(DUMP)) throw new Error('api.jsonl missing: see training/dump-api.py.');
    const rl = createInterface({ input: openDump(DUMP), crlfDelay: Infinity });
    let lines = 0;
    const mismatches: string[] = [];
    for await (const line of rl) {
      const row = JSON.parse(line) as Row;
      lines += 1;
      const mIdx = line.indexOf('"multiple":');
      // parse_multiple_ingredients
      try {
        const got = serializeParsed(parse_multiple_ingredients([row.s], { volumetric_units_system: 'us_customary' })[0]!);
        if (row.multiple_error !== undefined) mismatches.push(`[multiple] "${row.s}": Python raised ${row.multiple_error}; port returned`);
        else {
          const expected = line.slice(mIdx + '"multiple":'.length, line.indexOf(',"inspect'));
          if (got !== expected) mismatches.push(`[multiple] "${row.s}": differs`);
        }
      } catch (e) {
        if (row.multiple_error === undefined) mismatches.push(`[multiple] "${row.s}": port threw ${String(e)}`);
      }
      // inspect_parser
      try {
        const info = inspect_parser(row.s);
        const pp = info.PostProcessor as PostProcessor;
        const labels = pp.tokens.map((t) => t.label);
        const scores = pp.tokens.map((t) => t.score);
        const parsed = serializeParsed(pp.parsed);
        if (row.inspect_error !== undefined) mismatches.push(`[inspect] "${row.s}": Python raised ${row.inspect_error}; port returned`);
        else {
          const exp = row.inspect!;
          // Raw CRF marginals carry the level-1 engine-libm seam (≤2.8e-14); same tolerance as level 1.
          const scoresOk = scores.length === exp.scores.length && scores.every((v, i) => Math.abs(v - (exp.scores[i] as number)) <= 1e-9);
          if (JSON.stringify(labels) !== JSON.stringify(exp.labels)) mismatches.push(`[inspect] "${row.s}": labels ${JSON.stringify(labels)} vs ${JSON.stringify(exp.labels)}`);
          else if (!scoresOk) mismatches.push(`[inspect] "${row.s}": scores differ beyond 1e-9 (${scores.map(pyFloatRepr).join(',')} vs ${exp.scores.map(pyFloatRepr).join(',')})`);
          else {
            const pIdx = line.indexOf('"parsed":', line.indexOf('"inspect":'));
            const expected = line.slice(pIdx + '"parsed":'.length, line.lastIndexOf('}}'));
            if (parsed !== expected) mismatches.push(`[inspect] "${row.s}": parsed differs`);
          }
        }
      } catch (e) {
        if (row.inspect_error === undefined) mismatches.push(`[inspect] "${row.s}": port threw ${String(e)}`);
      }
    }
    console.log(`api: ${lines} lines, ${mismatches.length} mismatches`);
    for (const m of mismatches.slice(0, 30)) console.log('  ' + m);
    expect(mismatches.length).toBe(0);
  });
});
