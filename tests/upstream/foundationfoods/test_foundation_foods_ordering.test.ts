// Verbatim conversion of ip-repo/tests/foundationfoods/test_foundation_foods_ordering.py @ ffd6ae3 (1 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect, beforeAll } from 'vitest';

import { LabelledToken } from '../../../src/dataclasses.js';
import { PostProcessor } from '../../../src/en/index.js';
import { preload_foundation_foods } from '../../../src/foundation-foods.js';

beforeAll(async () => {
  await preload_foundation_foods();
});

function p_mulitple_names() {
  // Define a PostProcessor object with discard_isolated_stop_words set to False
  // to use for testing the PostProcessor class methods.
  //
  // This sentence has the name split by a token with a non-name label.
  const sentence = "2 cups olive or sunflower oil";
  const tokens = ["2", "cup", "olive", "or", "sunflower", "oil"];
  const pos_tags = ["CD", "NNS", "NN", "CC", "NN", "NN"];
  const labels = ["QTY", "UNIT", "NAME_VAR", "NAME_SEP", "NAME_VAR", "B_NAME_TOK"];
  const scores = [
    0.9999916198218641,
    0.9999194173062287,
    0.9455381513097211,
    0.9996235422364157,
    0.9649807293441203,
    0.9668959628659927,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i],
        label: labels[i],
        score: scores[i],
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
    discard_isolated_stop_words: false,
    foundation_foods: true,
  });
}

describe("TestPostProcessor_ordering", () => {
  it("test_split_ingredient_name", () => {
    // Test that the foundation foods matched to each ingredient name have mapped to
    // the correct index in the name list.
    const p = p_mulitple_names();

    expect(p.parsed.name[0].text).toBe("olive oil");
    expect(p.parsed.foundation_foods[0].fdc_id).toBe(2710186);
    expect(p.parsed.foundation_foods[0].name_index).toBe(0);

    expect(p.parsed.name[1].text).toBe("sunflower oil");
    expect(p.parsed.foundation_foods[1].fdc_id).toBe(2710192);
    expect(p.parsed.foundation_foods[1].name_index).toBe(1);
  });
});
