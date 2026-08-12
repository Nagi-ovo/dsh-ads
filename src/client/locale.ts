/** Locale selection shared by the slot adapters and internal ad surfaces. */

import type { AdLocale } from './types.ts'

/**
 * Map the host locale to the two artwork sets this plugin ships.
 * @param active - DSH's current locale id.
 * @returns English only for the explicit `en` setting; every other future id falls back to Chinese.
 */
export function adLocale(active: string): AdLocale {
  return active === 'en' ? 'en' : 'zh'
}
