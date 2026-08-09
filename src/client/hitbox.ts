/**
 * The decoy close button.
 *
 * Every banner draws a comfortable-looking ✕. Only a small, off-centre patch
 * inside it actually dismisses the banner; the rest of the glyph — and the
 * banner body — opens the "landing page" lightbox instead. This reproduces the
 * defining texture of cheap Chinese web ads, where the close affordance is
 * drawn honestly and wired dishonestly.
 *
 * The offset is derived from the banner's frozen seed, so a given banner keeps
 * the same wrong hitbox for its whole life: a target that moved between
 * attempts would read as a rendering bug instead of as the joke.
 */

/** Rendered size of the ✕ glyph box, in CSS pixels. */
export const VISUAL_CLOSE_PX = 20

/**
 * Side of the patch that actually closes the banner, in CSS pixels. Small
 * enough to miss on a confident click, large enough that a deliberate,
 * pixel-hunting user always wins — the joke is friction, not a lockout.
 */
export const DEFAULT_HITBOX_PX = 7

/** Placement of the real hitbox inside the visual glyph box. */
export interface Hitbox {
  /** Offset from the glyph box's left edge, in CSS pixels. */
  readonly left: number
  /** Offset from the glyph box's top edge, in CSS pixels. */
  readonly top: number
  /** Side length of the square hitbox, in CSS pixels. */
  readonly size: number
}

/** Fractional part, for seeds already known to be non-negative. */
const frac = (x: number): number => x - Math.floor(x)

/**
 * Place the real hitbox inside the visual glyph for one banner.
 *
 * The patch always stays fully inside the glyph box, so the banner never grows
 * an invisible dead zone outside the thing the user is aiming at.
 *
 * The two axes come from multiplying the seed by mutually irrational-ish
 * constants and keeping the fractional part, which decorrelates them for
 * *any* seed distribution. Slicing decimal digits out of the seed instead
 * looks equivalent and is not: a regularly-spaced seed (k/200, and any other
 * seed whose scaled value lands on a fixed digit) collapses one axis to a
 * constant, and a close button that only ever skews sideways is half a joke.
 *
 * @param seed - the banner's frozen randomness, in [0, 1).
 * @param size - side of the real hitbox; defaults to {@link DEFAULT_HITBOX_PX}.
 * @returns the hitbox rectangle relative to the glyph box's top-left corner.
 */
export function resolveHitbox(seed: number, size: number = DEFAULT_HITBOX_PX): Hitbox {
  const span = Math.max(0, VISUAL_CLOSE_PX - size)
  const hx = frac(seed * 137.5077 + 0.3183)
  const hy = frac(seed * 293.0169 + 0.6180)
  return { left: hx * span, top: hy * span, size }
}
