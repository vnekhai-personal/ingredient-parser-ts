/**
 * The Porter stemmer the ship model was trained with: `natural` 8.1.1's `PorterStemmer.stem`
 * (docs/PORTING.md §3.3, CLAUDE.md I2), ported step for step from
 * `natural/lib/natural/stemmers/porter_stemmer.js` so the runtime has no dependency on the
 * `natural` package. Every quirk of that implementation is kept (it is not Porter's reference
 * algorithm): tokens shorter than three characters are returned untouched and un-lowercased,
 * step 1a strips one trailing "s" from any token longer than two characters not ending in "ss",
 * the measure is computed on natural's consonant/vowel grouping, and step 4's regexes are
 * applied as written. Differential test against natural: tests/harness/linguistics.test.ts.
 *
 * Copyright (c) 2011, Chris Umbel — MIT licence (LICENSE.natural). The foundation-foods matcher
 * uses the Snowball port instead (`foundationfoods/_snowball.ts`); the two are never mixed.
 */

/** Consecutive consonants → "C", consecutive vowels → "V" (a "y" after a consonant counts as a vowel). */
function categorizeGroups(token: string): string {
  return token.replace(/[^aeiouy]+y/g, 'CV').replace(/[aeiou]+/g, 'V').replace(/[^V]+/g, 'C');
}

/** Single consonants → "C", single vowels → "V". */
function categorizeChars(token: string): string {
  return token.replace(/[^aeiouy]y/g, 'CV').replace(/[aeiou]/g, 'V').replace(/[^V]/g, 'C');
}

/** Porter's measure M: the number of VC sequences, dropping an initial C and a trailing V. */
function measure(token: string | null): number {
  if (!token) return -1;
  return categorizeGroups(token).replace(/^C/, '').replace(/V$/, '').length / 2;
}

function endsWithDoublCons(token: string): boolean {
  return /([^aeiou])\1$/.test(token);
}

/** Replace `pattern` at the end of `token`; null when it does not match. */
function attemptReplace(
  token: string,
  pattern: string | RegExp,
  replacement: string,
  callback?: (result: string) => string | null,
): string | null {
  let result: string | null = null;
  if (typeof pattern === 'string' && token.substr(0 - pattern.length) === pattern) {
    result = token.replace(new RegExp(pattern + '$'), replacement);
  } else if (pattern instanceof RegExp && token.match(pattern)) {
    result = token.replace(pattern, replacement);
  }
  if (result && callback) return callback(result);
  return result;
}

type Replacement = readonly [string, string, string];

/** Apply a list of [suffix, probe replacement, replacement] for a minimum measure. */
function attemptReplacePatterns(token: string, replacements: readonly Replacement[], measureThreshold?: number | null): string {
  let replacement = token;
  for (const [pattern, probe, repl] of replacements) {
    if (measureThreshold == null || measure(attemptReplace(token, pattern, probe)) > measureThreshold) {
      replacement = attemptReplace(replacement, pattern, repl) || replacement;
    }
  }
  return replacement;
}

function replacePatterns(token: string, replacements: readonly Replacement[], measureThreshold?: number | null): string {
  return attemptReplacePatterns(token, replacements, measureThreshold) || token;
}

function replaceRegex(token: string, regex: RegExp, includeParts: readonly number[], minimumMeasure: number): string | null {
  let result = '';
  if (regex.test(token)) {
    const parts = regex.exec(token) as RegExpExecArray;
    for (const i of includeParts) result += parts[i];
  }
  if (measure(result) > minimumMeasure) return result;
  return null;
}

function step1a(token: string): string {
  if (token.match(/(ss|i)es$/)) return token.replace(/(ss|i)es$/, '$1');
  if (token.substr(-1) === 's' && token.substr(-2, 1) !== 's' && token.length > 2) return token.replace(/s?$/, '');
  return token;
}

function step1b(token: string): string {
  if (token.substr(-3) === 'eed') {
    if (measure(token.substr(0, token.length - 3)) > 0) return token.replace(/eed$/, 'ee');
  } else {
    const result = attemptReplace(token, /(ed|ing)$/, '', (stripped) => {
      if (categorizeGroups(stripped).indexOf('V') >= 0) {
        const inner = attemptReplacePatterns(stripped, [
          ['at', '', 'ate'],
          ['bl', '', 'ble'],
          ['iz', '', 'ize'],
        ]);
        if (inner !== stripped) return inner;
        if (endsWithDoublCons(stripped) && stripped.match(/[^lsz]$/)) return stripped.replace(/([^aeiou])\1$/, '$1');
        if (measure(stripped) === 1 && categorizeChars(stripped).substr(-3) === 'CVC' && stripped.match(/[^wxy]$/)) {
          return stripped + 'e';
        }
        return stripped;
      }
      return null;
    });
    if (result) return result;
  }
  return token;
}

function step1c(token: string): string {
  const categorizedGroups = categorizeGroups(token);
  if (token.substr(-1) === 'y' && categorizedGroups.substr(0, categorizedGroups.length - 1).indexOf('V') > -1) {
    return token.replace(/y$/, 'i');
  }
  return token;
}

const STEP2: readonly Replacement[] = [
  ['ational', '', 'ate'], ['tional', '', 'tion'], ['enci', '', 'ence'], ['anci', '', 'ance'],
  ['izer', '', 'ize'], ['abli', '', 'able'], ['bli', '', 'ble'], ['alli', '', 'al'], ['entli', '', 'ent'], ['eli', '', 'e'],
  ['ousli', '', 'ous'], ['ization', '', 'ize'], ['ation', '', 'ate'], ['ator', '', 'ate'], ['alism', '', 'al'],
  ['iveness', '', 'ive'], ['fulness', '', 'ful'], ['ousness', '', 'ous'], ['aliti', '', 'al'],
  ['iviti', '', 'ive'], ['biliti', '', 'ble'], ['logi', '', 'log'],
];

function step2(token: string): string {
  return replacePatterns(token, STEP2, 0);
}

const STEP3: readonly Replacement[] = [
  ['icate', '', 'ic'], ['ative', '', ''], ['alize', '', 'al'],
  ['iciti', '', 'ic'], ['ical', '', 'ic'], ['ful', '', ''], ['ness', '', ''],
];

function step3(token: string): string {
  return replacePatterns(token, STEP3, 0);
}

function step4(token: string): string {
  return (
    replaceRegex(token, /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/, [1], 1) ||
    replaceRegex(token, /^(.+?)(s|t)(ion)$/, [1, 2], 1) ||
    token
  );
}

function step5a(token: string): string {
  const m = measure(token.replace(/e$/, ''));
  if (m > 1 || (m === 1 && !(categorizeChars(token).substr(-4, 3) === 'CVC' && token.match(/[^wxy].$/)))) {
    token = token.replace(/e$/, '');
  }
  return token;
}

function step5b(token: string): string {
  if (measure(token) > 1) return token.replace(/ll$/, 'l');
  return token;
}

/** natural's `PorterStemmer.stem(token)`. */
export function porter_stem(token: string): string {
  if (token.length < 3) return token;
  return step5b(step5a(step4(step3(step2(step1c(step1b(step1a(token.toLowerCase()))))))));
}
