import { IncomingMessage, ServerResponse } from "node:http";
//#region src/index.d.ts
/** The slice of the host context this plugin uses. */
interface HostContext {
  /** The web shell's HTTP server; the only host capability the ad layer needs. */
  webServer: {
    /**
     * Publish a route.
     * @param route - the path to claim and the handler to serve it.
     * @returns the disposer that unpublishes it.
     */
    register(route: {
      kind: 'exact';
      path: string;
      handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
    }): () => void;
  };
  /**
   * Register a disposable effect.
   * @param callback - runs on apply, returns its own teardown.
   */
  effect(callback: () => (() => void)): void;
}
/** Host capabilities required for the dynamic tier. */
declare const inject: string[];
/** Plugin configuration. */
interface Config {
  /**
   * How recently a plugin must have been pushed to enter the rotation, in
   * days. Zero or less advertises the whole discovered topic.
   */
  freshDays?: number;
  /** How long a search result is reused before GitHub is queried again, in minutes. */
  cacheMinutes?: number;
}
/**
 * Register the sponsor route.
 * @param ctx - host context.
 * @param config - see {@link Config}.
 */
declare function apply(ctx: HostContext, config?: Config): void;
//#endregion
export { Config, apply, inject };