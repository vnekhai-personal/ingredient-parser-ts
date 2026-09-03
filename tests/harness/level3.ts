// Harness level 3 runner (docs/PORTING.md §4): parse_ingredient over a training/dump-parsed.py dump,
// diffed byte for byte against Python's canonical serialisation.
import { openDump } from './dumps.js';
import { createInterface } from 'node:readline';
import { parse_ingredient, type ParseIngredientOptions } from '../../src/index.js';
import { serializeParsed } from './serialize.js';

export interface Mismatch {
  src: string;
  sentence: string;
  /** 'conf-only': the only differences are foundation_foods[*].confidence values (magnitude in `confDiff`). */
  kind: 'threw' | 'should-throw' | 'diff' | 'conf-only';
  detail: string;
  confDiff?: number;
}

export interface Level3Options {
  parse?: ParseIngredientOptions;
  /** Classify differences confined to foundation_foods[*].confidence separately (float32 BLAS seam, src/_np.ts). */
  classifyConfidenceOnly?: boolean;
}

/** Max |Δconfidence| when a and b differ only in foundation_foods[*].confidence, else null. */
function confidenceOnlyDiff(a: unknown, b: unknown): number | null {
  const pa = a as { foundation_foods: { confidence: number }[] } & Record<string, unknown>;
  const pb = b as { foundation_foods: { confidence: number }[] } & Record<string, unknown>;
  if (!Array.isArray(pa.foundation_foods) || !Array.isArray(pb.foundation_foods)) return null;
  if (pa.foundation_foods.length !== pb.foundation_foods.length) return null;
  const strip = (p: Record<string, unknown>) => ({
    ...p,
    foundation_foods: (p['foundation_foods'] as Record<string, unknown>[]).map((f) => ({ ...f, confidence: 0 })),
  });
  if (firstDiff(strip(pa), strip(pb)) !== null) return null;
  let max = 0;
  pa.foundation_foods.forEach((f, i) => {
    max = Math.max(max, Math.abs(f.confidence - (pb.foundation_foods[i] as { confidence: number }).confidence));
  });
  return max;
}

/** First differing path between two JSON values, for a readable report. */
export function firstDiff(a: unknown, b: unknown, path = '$'): string | null {
  if (typeof a !== typeof b) return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  if (a === null || b === null || typeof a !== 'object') {
    return a === b ? null : `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    const d = firstDiff(ao[k], bo[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

export async function runLevel3(
  dumpPath: string,
  opts: Level3Options = {},
): Promise<{ lines: number; mismatches: Mismatch[] }> {
  const options = opts.parse ?? {};
  const classify = opts.classifyConfidenceOnly ?? false;
  const rl = createInterface({ input: openDump(dumpPath), crlfDelay: Infinity });
  let lines = 0;
  let first = true;
  const mismatches: Mismatch[] = [];
  for await (const line of rl) {
    if (first) {
      first = false;
      continue;
    }
    lines += 1;
    const row = JSON.parse(line) as { src: string; s: string; parsed?: unknown; error?: string };
    let got: string | null = null;
    let threw: string | null = null;
    try {
      got = serializeParsed(parse_ingredient(row.s, options));
    } catch (e) {
      threw = String(e);
    }
    if (row.error !== undefined) {
      if (threw === null) mismatches.push({ src: row.src, sentence: row.s, kind: 'should-throw', detail: `Python raised ${row.error}; port returned ${got}` });
      continue;
    }
    if (threw !== null) {
      mismatches.push({ src: row.src, sentence: row.s, kind: 'threw', detail: threw });
      continue;
    }
    const marker = '"parsed":';
    const expected = line.slice(line.indexOf(marker) + marker.length, -1);
    if (got !== expected) {
      const ea = JSON.parse(expected);
      const ga = JSON.parse(got as string);
      const d = firstDiff(ea, ga) ?? `byte-level: ${expected.slice(0, 120)} vs ${(got as string).slice(0, 120)}`;
      const cd = classify ? confidenceOnlyDiff(ea, ga) : null;
      if (cd !== null) mismatches.push({ src: row.src, sentence: row.s, kind: 'conf-only', detail: d, confDiff: cd });
      else mismatches.push({ src: row.src, sentence: row.s, kind: 'diff', detail: d });
    }
  }
  return { lines, mismatches };
}

export function reportLevel3(r: { lines: number; mismatches: Mismatch[] }, show = 40): void {
  const byKind: Record<string, number> = {};
  for (const m of r.mismatches) byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
  console.log(`lines ${r.lines}; mismatches ${r.mismatches.length} ${JSON.stringify(byKind)}`);
  for (const m of r.mismatches.filter((m) => m.kind !== 'conf-only').slice(0, show)) console.log(`  [${m.kind}] ${m.src} "${m.sentence}": ${m.detail}`);
}
