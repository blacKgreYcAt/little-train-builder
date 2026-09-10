/**
 * The stopping game.
 *
 * Until now the line was a sandbox: you could drive, but nothing ever asked
 * anything of you. This gives a six-year-old something to aim at — pull up
 * with the engine inside the marked box — and it does it using the steam
 * physics that were already there, so learning to shut off early and let her
 * roll is the whole skill.
 *
 * Kept as pure functions so the rules can be checked without a browser.
 */

/** Where the platforms sit, as fractions of a lap. */
export const STOP_FRACTIONS = [0.08, 0.42, 0.72];

/** How far either side of the marker still counts as a stop. */
export const ZONE = 4;
/** Below this the engine counts as standing still. */
export const STOPPED_SPEED = 0.35;

export type StopVerdict = 0 | 1 | 2 | 3;

/**
 * Stars for how close the engine came to rest to the middle of the box.
 * Generous at the edges: the point is to make a small child want another go.
 */
export function starsFor(offset: number): StopVerdict {
  const d = Math.abs(offset);
  if (d <= 1.2) return 3;
  if (d <= 2.5) return 2;
  if (d <= ZONE) return 1;
  return 0;
}

/** Distances round the lap, in track units, in order. */
export function stopDistances(routeLength: number) {
  return STOP_FRACTIONS.map((f) => f * routeLength);
}

/**
 * How far ahead the next platform is, and which one it is.
 *
 * Everything is measured going forwards round the loop, so the answer is
 * always a platform the train has yet to reach — even when it has just wrapped
 * past the end of the lap.
 */
export function nextStop(distance: number, routeLength: number) {
  const stops = stopDistances(routeLength);
  const here = ((distance % routeLength) + routeLength) % routeLength;
  let bestIndex = 0;
  let bestGap = Infinity;
  stops.forEach((s, i) => {
    const gap = (s - here + routeLength) % routeLength;
    if (gap < bestGap) {
      bestGap = gap;
      bestIndex = i;
    }
  });
  return { index: bestIndex, gap: bestGap, at: stops[bestIndex] };
}

/**
 * Signed distance from the platform: negative short of it, positive past it.
 * Wrapping is handled so a stop just over the lap boundary still reads as a
 * small number rather than a whole lap.
 */
export function offsetFromStop(distance: number, stopAt: number, routeLength: number) {
  let d = (distance - stopAt) % routeLength;
  if (d > routeLength / 2) d -= routeLength;
  if (d < -routeLength / 2) d += routeLength;
  return d;
}

/**
 * The platform the engine is closest to, ahead or behind.
 *
 * Judging needs this rather than `nextStop`: the moment the engine noses past
 * a platform, "next" flips to the one after it, and the stop being judged
 * would vanish mid-manoeuvre.
 */
export function nearestStop(distance: number, routeLength: number) {
  const stops = stopDistances(routeLength);
  let bestIndex = 0;
  let bestOffset = Infinity;
  stops.forEach((at, i) => {
    const off = offsetFromStop(distance, at, routeLength);
    if (Math.abs(off) < Math.abs(bestOffset)) {
      bestOffset = off;
      bestIndex = i;
    }
  });
  return { index: bestIndex, offset: bestOffset, at: stops[bestIndex] };
}
