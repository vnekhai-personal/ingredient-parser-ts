// Minimal typings for natural/lib/natural/brill_pos_tagger/index.js (CJS module.exports object) —
// the reference implementation tests/harness/linguistics.test.ts diffs the vendored tagger against.
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
declare const brill: {
  Lexicon: typeof Lexicon;
  RuleSet: typeof RuleSet;
  BrillPOSTagger: typeof BrillPOSTagger;
};
export default brill;
