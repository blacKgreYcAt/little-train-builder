import * as THREE from "three";
import { ROUTE_LENGTH, sampleRoute } from "./route";

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

/** The line runs straight through this one — see the tunnel bore in Track3D. */
export const TUNNEL_FROM = 0.285;
export const TUNNEL_TO = 0.345;
const tunnelMid = pointOnRoute((TUNNEL_FROM + TUNNEL_TO) / 2);
export const TUNNEL_HILL: Feature = {
  x: tunnelMid.x,
  z: tunnelMid.z,
  r: 34,
  h: 17,
};

/** A ridge sitting on the line, so the flattened corridor carves a cutting. */
const cuttingMid = pointOnRoute(0.62);
export const CUTTING_RIDGE: Feature = {
  x: cuttingMid.x,
  z: cuttingMid.z,
  r: 30,
  h: 8.5,
};

/** A hollow off to one side, filled with water. */
const lakeMid = pointOnRoute(0.83, 46);
export const LAKE_BASIN: Feature = { x: lakeMid.x, z: lakeMid.z, r: 34, h: -9 };
export const LAKE_LEVEL = landHeightBase(lakeMid.x, lakeMid.z) - 4.6;

const FEATURES: Feature[] = [TUNNEL_HILL, CUTTING_RIDGE, LAKE_BASIN];

/* -------------------------------------------------------------- terrain --- */

/** Natural land height, ignoring the railway but including the landmarks. */
export function landHeight(x: number, z: number) {
  let h = landHeightBase(x, z);
  for (const f of FEATURES) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r) h += f.h * fade(1 - d / f.r);
  }
  return h;
}

/** Inside the tunnel hill the ground must stay put, or there is no hill left. */
export function insideTunnelHill(x: number, z: number) {
  return Math.hypot(x - TUNNEL_HILL.x, z - TUNNEL_HILL.z) < TUNNEL_HILL.r * 0.78;
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
