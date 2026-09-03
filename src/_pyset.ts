/**
 * CPython 3.12 `set` iteration order for integer-hashed keys (TS-native supporting module).
 *
 * Upstream's foundation-foods code iterates sets of FDC ids / FDC objects (hashed by their
 * integer fdc_id) and the resulting order feeds stable sorts and top-N truncations, so it is
 * observable in the output. This reproduces `setobject.c`: open addressing with LINEAR_PROBES
 * = 9 consecutive slots, perturbation (PERTURB_SHIFT = 5), the fill*5 >= mask*3 resize rule
 * (used*4 below 50000 entries), `set_insert_clean` on rebuild, and `set_merge`'s fast paths
 * for copying into an empty set. Integers hash to themselves (non-negative, < 2^61 - 1).
 * Verified against CPython on generated cases (tests/goldens/pyset-cases.json).
 */

const MINSIZE = 8;
const LINEAR_PROBES = 9;
const PERTURB_SHIFT = 5n;

export class PySet {
  private table: (number | null)[];
  private mask: number;
  private fill = 0;
  private used = 0;

  constructor(items?: Iterable<number>) {
    this.table = new Array<number | null>(MINSIZE).fill(null);
    this.mask = MINSIZE - 1;
    if (items) for (const x of items) this.add(x);
  }

  get size(): number {
    return this.used;
  }

  has(key: number): boolean {
    const hash = key;
    let i = hash & this.mask;
    let perturb = BigInt(hash);
    for (;;) {
      let probes = i + LINEAR_PROBES <= this.mask ? LINEAR_PROBES : 0;
      let e = i;
      do {
        const k = this.table[e];
        if (k === null) return false;
        if (k === key) return true;
        e += 1;
      } while (probes-- > 0);
      perturb >>= PERTURB_SHIFT;
      i = Number((BigInt(i) * 5n + 1n + perturb) & BigInt(this.mask));
    }
  }

  /** `set_add_entry` (no dummies ever exist here: this set never deletes). */
  add(key: number): void {
    const hash = key;
    let i = hash & this.mask;
    let perturb = BigInt(hash);
    for (;;) {
      let probes = i + LINEAR_PROBES <= this.mask ? LINEAR_PROBES : 0;
      let e = i;
      do {
        const k = this.table[e];
        if (k === null) {
          this.table[e] = key;
          this.fill += 1;
          this.used += 1;
          if (this.fill * 5 < this.mask * 3) return;
          this.resize(this.used > 50000 ? this.used * 2 : this.used * 4);
          return;
        }
        if (k === key) return;
        e += 1;
      } while (probes-- > 0);
      perturb >>= PERTURB_SHIFT;
      i = Number((BigInt(i) * 5n + 1n + perturb) & BigInt(this.mask));
    }
  }

  private static insertClean(table: (number | null)[], mask: number, key: number): void {
    const hash = key;
    let i = hash & mask;
    let perturb = BigInt(hash);
    for (;;) {
      if (table[i] === null) {
        table[i] = key;
        return;
      }
      if (i + LINEAR_PROBES <= mask) {
        for (let j = 1; j <= LINEAR_PROBES; j++) {
          if (table[i + j] === null) {
            table[i + j] = key;
            return;
          }
        }
      }
      perturb >>= PERTURB_SHIFT;
      i = Number((BigInt(i) * 5n + 1n + perturb) & BigInt(mask));
    }
  }

  private resize(minused: number): void {
    let newsize = MINSIZE;
    while (newsize <= minused) newsize <<= 1;
    const old = this.table;
    this.table = new Array<number | null>(newsize).fill(null);
    this.mask = newsize - 1;
    for (const k of old) if (k !== null) PySet.insertClean(this.table, this.mask, k);
    this.fill = this.used;
  }

  /** `set_merge(self, other)` for a set `other`. */
  private merge(other: PySet): void {
    if ((this.fill + other.used) * 5 >= this.mask * 3) {
      this.resize((this.used + other.used) * 2);
    }
    if (this.fill === 0 && this.mask === other.mask && other.fill === other.used) {
      this.table = other.table.slice();
      this.fill = other.fill;
      this.used = other.used;
      return;
    }
    if (this.fill === 0) {
      for (const k of other.table) if (k !== null) PySet.insertClean(this.table, this.mask, k);
      this.fill = other.used;
      this.used = other.used;
      return;
    }
    for (const k of other.table) if (k !== null) this.add(k);
  }

  /** `a | b`: copy of `a` (via set_merge into an empty set) then merge `b`. */
  union(other: PySet): PySet {
    const result = new PySet();
    result.merge(this);
    result.merge(other);
    return result;
  }

  /** `a & b` (result built by adding in the smaller set's iteration order — CPython's set_intersection). */
  intersection(other: PySet): PySet {
    let a: PySet = this;
    let b: PySet = other;
    if (b.used > a.used) [a, b] = [b, a]; // CPython swaps so `other` is the smaller
    const result = new PySet();
    for (const k of b) if (a.has(k)) result.add(k);
    return result;
  }

  /** Iteration in table-slot order — CPython's observable set order. */
  *[Symbol.iterator](): IterableIterator<number> {
    for (const k of this.table) if (k !== null) yield k;
  }

  toArray(): number[] {
    return [...this];
  }
}
