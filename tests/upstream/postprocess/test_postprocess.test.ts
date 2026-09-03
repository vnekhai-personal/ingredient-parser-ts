// Verbatim conversion of ip-repo/tests/postprocess/test_postprocess.py @ ffd6ae3 (11 tests).
// Do not edit expectations here — they are upstream's. See tests/upstream/README.md.
import { describe, it, expect } from "vitest";

import {
  IngredientAmount,
  IngredientText,
  LabelledToken,
  ParsedIngredient,
} from "../../../src/dataclasses.js";
import { PostProcessor } from "../../../src/en/index.js";
import { ingredient_amount_factory } from "../../../src/en/_utils.js";

/** Define a PostProcessor object with discard_isolated_stop_words set to True
 * to use for testing the PostProcessor class methods.
 */
function p_fixture() {
  const sentence = "2 14 ounce cans of coconut milk";
  const tokens = ["2", "14", "ounce", "can", "of", "coconut", "milk"];
  const pos_tags = ["CD", "CD", "NN", "MD", "VB", "NN", "NN"];
  const labels = ["QTY", "QTY", "UNIT", "UNIT", "COMMENT", "B_NAME_TOK", "I_NAME_TOK"];
  const scores = [
    0.9995971493946465,
    0.9941502269360797,
    0.9978571790476597,
    0.9343053167729019,
    0.8352859914316577,
    0.9907929042080257,
    0.9954196827665529,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
    discard_isolated_stop_words: true,
  });
}

/** Define a PostProcessor object with discard_isolated_stop_words set to True
 * to use for testing the PostProcessor class methods.
 *
 * This sentence includes numbers written as words.
 */
function p_string_numbers_fixture() {
  const sentence = "2 butternut squash, about one and one-half pounds each";
  const tokens = [
    "2",
    "butternut",
    "squash",
    ",",
    "about",
    "one",
    "and",
    "one-half",
    "pound",
    "each",
  ];
  const pos_tags = ["CD", "NN", "NN", ",", "IN", "CD", "CC", "JJ", "NN", "DT"];
  const labels = [
    "QTY",
    "B_NAME_TOK",
    "I_NAME_TOK",
    "PUNC",
    "COMMENT",
    "QTY",
    "QTY",
    "QTY",
    "UNIT",
    "COMMENT",
  ];
  const scores = [
    0.9984380824450226,
    0.9978651159111281,
    0.9994189046396519,
    0.9999962272946663,
    0.9922077606027025,
    0.8444345718042952,
    0.711112570789477,
    0.7123166610204924,
    0.7810746702425934,
    0.9447105511029686,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
    discard_isolated_stop_words: true,
  });
}

/** Define a PostProcessor object with discard_isolated_stop_words set to True
 * to use for testing the PostProcessor class methods.
 *
 * This sentence includes a number range written in words.
 */
function p_string_numbers_range_fixture() {
  const sentence = "2 butternut squash, about one or two pounds each";
  const tokens = [
    "2",
    "butternut",
    "squash",
    ",",
    "about",
    "one",
    "or",
    "two",
    "pounds",
    "each",
  ];
  const pos_tags = ["CD", "NN", "NN", ",", "IN", "CD", "CC", "CD", "NNS", "DT"];
  const labels = [
    "QTY",
    "B_NAME_TOK",
    "I_NAME_TOK",
    "PUNC",
    "COMMENT",
    "QTY",
    "QTY",
    "QTY",
    "UNIT",
    "COMMENT",
  ];
  const scores = [
    0.9984380824450226,
    0.9978651159111281,
    0.9994189046396519,
    0.9999962272946663,
    0.9922077606027025,
    0.8444345718042952,
    0.711112570789477,
    0.7123166610204924,
    0.7810746702425934,
    0.9447105511029686,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
    discard_isolated_stop_words: true,
  });
}

/** Define a PostProcessor object with discard_isolated_stop_words set to False
 * to use for testing the PostProcessor class methods.
 *
 * This sentence has the name after the preparation instruction.
 */
function p_postprep_fixture() {
  const sentence = "1 tbsp chopped pistachios";
  const tokens = ["1", "tbsp", "chopped", "pistachios"];
  const pos_tags = ["CD", "NN", "VBD", "NNS"];
  const labels = ["QTY", "UNIT", "PREP", "B_NAME_TOK"];
  const scores = [
    0.9997566777785302,
    0.9975314001146002,
    0.9936702913782429,
    0.9988409678348467,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
    discard_isolated_stop_words: false,
  });
}

/** Define a PostProcessor object with discard_isolated_stop_words set to False
 * to use for testing the PostProcessor class methods.
 */
function p_no_discard_fixture() {
  const sentence = "2 14 ounce cans of coconut milk";
  const tokens = ["2", "14", "ounce", "can", "of", "coconut", "milk"];
  const pos_tags = ["CD", "CD", "NN", "MD", "IN", "NN", "NN"];
  const labels = ["QTY", "QTY", "UNIT", "UNIT", "COMMENT", "B_NAME_TOK", "I_NAME_TOK"];
  const scores = [
    0.9995971493946465,
    0.9941502269360797,
    0.9978571790476597,
    0.9343053167729019,
    0.8352859914316577,
    0.9907929042080257,
    0.9954196827665529,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
    discard_isolated_stop_words: false,
  });
}

/** Define a PostProcessor object for sentence with a fraction in prep
 * to use for testing the PostProcessor class methods.
 *
 * This sentence includes a fraction in the preparation instructions.
 */
function p_fraction_in_prep_fixture() {
  const sentence = "3 carrots, peeled and sliced into 5mm (¼in) coins";
  const tokens = [
    "3",
    "carrots",
    ",",
    "peeled",
    "and",
    "sliced",
    "into",
    "5",
    "mm",
    "(",
    "#1$4",
    "in",
    ")",
    "coins",
  ];
  const pos_tags = [
    "CD",
    "NNS",
    ",",
    "VBD",
    "CC",
    "VBD",
    "IN",
    "CD",
    "NN",
    "(",
    "NNP",
    "IN",
    ")",
    "NNS",
  ];
  const labels = [
    "QTY",
    "B_NAME_TOK",
    "PUNC",
    "PREP",
    "PREP",
    "PREP",
    "PREP",
    "PREP",
    "PREP",
    "PUNC",
    "PREP",
    "PREP",
    "PUNC",
    "PREP",
  ];
  const scores = [
    0.9994675946370136,
    0.9982121821692039,
    0.9999986664162547,
    0.9999349193863984,
    0.999720763986239,
    0.9999682855629554,
    0.9999116643460678,
    0.9998989415285744,
    0.9994126452404396,
    0.999365113705119,
    0.649315853101702,
    0.651598144547812,
    0.9992304409607873,
    0.660356736493678,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
}

/** Define a PostProcessor object for sentence with a fraction range in prep
 * to use for testing the PostProcessor class methods.
 *
 * This sentence includes a number range in the preparation instructions.
 */
function p_fraction_range_in_prep_fixture() {
  const sentence = "3 carrots, peeled and sliced into 5-10mm (¼-½in) coins";
  const tokens = [
    "3",
    "carrots",
    ",",
    "peeled",
    "and",
    "sliced",
    "into",
    "5-10",
    "mm",
    "(",
    "#1$4-#1$2",
    "in",
    ")",
    "coins",
  ];
  const pos_tags = [
    "CD",
    "NNS",
    ",",
    "VBD",
    "CC",
    "VBD",
    "IN",
    "JJ",
    "NN",
    "(",
    "JJ",
    "IN",
    ")",
    "NNS",
  ];
  const labels = [
    "QTY",
    "B_NAME_TOK",
    "PUNC",
    "PREP",
    "PREP",
    "PREP",
    "PREP",
    "PREP",
    "PREP",
    "PUNC",
    "PREP",
    "PREP",
    "PUNC",
    "PREP",
  ];
  const scores = [
    0.9994675946370136,
    0.9982121821692039,
    0.9999986664162547,
    0.9999349193863984,
    0.999720763986239,
    0.9999682855629554,
    0.9999116643460678,
    0.9998989415285744,
    0.9994126452404396,
    0.999365113705119,
    0.649315853101702,
    0.651598144547812,
    0.9992304409607873,
    0.660356736493678,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, { custom_units: {} });
}

/** Define a PostProcessor object with discard_isolated_stop_words set to False
 * to use for testing the PostProcessor class methods.
 *
 * This sentence has the name split by a token with a non-name label.
 */
function p_split_name_fixture() {
  const sentence = "5 fresh large basil leaves";
  const tokens = ["5", "fresh", "large", "basil", "leaves"];
  const pos_tags = ["CD", "JJ", "JJ", "NN", "NN"];
  const labels = ["QTY", "B_NAME_TOK", "SIZE", "B_NAME_TOK", "I_NAME_TOK"];
  const scores = [
    0.99938548647492,
    0.968725226931013,
    0.9588222550056443,
    0.5092435116086577,
    0.9877923155569212,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
    discard_isolated_stop_words: false,
  });
}

/** Define a PostProcessor object for sentence with a multiplier range.
 * i.e. "3-4x".
 */
function p_multiplier_range_amount_fixture() {
  const sentence = "3 - 4 x 15ml tablespoons olive oil";
  const tokens = ["3-4x", "15", "ml", "tablespoon", "olive", "oil"];
  const pos_tags = ["CD", "CD", "NN", "NNS", "JJ", "NN"];
  const labels = ["QTY", "QTY", "UNIT", "UNIT", "B_NAME_TOK", "I_NAME_TOK"];
  const scores = [
    0.9999535063384082,
    0.9997353684954745,
    0.9999941074194176,
    0.999910213422632,
    0.9994944350996183,
    0.9995007468043913,
  ];
  const labelled_tokens = tokens.map(
    (text, i) =>
      new LabelledToken({
        index: i,
        text,
        pos_tag: pos_tags[i]!,
        label: labels[i]!,
        score: scores[i]!,
        plural: false,
      }),
  );

  return new PostProcessor(sentence, labelled_tokens, {
    custom_units: {},
  });
}

describe("TestPostProcessor__builtins__", () => {
  it("test__str__", () => {
    // Test PostProcessor __str__
    const p = p_fixture();
    // Upstream writes this as one triple-quoted string with a backslash line
    // continuation; the value is a single line break followed by a tab.
    const truth =
      "Post-processed recipe ingredient sentence\n" +
      "\t[('2', 'QTY'), ('14', 'QTY'), ('ounce', 'UNIT'), ('can', 'UNIT'), ('of', 'COMMENT'), " +
      "('coconut', 'B_NAME_TOK'), ('milk', 'I_NAME_TOK')]";
    expect(p.toString()).toBe(truth);
  });

  it("test__repr__", () => {
    // Test PostProessor __repr__
    const p = p_fixture();
    expect(p.repr()).toBe('PostProcessor("2 14 ounce cans of coconut milk")');
  });
});

describe("TestPostProcessor_parsed", () => {
  it("test", () => {
    // Test fixture returns expected ParsedIngredient object, with the word "of"
    // discarded due to discard_isolated_stop_words being set to True.
    const p = p_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "coconut milk", confidence: 0.993106, starting_index: 5 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "2",
          unit: "cans",
          text: "2 cans",
          confidence: 0.966951,
          starting_index: 0,
          APPROXIMATE: false,
          SINGULAR: false,
        }),
        ingredient_amount_factory({
          quantity: "14",
          unit: "ounce",
          text: "14 ounces",
          confidence: 0.994150,
          starting_index: 1,
          APPROXIMATE: false,
          SINGULAR: true,
        }),
      ],
      preparation: null,
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "2 14 ounce cans of coconut milk",
    });

    expect(p.parsed).toEqual(expected);
  });

  it("test_string_numbers", () => {
    // Test fixture returns expected ParsedIngredient object, with the string
    // numbers replaced with numeric range.
    const p_string_numbers = p_string_numbers_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "butternut squash", confidence: 0.998642, starting_index: 1 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "2",
          unit: "",
          text: "2",
          confidence: 0.998438,
          starting_index: 0,
          APPROXIMATE: false,
          SINGULAR: false,
        }),
        ingredient_amount_factory({
          quantity: "1.5",
          unit: "pound",
          text: "1 1/2 pounds",
          confidence: 0.768515,
          starting_index: 5,
          APPROXIMATE: true,
          SINGULAR: true,
        }),
      ],
      preparation: null,
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "2 butternut squash, about one and one-half pounds each",
    });

    expect(p_string_numbers.parsed).toEqual(expected);
  });

  it("test_string_numbers_range", () => {
    // Test fixture returns expected ParsedIngredient object, with the string
    // numbers replaced with numeric range.
    const p_string_numbers_range = p_string_numbers_range_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "butternut squash", confidence: 0.998642, starting_index: 1 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "2",
          unit: "",
          text: "2",
          confidence: 0.998438,
          starting_index: 0,
          APPROXIMATE: false,
          SINGULAR: false,
        }),
        ingredient_amount_factory({
          quantity: "1-2",
          unit: "pounds",
          text: "1-2 pounds",
          confidence: 0.768515,
          starting_index: 5,
          APPROXIMATE: true,
          SINGULAR: true,
        }),
      ],
      preparation: null,
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "2 butternut squash, about one or two pounds each",
    });

    expect(p_string_numbers_range.parsed).toEqual(expected);
  });

  it("test_postprep_amounts", () => {
    // Test fixture returns expected ParsedIngredient object, with the preparation
    // tokens before the ingredient name.
    const p_postprep = p_postprep_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "pistachios", confidence: 0.998841, starting_index: 3 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "1",
          unit: "tbsp",
          text: "1 tbsp",
          confidence: 0.998644,
          starting_index: 0,
        }),
      ],
      preparation: new IngredientText({ text: "chopped", confidence: 0.99367, starting_index: 2 }),
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "1 tbsp chopped pistachios",
    });

    expect(p_postprep.parsed).toEqual(expected);
  });

  it("test_no_discard_isolated_stop_words", () => {
    // Test fixture returns expected ParsedIngredient object, with the word "of"
    // kept due to discard_isolated_stop_words being set to False.
    const p_no_discard = p_no_discard_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "coconut milk", confidence: 0.993106, starting_index: 5 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "2",
          unit: "cans",
          text: "2 cans",
          confidence: 0.966951,
          starting_index: 0,
          APPROXIMATE: false,
          SINGULAR: false,
        }),
        ingredient_amount_factory({
          quantity: "14",
          unit: "ounce",
          text: "14 ounces",
          confidence: 0.994150,
          starting_index: 1,
          APPROXIMATE: false,
          SINGULAR: true,
        }),
      ],
      preparation: null,
      comment: new IngredientText({ text: "of", confidence: 0.835286, starting_index: 4 }),
      purpose: null,
      foundation_foods: [],
      sentence: "2 14 ounce cans of coconut milk",
    });

    expect(p_no_discard.parsed).toEqual(expected);
  });

  it("test_fraction_in_prep", () => {
    // Test fixture returns expected ParsedIngredient object, with the fraction in the
    // preparation instruction retained.
    const p_fraction_in_prep = p_fraction_in_prep_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "carrots", confidence: 0.998212, starting_index: 1 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "3",
          unit: "",
          text: "3",
          confidence: 0.999468,
          starting_index: 0,
        }),
      ],
      preparation: new IngredientText({
        text: "peeled and sliced into 5 mm (1/4 in) coins",
        confidence: 0.905338,
        starting_index: 3,
      }),
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "3 carrots, peeled and sliced into 5mm (¼in) coins",
    });

    expect(p_fraction_in_prep.parsed).toEqual(expected);
  });

  it("test_fraction_range_in_prep", () => {
    // Test fixture returns expected ParsedIngredient object, with the fraction range
    // in the preparation instruction retained.
    const p_fraction_range_in_prep = p_fraction_range_in_prep_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "carrots", confidence: 0.998212, starting_index: 1 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "3",
          unit: "",
          text: "3",
          confidence: 0.999468,
          starting_index: 0,
        }),
      ],
      preparation: new IngredientText({
        text: "peeled and sliced into 5-10 mm (1/4-1/2 in) coins",
        confidence: 0.905338,
        starting_index: 3,
      }),
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "3 carrots, peeled and sliced into 5-10mm (¼-½in) coins",
    });

    expect(p_fraction_range_in_prep.parsed).toEqual(expected);
  });

  it("test_split_ingredient_name", () => {
    // Test fixture returns expected ParsedIngredient object, with a single name
    // despite a SIZE token splitting the name.
    const p_split_name = p_split_name_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({
          text: "fresh basil leaves",
          confidence: 0.858622,
          starting_index: 1,
        }),
      ],
      size: new IngredientText({ text: "large", confidence: 0.958822, starting_index: 2 }),
      amount: [
        ingredient_amount_factory({
          quantity: "5",
          unit: "",
          text: "5",
          confidence: 0.999385,
          starting_index: 0,
        }),
      ],
      preparation: null,
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "5 fresh large basil leaves",
    });

    expect(p_split_name.parsed).toEqual(expected);
  });

  it("test_multiplier_range", () => {
    // Test fixture returns expected ParsedIngredient object, where the first amount
    // is marked as MULTIPLIER=True and RANGE=TRUE.
    const p_multiplier_range_amount = p_multiplier_range_amount_fixture();
    const expected = new ParsedIngredient({
      name: [
        new IngredientText({ text: "olive oil", confidence: 0.999498, starting_index: 4 }),
      ],
      size: null,
      amount: [
        ingredient_amount_factory({
          quantity: "3-4x",
          unit: "",
          text: "3-4x",
          confidence: 0.999954,
          starting_index: 0,
        }),
        ingredient_amount_factory({
          quantity: "15",
          unit: "ml tablespoons",
          text: "15 ml tablespoon",
          confidence: 0.99988,
          starting_index: 1,
          SINGULAR: true,
        }),
      ],
      preparation: null,
      comment: null,
      purpose: null,
      foundation_foods: [],
      sentence: "3 - 4 x 15ml tablespoons olive oil",
    });

    expect(p_multiplier_range_amount.parsed).toEqual(expected);
    // CONVERSION NOTE: ParsedIngredient.amount is typed
    // IngredientAmount | CompositeIngredientAmount; the cast narrows to the flag-bearing
    // type upstream reads here (a Python duck-typed attribute access).
    expect((expected.amount[0] as IngredientAmount).MULTIPLIER).toBe(true);
    expect((expected.amount[0] as IngredientAmount).RANGE).toBe(true);
  });
});
