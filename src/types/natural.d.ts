// Minimal type surface of `natural` 8.1.1 used by the port (the package's own typings pull a
// .ts source into the type-check). Mapped via tsconfig `paths`; runtime import is unchanged.
export class Lexicon {
  constructor(language: string, defaultCategory: string, defaultCategoryCapitalised?: string);
}
export class RuleSet {
  constructor(language: string);
}
export interface BrillPOSTaggedWord {
  token: string;
  tag: string;
}
export interface BrillPOSSentence {
  taggedWords: BrillPOSTaggedWord[];
}
export class BrillPOSTagger {
  constructor(lexicon: Lexicon, ruleSet: RuleSet);
  tag(tokens: string[]): BrillPOSSentence;
}
export interface Stemmer {
  stem(token: string): string;
}
export const PorterStemmer: Stemmer;
declare const natural: {
  Lexicon: typeof Lexicon;
  RuleSet: typeof RuleSet;
  BrillPOSTagger: typeof BrillPOSTagger;
  PorterStemmer: Stemmer;
};
export default natural;
