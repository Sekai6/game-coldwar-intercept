/**
 * Returns a reproducible, approximately uniform value in [0, 1).
 * Inputs should identify the event rather than mutable unrelated state.
 */
export function deterministicProbabilityRoll(...inputs: number[]) {
  let hash = 0x811c9dc5;
  for (const input of inputs) {
    const quantized = Math.round(input * 1000);
    hash ^= quantized;
    hash = Math.imul(hash, 0x01000193);
    hash ^= hash >>> 13;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}
