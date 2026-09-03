// Differential test of the vendored linguistic components against the implementations the ship
// model was trained with (CLAUDE.md I2): `src/en/_brill.ts` and `src/en/_porter.ts` vs natural
// 8.1.1's BrillPOSTagger(Lexicon('EN','NN','NNP'), RuleSet('EN')) and PorterStemmer.stem, run live
// (natural is a devDependency). Inputs: the corpus + fixture sentences of the committed level-3
// reference (a 5,000-line sample by default, every line under HARNESS=full), every FDC description
// under HARNESS=full, and adversarial token lists aimed at each predicate and fallback.
// The committed Python-side tags (feature-hashes.jsonl.gz) are checked too, without natural.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { describe, expect, it } from 'vitest';
import brill from 'natural/lib/natural/brill_pos_tagger/index.js';
import PorterStemmer from 'natural/lib/natural/stemmers/porter_stemmer.js';
import { brill_lexicon_tag, brill_tag } from '../../src/en/_brill.js';
import { porter_stem } from '../../src/en/_porter.js';
import { pos_tag, stem, tokenize } from '../../src/en/_utils.js';
import { PreProcessor } from '../../src/en/index.js';
import { load_fdc_rows } from '../../src/en/_loaders.js';
import { preload_foundation_foods } from '../../src/foundation-foods.js';
import { openDump, resolveDump } from './dumps.js';

const ROOT = resolve(import.meta.dirname, '../..');
const wantFull = process.env['HARNESS'] === 'full';
const SAMPLE = 5000;

const NATURAL = new brill.BrillPOSTagger(new brill.Lexicon('EN', 'NN', 'NNP'), new brill.RuleSet('EN'));
const naturalTags = (tokens: readonly string[]): string[] => NATURAL.tag([...tokens]).taggedWords.map((w) => w.tag);
const portTags = (tokens: readonly string[]): string[] => brill_tag(tokens).map((p) => p[1]);

/** Sentences of the committed level-3 reference (corpus + fixtures), first `limit` or all. */
async function sentences(limit: number): Promise<string[]> {
  const out: string[] = [];
  const rl = createInterface({ input: openDump(resolveDump('parsed.jsonl', 'PARSED_DUMP')), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false; // header
      continue;
    }
    out.push((JSON.parse(line) as { s: string }).s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Token lists the parser actually tags: the PreProcessor's normalised tokens (what `pos_tag` sees). */
function tokenLists(lines: readonly string[]): string[][] {
  const lists: string[][] = [];
  for (const s of lines) {
    try {
      lists.push(tokenize(new PreProcessor(s).sentence));
    } catch {
      lists.push(tokenize(s)); // lines where Python raises: still tag the raw tokens
    }
  }
  return lists;
}

function diffTags(lists: readonly (readonly string[])[]): string[] {
  const bad: string[] = [];
  for (const tokens of lists) {
    const a = portTags(tokens);
    const b = naturalTags(tokens);
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${JSON.stringify(tokens)}: port ${JSON.stringify(a)} natural ${JSON.stringify(b)}`);
  }
  return bad;
}

function diffStems(tokens: Iterable<string>): string[] {
  const bad: string[] = [];
  for (const t of tokens) {
    const a = porter_stem(t);
    const b = PorterStemmer.stem(t);
    if (a !== b) bad.push(`${JSON.stringify(t)}: port ${JSON.stringify(a)} natural ${JSON.stringify(b)}`);
  }
  return bad;
}

const ADVERSARIAL_TOKENS: string[] = [
  // lexicon fallbacks: as written, lowercased, default NN / NNP by the first UTF-16 unit
  'Onion', 'ONION', 'onion', 'Zyxwv', 'zyxwv', 'ZYXWV', 'Éclair', 'éclair', 'İstanbul', 'ıi', 'ß', 'ẞ', '🍅', '🍅x', 'Ⅻ',
  'constructor', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__', 'Constructor', 'prototype',
  // CURRENT-WORD-IS-NUMBER: Number() and parseFloat() acceptance, and the NN/NNP/NNS/NNPS gates
  '1', '12', '1.5', '.5', '5.', '-3', '+3', '1e5', '1E5', '0x10', '0b1', '0o7', 'Infinity', '-Infinity', 'NaN',
  '12abc', '0abc', '00', '1/2', '1#1$4', '1_000', '١٢', '½', '1,5', '1.2.3', 'Ten', 'ten', '3rd', '1st',
  // CURRENT-WORD-IS-URL: a dot plus two adjacent ASCII letters
  'www.example.com', 'a.b', 'ab.c', 'x.yz', 'e.g.', 'i.e.', '3.5oz', 'oz.', 'lb.', 'tsp.', 'St.', 'Mr.', '...',
  // CURRENT-WORD-ENDS-WITH via indexOf (first occurrence): ed / ly / al / s / ing
  'ed', 'red', 'shredded', 'Shredded', 'lyly', 'ly', 'fly', 'Only', 'al', 'oatmeal', 'Cereal', 'ss', 's', 'sss',
  'ing', 'ring', 'Ring', 'ingredients', 'baking', 'BAKING', 'edly', 'saladed', 'sals', 'als',
  // DT before verb-like words (PREV-TAG DT) and PREV-WORD-IS would
  'the', 'a', 'The', 'would', 'Would', 'WOULD', 'bake', 'baked', 'bakes', 'chop', 'Chop', 'run', 'Run',
  // punctuation and tokenizer output shapes
  ',', '(', ')', '/', '-', '--', '\'', '"', '`', '``', '\'\'', 'and/or', '&', '%', '°', '°F', '5°', 'x', 'X',
];

function adversarialLists(): string[][] {
  const lists: string[][] = [[]];
  for (const t of ADVERSARIAL_TOKENS) lists.push([t]);
  // every token in every position of a five-token window, so PREV-TAG / PREV-WORD-IS / NEXT-TAG fire
  for (const t of ADVERSARIAL_TOKENS) {
    lists.push(['the', t, 'the', t, 'the']);
    lists.push(['would', t, 'would', t]);
    lists.push([t, t, t]);
    lists.push(['1', 'cup', t, ',', t]);
  }
  return lists;
}

describe('vendored Brill tagger reproduces natural 8.1.1', () => {
  it('adversarial token lists', () => {
    const bad = diffTags(adversarialLists());
    expect(bad.slice(0, 20)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it('the documented departures from natural (empty token, __proto__) take the default path', () => {
    expect(brill_lexicon_tag('')).toBe('NN');
    expect(brill_lexicon_tag('__proto__')).toBe('NN');
    expect(brill_lexicon_tag('__PROTO__')).toBe('NN'); // '_' is not an ASCII capital
    expect(portTags(['__proto__'])).toEqual(['NN']);
    // natural's plain-object lookup yields `undefined` for both; nothing else differs.
    expect(naturalTags(['__proto__'])).toEqual([undefined as unknown as string]);
    expect(naturalTags([''])).toEqual([undefined as unknown as string]);
  });

  it('fixture lines (fixtures/probe-recipes.json)', () => {
    const fixtures = JSON.parse(readFileSync(resolve(ROOT, 'fixtures/probe-recipes.json'), 'utf8')) as Record<string, { lines: string[] }>;
    const lines = Object.values(fixtures).flatMap((e) => e.lines);
    const bad = diffTags(tokenLists(lines));
    expect(bad).toEqual([]);
  });

  it(`corpus sentences of the level-3 reference (${wantFull ? 'every line' : `first ${SAMPLE}`})`, async () => {
    const lines = await sentences(wantFull ? Infinity : SAMPLE);
    const lists = tokenLists(lines);
    const bad = diffTags(lists);
    console.log(`brill vs natural: ${lists.length} token lists, ${bad.length} mismatches`);
    expect(bad.slice(0, 20)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it.skipIf(!wantFull)('every FDC description (foundation-foods path)', async () => {
    await preload_foundation_foods();
    const lists = load_fdc_rows().map((r) => tokenize(r.description.toLowerCase()));
    const bad = diffTags(lists);
    console.log(`brill vs natural (FDC): ${lists.length} descriptions, ${bad.length} mismatches`);
    expect(bad.slice(0, 20)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it(`committed Python-side tags (feature-hashes.jsonl.gz, ${wantFull ? 'every line' : `first ${SAMPLE}`})`, async () => {
    const dump = resolveDump('feature-hashes.jsonl', 'FEATURE_HASHES');
    if (!existsSync(dump)) throw new Error('feature-hashes.jsonl missing');
    const rl = createInterface({ input: openDump(dump), crlfDelay: Infinity });
    let n = 0;
    const bad: string[] = [];
    for await (const line of rl) {
      const row = JSON.parse(line) as { s: string; p: string[]; error?: string };
      if (row.error !== undefined) continue;
      n += 1;
      const pos = new PreProcessor(row.s, { custom_units: {} }).tokenized_sentence.map((t) => t.pos_tag);
      if (JSON.stringify(pos) !== JSON.stringify(row.p)) bad.push(`${row.s}: port ${JSON.stringify(pos)} python ${JSON.stringify(row.p)}`);
      if (!wantFull && n >= SAMPLE) break;
    }
    console.log(`tags vs Python reference: ${n} lines, ${bad.length} mismatches`);
    expect(bad.slice(0, 20)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it('pos_tag is the vendored tagger', () => {
    expect(pos_tag(['2', 'cups', 'Chopped', 'flat-leaf', 'parsley'])).toEqual(brill_tag(['2', 'cups', 'Chopped', 'flat-leaf', 'parsley']));
  });
});

describe('vendored Porter stemmer reproduces natural 8.1.1', () => {
  it('adversarial tokens', () => {
    const extra = [
      'a', 'ab', 'abc', 'ML', 'mL', 'Oz', 'OZ', 'sky', 'skies', 'flies', 'fly', 'cries', 'cry', 'agreed', 'feed', 'bleed',
      'hopping', 'hoping', 'hopped', 'sized', 'sizing', 'filing', 'filling', 'falling', 'fizzed', 'buzzing', 'controlled',
      'ration', 'rational', 'relational', 'conditional', 'valency', 'hesitancy', 'digitizer', 'conformabli', 'radicalli',
      'differentli', 'vileli', 'analogousli', 'vietnamization', 'predication', 'operator', 'feudalism', 'decisiveness',
      'hopefulness', 'callousness', 'formaliti', 'sensitiviti', 'sensibiliti', 'triplicate', 'formative', 'formalize',
      'electriciti', 'electrical', 'hopeful', 'goodness', 'revival', 'allowance', 'inference', 'airliner', 'gyroscopic',
      'adjustable', 'defensible', 'irritant', 'replacement', 'adjustment', 'dependent', 'adoption', 'homologou', 'communism',
      'activate', 'angulariti', 'homologous', 'effective', 'bowdlerize', 'probate', 'rate', 'cease', 'controll', 'roll',
      'y', 'yy', 'yyy', 'aeiou', 'bcdfg', 'Tomatoes', 'TOMATOES', 'tomatoes', 'chilies', 'chillies', 'ies', 'ss', 'sss',
      'ed', 'eed', 'ing', 'ings', 'é', 'éé', 'ééé', 'crème', 'jalapeños', 'Ⅻ', '🍅🍅🍅', 'and/or', '1#1$4', '!num', 'x.y',
    ];
    const bad = diffStems(extra);
    expect(bad).toEqual([]);
  });

  it(`every token of the level-3 reference sentences (${wantFull ? 'every line' : `first ${SAMPLE}`}), plus lowercase and hyphen parts`, async () => {
    const lines = await sentences(wantFull ? Infinity : SAMPLE);
    const vocab = new Set<string>();
    for (const tokens of tokenLists(lines)) {
      for (const t of tokens) {
        vocab.add(t);
        vocab.add(t.toLowerCase());
        for (const part of t.split('-')) vocab.add(part);
      }
    }
    const bad = diffStems(vocab);
    console.log(`porter vs natural: ${vocab.size} tokens, ${bad.length} mismatches`);
    expect(bad.slice(0, 20)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it('stem() is the vendored stemmer', () => {
    for (const t of ['tomatoes', 'ML', 'baking', 'flies']) expect(stem(t)).toBe(porter_stem(t));
  });
});
