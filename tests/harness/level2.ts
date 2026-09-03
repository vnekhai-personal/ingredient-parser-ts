// Harness level 2 (docs/PORTING.md §4): recompute feature dicts from raw sentences with the TS
// PreProcessor and diff them against Python's (training/dump-features.py output, produced
// with BRILL_TAGS_FILE + PORTER_STEMS_FILE so tags/stems are natural's on both sides).
import { openDump } from './dumps.js';
import { createInterface } from 'node:readline';
import { PreProcessor, type FeatureDict } from '../../src/en/index.js';

interface Row {
  sentence: string;
  features: FeatureDict[];
}
export interface Level2Mismatch {
  sentence: string;
  token: number;
  key: string;
  expected: string | boolean | undefined;
  got: string | boolean | undefined;
}
export interface Level2Stats {
  sequences: number;
  tokens: number;
  errors: { sentence: string; error: string }[];
  /** Sequences whose feature dicts differ in any key/value. */
  valueMismatchSeqs: number;
  /** Sequences whose canonical JSON differs only by key order. */
  orderOnlyMismatchSeqs: number;
  firstMismatches: Level2Mismatch[];
}

function canonical(features: FeatureDict[]): string {
  return JSON.stringify(features);
}

export async function runLevel2(dumpPath: string, maxReport = 20): Promise<Level2Stats> {
  const rl = createInterface({ input: openDump(dumpPath), crlfDelay: Infinity });
  const stats: Level2Stats = {
    sequences: 0,
    tokens: 0,
    errors: [],
    valueMismatchSeqs: 0,
    orderOnlyMismatchSeqs: 0,
    firstMismatches: [],
  };
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue; // header
    }
    const row = JSON.parse(line) as Row;
    stats.sequences += 1;
    stats.tokens += row.features.length;
    let got: FeatureDict[];
    try {
      got = new PreProcessor(row.sentence, { custom_units: {} }).sentence_features();
    } catch (e) {
      stats.errors.push({ sentence: row.sentence, error: String(e) });
      continue;
    }
    const expected = row.features;
    let valueMismatch = false;
    const n = Math.max(expected.length, got.length);
    for (let t = 0; t < n; t++) {
      const e = expected[t] ?? {};
      const g = got[t] ?? {};
      const keys = new Set([...Object.keys(e), ...Object.keys(g)]);
      for (const key of keys) {
        if (e[key] !== g[key]) {
          valueMismatch = true;
          if (stats.firstMismatches.length < maxReport) {
            stats.firstMismatches.push({ sentence: row.sentence, token: t, key, expected: e[key], got: g[key] });
          }
        }
      }
    }
    if (valueMismatch) stats.valueMismatchSeqs += 1;
    else if (canonical(expected) !== canonical(got)) stats.orderOnlyMismatchSeqs += 1;
  }
  return stats;
}

export function formatLevel2(s: Level2Stats): string {
  const lines = [
    `sequences ${s.sequences}, tokens ${s.tokens}`,
    `errors ${s.errors.length}; value mismatches ${s.valueMismatchSeqs} seqs; order-only mismatches ${s.orderOnlyMismatchSeqs} seqs`,
  ];
  for (const e of s.errors.slice(0, 5)) lines.push(`  ERROR "${e.sentence}": ${e.error}`);
  for (const m of s.firstMismatches) {
    lines.push(`  "${m.sentence}" token ${m.token} ${m.key}: expected ${JSON.stringify(m.expected)} got ${JSON.stringify(m.got)}`);
  }
  return lines.join('\n');
}
