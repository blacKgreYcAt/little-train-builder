import { setActiveRoute } from "./route";
import { rebuildChapters } from "./terrain";
import { DEFAULT_ROUTE, type RouteKey } from "./routes";

/**
 * Swaps the whole world over to another line.
 *
 * Order matters: the curve has to be rebuilt before the terrain chapters, and
 * both before anything reads them. Everything else — ballast, rails, sleepers,
 * embankments, the bore, the scenery — is built inside `useMemo`s in the
 * scene, so the Canvas is remounted on the route key to force those to rerun.
 *
 * This lives apart from route.ts and terrain.ts because terrain imports route;
 * putting the call to `rebuildChapters` inside `setActiveRoute` would make
 * those two modules import each other.
 */
export function applyRoute(key: RouteKey) {
  setActiveRoute(key);
  rebuildChapters();
}

// the world has to be coherent from the very first import, not only after a
// route change
applyRoute(DEFAULT_ROUTE);
