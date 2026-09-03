// Differential check of the Snowball (Porter2) port against NLTK over the corpus + FDC vocabulary.
// snowball-stems.jsonl is produced by the Python side (see training/README.md); regenerable.
import { existsSync } from 'node:fs';
import { openDump, resolveDump } from './dumps.js';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { describe, expect, it } from 'vitest';
import { snowball_stem } from '../../src/en/foundationfoods/_snowball.js';

const ROOT = resolve(import.meta.dirname, '../..');
const DUMP = resolveDump('snowball-stems.jsonl');

describe('snowball_stem reproduces nltk.stem.snowball.EnglishStemmer', () => {
  it('fixed spot checks', () => {
    const cases: [string, string][] = [
      ['generously', 'generous'], ['coriander', 'coriand'], ['courgette', 'courgett'], ['skies', 'sky'],
      ['dying', 'die'], ['thinly', 'thin'], ['tomatoes', 'tomato'], ['microwaved', 'microwav'],
      ['pasteurized', 'pasteur'], ['agreed', 'agre'], ['hopping', 'hop'], ['communication', 'communic'],
    ];
    for (const [w, s] of cases) expect(snowball_stem(w), w).toBe(s);
  });

  it.skipIf(process.env['HARNESS'] !== 'full')('every vocabulary token (snowball-stems.jsonl)', async () => {
    if (!existsSync(DUMP)) throw new Error('snowball-stems.jsonl missing: see training/README.md (HARNESS=full needs every dump).');
    const rl = createInterface({ input: openDump(DUMP), crlfDelay: Infinity });
    let n = 0;
    const bad: string[] = [];
    for await (const line of rl) {
      const { w, s } = JSON.parse(line) as { w: string; s: string };
      n += 1;
      if (snowball_stem(w) !== s) bad.push(`${w}: expected ${s} got ${snowball_stem(w)}`);
    }
    console.log(`snowball: ${n} tokens, ${bad.length} mismatches`);
    expect(bad.slice(0, 20)).toEqual([]);
    expect(bad.length).toBe(0);
  });
});
