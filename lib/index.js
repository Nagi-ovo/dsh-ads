//#region src/index.ts
/**
* dsh-ads, node half.
*
* Pure UI plugin: the empty apply exists so the plugin appears in the host
* cordis.yml / Loader; the browser half ships via `exports["./client"]`,
* discovered through the package.json `dshClient` declaration. Every knob the
* ad layer has lives in the browser, where the user can reach it from the
* settings panel — a host-side `Config` would validate at boot and then have
* no channel to the layer that needs it.
*
* A surface without the browser half simply has no ad layer, which is the
* correct degradation for TUI, ACP, and headless.
*
* @module @dsh-external/dsh-ads
*/
/** Host plugin body — no host-side behavior for the ad layer. */
function apply() {}
//#endregion
export { apply };
