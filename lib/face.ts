/**
 * The face is fully parametric rather than a fixed set of expressions, so the
 * child can build their own. Every renderer (3D model, SVG thumbnails, the 2D
 * fallback view) draws from these same numbers.
 *
 * All 0..1 values are "how much", and the renderers map them onto sensible
 * ranges — that keeps the sliders meaningful without the UI needing units.
 */

export type FaceSkinKey =
  | "charcoal"
  | "slate"
  | "brass"
  | "warm"
  | "tan"
  | "pale";

export const FACE_SKINS: Record<FaceSkinKey, string> = {
  charcoal: "#33333a", // the traditional dark smokebox door
  slate: "#5c6773",
  brass: "#a8813f",
  warm: "#8a6047",
  tan: "#c2946b",
  pale: "#e6c6a6",
};

export const FACE_SKIN_ORDER: FaceSkinKey[] = [
  "charcoal",
  "slate",
  "brass",
  "warm",
  "tan",
  "pale",
];

export interface FaceConfig {
  skin: FaceSkinKey;
  /** eyes */
  eyeSize: number; // 0..1 small → big
  eyeSpacing: number; // 0..1 close → wide apart
  pupilSize: number; // 0..1
  eyeOpen: number; // 0..1 shut → wide awake
  wink: boolean; // one eye closed
  /** eyebrows */
  browVisible: boolean;
  browAngle: number; // -1 cross .. 0 level .. 1 worried
  browHeight: number; // 0..1 low → raised
  browThickness: number; // 0..1
  /** mouth */
  mouthCurve: number; // -1 sad .. 0 straight .. 1 big smile
  mouthWidth: number; // 0..1
  mouthOpen: number; // 0..1
  tongue: boolean;
  /** cheeks */
  blush: number; // 0..1, 0 = none
}

export const DEFAULT_FACE: FaceConfig = {
  skin: "charcoal",
  eyeSize: 0.5,
  eyeSpacing: 0.5,
  pupilSize: 0.5,
  eyeOpen: 1,
  wink: false,
  browVisible: true,
  browAngle: 0.15,
  browHeight: 0.5,
  browThickness: 0.5,
  mouthCurve: 0.75,
  mouthWidth: 0.5,
  mouthOpen: 0,
  tongue: false,
  blush: 0,
};

export type FacePresetKey =
  | "happy"
  | "sleepy"
  | "surprised"
  | "wink"
  | "determined"
  | "silly";

export const FACE_PRESETS: Record<FacePresetKey, FaceConfig> = {
  happy: { ...DEFAULT_FACE },
  sleepy: {
    ...DEFAULT_FACE,
    eyeOpen: 0.05,
    browAngle: 0.5,
    browHeight: 0.75,
    mouthCurve: 0.3,
    mouthWidth: 0.3,
  },
  surprised: {
    ...DEFAULT_FACE,
    eyeSize: 0.85,
    pupilSize: 0.35,
    browHeight: 1,
    browAngle: 0.4,
    mouthCurve: 0,
    mouthOpen: 0.8,
    mouthWidth: 0.35,
  },
  wink: {
    ...DEFAULT_FACE,
    wink: true,
    mouthCurve: 1,
    blush: 0.5,
  },
  determined: {
    ...DEFAULT_FACE,
    eyeSize: 0.6,
    browAngle: -0.9,
    browHeight: 0.2,
    browThickness: 0.8,
    mouthCurve: -0.15,
    mouthWidth: 0.6,
  },
  silly: {
    ...DEFAULT_FACE,
    wink: true,
    eyeSize: 0.7,
    browAngle: 0.6,
    browHeight: 0.8,
    mouthCurve: 0.9,
    mouthWidth: 0.6,
    mouthOpen: 0.35,
    tongue: true,
    blush: 0.7,
  },
};

export const FACE_PRESET_ORDER: FacePresetKey[] = [
  "happy",
  "sleepy",
  "surprised",
  "wink",
  "determined",
  "silly",
];

/**
 * Saved configs from before the face was editable stored it as a preset name.
 * Also repairs partial objects so a half-written config can't blank the face.
 */
export function normaliseFace(value: unknown): FaceConfig {
  if (typeof value === "string") {
    return { ...(FACE_PRESETS[value as FacePresetKey] ?? DEFAULT_FACE) };
  }
  if (value && typeof value === "object") {
    return { ...DEFAULT_FACE, ...(value as Partial<FaceConfig>) };
  }
  return { ...DEFAULT_FACE };
}

export function randomFace(): FaceConfig {
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
  const r = () => Math.random();
  return {
    skin: pick(FACE_SKIN_ORDER),
    eyeSize: 0.25 + r() * 0.7,
    eyeSpacing: 0.2 + r() * 0.7,
    pupilSize: 0.25 + r() * 0.6,
    eyeOpen: r() < 0.15 ? 0.08 : 0.6 + r() * 0.4,
    wink: r() < 0.25,
    browVisible: r() < 0.85,
    browAngle: r() * 2 - 1,
    browHeight: r(),
    browThickness: 0.25 + r() * 0.7,
    mouthCurve: r() < 0.75 ? 0.3 + r() * 0.7 : r() * 2 - 1,
    mouthWidth: 0.25 + r() * 0.6,
    mouthOpen: r() < 0.5 ? 0 : r() * 0.7,
    tongue: r() < 0.2,
    blush: r() < 0.5 ? 0 : r(),
  };
}

/* ---- shared geometry, so 2D and 3D agree on where the features sit ------ */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** All values are fractions of the smokebox-door radius. */
export function faceMetrics(f: FaceConfig) {
  const eyeR = lerp(0.14, 0.27, f.eyeSize);
  const eyeX = lerp(0.28, 0.5, f.eyeSpacing);
  const eyeY = -0.14;
  const pupilR = eyeR * lerp(0.34, 0.62, f.pupilSize);
  const openness = Math.max(0.06, f.eyeOpen);
  const browY = eyeY - eyeR * lerp(1.25, 2.4, f.browHeight);
  const browLen = eyeR * 1.95;
  const browW = lerp(0.035, 0.105, f.browThickness);
  const browTilt = f.browAngle * 0.42;
  const mouthY = 0.34;
  const mouthW = lerp(0.22, 0.56, f.mouthWidth);
  const mouthCurve = f.mouthCurve * 0.42;
  const mouthOpen = lerp(0, 0.3, f.mouthOpen);
  return {
    eyeR,
    eyeX,
    eyeY,
    pupilR,
    openness,
    browY,
    browLen,
    browW,
    browTilt,
    mouthY,
    mouthW,
    mouthCurve,
    mouthOpen,
  };
}
