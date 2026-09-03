// Minimal typings for natural/lib/natural/stemmers/porter_stemmer.js (CJS module.exports stemmer) —
// the reference implementation tests/harness/linguistics.test.ts diffs the vendored stemmer against.
export interface Stemmer {
  stem(token: string): string;
}
declare const PorterStemmer: Stemmer;
export default PorterStemmer;
