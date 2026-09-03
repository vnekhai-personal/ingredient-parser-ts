// Node-only helper: read a .json.gz model. The runtime never touches zlib (Hermes has none);
// the model asset ships as a generated module (docs/PORTING.md §3.9).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { CRFModelJson } from '../../src/inference.js';

export function loadModelGz(path: string): CRFModelJson {
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')) as CRFModelJson;
}
