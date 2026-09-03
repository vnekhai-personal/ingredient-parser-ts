// Verbatim conversion of ip-repo/tests/foundationfoods/test_tokenize_fdc_description.py @ ffd6ae3 (4 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { beforeAll, describe, it, expect } from 'vitest';

import { preload_foundation_foods } from '../../../src/foundation-foods.js';
import {
  TokenizedFDCDescription,
  tokenize_fdc_description,
} from '../../../src/en/foundationfoods/_ff_utils.js';

// Infrastructure only (tests/upstream/README.md): the embeddings asset is lazy in the port.
beforeAll(async () => {
  await preload_foundation_foods();
});

describe("TestTokenizeFDCDescription", () => {
  // PARITY-DELTA (tagger, docs/PORTING.md §3.2): NLTK tags "vegetable" JJ; natural's Brill tags it NN and
  // Python at the pin with BRILL_TAGS_FILE returns pos_tags ["NN","NNS"], as the port does (2026-09-02).
  it.fails("test_simple_description", () => {
    // Test that the description is tokenized and stemmed and all tokens have wieght 1.
    const description = "Vegetable chips";

    const expected_tokens = ["veget", "chip"];
    const expected_pos_tags = ["JJ", "NNS"];
    const expected_weights = [1.0, 1.0];
    expect(tokenize_fdc_description(description)).toEqual(
      new TokenizedFDCDescription({
        tokens: expected_tokens,
        pos_tags: expected_pos_tags,
        embedding_tokens: expected_tokens,
        embedding_pos_tags: expected_pos_tags,
        embedding_weights: expected_weights,
      }),
    );
  });

  it("test_multiple_phrase_weights", () => {
    // Test that the weights for tokens in each phrase descrease with each phrase.
    const description = "Chicken, thigh, meat and skin, raw";

    const expected_tokens = ["chicken", "thigh", "meat", "and", "skin", "raw"];
    const expected_pos_tags = ["NN", "NN", "NN", "CC", "NN", "JJ"];
    const expected_weights = [
      1.0,
      1.0 - 1e-3,
      1.0 - 2e-3,
      1.0 - 2e-3,
      1.0 - 2e-3,
      1.0 - 3e-3,
    ];
    expect(tokenize_fdc_description(description)).toEqual(
      new TokenizedFDCDescription({
        tokens: expected_tokens,
        pos_tags: expected_pos_tags,
        embedding_tokens: expected_tokens,
        embedding_pos_tags: expected_pos_tags,
        embedding_weights: expected_weights,
      }),
    );
  });

  // PARITY-DELTA (tagger): NLTK tags "canned" VBD, Brill JJ; Python-with-Brill gives ["NN","JJ","DT","NN"]
  // (tokens and weights identical), as the port does.
  it.fails("test_negated_tokens", () => {
    // Test that negated tokens and the following tokens within the same phrase have 0
    // weight.
    const description = "Chicken, canned, no broth";

    const expected_tokens = ["chicken", "can", "no", "broth"];
    const expected_pos_tags = ["NN", "VBD", "DT", "NN"];
    const expected_weights = [1.0, 1.0 - 1e-3, 0, 0];
    expect(tokenize_fdc_description(description)).toEqual(
      new TokenizedFDCDescription({
        tokens: expected_tokens,
        pos_tags: expected_pos_tags,
        embedding_tokens: expected_tokens,
        embedding_pos_tags: expected_pos_tags,
        embedding_weights: expected_weights,
      }),
    );
  });

  // PARITY-DELTA (tagger): as test_negated_tokens; Python-with-Brill gives ["NN","JJ","IN","NN"].
  it.fails("test_reduced_relevance_tokens", () => {
    // Test that reduced relevance tokens and the following tokens within the same
    // phrase have reduced weight.
    const description = "Chicken, canned, with broth";

    const expected_tokens = ["chicken", "can", "with", "broth"];
    const expected_pos_tags = ["NN", "VBD", "IN", "NN"];
    const expected_weights = [1.0, 1.0 - 1e-3, 1 - 0.5 - 2e-3, 1 - 0.5 - 2e-3];
    expect(tokenize_fdc_description(description)).toEqual(
      new TokenizedFDCDescription({
        tokens: expected_tokens,
        pos_tags: expected_pos_tags,
        embedding_tokens: expected_tokens,
        embedding_pos_tags: expected_pos_tags,
        embedding_weights: expected_weights,
      }),
    );
  });
});
