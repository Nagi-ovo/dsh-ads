/**
 * Return a stable non-negative 32-bit hash for deterministic client choices.
 *
 * FNV-1a keeps visual rotation, feed selection, and reward scheduling stable
 * without making those features depend on one another's implementation.
 *
 * @param text - the string to hash.
 * @returns the unsigned 32-bit hash.
 */
export function hashString(text: string): number {
  let hash = 0x811c_9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x0100_0193) >>> 0
  }
  return hash >>> 0
}
