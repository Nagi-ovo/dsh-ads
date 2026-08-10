/**
 * "关闭所有广告", and why it is not a setting.
 *
 * Every switch in {@link module:./settings.ts} is remembered. This one must not
 * be: it means "enough for now", and a persisted version would turn one stray
 * click into an uninstall the user could not undo without knowing where the
 * storage key lives. So it lives in module scope — page-load lifetime, gone on
 * reload, exactly the promise the button makes.
 *
 * It still has to cross React trees, because the button sits in the host's
 * settings dialog and the layer it retires is portalled somewhere else
 * entirely. A plain event does that without persisting anything.
 *
 * @module
 */

import { useEffect, useState } from 'react'

/** Same-document notification that the layer has been retired. */
const RETIRED = 'dsh-ads:retired'

/** Whether the layer has been retired for this page load. */
let retired = false

/**
 * Retire the ad layer until the page is reloaded.
 *
 * Deliberately one-way: nothing here un-retires, because the button says it
 * closes the ads and an ad layer that came back on its own would make a liar
 * of the one honest control in the plugin.
 */
export function retireAds(): void {
  if (retired) return
  retired = true
  dispatchEvent(new CustomEvent(RETIRED))
}

/**
 * Follow the retired flag.
 * @returns true once anything has retired the layer this page load.
 */
export function useRetired(): boolean {
  const [value, setValue] = useState(retired)
  useEffect(() => {
    // Re-read on mount as well as on the event: a tree that mounts after the
    // button was pressed would otherwise start out showing ads again.
    setValue(retired)
    const onRetired = () => setValue(true)
    addEventListener(RETIRED, onRetired)
    return () => removeEventListener(RETIRED, onRetired)
  }, [])
  return value
}

/**
 * Un-retire the layer.
 *
 * Not reachable from the UI — the button is one-way by design. Tests need a
 * way back to a clean slate, since module state outlives a render.
 */
export function resetRetired(): void {
  retired = false
}
