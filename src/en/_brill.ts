/**
 * The Brill POS tagger the ship model was trained with: `natural` 8.1.1's
 * `BrillPOSTagger(Lexicon('EN', 'NN', 'NNP'), RuleSet('EN'))` (docs/PORTING.md §3.2, CLAUDE.md I2),
 * reproduced here so the runtime has no dependency on the `natural` package (its root pulls
 * database clients and Node-only modules into every bundle). The lexicon and rules are vendored
 * (models/natural/, generated into `./data/brill.en.ts`); the algorithm is written from natural's
 * observed behaviour, not its code (those sources are GPL-3.0; the package is MIT).
 *
 * Behaviour reproduced exactly (tests/harness/linguistics.test.ts diffs it against natural over
 * the corpus, the FDC descriptions and adversarial tokens):
 * - lexicon lookup of the token as written, then lowercased (`String.prototype.toLowerCase`),
 *   else the default: NNP when the first UTF-16 code unit is an ASCII capital, otherwise NN;
 * - then, for each position in turn, the 18 English transformation rules in file order, each
 *   seeing the tag the previous rules left at that position and the final tags of earlier ones;
 * - predicate quirks kept: "is a number" accepts anything `Number()` or `parseFloat()` takes
 *   ("1#1$4" → CD via parseFloat's prefix parse, "0abc" is not a number); "ends with" uses the
 *   first occurrence of the suffix, so "lyly" does not end with "ly"; "is a URL" is a dot plus
 *   two adjacent ASCII letters.
 * Known, harmless departures: natural tags the empty token and `__proto__` `undefined` through
 * plain-object lookups; here both take the default path (the tokenizer never yields an empty
 * token; `__proto__` is not in the corpus).
 */
import { BRILL_RULES, BRILL_TAGS, BRILL_WORDS } from './data/brill.en.js';

const DEFAULT_CATEGORY = 'NN';
const DEFAULT_CATEGORY_CAPITALISED = 'NNP';
const WILDCARD = '*';

type Predicate = (tokens: readonly string[], tags: readonly string[], i: number, parameter: string) => boolean;

/** natural's `isNumeric(x) || parseFloat(x)` truthiness, then `parameter === 'YES' ? isNumber : !isNumber`. */
const currentWordIsNumber: Predicate = (tokens, _tags, i, parameter) => {
  const token = tokens[i] as string;
  let isNumber: boolean | number = !Number.isNaN(Number(token));
  if (!isNumber) isNumber = parseFloat(token);
  return parameter === 'YES' ? Boolean(isNumber) : !isNumber;
};

const currentWordIsURL: Predicate = (tokens, _tags, i, parameter) => {
  const token = tokens[i] as string;
  const isURL = token.indexOf('.') > -1 && /[a-zA-Z]{2}/.test(token);
  return parameter === 'YES' ? isURL : !isURL;
};

const currentWordEndsWith: Predicate = (tokens, _tags, i, parameter) => {
  const word = tokens[i] as string;
  if (!parameter || parameter.length > word.length) return false;
  return word.indexOf(parameter) === word.length - parameter.length;
};

const prevWordIs: Predicate = (tokens, _tags, i, parameter) =>
  i > 0 && (tokens[i - 1] as string).toLowerCase() === parameter.toLowerCase();

const prevTagIs: Predicate = (_tokens, tags, i, parameter) => i > 0 && tags[i - 1] === parameter;

const nextTagIs: Predicate = (_tokens, tags, i, parameter) => i < tags.length - 1 && tags[i + 1] === parameter;

/** The predicates natural's English rule file uses (`RuleTemplates.js` names). */
const PREDICATES: Readonly<Record<string, Predicate>> = {
  'PREV-TAG': prevTagIs,
  'NEXT-TAG': nextTagIs,
  'NEXT-WORD-IS-TAG': nextTagIs,
  'CURRENT-WORD-IS-NUMBER': currentWordIsNumber,
  'CURRENT-WORD-IS-URL': currentWordIsURL,
  'CURRENT-WORD-ENDS-WITH': currentWordEndsWith,
  'PREV-WORD-IS': prevWordIs,
};

interface Rule {
  from: string;
  to: string;
  predicate: Predicate;
  parameter: string;
}

function parseRule(line: string): Rule {
  const parts = line.trim().split(/[ \t]+/);
  const [from, to, name, parameter] = parts;
  if (parts.length < 3 || parts.length > 4 || from === undefined || to === undefined || name === undefined) {
    throw new Error(`brill: malformed rule ${JSON.stringify(line)}`);
  }
  const predicate = PREDICATES[name];
  if (predicate === undefined) throw new Error(`brill: unsupported predicate ${name} in rule ${JSON.stringify(line)}`);
  return { from, to, predicate, parameter: parameter ?? '' };
}

let lexicon: Map<string, string> | null = null;
let rules: readonly Rule[] | null = null;

function getLexicon(): Map<string, string> {
  if (lexicon === null) {
    lexicon = new Map();
    for (let g = 0; g < BRILL_TAGS.length; g++) {
      const tag = BRILL_TAGS[g] as string;
      for (const word of (BRILL_WORDS[g] as string).split('\n')) lexicon.set(word, tag);
    }
  }
  return lexicon;
}

function getRules(): readonly Rule[] {
  if (rules === null) {
    const seen = new Set<string>();
    const parsed: Rule[] = [];
    for (const line of BRILL_RULES) {
      const rule = parseRule(line);
      // natural keys its rule set by the rule literal; a repeated rule is applied once.
      const key = `${rule.from} ${rule.to} ${rule.predicate.name} ${rule.parameter}`;
      if (seen.has(key)) continue;
      seen.add(key);
      parsed.push(rule);
    }
    rules = parsed;
  }
  return rules;
}

/** Lexical category of one token: the lexicon entry as written, else lowercased, else the default. */
export function brill_lexicon_tag(token: string): string {
  const lex = getLexicon();
  const exact = lex.get(token);
  if (exact !== undefined) return exact;
  const lower = lex.get(token.toLowerCase());
  if (lower !== undefined) return lower;
  const c = token.charCodeAt(0);
  return c >= 65 && c <= 90 ? DEFAULT_CATEGORY_CAPITALISED : DEFAULT_CATEGORY;
}

/** Tag a token list: lexicon categories, then the transformation rules. Returns (token, tag) pairs. */
export function brill_tag(tokens: readonly string[]): [string, string][] {
  const tags = tokens.map(brill_lexicon_tag);
  const ruleSet = getRules();
  for (let i = 0; i < tokens.length; i++) {
    for (const rule of ruleSet) {
      if ((tags[i] === rule.from || rule.from === WILDCARD) && rule.predicate(tokens, tags, i, rule.parameter)) {
        tags[i] = rule.to;
      }
    }
  }
  return tokens.map((token, i) => [token, tags[i] as string]);
}
