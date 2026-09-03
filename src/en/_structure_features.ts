/**
 * Port of `ingredient_parser/en/_structure_features.py` (pin ffd6ae3). Identifiers verbatim,
 * including upstream's class-name typo. Grammars are copied character for character; the
 * chunk parser is `_nltk_chunk.ts`.
 */
import type { Token } from '../dataclasses.js';
import { pyReprNested } from '../_py.js';
import { DIMENSIONS, FLATTENED_UNITS_LIST, LENGTH_UNITS, SIZES } from './_constants.js';
import { RegexpParser, Tree, type TaggedToken } from './_nltk_chunk.js';

// (token, pos) pairs identifying the start of example phrases.
export const EXAMPLE_PHRASE_START_IN: readonly TaggedToken[] = [
  ['AS', 'IN'],
  ['LIKE', 'IN'],
  ['E.G.', 'IN'],
];
export const EXAMPLE_PHRASE_START_JJ: readonly (readonly TaggedToken[])[] = [
  [
    ['SUCH', 'JJ'],
    ['AS', 'IN'],
  ],
];

function pairEq(a: TaggedToken | undefined, b: TaggedToken): boolean {
  return a !== undefined && a[0] === b[0] && a[1] === b[1];
}

export class SentenceStrucureFeatures {
  // RegexpParser to detect multi-ingredient phrases.
  static readonly mip_parser = new RegexpParser(
    `
        # Extended multi-ingredient phrase containing of 3 ingredients
        # w, x or y z
        EMIP: {<NN.*|JJ.*>+<,><NN.*|JJ.*>+<,>?<CC><DT|NN.*|JJ.*>*<NN.*>}
        # Multi-ingredient phrase containing of 2 ingredients
        # x or y z
        MIP: {<NN.*|JJ.*>+<CC><DT|NN.*|JJ.*>*<NN.*>}
        `,
  );

  // RegexpParser to detect the start of a new ingredient sentence in a compound sentence.
  static readonly compound_parser = new RegexpParser(`
        CS_WU: {<CC><RB>?<CD|DT>+<RB>?<UNIT|SIZE>+} # with unit: quantity with unit/size
        CS_NU: {<CC><CD|DT>+<NN.*|JJ.*>}  # no unit: quantity but no unit or size
        CS_HALF: {<CC><HALF>} # "or half the", "or half that" etc.
    `);

  // RegexpParser to detect phrases of examples of ingredients.
  static readonly example_parser = new RegexpParser(`
        NP: {(<NN.*|JJ.*>+<,>?)*<CC|DT>?<NN.*|JJ.*>*<NN.*>}
        EX: {<JJ.*>?<IN><NP>}
    `);

  // RegexpParser to detect dimensional phrases.
  static readonly dimensional_phrase_parser = new RegexpParser(`
        LENGTH: {<CD><LEN>}
        PLENGTH: {<\\(><LENGTH><\\)>}  # LENGTH in parentheses
        SLENGTH: {<SYM><LENGTH>}  # LENGTH following forward slash
        DP: {<LENGTH><SLENGTH|PLENGTH>?<IN>?<DIM>*}
    `);

  readonly tokenized_sentence: readonly Token[];
  readonly mip_phrases: number[][];
  readonly sentence_splits: number[];
  readonly example_phrases: number[][];
  readonly dimensional_phrases: number[][];

  constructor(tokenized_sentence: readonly Token[]) {
    this.tokenized_sentence = tokenized_sentence;
    this.mip_phrases = this.detect_mip_phrases(tokenized_sentence);
    this.sentence_splits = this.detect_sentences_splits(tokenized_sentence);
    this.example_phrases = this.detect_examples(tokenized_sentence);
    this.dimensional_phrases = this.detect_dimensional_phrases(tokenized_sentence);
  }

  repr(): string {
    return (
      'SentenceStrucureFeatures(' +
      `mip_phrases: ${pyReprNested(this.mip_phrases)}, ` +
      `sentence_splits: ${pyReprNested(this.sentence_splits)}, ` +
      `example_phrases: ${pyReprNested(this.example_phrases)}), ` +
      `dimensional_phrases: ${pyReprNested(this.dimensional_phrases)})`
    );
  }

  /** Leaf-index ranges of the direct subtrees of `parent_tree` whose label is in `labels`. */
  _get_subtree_indices(parent_tree: Tree, labels: readonly string[]): number[][] {
    const indices: number[][] = [];
    let leaf_idx = 0;
    for (const child of parent_tree.children) {
      if (child instanceof Tree) {
        const num_leaves = child.leaves().length;
        if (labels.includes(child.label)) {
          indices.push(Array.from({ length: num_leaves }, (_, k) => leaf_idx + k));
        }
        leaf_idx += num_leaves;
      } else {
        leaf_idx += 1;
      }
    }
    return indices;
  }

  /** True if the conjunction in the phrase is not "or". */
  _cc_is_not_or(text_pos: readonly TaggedToken[], indices: readonly number[]): boolean {
    const text = indices.map((i) => (text_pos[i] as TaggedToken)[0]);
    const pos = indices.map((i) => (text_pos[i] as TaggedToken)[1]);
    const cc_index = pos.indexOf('CC');
    if (cc_index === -1) return false;
    return (text[cc_index] as string).toLowerCase() !== 'or';
  }

  detect_mip_phrases(_tokenized_sentence: readonly Token[]): number[][] {
    const phrases: number[][] = [];
    const text_pos: TaggedToken[] = this.tokenized_sentence.map((token) => [token.text, token.pos_tag]);
    const parsed = SentenceStrucureFeatures.mip_parser.parse(text_pos);
    for (let indices of this._get_subtree_indices(parsed, ['EMIP', 'MIP'])) {
      if (this._cc_is_not_or(text_pos, indices)) continue;

      // Remove any units or sizes from the beginning of the phrase.
      let first_idx = indices[0] as number;
      const tokens_to_discard = [...FLATTENED_UNITS_LIST, ...SIZES];
      while (tokens_to_discard.includes((this.tokenized_sentence[first_idx] as Token).text.toLowerCase())) {
        indices = indices.slice(1);
        first_idx = indices[0] as number;
      }

      if (indices.length === 0) continue;

      if ((this.tokenized_sentence[indices[0] as number] as Token).pos_tag === 'CC' || indices.length === 0) continue;

      phrases.push(indices);
    }
    return phrases;
  }

  detect_sentences_splits(tokenized_sentence: readonly Token[]): number[] {
    const split_indices: number[] = [];
    const text_pos: TaggedToken[] = [];
    for (const t of tokenized_sentence) {
      let pos: string;
      if (FLATTENED_UNITS_LIST.has(t.text.toLowerCase())) pos = 'UNIT';
      else if (SIZES.includes(t.text.toLowerCase())) pos = 'SIZE';
      else if (t.text.toLowerCase() === 'half') pos = 'HALF';
      else pos = t.pos_tag;
      text_pos.push([t.feat_text, pos]);
    }
    const parsed = SentenceStrucureFeatures.compound_parser.parse(text_pos);
    for (const indices of this._get_subtree_indices(parsed, ['CS_WU', 'CS_NU', 'CS_HALF'])) {
      if (this._cc_is_not_or(text_pos, indices)) continue;
      split_indices.push(indices[0] as number);
    }
    return split_indices;
  }

  detect_examples(_tokenized_sentence: readonly Token[]): number[][] {
    const examples: number[][] = [];
    const text_pos: TaggedToken[] = this.tokenized_sentence.map((token) => [token.text, token.pos_tag]);
    const parsed = SentenceStrucureFeatures.example_parser.parse(text_pos);
    for (const indices of this._get_subtree_indices(parsed, ['EX'])) {
      const phrase_text_pos: TaggedToken[] = [];
      this.tokenized_sentence.forEach((token, i) => {
        if (indices.includes(i)) phrase_text_pos.push([token.text.toUpperCase(), token.pos_tag]);
      });

      const first2 = phrase_text_pos.slice(0, 2);
      if (
        EXAMPLE_PHRASE_START_JJ.some(
          (start) => start.length === first2.length && start.every((p, k) => pairEq(first2[k], p)),
        )
      ) {
        examples.push(indices);
        continue;
      } else if (EXAMPLE_PHRASE_START_IN.some((p) => pairEq(phrase_text_pos[0], p))) {
        examples.push(indices);
        continue;
      } else if (
        (phrase_text_pos[0] as TaggedToken)[1] === 'JJ' &&
        EXAMPLE_PHRASE_START_IN.some((p) => pairEq(phrase_text_pos[1], p))
      ) {
        examples.push(indices.slice(1));
        continue;
      }
    }
    return examples;
  }

  detect_dimensional_phrases(tokenized_sentence: readonly Token[]): number[][] {
    const text_pos: TaggedToken[] = [];
    for (const t of tokenized_sentence) {
      let pos: string;
      if (LENGTH_UNITS.has(t.text.toLowerCase()) && t.pos_tag !== 'IN') pos = 'LEN';
      else if (DIMENSIONS.has(t.text.toLowerCase())) pos = 'DIM';
      else pos = t.pos_tag;
      text_pos.push([t.feat_text, pos]);
    }
    const parsed = SentenceStrucureFeatures.dimensional_phrase_parser.parse(text_pos);
    return this._get_subtree_indices(parsed, ['DP']);
  }

  /** Structure features for the token at `index`, keys prefixed with `prefix`. */
  token_features(index: number, prefix: string): Record<string, boolean> {
    const features: Record<string, boolean> = {
      [prefix + 'mip_start']: false,
      [prefix + 'mip_end']: false,
      [prefix + 'after_sentence_split']: false,
      [prefix + 'example_phrase']: false,
    };
    for (const phrase of this.mip_phrases) {
      if (!phrase.includes(index)) continue;
      if (index === phrase[0]) features[prefix + 'mip_start'] = true;
      if (index === phrase[phrase.length - 1]) features[prefix + 'mip_end'] = true;
    }
    for (const split_index of this.sentence_splits) {
      if (index >= split_index) features[prefix + 'after_sentence_split'] = true;
    }
    for (const phrase of this.example_phrases) {
      if (phrase.includes(index)) features[prefix + 'example_phrase'] = true;
    }
    for (const phrase of this.dimensional_phrases) {
      if (phrase.includes(index)) features[prefix + 'dimensional_phrase'] = true;
    }
    return features;
  }
}
