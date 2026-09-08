import * as THREE from "three";
import { ROUTE_LENGTH, activeRoute, sampleRoute } from "./route";
import { ROUTES } from "./routes";

/**
 * The ground the railway runs through.
 *
 * A flat disc is what made the world look like a tablecloth — nothing to give
 * the horizon a shape and nothing for the line to cut through. This builds a
 * rolling heightfield instead, then flattens a corridor along the route so the
 * rails always sit on solid ground, which naturally carves cuttings where the
 * land is high and leaves the embankment mesh to carry it where the land is low.
 */

/* ---------------------------------------------------------------- noise --- */

function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const fade = (t: number) => t * t * (3 - 2 * t);

/** Value noise — smooth, cheap, and plenty for rolling countryside. */
function valueNoise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const zf = fade(z - zi);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi , zi + 1);
  const d = hash(xi + 1, zi + 1);
  return (
    a * (1 - xf) * (1 - zf) +
    b * xf * (1 - zf) +
    c * (1 - xf) * zf +
    d * xf * zf
  );
}

function fbm(x: number, z: number, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Rolling countryside before any named landmark is stamped into it. */
function landHeightBase(x: number, z: number) {
  const broad = (fbm(x * 0.0055, z * 0.0055, 4) - 0.5) * 15;
  const rolling = (fbm(x * 0.019, z * 0.019, 3) - 0.5) * 3.4;
  return broad + rolling;
}


/* ------------------------------------------------------- route chapters --- */

/**
 * Landmarks that give the loop some variety, positioned by sampling the route
 * so they follow it if the line is ever redrawn. Positive height raises a hill,
 * negative digs a hollow.
 */
export type Feature = { x: number; z: number; r: number; h: number };

function pointOnRoute(frac: number, sideways = 0) {
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  sampleRoute(frac * ROUTE_LENGTH, p, t);
  const lat = new THREE.Vector3(t.z, 0, -t.x).normalize();
  return { x: p.x + lat.x * sideways, y: p.y, z: p.z + lat.z * sideways };
}

/**
 * The line runs straight through this one — see the tunnel bore in Track3D.
 *
 * There is no hole in the terrain. The bore is a BackSide tube, which is
 * invisible from outside, so any stretch of it the ground fails to bury is a
 * window straight through the hill. A round hill cannot do that job: it only
 * clears the bore near its own centre, and where the line runs along an
 * embankment through low ground the crown has a long way to reach. What works
 * is a ridge that follows the line for the whole length of the bore with its
 * crown held a fixed height above the tube.
 *
 * The bore is fixed in units of track rather than as a fraction of the lap: as
 * a fraction it silently grows whenever the route is longer, outruns the
 * ridge, and the see-through comes straight back.
 */

/** Bore geometry, shared with the mesh in Track3D so the two can't drift. */
export const BORE_LIFT = 1.7;
export const BORE_RADIUS = 3.1;
/** Rock between the top of the bore and open air. */
const BORE_COVER = 2.4;
const TUNNEL_HALF = 25.5;

/** How far the ridge runs along the line, and how far out to each side. */
export const TUNNEL_HALF_LEN = 25;
const TUNNEL_LAT = 22;
/** Cheap early-out so the axis loop only runs near the tunnel. */
const TUNNEL_REACH = TUNNEL_HALF_LEN + TUNNEL_LAT;

type AxisSample = { x: number; y: number; z: number; a: number };

/* ---- everything below is rebuilt whenever the active route changes ---- */

export let TUNNEL_FROM = 0;
export let TUNNEL_TO = 0;
export let TUNNEL_HILL: Feature = { x: 0, z: 0, r: 23, h: 0 };
export let CUTTING_RIDGE: Feature = { x: 0, z: 0, r: 30, h: 8.5 };
export let LAKE_BASIN: Feature = { x: 0, z: 0, r: 34, h: -9 };
export let LAKE_LEVEL = 0;

let TUNNEL_AXIS: AxisSample[] = [];
let FEATURES: Feature[] = [];

/**
 * Recomputes the landmarks for whatever route is now active. Must be called
 * after `setActiveRoute` and before anything reads the terrain — see
 * `applyRoute` in lib/world.ts.
 */
export function rebuildChapters() {
  const def = ROUTES[activeRoute];

  TUNNEL_FROM = def.tunnelAt - TUNNEL_HALF / ROUTE_LENGTH;
  TUNNEL_TO = def.tunnelAt + TUNNEL_HALF / ROUTE_LENGTH;

  const from = TUNNEL_FROM * ROUTE_LENGTH;
  const to = TUNNEL_TO * ROUTE_LENGTH;
  const mid = (from + to) / 2;
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  TUNNEL_AXIS = [];
  for (let i = 0; i <= 48; i++) {
    const d = from + ((to - from) * i) / 48;
    sampleRoute(d, p, t);
    TUNNEL_AXIS.push({ x: p.x, y: p.y, z: p.z, a: d - mid });
  }

  const tunnelMid = pointOnRoute(def.tunnelAt);
  // `r` is where the portal masonry stands: just inside the flat top of the
  // ridge, so the ground has not started falling away before the mouth
  TUNNEL_HILL = { x: tunnelMid.x, z: tunnelMid.z, r: 23, h: 0 };

  const cuttingMid = pointOnRoute(def.cuttingAt);
  CUTTING_RIDGE = { x: cuttingMid.x, z: cuttingMid.z, r: 30, h: 8.5 };

  const lakeMid = pointOnRoute(def.lakeAt, def.lakeSide);
  LAKE_BASIN = { x: lakeMid.x, z: lakeMid.z, r: 34, h: -9 };
  LAKE_LEVEL = landHeightBase(lakeMid.x, lakeMid.z) - 4.6;

  // the tunnel is not in here — it's a ridge with a height target, applied
  // in landHeight below
  FEATURES = [CUTTING_RIDGE, LAKE_BASIN];
}

/** Where a point sits relative to the tunnel axis, and how high the ground
 *  needs to be there to bury the bore. */
function tunnelCoords(x: number, z: number) {
  let bestD = Infinity;
  let best = TUNNEL_AXIS[0];
  for (const s of TUNNEL_AXIS) {
    const d = (x - s.x) * (x - s.x) + (z - s.z) * (z - s.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return {
    along: Math.abs(best.a) / TUNNEL_HALF_LEN,
    side: Math.sqrt(bestD) / TUNNEL_LAT,
    crown: best.y + BORE_LIFT + BORE_RADIUS + BORE_COVER,
  };
}

/** 0 outside the ridge, 1 where the crown has to sit right over the bore. */
function tunnelWeight(along: number, side: number) {
  // Flat-topped along the line so cover can't sag anywhere inside the bore,
  // then dropping away sharply over the last stretch. The flat part has to
  // reach past the portals (TUNNEL_HILL.r), or the ground runs out just short
  // of the mouth and leaves a gap you can see through.
  const ends = fade(Math.max(0, Math.min(1, (1 - along) / 0.06)));
  const flanks = fade(Math.max(0, 1 - side));
  return ends * flanks;
}

/* -------------------------------------------------------------- terrain --- */

/** Natural land height, ignoring the railway but including the landmarks. */
export function landHeight(x: number, z: number) {
  let h = landHeightBase(x, z);
  for (const f of FEATURES) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r) h += f.h * fade(1 - d / f.r);
  }
  // The tunnel ridge is a height target rather than a bump added on top: it
  // has to clear the bore whatever the ground underneath happens to be doing.
  if (Math.hypot(x - TUNNEL_HILL.x, z - TUNNEL_HILL.z) < TUNNEL_REACH) {
    const { along, side, crown } = tunnelCoords(x, z);
    const w = tunnelWeight(along, side);
    if (w > 0) h += (crown - h) * w;
  }
  return h;
}

/** Inside the tunnel ridge the ground must stay put, or the corridor
 *  flattening carves the hill away and the bore is left standing in the open. */
export function insideTunnelHill(x: number, z: number) {
  if (Math.hypot(x - TUNNEL_HILL.x, z - TUNNEL_HILL.z) >= TUNNEL_REACH) return false;
  const { along, side } = tunnelCoords(x, z);
  return tunnelWeight(along, side) > 0.02;
}

export const TERRAIN_SIZE = 420;
const GRID = 190; // vertices per side
/** Rails sit dead flat within this, then the land eases back to its own shape. */
const CORRIDOR = 3.4;
const FALLOFF = 26;

/** Field colours — the patchwork is what makes it read as English countryside. */
const FIELD_COLOURS = [
  "#7bbf5c", "#6cae4e", "#8fca63", "#a8c85a",
  "#c9c463", "#d8c877", "#5fa04a", "#93bd5b",
];

type RouteSample = { x: number; y: number; z: number };

function buildRouteSamples(count = 700): RouteSample[] {
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const out: RouteSample[] = [];
  for (let i = 0; i < count; i++) {
    sampleRoute((i / count) * ROUTE_LENGTH, p, t);
    out.push({ x: p.x, y: p.y, z: p.z });
  }
  return out;
}

/**
 * Buckets the route by XZ cell so each terrain vertex only tests nearby
 * samples — otherwise it's 190x190 vertices against 700 samples every rebuild.
 */
function buildRouteLookup(samples: RouteSample[], cell: number) {
  const map = new Map<string, RouteSample[]>();
  const key = (cx: number, cz: number) => `${cx},${cz}`;
  for (const s of samples) {
    const cx = Math.floor(s.x / cell);
    const cz = Math.floor(s.z / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const k = key(cx + dx, cz + dz);
        let list = map.get(k);
        if (!list) map.set(k, (list = []));
        list.push(s);
      }
    }
  }
  return { map, cell, key };
}

export function buildTerrainGeometry() {
  const samples = buildRouteSamples();
  const lookup = buildRouteLookup(samples, FALLOFF);

  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, GRID, GRID);
  geo.rotateX(-Math.PI / 2); // into the XZ plane

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const grass = new THREE.Color("#6aa84f");

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // nearest bit of railway
    const k = lookup.key(Math.floor(x / lookup.cell), Math.floor(z / lookup.cell));
    const near = lookup.map.get(k);
    let bestD = Infinity;
    let bestY = 0;
    if (near) {
      for (const s of near) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < bestD) {
          bestD = d;
          bestY = s.y;
        }
      }
    }

    const natural = landHeight(x, z);
    let height = natural;

    if (bestD < CORRIDOR + FALLOFF && !insideTunnelHill(x, z)) {
      // Only low-lying track pulls the ground with it. Where the line is up on
      // an embankment or the bridge, the earthworks carry it and the ground
      // stays put — otherwise the terrain would fill in under the crossing.
      const lowness = Math.max(0, Math.min(1, 1 - bestY / 2.2));
      const t = Math.max(0, Math.min(1, (bestD - CORRIDOR) / FALLOFF));
      const blend = (1 - fade(t)) * lowness;
      height = natural * (1 - blend) + bestY * blend;
    }

    pos.setY(i, height);

    // patchwork fields, with the greens deepening in the hollows
    const field = Math.floor(fbm(x * 0.014 + 11, z * 0.014 + 7, 2) * FIELD_COLOURS.length);
    c.set(FIELD_COLOURS[Math.min(FIELD_COLOURS.length - 1, Math.max(0, field))]);
    c.lerp(grass, 0.25 + Math.max(0, Math.min(1, (height + 6) / 18)) * 0.2);
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Ground height including the flattened railway corridor — use this to sit
 * trees, poles and buildings on the land rather than through it.
 */
export function groundHeightNear(
  x: number,
  z: number,
  samples: RouteSample[]
): number {
  let bestD = Infinity;
  let bestY = 0;
  for (const s of samples) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bestD) {
      bestD = d;
      bestY = s.y;
    }
  }
  const natural = landHeight(x, z);
  if (bestD >= CORRIDOR + FALLOFF || insideTunnelHill(x, z)) return natural;
  const lowness = Math.max(0, Math.min(1, 1 - bestY / 2.2));
  const t = Math.max(0, Math.min(1, (bestD - CORRIDOR) / FALLOFF));
  const blend = (1 - fade(t)) * lowness;
  return natural * (1 - blend) + bestY * blend;
}

export { buildRouteSamples };
