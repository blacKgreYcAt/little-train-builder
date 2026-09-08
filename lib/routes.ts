/**
 * The lines you can choose between.
 *
 * Each one is just a ring of control points plus where its landmarks sit along
 * it. The landmarks are fractions of a lap rather than fixed coordinates, so
 * they follow the line they belong to — and every route gets checked by
 * scripts/check-routes.ts for curves too tight to run, gradients too steep to
 * climb, and any place the line passes close to itself without the height to
 * clear it.
 */

export type RouteKey = "figure8" | "lakeside" | "mountain" | "highline";

export interface RouteDef {
  key: RouteKey;
  /** picked by picture, so no words */
  icon: string;
  points: [number, number, number][];
  /** fraction of the lap where the tunnel's midpoint sits */
  tunnelAt: number;
  /** a ridge sitting on the line, which the flattened corridor cuts through */
  cuttingAt: number;
  /** a hollow beside the line, filled with water */
  lakeAt: number;
  lakeSide: number;
}

export const ROUTES: Record<RouteKey, RouteDef> = {
  /** The original: an eight that crosses over itself on a bridge. */
  figure8: {
    key: "figure8",
    icon: "🌀",
    tunnelAt: 0.315,
    cuttingAt: 0.62,
    lakeAt: 0.83,
    lakeSide: 46,
    points: [
      [0, 0.0, 0],
      [30, 0.25, 27],
      [66, 1.2, 41],
      [100, 2.4, 33],
      [117, 1.1, 6],
      [104, 2.9, -23],
      [72, 3.8, -41],
      [34, 4.7, -29],
      [10, 5.15, -12],
      [0, 5.4, 0],
      [-22, 5.0, 18],
      [-52, 4.2, 30],
      [-74, 3.3, 17],
      [-76, 2.4, -7],
      [-57, 1.5, -25],
      [-31, 0.7, -30],
      [-12, 0.25, -18],
    ],
  },

  /** A long, almost flat ring with wide open curves — the gentle one. */
  lakeside: {
    key: "lakeside",
    icon: "🏞️",
    tunnelAt: 0.47,
    cuttingAt: 0.13,
    lakeAt: 0.79,
    lakeSide: 54,
    points: [
      [115, 0.20, 0],
      [101, 0.50, 31],
      [63, 0.90, 54],
      [10, 1.20, 62],
      [-42, 1.30, 54],
      [-81, 1.10, 31],
      [-95, 0.80, 0],
      [-81, 0.50, -31],
      [-43, 0.25, -54],
      [10, 0.15, -62],
      [63, 0.20, -54],
      [101, 0.20, -31],
    ],
  },

  /** Steep and twisty, over the top and back down. The busy one. */
  mountain: {
    key: "mountain",
    icon: "⛰️",
    tunnelAt: 0.30,
    cuttingAt: 0.68,
    lakeAt: 0.86,
    lakeSide: 44,
    points: [
      [0, 0.0, 0],
      [26, 0.7, 25],
      [58, 2.3, 36],
      [82, 4.1, 19],
      [78, 5.4, -11],
      [48, 6.2, -32],
      [15, 6.7, -23],
      [0, 7.0, 0],
      [-21, 6.3, 21],
      [-48, 4.7, 32],
      [-73, 2.9, 17],
      [-73, 1.5, -13],
      [-46, 0.6, -31],
      [-15, 0.15, -23],
    ],
  },

  /** Climbs early and stays up: a long run on the embankment. */
  highline: {
    key: "highline",
    icon: "🌉",
    tunnelAt: 0.55,
    cuttingAt: 0.9,
    lakeAt: 0.24,
    lakeSide: 50,
    points: [
      [128, 0.40, -10],
      [116, 2.20, 16],
      [84, 4.00, 35],
      [40, 5.10, 42],
      [-4, 5.30, 35],
      [-36, 5.30, 16],
      [-48, 5.20, -10],
      [-36, 5.10, -36],
      [-4, 4.60, -55],
      [40, 3.40, -62],
      [84, 2.00, -55],
      [116, 1.00, -36],
    ],
  },
};

export const ROUTE_ORDER: RouteKey[] = ["figure8", "lakeside", "mountain", "highline"];

export const ROUTE_STORAGE_KEY = "ltb-route";
export const DEFAULT_ROUTE: RouteKey = "figure8";

export function loadRoute(): RouteKey {
  if (typeof window === "undefined") return DEFAULT_ROUTE;
  try {
    const raw = window.localStorage.getItem(ROUTE_STORAGE_KEY);
    return raw && raw in ROUTES ? (raw as RouteKey) : DEFAULT_ROUTE;
  } catch {
    return DEFAULT_ROUTE;
  }
}
