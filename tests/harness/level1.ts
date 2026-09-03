// Harness level 1 (docs/PORTING.md §4): replay Python's feature dicts through the TS decoder and
// diff labels (must be exact) and confidences (must match to far below the 6-dp rounding
// upstream applies). Dumps come from training/dump-features.py; never hand-edited.
import { openDump } from './dumps.js';
import { createInterface } from 'node:readline';
import { NumpyCRFInference, type FeatureDict } from '../../src/inference.js';
import { loadModelGz } from '../helpers/loadModel.js';

interface Header {
  model: string;
  sha256: string;
  count: number;
}
interface Row {
  sentence: string;
  features: FeatureDict[];
  labels: string[];
  scores: number[];
}
export interface Level1Stats {
  header: Header;
  sequences: number;
  tokens: number;
  labelMismatches: { sentence: string; expected: string[]; got: string[] }[];
  scoreExact: number;
  scoreMaxAbsDiff: number;
  scoreOver1e12: number;
  scoreOver1e9: number;
  scoreOver5e7: number;
  worst: { sentence: string; t: number; expected: number; got: number } | null;
}

export async function runLevel1(dumpPath: string, repoRoot: string): Promise<Level1Stats> {
  const rl = createInterface({ input: openDump(dumpPath), crlfDelay: Infinity });
  let header: Header | null = null;
  let tagger: NumpyCRFInference | null = null;
  const stats: Level1Stats = {
    header: { model: '', sha256: '', count: 0 },
    sequences: 0,
    tokens: 0,
    labelMismatches: [],
    scoreExact: 0,
    scoreMaxAbsDiff: 0,
    scoreOver1e12: 0,
    scoreOver1e9: 0,
    scoreOver5e7: 0,
    worst: null,
  };
  for await (const line of rl) {
    if (header === null) {
      header = JSON.parse(line) as Header;
      stats.header = header;
      tagger = new NumpyCRFInference(loadModelGz(`${repoRoot}/${header.model}`));
      continue;
    }
    const row = JSON.parse(line) as Row;
    const result = (tagger as NumpyCRFInference).tag_from_features(row.features);
    const got = result.map(([l]) => l);
    stats.sequences += 1;
    stats.tokens += row.labels.length;
    if (got.length !== row.labels.length || got.some((l, i) => l !== row.labels[i])) {
      stats.labelMismatches.push({ sentence: row.sentence, expected: row.labels, got });
    }
    for (let t = 0; t < row.scores.length; t++) {
      const expected = row.scores[t] as number;
      const actual = result[t]?.[1] ?? Number.NaN;
      const d = Math.abs(actual - expected);
      if (d === 0) stats.scoreExact += 1;
      if (d > 1e-12) stats.scoreOver1e12 += 1;
      if (d > 1e-9) stats.scoreOver1e9 += 1;
      if (d > 5e-7) stats.scoreOver5e7 += 1;
      if (!(d <= stats.scoreMaxAbsDiff)) {
        stats.scoreMaxAbsDiff = d;
        stats.worst = { sentence: row.sentence, t, expected, got: actual };
      }
    }
  }
  return stats;
}

export function formatStats(s: Level1Stats): string {
  return [
    `model ${s.header.model} sha256 ${s.header.sha256.slice(0, 12)}…`,
    `sequences ${s.sequences} (header count ${s.header.count}), tokens ${s.tokens}`,
    `labels: ${s.labelMismatches.length} mismatching sequences`,
    `scores: exact ${s.scoreExact}/${s.tokens}, >1e-12: ${s.scoreOver1e12}, >1e-9: ${s.scoreOver1e9}, >5e-7: ${s.scoreOver5e7}, max abs diff ${s.scoreMaxAbsDiff}`,
    s.worst ? `worst: t=${s.worst.t} expected ${s.worst.expected} got ${s.worst.got} — "${s.worst.sentence}"` : '',
  ].join('\n');
}
