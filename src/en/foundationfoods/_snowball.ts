/**
 * Port of NLTK's `nltk.stem.snowball.EnglishStemmer` (NLTK 3.10.3, `ignore_stopwords=False`)
 * — the Snowball / Porter2 English stemmer. TS-native supporting module.
 *
 * Why this exists next to natural's Porter: the CRF model was trained on natural's Porter
 * stems (docs/PORTING.md, CLAUDE.md I2) and `src/en/_utils.ts` `stem()` stays Porter for
 * feature extraction. The foundation-foods matcher is NOT trained: its substitution tables
 * and NON_RAW_FOOD_*_STEMS are written in Snowball stems (`coriand`, `courgett`, `puré`,
 * `microwav`…), so it must stem with Snowball on both sides or those tables silently stop
 * matching. Verified against NLTK over the corpus + FDC vocabulary
 * (tests/harness/snowball.test.ts, `snowball-stems.jsonl`).
 */

const VOWELS = 'aeiouy';
const DOUBLE_CONSONANTS = ['bb', 'dd', 'ff', 'gg', 'mm', 'nn', 'pp', 'rr', 'tt'];
const LI_ENDING = 'cdeghkmnrt';
const STEP0_SUFFIXES = ["'s'", "'s", "'"];
const STEP1A_SUFFIXES = ['sses', 'ied', 'ies', 'us', 'ss', 's'];
const STEP1B_SUFFIXES = ['eedly', 'ingly', 'edly', 'eed', 'ing', 'ed'];
const STEP2_SUFFIXES = [
  'ization', 'ational', 'fulness', 'ousness', 'iveness', 'tional', 'biliti', 'lessli', 'entli', 'ation', 'alism',
  'aliti', 'ousli', 'iviti', 'fulli', 'enci', 'anci', 'abli', 'izer', 'ator', 'alli', 'bli', 'ogi', 'li',
];
const STEP3_SUFFIXES = ['ational', 'tional', 'alize', 'icate', 'iciti', 'ative', 'ical', 'ness', 'ful'];
const STEP4_SUFFIXES = [
  'ement', 'ance', 'ence', 'able', 'ible', 'ment', 'ant', 'ent', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize', 'ion', 'al',
  'er', 'ic',
];
const SPECIAL_WORDS: Readonly<Record<string, string>> = {
  skis: 'ski', skies: 'sky', dying: 'die', lying: 'lie', tying: 'tie', idly: 'idl', gently: 'gentl', ugly: 'ugli',
  early: 'earli', only: 'onli', singly: 'singl', sky: 'sky', news: 'news', howe: 'howe', atlas: 'atlas',
  cosmos: 'cosmos', bias: 'bias', andes: 'andes', inning: 'inning', innings: 'inning', outing: 'outing',
  outings: 'outing', canning: 'canning', cannings: 'canning', herring: 'herring', herrings: 'herring',
  earring: 'earring', earrings: 'earring', proceed: 'proceed', proceeds: 'proceed', proceeded: 'proceed',
  proceeding: 'proceed', exceed: 'exceed', exceeds: 'exceed', exceeded: 'exceed', exceeding: 'exceed',
  succeed: 'succeed', succeeds: 'succeed', succeeded: 'succeed', succeeding: 'succeed',
};

const isVowel = (c: string | undefined): boolean => c !== undefined && VOWELS.includes(c);
/** Python `s[:-n]` (n > 0). */
const dropLast = (s: string, n: number): string => (n >= s.length ? '' : s.slice(0, s.length - n));
/** nltk.stem.util.suffix_replace: original[:-len(old)] + new. */
const suffixReplace = (original: string, old: string, repl: string): string => dropLast(original, old.length) + repl;
/** Python negative index `s[-k]`. */
const at = (s: string, k: number): string | undefined => (s.length >= k ? s[s.length - k] : undefined);

function r1r2Standard(word: string): [string, string] {
  let r1 = '';
  let r2 = '';
  for (let i = 1; i < word.length; i++) {
    if (!isVowel(word[i]) && isVowel(word[i - 1])) {
      r1 = word.slice(i + 1);
      break;
    }
  }
  for (let i = 1; i < r1.length; i++) {
    if (!isVowel(r1[i]) && isVowel(r1[i - 1])) {
      r2 = r1.slice(i + 1);
      break;
    }
  }
  return [r1, r2];
}

/** `EnglishStemmer().stem(word)`. */
export function snowball_stem(input: string): string {
  let word = input.toLowerCase();

  if (word.length <= 2) return word;
  if (Object.hasOwn(SPECIAL_WORDS, word)) return SPECIAL_WORDS[word] as string;

  word = word.split('’').join("'").split('‘').join("'").split('‛').join("'");
  if (word.startsWith("'")) word = word.slice(1);
  if (word.startsWith('y')) word = 'Y' + word.slice(1);
  for (let i = 1; i < word.length; i++) {
    if (isVowel(word[i - 1]) && word[i] === 'y') word = word.slice(0, i) + 'Y' + word.slice(i + 1);
  }

  let step1a_vowel_found = false;
  let step1b_vowel_found = false;
  let r1 = '';
  let r2 = '';

  if (word.startsWith('gener') || word.startsWith('commun') || word.startsWith('arsen')) {
    if (word.startsWith('gener') || word.startsWith('arsen')) r1 = word.slice(5);
    else r1 = word.slice(6);
    for (let i = 1; i < r1.length; i++) {
      if (!isVowel(r1[i]) && isVowel(r1[i - 1])) {
        r2 = r1.slice(i + 1);
        break;
      }
    }
  } else {
    [r1, r2] = r1r2Standard(word);
  }

  // STEP 0
  for (const suffix of STEP0_SUFFIXES) {
    if (word.endsWith(suffix)) {
      word = dropLast(word, suffix.length);
      r1 = dropLast(r1, suffix.length);
      r2 = dropLast(r2, suffix.length);
      break;
    }
  }

  // STEP 1a
  for (const suffix of STEP1A_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === 'sses') {
        word = dropLast(word, 2);
        r1 = dropLast(r1, 2);
        r2 = dropLast(r2, 2);
      } else if (suffix === 'ied' || suffix === 'ies') {
        if (dropLast(word, suffix.length).length > 1) {
          word = dropLast(word, 2);
          r1 = dropLast(r1, 2);
          r2 = dropLast(r2, 2);
        } else {
          word = dropLast(word, 1);
          r1 = dropLast(r1, 1);
          r2 = dropLast(r2, 1);
        }
      } else if (suffix === 's') {
        for (const letter of dropLast(word, 2)) {
          if (isVowel(letter)) {
            step1a_vowel_found = true;
            break;
          }
        }
        if (step1a_vowel_found) {
          word = dropLast(word, 1);
          r1 = dropLast(r1, 1);
          r2 = dropLast(r2, 1);
        }
      }
      break;
    }
  }

  // STEP 1b
  for (const suffix of STEP1B_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (suffix === 'eed' || suffix === 'eedly') {
        if (r1.endsWith(suffix)) {
          word = suffixReplace(word, suffix, 'ee');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ee') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ee') : '';
        }
      } else {
        for (const letter of dropLast(word, suffix.length)) {
          if (isVowel(letter)) {
            step1b_vowel_found = true;
            break;
          }
        }
        if (step1b_vowel_found) {
          word = dropLast(word, suffix.length);
          r1 = dropLast(r1, suffix.length);
          r2 = dropLast(r2, suffix.length);

          if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) {
            word = word + 'e';
            r1 = r1 + 'e';
            if (word.length > 5 || r1.length >= 3) r2 = r2 + 'e';
          } else if (DOUBLE_CONSONANTS.some((d) => word.endsWith(d))) {
            word = dropLast(word, 1);
            r1 = dropLast(r1, 1);
            r2 = dropLast(r2, 1);
          } else if (
            (r1 === '' &&
              word.length >= 3 &&
              !isVowel(at(word, 1)) &&
              !'wxY'.includes(at(word, 1) as string) &&
              isVowel(at(word, 2)) &&
              !isVowel(at(word, 3))) ||
            (r1 === '' && word.length === 2 && isVowel(word[0]) && !isVowel(word[1]))
          ) {
            word = word + 'e';
            if (r1.length > 0) r1 = r1 + 'e';
            if (r2.length > 0) r2 = r2 + 'e';
          }
        }
      }
      break;
    }
  }

  // STEP 1c
  if (word.length > 2 && 'yY'.includes(at(word, 1) as string) && !isVowel(at(word, 2))) {
    word = dropLast(word, 1) + 'i';
    r1 = r1.length >= 1 ? dropLast(r1, 1) + 'i' : '';
    r2 = r2.length >= 1 ? dropLast(r2, 1) + 'i' : '';
  }

  // STEP 2
  for (const suffix of STEP2_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        if (suffix === 'tional') {
          word = dropLast(word, 2);
          r1 = dropLast(r1, 2);
          r2 = dropLast(r2, 2);
        } else if (suffix === 'enci' || suffix === 'anci' || suffix === 'abli') {
          word = dropLast(word, 1) + 'e';
          r1 = r1.length >= 1 ? dropLast(r1, 1) + 'e' : '';
          r2 = r2.length >= 1 ? dropLast(r2, 1) + 'e' : '';
        } else if (suffix === 'entli') {
          word = dropLast(word, 2);
          r1 = dropLast(r1, 2);
          r2 = dropLast(r2, 2);
        } else if (suffix === 'izer' || suffix === 'ization') {
          word = suffixReplace(word, suffix, 'ize');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ize') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ize') : '';
        } else if (suffix === 'ational' || suffix === 'ation' || suffix === 'ator') {
          word = suffixReplace(word, suffix, 'ate');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ate') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ate') : 'e';
        } else if (suffix === 'alism' || suffix === 'aliti' || suffix === 'alli') {
          word = suffixReplace(word, suffix, 'al');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'al') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'al') : '';
        } else if (suffix === 'fulness') {
          word = dropLast(word, 4);
          r1 = dropLast(r1, 4);
          r2 = dropLast(r2, 4);
        } else if (suffix === 'ousli' || suffix === 'ousness') {
          word = suffixReplace(word, suffix, 'ous');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ous') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ous') : '';
        } else if (suffix === 'iveness' || suffix === 'iviti') {
          word = suffixReplace(word, suffix, 'ive');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ive') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ive') : 'e';
        } else if (suffix === 'biliti' || suffix === 'bli') {
          word = suffixReplace(word, suffix, 'ble');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ble') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ble') : '';
        } else if (suffix === 'ogi' && at(word, 4) === 'l') {
          word = dropLast(word, 1);
          r1 = dropLast(r1, 1);
          r2 = dropLast(r2, 1);
        } else if (suffix === 'fulli' || suffix === 'lessli') {
          word = dropLast(word, 2);
          r1 = dropLast(r1, 2);
          r2 = dropLast(r2, 2);
        } else if (suffix === 'li' && LI_ENDING.includes(at(word, 3) as string)) {
          word = dropLast(word, 2);
          r1 = dropLast(r1, 2);
          r2 = dropLast(r2, 2);
        }
      }
      break;
    }
  }

  // STEP 3
  for (const suffix of STEP3_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r1.endsWith(suffix)) {
        if (suffix === 'tional') {
          word = dropLast(word, 2);
          r1 = dropLast(r1, 2);
          r2 = dropLast(r2, 2);
        } else if (suffix === 'ational') {
          word = suffixReplace(word, suffix, 'ate');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ate') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ate') : '';
        } else if (suffix === 'alize') {
          word = dropLast(word, 3);
          r1 = dropLast(r1, 3);
          r2 = dropLast(r2, 3);
        } else if (suffix === 'icate' || suffix === 'iciti' || suffix === 'ical') {
          word = suffixReplace(word, suffix, 'ic');
          r1 = r1.length >= suffix.length ? suffixReplace(r1, suffix, 'ic') : '';
          r2 = r2.length >= suffix.length ? suffixReplace(r2, suffix, 'ic') : '';
        } else if (suffix === 'ful' || suffix === 'ness') {
          word = dropLast(word, suffix.length);
          r1 = dropLast(r1, suffix.length);
          r2 = dropLast(r2, suffix.length);
        } else if (suffix === 'ative' && r2.endsWith(suffix)) {
          word = dropLast(word, 5);
          r1 = dropLast(r1, 5);
          r2 = dropLast(r2, 5);
        }
      }
      break;
    }
  }

  // STEP 4
  for (const suffix of STEP4_SUFFIXES) {
    if (word.endsWith(suffix)) {
      if (r2.endsWith(suffix)) {
        if (suffix === 'ion') {
          if ('st'.includes(at(word, 4) as string)) {
            word = dropLast(word, 3);
            r1 = dropLast(r1, 3);
            r2 = dropLast(r2, 3);
          }
        } else {
          word = dropLast(word, suffix.length);
          r1 = dropLast(r1, suffix.length);
          r2 = dropLast(r2, suffix.length);
        }
      }
      break;
    }
  }

  // STEP 5
  if (r2.endsWith('l') && at(word, 2) === 'l') {
    word = dropLast(word, 1);
  } else if (r2.endsWith('e')) {
    word = dropLast(word, 1);
  } else if (r1.endsWith('e')) {
    if (
      word.length >= 4 &&
      (isVowel(at(word, 2)) || 'wxY'.includes(at(word, 2) as string) || !isVowel(at(word, 3)) || isVowel(at(word, 4)))
    ) {
      word = dropLast(word, 1);
    }
  }

  return word.split('Y').join('y');
}
