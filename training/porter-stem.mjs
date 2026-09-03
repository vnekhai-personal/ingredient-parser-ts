// Stem every token in a vocabulary dump with natural's vanilla PorterStemmer -> JSONL map.
// Input: feat-tokens.jsonl ({"w": token} per line, from dump-feat-tokens.py).
// Output: porter-stems.jsonl ({"w": token, "s": stem} per line), consumed by the
// PORTER_STEMS_FILE hook in preprocess-brill-patch.diff.
// Canonical JSON: JSON.stringify default = compact separators, raw unicode.
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import natural from 'natural';

const src = process.argv[2] ?? 'feat-tokens.jsonl';
const dst = process.argv[3] ?? 'porter-stems.jsonl';
const stemmer = natural.PorterStemmer;

const out = createWriteStream(dst);
let n = 0;
for await (const line of createInterface({ input: createReadStream(src) })) {
  const { w } = JSON.parse(line);
  out.write(JSON.stringify({ w, s: stemmer.stem(w) }) + '\n');
  n += 1;
}
out.end(() => console.log(`stemmed ${n} tokens -> ${dst}`));
