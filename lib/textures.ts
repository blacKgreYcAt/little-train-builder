import * as THREE from "three";

/**
 * Texture loading for the scene.
 *
 * Loaded imperatively rather than through drei's `useTexture`, which suspends —
 * and a suspended child with no boundary above it blanks the whole canvas.
 * These just pop in when they arrive, which is the right trade for scenery.
 */

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

/**
 * A repeating surface texture. `rx`/`ry` are how many times it tiles across the
 * geometry's UVs, so a long thin ribbon wants ry much larger than rx.
 */
export function tiled(file: string, rx = 1, ry = rx): THREE.Texture {
  const key = `${file}|${rx}|${ry}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const tex = loader.load(`/textures/${file}`);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = THREE.SRGBColorSpace;
  // the ground is seen at a very glancing angle; without this it turns to mush
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** A plain sprite texture — no tiling, keeps its alpha. */
export function sprite(file: string): THREE.Texture {
  const key = `sprite|${file}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = loader.load(`/textures/${file}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
