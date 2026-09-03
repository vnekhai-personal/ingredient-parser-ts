/**
 * Port of `ingredient_parser/en/foundationfoods/_foundationfoods.py` (pin ffd6ae3).
 *
 * Python-semantics notes (all observable in the output, all mirrored):
 * - Sets of FDC ids / FDC objects (`candidate_fdc_ids`, `fdc_entries`) iterate in CPython's
 *   int-hash table order (`PySet`); FDCIngredient hashes by `fdc_id`, and a set keeps the
 *   FIRST object inserted for a key.
 * - `sorted(..., reverse=True)` is stable and keeps the original order among equal keys: a
 *   stable sort with "higher score first, then higher DATASET_PREFERENCE index first".
 * - `np.std` / `np.mean` over score lists use numpy's pairwise float64 sums (`npStd`/`npMean`).
 * - `float(round(x / 3, 6))` is Python's exact-binary round-half-even (`pyRound`).
 * - `p ** depth` is C `pow()` upstream; `Math.pow` here (V8 fdlibm) — libm seam, only reaches
 *   the output through the `< BM25_USIF_AGREENMENT_THRESHOLD` comparison.
 * - The override table's `FoundationFood` objects are shared and mutated
 *   (`match.name_index = name_idx`) exactly as upstream does.
 */
import { npMean, npStd } from '../../_np.js';
import { pyFloatRepr } from '../../_py.js';
import { npRound } from '../../_np.js';
import { PySet } from '../../_pyset.js';
import { FoundationFood } from '../../dataclasses.js';
import { load_embeddings_model } from '../_embeddings.js';
import { get_bm25_ranker } from './_bm25.js';
import {
  FOUNDATION_FOOD_OVERRIDES,
  NON_RAW_FOOD_NOUN_STEMS,
  NON_RAW_FOOD_VERB_STEMS,
  override_key,
} from './_ff_constants.js';
import { FDCIngredientMatch, IngredientToken, type FDCIngredient } from './_ff_dataclasses.js';
import { normalise_spelling, prepare_tokens, strip_ambiguous_leading_adjectives } from './_ff_utils.js';
import { get_fuzzy_ranker } from './_fuzzy.js';
import { get_usif_ranker } from './_usif.js';

// Constant defining the top k matches to use wherever we limit the matches considered.
export const TOP_K = 50;

// Constant defining the minimum agreement between BM25 and uSIF rankings
export const BM25_USIF_AGREENMENT_THRESHOLD = 0.25;

// Constant defining the minimum percetage difference between top ranked results to
// be confident in the top ranked result.
export const TOP_PC_DIFF_THRESHOLD = 0.01;

// Constant defining the maximum reasonable semantic score.
export const SEMANTIC_SCORE_THRESHOLD = 0.275;

// List of FDC data preferences, least preferred to most preferred.
export const DATASET_PREFERENCE: string[] = ['survey_fndds_food', 'sr_legacy_food', 'foundation_food'];

export interface MatchQualityInit {
  quality: 'good' | 'poor';
  reason: string;
}

/** Class for storing information about the quality of the match. */
export class MatchQuality {
  quality: 'good' | 'poor';
  reason: string;

  constructor(f: MatchQualityInit) {
    this.quality = f.quality;
    this.reason = f.reason;
  }
}

/** Match ingredient name to foundation foods from FDC ingredient (prepare → uSIF/BM25 down-select → fuzzy arbitration). */
export function match_foundation_foods(
  tokens: readonly string[],
  pos_tags: readonly string[],
  name_idx: number,
): FoundationFood | null {
  // zip() truncates to the shortest input.
  const n = Math.min(tokens.length, pos_tags.length);
  let name_tokens: IngredientToken[] = [];
  for (let i = 0; i < n; i++) {
    name_tokens.push(new IngredientToken({ token: tokens[i] as string, pos_tag: pos_tags[i] as string }));
  }

  name_tokens = strip_ambiguous_leading_adjectives(name_tokens);
  const prepared_tokens = prepare_tokens(name_tokens);
  if (prepared_tokens.length === 0) {
    return null;
  }

  const normalised_tokens = normalise_spelling(prepared_tokens);

  const override = FOUNDATION_FOOD_OVERRIDES.get(override_key(normalised_tokens.map((t) => t.token)));
  if (override !== undefined) {
    const match = override;
    match.name_index = name_idx;
    return match;
  }

  // Determine if there any of the normalised tokens are in the embeddings model.
  // If not, we will skip the semantic (embeddings based) rankers.
  const embeddings = load_embeddings_model();
  const normalised_embeddings_tokens = normalised_tokens.filter((t) => embeddings.has(t.token));
  const has_token_in_embeddings = normalised_embeddings_tokens.length > 0;

  // Bias the results towards selecting the raw version of a FDC ingredient, but
  // only if the ingredient name tokens don't already include a verb or noun that
  // indicates the food is not raw (e.g. cooked)
  if (
    !normalised_tokens.some((t) => NON_RAW_FOOD_VERB_STEMS.has(t.token)) &&
    !normalised_tokens.some((t) => NON_RAW_FOOD_NOUN_STEMS.has(t.token))
  ) {
    normalised_tokens.push(new IngredientToken({ token: 'raw', pos_tag: 'JJ' }));
    normalised_embeddings_tokens.push(new IngredientToken({ token: 'raw', pos_tag: 'JJ' }));
  }

  const bm25 = get_bm25_ranker();
  const bm25_matches = bm25.rank_matches(normalised_tokens);

  if (!has_token_in_embeddings) {
    if (bm25_matches.length === 0) {
      return null;
    }

    // No other possible matching techniques, so just pick the best from BM25.
    const best_match = bm25_matches[0] as FDCIngredientMatch;
    return new FoundationFood({
      text: best_match.fdc.description,
      confidence: 1.0,
      fdc_id: best_match.fdc.fdc_id,
      category: best_match.fdc.category,
      data_type: best_match.fdc.data_type,
      name_index: name_idx,
    });
  }

  const u = get_usif_ranker();
  const usif_matches = u.rank_matches(normalised_embeddings_tokens);

  // Check if both BM25 and uSIF agree on the top result. If they do, return that and
  // avoid any further processing.
  const fdc = consistent_top_result(bm25_matches, usif_matches);
  if (fdc) {
    return new FoundationFood({
      text: fdc.description,
      confidence: 1.0,
      fdc_id: fdc.fdc_id,
      category: fdc.category,
      data_type: fdc.data_type,
      name_index: name_idx,
    });
  }

  let fuzzy_matches: FDCIngredientMatch[] = [];
  const bm25_usif_agreement = estimate_bm25_usif_agreement(bm25_matches, usif_matches);
  if (has_token_in_embeddings && bm25_usif_agreement < BM25_USIF_AGREENMENT_THRESHOLD) {
    // Get all FDC IDs for BM25 and uSIF matches
    // We'll only use the fuzzy ranker on these, instead of the whole FDC set.
    const candidate_fdc_ids = new PySet(usif_matches.slice(0, TOP_K).map((m) => m.fdc.fdc_id)).union(
      new PySet(bm25_matches.slice(0, TOP_K).map((m) => m.fdc.fdc_id)),
    );

    const fuzzy = get_fuzzy_ranker();
    fuzzy_matches = fuzzy.rank_matches(normalised_embeddings_tokens, candidate_fdc_ids);
  }

  const fused_matches = fuse_results(bm25_matches, fuzzy_matches, usif_matches, { top_n: TOP_K });
  const best_match = fused_matches[0];
  const second_match = fused_matches[1];
  if (best_match === undefined || second_match === undefined) {
    throw new Error('list index out of range'); // Python: IndexError
  }

  // If the there is less than 1% difference in score between the best two fused
  // matches, then assume we can't identify a suitable match.
  // Only do this if the best fused score is less than 0.95 so we don't discard good
  // matches.
  // However, if there is a 0% difference in score (i.e. same score), then we just
  // select the first because fused_matches are already sorted in order of preferred
  // dataset.
  const top_pc_diff = percent_difference(best_match.score, second_match.score);
  if (best_match.score < 0.95 && 0 < top_pc_diff && top_pc_diff <= TOP_PC_DIFF_THRESHOLD) {
    return null;
  }

  if (top_pc_diff === 0) {
    // Check how many results have the same top score. If it's more than 3 (i.e. more
    // than one from each data set) then we have no idea, so return None.
    let matches_with_top_score = 0;
    for (const m of fused_matches) if (m.score === best_match.score) matches_with_top_score += 1;
    if (matches_with_top_score > DATASET_PREFERENCE.length) {
      return null;
    }
  }

  const match_quality = determine_match_quality(best_match, usif_matches, fuzzy_matches);
  if (match_quality.quality === 'poor') {
    return null;
  }

  return new FoundationFood({
    text: best_match.fdc.description,
    confidence: best_match.score, // Note: already rounded by fuse_results
    fdc_id: best_match.fdc.fdc_id,
    category: best_match.fdc.category,
    data_type: best_match.fdc.data_type,
    name_index: name_idx,
  });
}

/** If the BM25 and uSIF matches have a single consistent best match, return it. Otherwise return null. */
export function consistent_top_result(
  bm25_matches: readonly FDCIngredientMatch[],
  usif_matches: readonly FDCIngredientMatch[],
): FDCIngredient | null {
  if (bm25_matches.length === 0 || usif_matches.length === 0) {
    return null;
  }

  // set() of FDCIngredient (hashed by fdc_id): only its size and single element matter.
  const best_matches = new Map<number, FDCIngredient>();
  const add = (fdc: FDCIngredient): void => {
    if (!best_matches.has(fdc.fdc_id)) best_matches.set(fdc.fdc_id, fdc);
  };

  // Because bm25_matches and usif_matches are ordered, we want to stop iterating over
  // them as soon as we encounter a score that is different from the best score.
  add((bm25_matches[0] as FDCIngredientMatch).fdc);
  let best_score = (bm25_matches[0] as FDCIngredientMatch).score;
  for (const m of bm25_matches.slice(1)) {
    if (m.score === best_score) {
      add(m.fdc);
    } else {
      break;
    }
  }

  add((usif_matches[0] as FDCIngredientMatch).fdc);
  best_score = (usif_matches[0] as FDCIngredientMatch).score;
  for (const m of usif_matches.slice(1)) {
    if (m.score === best_score) {
      add(m.fdc);
    } else {
      break;
    }
  }

  if (best_matches.size === 1) {
    // If there is exactly one FDC Ingredient in the intersection, return it.
    return best_matches.values().next().value as FDCIngredient;
  }

  // If there are no items in the intersection, or more than one, return None.
  return null;
}

/** Calculate the percentage difference between two scores, [0 1]. */
export function percent_difference(score1: number, score2: number): number {
  if (score1 === score2) {
    return 0;
  }

  const max_score = Math.max(score1, score2);
  const min_score = Math.min(score1, score2);
  const delta = max_score - min_score;
  return delta / max_score;
}

/** Calculate the agreement between the BM25 and uSIF matches (Rank Biased Overlap [1]). */
export function estimate_bm25_usif_agreement(
  bm25_matches: readonly FDCIngredientMatch[],
  usif_matches: readonly FDCIngredientMatch[],
  options: { p?: number } = {},
): number {
  const p = options.p ?? 0.95;
  if (p < 0 || p > 1) {
    throw new Error(`p should be between 0 and 1. Provided value is ${pyFloatRepr(p)}.`); // Python: ValueError
  }

  const bm25_ids = bm25_matches.slice(0, TOP_K).map((m) => m.fdc.fdc_id);
  const usif_ids = usif_matches.slice(0, TOP_K).map((m) => m.fdc.fdc_id);

  // Only the overlap COUNT is used, so plain Sets suffice.
  const bm25_set = new Set<number>();
  const usif_set = new Set<number>();
  let rbo_sum = 0;
  for (let depth = 1; depth <= bm25_ids.length; depth++) {
    const usif_id = usif_ids[depth - 1];
    if (usif_id === undefined) throw new Error('list index out of range'); // Python: IndexError
    bm25_set.add(bm25_ids[depth - 1] as number);
    usif_set.add(usif_id);

    // Calculate overlap at current depth.
    let overlap = 0;
    for (const id of bm25_set) if (usif_set.has(id)) overlap += 1;

    const agreement = overlap / depth;
    // Python `p ** depth` is C pow(); Math.pow is V8's fdlibm pow (libm seam, see header).
    rbo_sum += agreement * Math.pow(p, depth);
  }

  // This provides the base RBO for the common length
  return (1 - p) * rbo_sum;
}

/** Calculate confidence of a ranker function from the spread of scores. */
export function estimate_ranker_confidence(scores: readonly number[]): number {
  if (scores.length < 2) {
    return 0;
  }

  // sorted(scores, reverse=True): stable; equal values are interchangeable numerically.
  const sorted_scores = scores.slice().sort((x, y) => y - x);
  const max_score = sorted_scores[0] as number;
  let second_max = 0;
  for (const score of sorted_scores) {
    if (score !== max_score) {
      second_max = score;
      break;
    }
  }

  const gap = max_score - second_max;
  if (max_score === 0) throw new Error('float division by zero'); // Python: ZeroDivisionError
  const relative_gap = gap / max_score;

  let distribution_factor: number;
  if (scores.length > 2) {
    // Calculate coefficient of variation for scores below top
    const remaining_scores = sorted_scores.slice(1);
    const remaining_std = npStd(remaining_scores);
    const remaining_mean = npMean(remaining_scores);
    if (remaining_mean > 0) {
      const cv = remaining_std / remaining_mean;
      // Lower CV = more concentrated = clearer winner
      distribution_factor = 1.0 / (1.0 + cv);
    } else {
      distribution_factor = 1.0;
    }
  } else {
    distribution_factor = 1.0;
  }

  // Combine gap and distribution (weighted average)
  const confidence = 0.7 * relative_gap + 0.3 * distribution_factor;
  return confidence;
}

/** Normalize list of scores. */
export function normalize_scores(scores: readonly number[]): number[] {
  if (scores.length === 0) {
    return [];
  }

  const first = scores[0] as number;

  // Handle case where all scores are identical
  if (scores.every((s) => s === first)) {
    return new Array<number>(scores.length).fill(0.5);
  }

  // Calculate normalization interval.
  let min_ = first;
  let max_ = first;
  for (const s of scores) {
    if (s < min_) min_ = s;
    if (s > max_) max_ = s;
  }
  // Ensure that the range is never 0
  const range_val = Math.max(max_ - min_, 1e-9);

  const normalized: number[] = [];
  for (const score of scores) {
    let norm_score = (score - min_) / range_val;
    // Clip to [0, 1] to handle cases where range_val is really small.
    norm_score = Math.max(0.0, Math.min(1.0, norm_score));
    normalized.push(norm_score);
  }

  return normalized;
}

/** `DATASET_PREFERENCE.index(data_type)`. */
function dataset_preference_index(data_type: string): number {
  const idx = DATASET_PREFERENCE.indexOf(data_type);
  if (idx === -1) throw new Error(`${data_type} is not in list`); // Python: ValueError
  return idx;
}

/** Distribution-based score fusion of BM25, Fuzzy and uSIF match results, ordered best to worst. */
export function fuse_results(
  bm25_matches: readonly FDCIngredientMatch[],
  fuzzy_matches: readonly FDCIngredientMatch[],
  usif_matches: readonly FDCIngredientMatch[],
  options: { top_n?: number } = {},
): FDCIngredientMatch[] {
  const top_n = options.top_n ?? 100;

  // Limit to best `top_n` results to prevent the normalisation being dominated by poor
  // matches.
  bm25_matches = bm25_matches.slice(0, top_n);
  usif_matches = usif_matches.slice(0, top_n);
  fuzzy_matches = fuzzy_matches.slice(0, top_n);

  // Normalize both score distributions
  const bm25_normalized = normalize_scores(bm25_matches.map((m) => m.score));
  const usif_normalized = normalize_scores(usif_matches.map((m) => m.score));
  const fuzzy_normalized = normalize_scores(fuzzy_matches.map((m) => m.score));

  // Create dict mapping fdc_id to normalized score
  const usif_dict = new Map<number, number>();
  usif_matches.forEach((match, i) => usif_dict.set(match.fdc.fdc_id, usif_normalized[i] as number));
  const fuzzy_dict = new Map<number, number>();
  fuzzy_matches.forEach((match, i) => fuzzy_dict.set(match.fdc.fdc_id, fuzzy_normalized[i] as number));
  const bm25_dict = new Map<number, number>();
  bm25_matches.forEach((match, i) => bm25_dict.set(match.fdc.fdc_id, bm25_normalized[i] as number));

  // Estimate ranker confidences based on spread of normalised scores.
  let bm25_conf = estimate_ranker_confidence(bm25_normalized);
  let fuzzy_conf = estimate_ranker_confidence(fuzzy_normalized);
  let usif_conf = estimate_ranker_confidence(usif_normalized);
  const total_conf = bm25_conf + usif_conf + fuzzy_conf;
  if (total_conf === 0) throw new Error('float division by zero'); // Python: ZeroDivisionError
  bm25_conf = (bm25_conf / total_conf) * 3;
  fuzzy_conf = (fuzzy_conf / total_conf) * 3;
  usif_conf = (usif_conf / total_conf) * 3;

  const fused_matches: FDCIngredientMatch[] = [];
  // {m.fdc for m in bm25_matches} | {m.fdc for m in usif_matches}: FDCIngredient hashes by
  // fdc_id, so the set order is the PySet order of the ids and the object kept per id is the
  // first one inserted.
  const fdc_by_id = new Map<number, FDCIngredient>();
  for (const m of [...bm25_matches, ...usif_matches]) {
    if (!fdc_by_id.has(m.fdc.fdc_id)) fdc_by_id.set(m.fdc.fdc_id, m.fdc);
  }
  const fdc_entries = new PySet(bm25_matches.map((m) => m.fdc.fdc_id)).union(
    new PySet(usif_matches.map((m) => m.fdc.fdc_id)),
  );
  for (const fdc_id of fdc_entries) {
    const fdc = fdc_by_id.get(fdc_id) as FDCIngredient;
    const bm25_norm_score = bm25_dict.get(fdc.fdc_id) ?? 0;
    // uSIF and Fuzzy scores are inverted (i.e. smaller = better). Therefore, after
    // normalisation, subtract from one to make bigger = better.
    const usif_norm_score = 1 - (usif_dict.get(fdc.fdc_id) ?? 1);
    const fuzzy_norm_score = 1 - (fuzzy_dict.get(fdc.fdc_id) ?? 1);

    const fused_score = bm25_conf * bm25_norm_score + usif_conf * usif_norm_score + fuzzy_conf * fuzzy_norm_score;
    // `fused_score` is an np.float64 upstream (the confidences come from numpy), so `round(..., 6)`
    // is numpy's scaled-rint rounding, not CPython's (audit round 2, F9).
    fused_matches.push(new FDCIngredientMatch({ fdc: fdc, score: npRound(fused_score / 3, 6) }));
  }

  // When resolving identical scores, use the preferred dataset.
  // sorted(key=(score, preference index), reverse=True): keys are computed for every element
  // up front (so an unknown data_type raises regardless of ties); the sort is stable and
  // equal keys keep their order.
  const keys = new Map<FDCIngredientMatch, number>();
  for (const m of fused_matches) keys.set(m, dataset_preference_index(m.fdc.data_type));
  return fused_matches.sort((x, y) => {
    if (x.score !== y.score) return y.score - x.score;
    return (keys.get(y) as number) - (keys.get(x) as number);
  });
}

/** Determine the quality of the FDC match based on the scores from the semantic rankers. */
export function determine_match_quality(
  best_match: FDCIngredientMatch,
  usif_matches: readonly FDCIngredientMatch[],
  fuzzy_matches: readonly FDCIngredientMatch[],
): MatchQuality {
  const usif_match = get_matching_fdc_score(best_match.fdc.fdc_id, usif_matches);
  const fuzzy_match = get_matching_fdc_score(best_match.fdc.fdc_id, fuzzy_matches);

  const usif_score = usif_match ? usif_match.score : 1;
  const fuzzy_score = fuzzy_match ? fuzzy_match.score : 1;
  const best_semantic_score = Math.min(usif_score, fuzzy_score);
  if (best_semantic_score > SEMANTIC_SCORE_THRESHOLD) {
    return new MatchQuality({
      quality: 'poor',
      reason:
        `best semantic score greater than threshold ` +
        `(best_semantic_score=${best_semantic_score.toFixed(4)} > ` +
        `SEMANTIC_SCORE_THRESHOLD=${pyFloatRepr(SEMANTIC_SCORE_THRESHOLD)})`,
    });
  }

  return new MatchQuality({ quality: 'good', reason: '' });
}

/** Return the FDCIngredientMatch with given fdc_id, or null if none exists. */
export function get_matching_fdc_score(
  fdc_id: number,
  matches: readonly FDCIngredientMatch[],
): FDCIngredientMatch | null {
  for (const match of matches) {
    if (match.fdc.fdc_id === fdc_id) {
      return match;
    }
  }

  return null;
}
