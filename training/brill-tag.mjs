// Tag every corpus token list with natural's Brill tagger -> JSONL map.
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import natural from 'natural';

const lexicon = new natural.Lexicon('EN', 'NN', 'NNP');
const rules = new natural.RuleSet('EN');
const tagger = new natural.BrillPOSTagger(lexicon, rules);

const out = createWriteStream('brill-tags.jsonl');
let n = 0;
// Blank / whitespace-only input tokenizes to [] — the hook must find that key too.
out.write(JSON.stringify({ k: '[]', tags: [] }) + '\n');
for await (const line of createInterface({ input: createReadStream('corpus-tokens.jsonl') })) {
  const { t } = JSON.parse(line);
  const tags = tagger.tag(t).taggedWords.map((w) => w.tag);
  out.write(JSON.stringify({ k: JSON.stringify(t), tags }) + '\n');
  n += 1;
}
out.end(() => console.log(`tagged ${n} token lists`));
