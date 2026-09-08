import * as THREE from "three";
import { DEFAULT_ROUTE, ROUTES, type RouteKey } from "./routes";

/**
 * The line the train runs on.
 *
 * Which route is active can change, so `routeCurve` and `ROUTE_LENGTH` are
 * live bindings rather than frozen constants — importers see the new values
 * after `setActiveRoute`. Everything derived from them (the terrain chapters,
 * and every geometry built in a useMemo) has to be rebuilt afterwards, which
 * is what `applyRoute` in lib/world.ts exists to coordinate.
 */
function buildCurve(key: RouteKey) {
  const curve = new THREE.CatmullRomCurve3(
    ROUTES[key].points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    // centripetal avoids the overshoot/cusps a uniform spline gives on unevenly
    // spaced control points
    "centripetal",
    0.5
  );
  // Denser arc-length table => steadier speed and smoother geometry.
  curve.arcLengthDivisions = 3000;
  return curve;
}

export let activeRoute: RouteKey = DEFAULT_ROUTE;
export let routeCurve = buildCurve(DEFAULT_ROUTE);
export let ROUTE_LENGTH = routeCurve.getLength();

/** Swaps the line. Callers must rebuild the terrain chapters afterwards. */
export function setActiveRoute(key: RouteKey) {
  activeRoute = key;
  routeCurve = buildCurve(key);
  ROUTE_LENGTH = routeCurve.getLength();
}

/** Half the distance between the rails, and where the railhead sits. */
export const GAUGE = 0.72;
export const RAIL_HEIGHT = 0.2;
export const BALLAST_HALF_WIDTH = 1.55;

/** The crossing sits at the origin; used to keep the embankment off the lower track. */
export const CROSSING_CLEAR_RADIUS = 18;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

function normalise(distance: number) {
  const u = (distance % ROUTE_LENGTH) / ROUTE_LENGTH;
  return u < 0 ? u + 1 : u;
}

/** Position and heading at a distance along the route. */
export function sampleRoute(
  distance: number,
  pos: THREE.Vector3,
  tangent: THREE.Vector3
) {
  const u = normalise(distance);
  routeCurve.getPointAt(u, pos);
  routeCurve.getTangentAt(u, tangent);
}

/**
 * Basis where local +X is the direction of travel and +Y stays world-up-ish,
 * so the model pitches on gradients instead of just yawing.
 */
export function basisFromTangent(
  tangent: THREE.Vector3,
  xAxis: THREE.Vector3,
  yAxis: THREE.Vector3,
  zAxis: THREE.Vector3
) {
  xAxis.copy(tangent).normalize();
  zAxis.crossVectors(xAxis, WORLD_UP).normalize();
  yAxis.crossVectors(zAxis, xAxis).normalize();
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

export function orientationFromTangent(
  tangent: THREE.Vector3,
  target: THREE.Quaternion
) {
  basisFromTangent(tangent, _x, _y, _z);
  _m.makeBasis(_x, _y, _z);
  target.setFromRotationMatrix(_m);
}

/** Sideways direction at a point on the route (for rails, sleepers, scenery). */
export function lateralAt(tangent: THREE.Vector3, target: THREE.Vector3) {
  target.crossVectors(tangent, WORLD_UP).normalize();
  return target;
}

/** A curve parallel to the route, offset sideways — used to extrude the rails. */
export class OffsetRouteCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private offset: number, private lift: number) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const lat = new THREE.Vector3();
    sampleRoute(t * ROUTE_LENGTH, pos, tan);
    lateralAt(tan, lat);
    return target.set(
      pos.x + lat.x * this.offset,
      pos.y + this.lift,
      pos.z + lat.z * this.offset
    );
  }
}

/** A slice of the route between two distances — used to bore a tunnel along it. */
export class SubRouteCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private from: number,
    private to: number,
    private lift = 0
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const pos = new THREE.Vector3();
    const tan = new THREE.Vector3();
    sampleRoute(this.from + (this.to - this.from) * t, pos, tan);
    return target.set(pos.x, pos.y + this.lift, pos.z);
  }
}
