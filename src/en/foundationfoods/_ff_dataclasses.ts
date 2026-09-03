/**
 * Port of `ingredient_parser/en/foundationfoods/_ff_dataclasses.py` (pin ffd6ae3). Identifiers
 * verbatim; each class is constructed with ONE object of its fields (tests/upstream/README.md).
 */

export interface IngredientTokenInit {
  token: string;
  pos_tag: string;
}

/** NamedTuple `(token, pos_tag)` — immutable record. */
export class IngredientToken {
  readonly token: string;
  readonly pos_tag: string;

  constructor(t: IngredientTokenInit) {
    this.token = t.token;
    this.pos_tag = t.pos_tag;
  }
}

export interface FDCIngredientInit {
  fdc_id: number;
  data_type: string;
  description: string;
  category: string;
  tokens: string[];
  pos_tags: string[];
  embedding_tokens: string[];
  embedding_pos_tags: string[];
  embedding_weights: number[];
}

/** Dataclass for details of an ingredient from the FoodDataCentral database. */
export class FDCIngredient {
  fdc_id: number;
  data_type: string;
  description: string;
  category: string;
  tokens: string[];
  pos_tags: string[];
  embedding_tokens: string[];
  embedding_pos_tags: string[];
  embedding_weights: number[];

  constructor(f: FDCIngredientInit) {
    this.fdc_id = f.fdc_id;
    this.data_type = f.data_type;
    this.description = f.description;
    this.category = f.category;
    this.tokens = f.tokens;
    this.pos_tags = f.pos_tags;
    this.embedding_tokens = f.embedding_tokens;
    this.embedding_pos_tags = f.embedding_pos_tags;
    this.embedding_weights = f.embedding_weights;
  }

  /** `__eq__` / `__hash__`: identity is the fdc_id. */
  equals(other: unknown): boolean {
    return other instanceof FDCIngredient && this.fdc_id === other.fdc_id;
  }
}

export interface FDCIngredientMatchInit {
  fdc: FDCIngredient;
  score: number;
}

/** Dataclass for details of a matching FDC ingredient. */
export class FDCIngredientMatch {
  fdc: FDCIngredient;
  score: number;

  constructor(m: FDCIngredientMatchInit) {
    this.fdc = m.fdc;
    this.score = m.score;
  }

  /** `__eq__` / `__hash__`: equal when the score and the fdc_id are equal. */
  equals(other: unknown): boolean {
    return (
      other instanceof FDCIngredientMatch && this.score === other.score && this.fdc.fdc_id === other.fdc.fdc_id
    );
  }
}
