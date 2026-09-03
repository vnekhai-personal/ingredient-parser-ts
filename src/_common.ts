/**
 * Port of `ingredient_parser/_common.py` (pin ffd6ae3). Identifiers verbatim.
 * `UREG` (pint) lands with step 3; `download_nltk_resources` has no counterpart.
 */
import { PY_D, PY_EOS, PY_S, pyFloat } from './_py.js';

export const SUPPORTED_LANGUAGES: readonly string[] = ['en'];

/** Numeric range e.g. 1-2, 2-3, #1$2-1#3$4. */
export const RANGE_PATTERN = new RegExp(`^[${PY_D}#$]+${PY_S}*[\\-][${PY_D}#$]+${PY_EOS}`, 'u');

/** Advance `iterator` n steps ahead; if n is null, consume entirely. */
export function consume(iterator: Iterator<unknown>, n: number | null): void {
  if (n === null) {
    while (!iterator.next().done) {
      /* drain */
    }
  } else {
    for (let i = 0; i < n; i++) {
      if (iterator.next().done) break;
    }
  }
}

/**
 * Yield groups of consecutive indices, each group as an iterator (as upstream's
 * `map(itemgetter(1), g)`): `[[...g] for g in group_consecutive_idx([0,1,2,4,5])]` → `[[0,1,2],[4,5]]`.
 */
export function* group_consecutive_idx(idx: readonly number[]): Generator<IterableIterator<number>, void, undefined> {
  let i = 0;
  while (i < idx.length) {
    const start = i;
    const key = start - (idx[start] as number);
    let j = i + 1;
    while (j < idx.length && j - (idx[j] as number) === key) j += 1;
    yield idx.slice(start, j)[Symbol.iterator]();
    i = j;
  }
}

/** Open the model card in the default application — not available in the port. */
export function show_model_card(lang = 'en'): void {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    // Python: ValueError
    throw new Error(`Unsupported language "${lang}"`);
  }
  throw new Error('show_model_card() opens a file with the OS and is not available in the TypeScript port.');
}

/** True if `value` can be converted by Python's float(). */
export function is_float(value: string): boolean {
  return pyFloat(value) !== null;
}

/** True if `value` is a range e.g. 100-200. */
export function is_range(value: string): boolean {
  return RANGE_PATTERN.test(value);
}
