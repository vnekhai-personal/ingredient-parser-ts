// The Python reference dumps the harness diffs against. Two locations, checked in this order:
//   1. the regenerable plain JSONL at the repo root (or the path in the test's env var), written by
//      training/dump-*.py — used while developing against a fresh Python run;
//   2. the committed, gzipped copy under tests/goldens/parity/ — the pinned reference for the
//      parity tag. Generated from the pin, never hand-edited (CLAUDE.md I4); provenance in
//      tests/goldens/parity/MANIFEST.md.
import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createGunzip } from 'node:zlib';
import type { Readable } from 'node:stream';

export const ROOT = resolve(import.meta.dirname, '../..');
export const PARITY_DIR = resolve(ROOT, 'tests/goldens/parity');

/** Path of the dump `name` (e.g. "parsed.jsonl"): env override, root plain file, else the committed .gz. */
export function resolveDump(name: string, envVar?: string): string {
  const override = envVar ? process.env[envVar] : undefined;
  if (override) return resolve(override);
  const plain = resolve(ROOT, name);
  if (existsSync(plain)) return plain;
  return resolve(PARITY_DIR, `${name}.gz`);
}

/** Readable line source for a dump path; transparently gunzips `.gz`. */
export function openDump(path: string): Readable {
  const raw = createReadStream(path);
  return path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
}
