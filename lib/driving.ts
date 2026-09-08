/**
 * How a real steam engine is driven, which is nothing like holding an arrow key:
 *
 *   reverser  — decides which way the wheels turn (forward / mid-gear / back)
 *   regulator — the throttle; lets steam through to the cylinders
 *   brake     — slows it down
 *
 * So to move off you set the reverser, then crack the regulator open. Closing
 * the regulator doesn't stop you — you coast until friction or the brake bites.
 *
 * The simple ⬅️➡️ buttons on the other camera modes drive these same values,
 * so the two ways of controlling the engine can't disagree.
 */
export interface Controls {
  /** 0 shut … 1 wide open */
  regulator: number;
  /** -1 back, 0 mid-gear (neutral), +1 forward */
  reverser: -1 | 0 | 1;
  /** 0 off … 1 hard on */
  brake: number;
  /** held down = feeding water into the boiler */
  injector: boolean;
  /** boiler pressure, 0..1 — drops when you use steam, recovers when you don't */
  pressure: number;
  /** water showing in the gauge glass, 0..1 */
  water: number;
}

export const INITIAL_CONTROLS: Controls = {
  regulator: 0,
  reverser: 1,
  brake: 0,
  injector: false,
  pressure: 0.86,
  water: 0.68,
};

export const MAX_SPEED = 19;
export const REVERSE_MAX = 9;
const TRACTIVE_EFFORT = 13;
const ROLLING_RESISTANCE = 3.2;
const BRAKE_FORCE = 16;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Advances speed and the boiler state by one frame.
 * Low pressure saps power but never stops the engine dead — a six-year-old
 * should never be stranded because they forgot to work the injector.
 */
export function stepDriving(c: Controls, speed: number, dt: number): number {
  const demand = c.regulator * c.reverser;
  const power = 0.55 + 0.45 * c.pressure;
  let next = speed + demand * TRACTIVE_EFFORT * power * dt;

  const resistance = (ROLLING_RESISTANCE + c.brake * BRAKE_FORCE) * dt;
  if (next > 0) next = Math.max(0, next - resistance);
  else if (next < 0) next = Math.min(0, next + resistance);

  // steam used, steam made
  if (c.regulator > 0.04) {
    c.pressure -= 0.09 * c.regulator * dt;
    c.water -= 0.016 * c.regulator * dt;
  } else {
    c.pressure += 0.055 * dt;
  }
  if (c.injector) {
    c.water += 0.09 * dt;
    c.pressure -= 0.02 * dt; // cold water knocks the pressure back a little
  }
  c.pressure = clamp(c.pressure, 0.12, 1);
  c.water = clamp(c.water, 0, 1);

  return clamp(next, -REVERSE_MAX, MAX_SPEED);
}
