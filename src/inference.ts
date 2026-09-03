/**
 * Port of `ingredient_parser/inference.py` (upstream pin ffd6ae3c6efb9925c40fc9b4454d77b40469ef91).
 *
 * Identifiers are upstream's, verbatim (snake_case included): NumpyCRFInference, NumpyViterbiInference,
 * tag_from_features, predict_sequence… so the two codebases read side by side.
 *
 * Parity notes (verified by the level-1 differential harness, tests/harness/decoder.test.ts):
 * - Weights are 16-bit quantized integers; Viterbi runs on exact integer sums, so labels are
 *   bit-identical by construction. Ties resolve to the lowest label index (numpy argmax).
 * - Marginals reproduce upstream's numeric path exactly: dequantization happens in float32
 *   (numpy `astype(float32)` then a weak-scalar divide), the forward/backward recursions run in
 *   float64 with numpy's `logaddexp` formula folded left-to-right, and in the backward pass the
 *   `transitions + next_emissions` sum is a float32 add before the float64 beta is added.
 * - The only platform seam left is libm: `Math.exp`/`Math.log1p` may differ from macOS libm by
 *   an ulp. The harness measures this; see docs/PORTING.md §4.
 * - Upstream gates the I_NAME_TOK constraint on `if constrain_transitions and b_name_idx:` —
 *   Python truthiness of the index. Mirrored literally (`bNameIdx` of 0 disables it too).
 * - Only quantized integer weights are supported. Upstream's float32 path sums emission rows in
 *   Python `set` iteration order, which is hash-randomized per process, so it is not
 *   reproducible even in Python; refusing it is the honest port.
 */

/** Dict of token features, as produced by the PreProcessor. */
export type FeatureDict = Record<string, string | boolean>;

/** Shape of the exported model JSON (`train/export.py` `CRFModelParameters`). */
export interface CRFModelJson {
  attributes: Record<string, number>;
  labels: Record<string, number>;
  state_features: Record<string, number>;
  transitions: Record<string, number>;
  quantization_scale: number;
  quantization_zero_offset: number;
}

export type LabelScore = readonly [label: string, score: number];

/** numpy's `logaddexp`: log(exp(x) + exp(y)) with the exact branch structure of npy_logaddexp. */
export function logaddexp(x: number, y: number): number {
  if (x === y) {
    // Handles infinities of the same sign without warnings (and -inf + LN2 === -inf).
    return x + Math.LN2;
  }
  const tmp = x - y;
  if (tmp > 0) {
    return x + Math.log1p(Math.exp(-tmp));
  } else if (tmp <= 0) {
    return y + Math.log1p(Math.exp(tmp));
  }
  // NaN
  return tmp;
}

export class NumpyCRFInference {
  readonly model: NumpyViterbiInference;
  readonly combined_name_labels: boolean;

  constructor(modelData: CRFModelJson, combined_name_labels = false) {
    this.model = new NumpyViterbiInference(
      modelData.attributes,
      modelData.labels,
      modelData.state_features,
      modelData.transitions,
      modelData.quantization_scale,
      modelData.quantization_zero_offset,
    );
    this.combined_name_labels = combined_name_labels;
  }

  /**
   * Tag a sentence given its per-token feature dicts.
   * If `combined_name_labels` is set, transition constraints are not applied (they only apply to
   * I_NAME_TOK).
   */
  tag_from_features(sentenceFeatures: readonly FeatureDict[]): LabelScore[] {
    if (this.model.emission_weights.length === 0 || this.model.transition_weights.length === 0) {
      throw new Error('NumpyViterbiInference model does not have any weights.');
    }
    const features = sentenceFeatures.map((f) => this._convert_features(f));
    return this.model.predict_sequence(features, !this.combined_name_labels);
  }

  /**
   * Feature dict → set of feature strings, the keys the weights are indexed by.
   * Strings become `key:value`; booleans become `key` when true and are dropped when false.
   */
  _convert_features(features: FeatureDict): Set<string> {
    const out = new Set<string>();
    for (const key of Object.keys(features)) {
      const value = features[key];
      if (value === false) continue;
      out.add(typeof value === 'boolean' ? key : `${key}:${value}`);
    }
    return out;
  }

  /** Marginal probability of `label` at `position` for the most recent `predict_sequence` call. */
  marginal(label: string, position: number): number {
    const m = this.model.marginals;
    if (m.length === 0) {
      throw new Error('Cannot return marginals until predict_sequence() has been called.');
    }
    const labelIdx = this.model.label_to_idx.get(label);
    if (labelIdx === undefined) throw new Error(`Unknown label: ${label}`);
    const v = m[position * this.model.n_labels + labelIdx];
    if (v === undefined) throw new Error(`Position out of range: ${position}`);
    return v;
  }
}

export class NumpyViterbiInference {
  readonly label_to_idx: Map<string, number>;
  readonly idx_to_label: string[];
  readonly n_labels: number;
  readonly features_to_idx: Map<string, number>;
  readonly n_features: number;
  readonly scale_factor: number;
  readonly zero_offset: number;
  /** (n_features × n_labels) row-major, quantized integers. */
  readonly emission_weights: Int32Array;
  /** (n_labels × n_labels) row-major [prev][current], quantized integers. */
  readonly transition_weights: Int32Array;
  /** Dequantized transitions (float32 values held in a float64 array). */
  readonly dq_transition_weights: Float64Array;
  /** (seqLen × n_labels) marginals from the last `predict_sequence`; empty before the first call. */
  marginals: Float64Array = new Float64Array(0);

  constructor(
    features: Record<string, number>,
    labels: Record<string, number>,
    featureWeights: Record<string, number>,
    transition_weights: Record<string, number>,
    scale_factor: number,
    zero_offset: number,
  ) {
    this.label_to_idx = new Map(Object.entries(labels));
    this.n_labels = this.label_to_idx.size;
    this.idx_to_label = new Array<string>(this.n_labels);
    for (const [label, idx] of this.label_to_idx) this.idx_to_label[idx] = label;
    this.features_to_idx = new Map(Object.entries(features));
    this.n_features = this.features_to_idx.size;
    this.scale_factor = scale_factor;
    this.zero_offset = zero_offset;

    this.emission_weights = new Int32Array(this.n_features * this.n_labels);
    for (const [feat, weight] of Object.entries(featureWeights)) {
      if (!Number.isInteger(weight)) {
        throw new Error('Only quantized integer weights are supported (see inference.ts header).');
      }
      const sep = feat.lastIndexOf('|');
      const featureIdx = this.features_to_idx.get(feat.slice(0, sep));
      const labelIdx = this.label_to_idx.get(feat.slice(sep + 1));
      if (featureIdx === undefined || labelIdx === undefined) {
        throw new Error(`state_features key not in attributes/labels: ${feat}`);
      }
      this.emission_weights[featureIdx * this.n_labels + labelIdx] = weight;
    }

    this.transition_weights = new Int32Array(this.n_labels * this.n_labels);
    for (const [feat, weight] of Object.entries(transition_weights)) {
      if (!Number.isInteger(weight)) {
        throw new Error('Only quantized integer weights are supported (see inference.ts header).');
      }
      const sep = feat.lastIndexOf('|');
      const prevIdx = this.label_to_idx.get(feat.slice(0, sep));
      const curIdx = this.label_to_idx.get(feat.slice(sep + 1));
      if (prevIdx === undefined || curIdx === undefined) {
        throw new Error(`transitions key not in labels: ${feat}`);
      }
      this.transition_weights[prevIdx * this.n_labels + curIdx] = weight;
    }

    this.dq_transition_weights = new Float64Array(this.n_labels * this.n_labels);
    for (let i = 0; i < this.dq_transition_weights.length; i++) {
      this.dq_transition_weights[i] = this._dequantize_affine(this.transition_weights[i] as number);
    }
  }

  /**
   * `(w.astype(float32) - zero_offset) / scale_factor` with numpy's float32 semantics:
   * the Python scalars are weak, so every intermediate is rounded to float32.
   */
  _dequantize_affine(w: number): number {
    return Math.fround(Math.fround(Math.fround(w) - Math.fround(this.zero_offset)) / Math.fround(this.scale_factor));
  }

  /** Predict the label sequence with Viterbi; returns (label, confidence) per token. */
  predict_sequence(featuresSeq: readonly Set<string>[], constrainTransitions = true): LabelScore[] {
    const seqLen = featuresSeq.length;
    const L = this.n_labels;
    if (seqLen === 0) throw new Error('Cannot predict an empty sequence.');

    // State scores: exact integer sums of the selected emission rows.
    const stateScores = new Float64Array(seqLen * L);
    for (let t = 0; t < seqLen; t++) {
      for (const feat of featuresSeq[t] as Set<string>) {
        const fi = this.features_to_idx.get(feat);
        if (fi === undefined) continue;
        const base = fi * L;
        for (let j = 0; j < L; j++) {
          stateScores[t * L + j] = (stateScores[t * L + j] as number) + (this.emission_weights[base + j] as number);
        }
      }
    }

    const bNameIdx = this.label_to_idx.get('B_NAME_TOK');
    const iNameIdx = this.label_to_idx.get('I_NAME_TOK');
    const nameSepIdx = this.label_to_idx.get('NAME_SEP');
    // Whether B_NAME_TOK has occurred on the best path ending in each label, since the start
    // or the last NAME_SEP.
    const hasBName = new Uint8Array(seqLen * L);

    const lattice = new Float64Array(seqLen * L).fill(-Infinity);
    const backpointers = new Int32Array(seqLen * L);

    for (let j = 0; j < L; j++) lattice[j] = stateScores[j] as number;

    if (constrainTransitions) {
      if (iNameIdx === undefined || bNameIdx === undefined || nameSepIdx === undefined) {
        throw new Error('Transition constraints need B_NAME_TOK, I_NAME_TOK and NAME_SEP labels.');
      }
      lattice[iNameIdx] = -Infinity;
      hasBName[bNameIdx] = 1;
    }
    // Upstream: `if constrain_transitions and b_name_idx:` — Python truthiness of the index.
    const applyConstraint = constrainTransitions && Boolean(bNameIdx);

    for (let t = 1; t < seqLen; t++) {
      const prevRow = (t - 1) * L;
      const row = t * L;
      for (let j = 0; j < L; j++) {
        const emission = stateScores[row + j] as number;
        let best = -Infinity;
        let bestPrev = 0;
        for (let i = 0; i < L; i++) {
          let cand = (lattice[prevRow + i] as number) + (this.transition_weights[i * L + j] as number) + emission;
          if (applyConstraint && j === iNameIdx && hasBName[prevRow + i] === 0) {
            cand = -Infinity;
          }
          if (cand > best) {
            best = cand;
            bestPrev = i;
          }
        }
        lattice[row + j] = best;
        backpointers[row + j] = bestPrev;
      }
      if (applyConstraint) {
        for (let j = 0; j < L; j++) {
          hasBName[row + j] = hasBName[prevRow + (backpointers[row + j] as number)] as number;
        }
        hasBName[row + (bNameIdx as number)] = 1;
        hasBName[row + (nameSepIdx as number)] = 0;
      }
    }

    // Backtrack.
    const labelIndices = new Array<number>(seqLen).fill(0);
    {
      const row = (seqLen - 1) * L;
      let best = -Infinity;
      let bestIdx = 0;
      for (let j = 0; j < L; j++) {
        const v = lattice[row + j] as number;
        if (v > best) {
          best = v;
          bestIdx = j;
        }
      }
      labelIndices[seqLen - 1] = bestIdx;
    }
    for (let t = seqLen - 2; t >= 0; t--) {
      labelIndices[t] = backpointers[(t + 1) * L + (labelIndices[t + 1] as number)] as number;
    }

    this.marginals = this._compute_marginals(seqLen, stateScores);
    const out: LabelScore[] = new Array(seqLen);
    for (let t = 0; t < seqLen; t++) {
      const idx = labelIndices[t] as number;
      out[t] = [this.idx_to_label[idx] as string, this.marginals[t * L + idx] as number];
    }
    return out;
  }

  /** Forward–backward marginals in log space; mirrors `_compute_marginals` numerically. */
  _compute_marginals(seqLen: number, rawStateScores: Float64Array): Float64Array {
    const L = this.n_labels;
    const T = this.dq_transition_weights;
    const state = new Float64Array(seqLen * L);
    for (let i = 0; i < state.length; i++) state[i] = this._dequantize_affine(rawStateScores[i] as number);

    const logAlpha = new Float64Array(seqLen * L).fill(-Infinity);
    const logBeta = new Float64Array(seqLen * L).fill(-Infinity);

    // Forward: alpha[t][j] = logsumexp_i(alpha[t-1][i] + T[i][j]) + state[t][j]   (float64)
    for (let j = 0; j < L; j++) logAlpha[j] = state[j] as number;
    for (let t = 1; t < seqLen; t++) {
      const prevRow = (t - 1) * L;
      for (let j = 0; j < L; j++) {
        let acc = (logAlpha[prevRow] as number) + (T[j] as number);
        for (let i = 1; i < L; i++) {
          acc = logaddexp(acc, (logAlpha[prevRow + i] as number) + (T[i * L + j] as number));
        }
        logAlpha[t * L + j] = acc + (state[t * L + j] as number);
      }
    }

    // Backward: beta[t][i] = logsumexp_j(fround(T[i][j] + state[t+1][j]) + beta[t+1][j])
    // The inner add is float32 + float32 in numpy before the float64 beta joins.
    const lastRow = (seqLen - 1) * L;
    for (let j = 0; j < L; j++) logBeta[lastRow + j] = 0;
    for (let t = seqLen - 2; t >= 0; t--) {
      const nextRow = (t + 1) * L;
      for (let i = 0; i < L; i++) {
        let acc = Math.fround((T[i * L] as number) + (state[nextRow] as number)) + (logBeta[nextRow] as number);
        for (let j = 1; j < L; j++) {
          const term = Math.fround((T[i * L + j] as number) + (state[nextRow + j] as number)) + (logBeta[nextRow + j] as number);
          acc = logaddexp(acc, term);
        }
        logBeta[t * L + i] = acc;
      }
    }

    let logZ = logAlpha[lastRow] as number;
    for (let j = 1; j < L; j++) logZ = logaddexp(logZ, logAlpha[lastRow + j] as number);

    const marginals = new Float64Array(seqLen * L);
    for (let i = 0; i < marginals.length; i++) {
      marginals[i] = Math.exp((logAlpha[i] as number) + (logBeta[i] as number) - logZ);
    }
    return marginals;
  }
}
