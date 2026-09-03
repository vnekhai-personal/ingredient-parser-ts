/** Port of `ingredient_parser/__init__.py` (pin ffd6ae3) plus the module surface consumers need. */
export { SUPPORTED_LANGUAGES } from './_common.js';
export { UREG } from './_pint.js';
export { inspect_parser, parse_ingredient, parse_multiple_ingredients, tag_ingredient } from './parsers.js';
export type { Quirks, TaggedIngredient } from './en/index.js';
export type { ParseIngredientOptions } from './parsers.js';
export { preload_foundation_foods, set_parser_model, set_foundation_foods_assets } from './en/_loaders.js';
export { show_model_card } from './_common.js';
export const __version__ = '2.7.0';

export { NumpyCRFInference, NumpyViterbiInference, logaddexp } from './inference.js';
export type { CRFModelJson, FeatureDict, LabelScore } from './inference.js';
export { PreProcessor } from './en/index.js';
export { Fraction } from './fraction.js';
export { Unit, Quantity } from './_pint.js';
export * from './dataclasses.js';
