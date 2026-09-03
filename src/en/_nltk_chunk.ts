/**
 * Port of the subset of `nltk.chunk.regexp` (NLTK 3.10.3) that `_structure_features.py`
 * uses: `RegexpParser` grammars made only of chunk rules (`LABEL: {<tag pattern>}`), applied
 * as a cascade of stages over a tagged sentence. TS-native supporting module (CLAUDE.md §5).
 *
 * Mechanics, kept identical to NLTK: a sentence is encoded as a "chunk string" of
 * angle-bracketed tags (`<CD><NN><CC>`); each tag pattern becomes a regular expression over
 * that string (`<NN.*>` → `(<(NN[^\{\}<>]*)>)`), and a chunk rule wraps every non-overlapping
 * match that lies outside existing chunks in braces. A later stage sees earlier chunks as
 * single tokens tagged with the chunk label. Python `re` and JS `RegExp` agree on the
 * constructs involved (ordered alternation, greedy quantifiers, lookahead, named groups).
 */

import { pyStrip } from '../_py.js';

export type TaggedToken = readonly [text: string, tag: string];
export type TreeChild = TaggedToken | Tree;

export class Tree {
  constructor(
    public label: string,
    public children: TreeChild[],
  ) {}

  /** Leaves in order (tagged tokens), recursing into subtrees. */
  leaves(): TaggedToken[] {
    const out: TaggedToken[] = [];
    for (const child of this.children) {
      if (child instanceof Tree) out.push(...child.leaves());
      else out.push(child);
    }
    return out;
  }
}

const CHUNK_TAG_CHAR = '[^\\{\\}<>]';
const IN_STRIP_PATTERN = '(?=[^\\}]*(\\{|$))';
const CHUNK_TAG_PATTERN = /^((([^{}<>]|\{\d+,?\}|\{\d*,\d+\})|<[^{}<>]+>)*)$/;

/** Convert an NLTK tag pattern into a regular-expression source string. */
export function tag_pattern2re_pattern(tag_pattern: string): string {
  tag_pattern = tag_pattern.replace(/\s/g, '');
  tag_pattern = tag_pattern.replace(/</g, '(<(');
  tag_pattern = tag_pattern.replace(/>/g, ')>)');
  if (!CHUNK_TAG_PATTERN.test(tag_pattern)) {
    throw new Error(`Bad tag pattern: ${JSON.stringify(tag_pattern)}`);
  }
  // Replace every '.' that is not escaped (preceded by an even number of backslashes).
  let out = '';
  for (let i = 0; i < tag_pattern.length; i++) {
    const ch = tag_pattern[i] as string;
    if (ch === '.') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && tag_pattern[j] === '\\'; j--) backslashes += 1;
      out += backslashes % 2 === 0 ? CHUNK_TAG_CHAR : ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** `{<tag pattern>}`: chunk every match that is not already inside a chunk. */
export class ChunkRule {
  private readonly regexp: RegExp;

  constructor(
    readonly tag_pattern: string,
    readonly descr: string,
  ) {
    this.regexp = new RegExp(`(?<chunk>${tag_pattern2re_pattern(tag_pattern)})${IN_STRIP_PATTERN}`, 'g');
  }

  apply(chunkstr: ChunkString): void {
    chunkstr.xform(this.regexp, '{$<chunk>}');
  }

  static fromstring(s: string): ChunkRule {
    // Split off the comment (but don't split on '\#').
    const m = /^((?:\\.|[^#])*)(#.*)?/.exec(s) as RegExpExecArray;
    const rule = pyStrip(m[1] as string);
    const comment = pyStrip((m[2] ?? '').slice(1));
    if (rule === '') throw new Error('Empty chunk pattern');
    if (rule[0] === '{' && rule[rule.length - 1] === '}') {
      return new ChunkRule(rule.slice(1, -1), comment);
    }
    throw new Error(`Unsupported chunk rule (only {pattern} chunk rules are ported): ${rule}`);
  }
}

/** String encoding of one chunking of a tagged sentence. */
export class ChunkString {
  private readonly root_label: string;
  private readonly pieces: TreeChild[];
  private str: string;

  constructor(chunk_struct: Tree) {
    this.root_label = chunk_struct.label;
    this.pieces = chunk_struct.children.slice();
    const tags = this.pieces.map((tok) => (tok instanceof Tree ? tok.label : tok[1]));
    this.str = '<' + tags.join('><') + '>';
  }

  xform(regexp: RegExp, repl: string): void {
    let s = this.str.replace(regexp, repl);
    // Remove empty chunks "{}".
    s = s.replace(/\{\}/g, '');
    this.str = s;
  }

  to_chunkstruct(chunk_label = 'CHUNK'): Tree {
    const pieces: TreeChild[] = [];
    let index = 0;
    let piece_in_chunk = false;
    for (const piece of this.str.split(/[{}]/)) {
      const length = piece.split('<').length - 1;
      const subsequence = this.pieces.slice(index, index + length);
      if (piece_in_chunk) pieces.push(new Tree(chunk_label, subsequence));
      else pieces.push(...subsequence);
      index += length;
      piece_in_chunk = !piece_in_chunk;
    }
    return new Tree(this.root_label, pieces);
  }
}

/** One grammar stage: a list of rules producing chunks labelled `chunk_label`. */
export class RegexpChunkParser {
  constructor(
    readonly rules: readonly ChunkRule[],
    readonly chunk_label = 'NP',
    readonly root_label = 'S',
  ) {}

  parse(chunk_struct: Tree | TaggedToken[]): Tree {
    const tree = chunk_struct instanceof Tree ? chunk_struct : new Tree(this.root_label, chunk_struct.slice());
    if (tree.children.length === 0) return new Tree(this.root_label, []);
    const chunkstr = new ChunkString(tree);
    for (const rule of this.rules) rule.apply(chunkstr);
    return chunkstr.to_chunkstruct(this.chunk_label);
  }
}

/** A cascade of stages read from a grammar string (`LABEL: {pattern}` lines, `#` comments). */
export class RegexpParser {
  private readonly stages: RegexpChunkParser[] = [];

  constructor(
    grammar: string,
    private readonly root_label = 'S',
    private readonly loop = 1,
  ) {
    this._read_grammar(grammar, root_label);
  }

  private _read_grammar(grammar: string, root_label: string): void {
    let rules: ChunkRule[] = [];
    let lhs: string | null = null;
    const pattern = /^((?:\.|[^:])*)(:(.*))/;
    for (let line of grammar.split('\n')) {
      line = pyStrip(line);
      const m = pattern.exec(line);
      if (m) {
        this._add_stage(rules, lhs, root_label);
        lhs = pyStrip(m[1] as string);
        rules = [];
        line = pyStrip(m[3] as string);
      }
      if (line === '' || line.startsWith('#')) continue;
      rules.push(ChunkRule.fromstring(line));
    }
    this._add_stage(rules, lhs, root_label);
  }

  private _add_stage(rules: ChunkRule[], lhs: string | null, root_label: string): void {
    if (rules.length !== 0) {
      if (!lhs) throw new Error('Expected stage marker (eg NP:)');
      this.stages.push(new RegexpChunkParser(rules, lhs, root_label));
    }
  }

  parse(chunk_struct: Tree | TaggedToken[]): Tree {
    let tree: Tree | TaggedToken[] = chunk_struct;
    for (let i = 0; i < this.loop; i++) {
      for (const parser of this.stages) tree = parser.parse(tree);
    }
    return tree instanceof Tree ? tree : new Tree(this.root_label, tree.slice());
  }
}
