// Minimal typings for natural/lib/natural/stemmers/porter_stemmer.js (CJS module.exports stemmer).
export interface Stemmer {
  stem(token: string): string;
}
declare const PorterStemmer: Stemmer;
export default PorterStemmer;
