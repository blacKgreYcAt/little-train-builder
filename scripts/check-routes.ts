/**
 * Geometry check for every selectable route. A route that fails these is one
 * the player can actually pick, so it has to hold up before it ships:
 * curves the train can run, gradients it can climb, no place the line passes
 * close to itself without the height to clear it, and a tunnel the ground
 * actually buries.
 */
import * as THREE from "three";
import { ROUTES, ROUTE_ORDER } from "../lib/routes";
import { ROUTE_LENGTH, sampleRoute } from "../lib/route";
import { applyRoute } from "../lib/world";
import { TUNNEL_FROM, TUNNEL_TO, TUNNEL_HILL, BORE_LIFT, BORE_RADIUS, landHeight, LAKE_BASIN } from "../lib/terrain";

const MIN_RADIUS = 14;
const MAX_GRADIENT = 0.11;
const MIN_CROSS_CLEARANCE = 4.8;

let failed = 0;
const a = new THREE.Vector3(), b = new THREE.Vector3();
const ta = new THREE.Vector3(), tb = new THREE.Vector3();

for (const key of ROUTE_ORDER) {
  applyRoute(key);
  const len = ROUTE_LENGTH;
  const problems: string[] = [];

  let minR = Infinity, maxGrad = 0, minY = Infinity, maxY = -Infinity;
  for (let d = 0; d < len; d += 1) {
    sampleRoute(d, a, ta);
    sampleRoute(d + 1, b, tb);
    const ang = ta.angleTo(tb);
    if (ang > 1e-6) minR = Math.min(minR, 1 / ang);
    maxGrad = Math.max(maxGrad, Math.abs(b.y - a.y));
    minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
  }
  if (minR < MIN_RADIUS) problems.push(`curve too tight: ${minR.toFixed(1)} < ${MIN_RADIUS}`);
  if (maxGrad > MAX_GRADIENT) problems.push(`too steep: ${(maxGrad * 100).toFixed(1)}%`);

  // anywhere the line comes near itself must have the height to clear
  let worst: { flat: number; dy: number } | null = null;
  for (let i = 0; i < len; i += 2) {
    sampleRoute(i, a, ta);
    for (let j = i + 40; j < len - 20; j += 2) {
      sampleRoute(j, b, tb);
      const flat = Math.hypot(a.x - b.x, a.z - b.z);
      if (flat < 7 && (!worst || flat < worst.flat)) worst = { flat, dy: Math.abs(a.y - b.y) };
    }
  }
  if (worst && worst.dy < MIN_CROSS_CLEARANCE) {
    problems.push(`line passes ${worst.flat.toFixed(1)} from itself with only ${worst.dy.toFixed(1)} of clearance`);
  }

  // the tunnel must be buried for its whole length between the portals
  const from = TUNNEL_FROM * len, to = TUNNEL_TO * len, mid = (from + to) / 2;
  let cover = 99;
  for (let i = 0; i <= 40; i++) {
    const d = from + ((to - from) * i) / 40;
    sampleRoute(d, a, ta);
    if (Math.abs(d - mid) <= TUNNEL_HILL.r) {
      cover = Math.min(cover, landHeight(a.x, a.z) - (a.y + BORE_LIFT + BORE_RADIUS));
    }
  }
  if (cover < 0) problems.push(`tunnel see-through: cover ${cover.toFixed(2)}`);

  // the lake must sit beside the line, not on it
  let lakeGap = 1e9;
  for (let d = 0; d < len; d += 2) {
    sampleRoute(d, a, ta);
    lakeGap = Math.min(lakeGap, Math.hypot(a.x - LAKE_BASIN.x, a.z - LAKE_BASIN.z));
  }
  if (lakeGap < LAKE_BASIN.r * 0.5) problems.push(`track runs into the lake (${lakeGap.toFixed(1)})`);

  let ext = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
  for (let d = 0; d < len; d += 2) {
    sampleRoute(d, a, ta);
    ext = { x0: Math.min(ext.x0, a.x), x1: Math.max(ext.x1, a.x), z0: Math.min(ext.z0, a.z), z1: Math.max(ext.z1, a.z) };
  }
  if (Math.max(-ext.x0, ext.x1, -ext.z0, ext.z1) > 175) problems.push("runs off the terrain");

  const ok = problems.length === 0;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${key.padEnd(9)} len ${len.toFixed(0).padStart(4)}  ` +
    `radius ${minR.toFixed(1).padStart(5)}  grad ${(maxGrad * 100).toFixed(1).padStart(4)}%  ` +
    `climb ${(maxY - minY).toFixed(1).padStart(4)}  cover ${cover.toFixed(2).padStart(5)}  ` +
    `cross ${worst ? worst.dy.toFixed(1) : "none"}`
  );
  for (const p of problems) console.log("        - " + p);
}

console.log(failed ? `\n${failed} route(s) failed` : "\nall routes pass");
process.exit(failed ? 1 : 0);
