/**
 * Types for Lucide's per-icon entry points.
 *
 * The package ships declarations only for its barrel, and importing through
 * that barrel pulls its entire index into the browser bundle — around 750 KB
 * for the handful of glyphs the settings page uses. The per-icon modules are
 * the supported way to avoid that; they simply have no `.d.ts` of their own,
 * so the shape is declared once here rather than asserted at each import.
 *
 * @module
 */

declare module 'lucide-react/dist/esm/icons/*.mjs' {
  import type { ComponentType, SVGProps } from 'react'

  /** A Lucide glyph: an SVG that inherits `currentColor` and takes a size. */
  const Icon: ComponentType<SVGProps<SVGSVGElement> & { readonly size?: number | string }>
  export default Icon
}
