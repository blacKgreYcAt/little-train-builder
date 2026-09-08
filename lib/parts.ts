import {
  DEFAULT_FACE,
  normaliseFace,
  randomFace,
  type FaceConfig,
} from "./face";

export type ColorKey = "blue" | "green" | "red" | "yellow" | "purple" | "black";
export type FunnelKey = "classic" | "tapered" | "stubby" | "tall";
export type BufferKey = "roundBlack" | "roundGold" | "square";
export type WheelKey = "red" | "black" | "gold" | "blue";
export type TenderKey = "none" | "coal" | "passenger" | "cargo";
export type PlateKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "star" | "heart";
export type WhistleKey = "friendly" | "happy" | "high" | "deep";

export interface TrainConfig {
  body: ColorKey;
  /** Fully editable — see lib/face.ts. Older saves stored a preset name here. */
  face: FaceConfig;
  funnel: FunnelKey;
  buffers: BufferKey;
  wheels: WheelKey;
  tender: TenderKey;
  plate: PlateKey;
  whistle: WhistleKey;
}

export const DEFAULT_CONFIG: TrainConfig = {
  body: "blue",
  face: DEFAULT_FACE,
  funnel: "classic",
  buffers: "roundBlack",
  wheels: "red",
  tender: "coal",
  plate: "1",
  whistle: "friendly",
};

export const STORAGE_KEY = "ltb-train-config";

export const BODY_COLORS: Record<ColorKey, { main: string; dark: string; trim: string; label: string; swatch: string }> = {
  blue: { main: "#3E7BD6", dark: "#274E8C", trim: "#D6432E", label: "藍色", swatch: "#3E7BD6" },
  green: { main: "#3FA34D", dark: "#256B32", trim: "#22303B", label: "綠色", swatch: "#3FA34D" },
  red: { main: "#D6432E", dark: "#9C2E1D", trim: "#22303B", label: "紅色", swatch: "#D6432E" },
  yellow: { main: "#F2B705", dark: "#C99400", trim: "#D6432E", label: "黃色", swatch: "#F2B705" },
  purple: { main: "#8A5FBF", dark: "#623E92", trim: "#F2F2F2", label: "紫色", swatch: "#8A5FBF" },
  black: { main: "#33333A", dark: "#1B1B20", trim: "#3FA34D", label: "黑色", swatch: "#33333A" },
};

export const WHEEL_COLORS: Record<WheelKey, { hub: string; label: string; swatch: string }> = {
  red: { hub: "#D6432E", label: "紅色輪", swatch: "#D6432E" },
  black: { hub: "#2B2B2E", label: "黑色輪", swatch: "#2B2B2E" },
  gold: { hub: "#D4AF37", label: "金色輪", swatch: "#D4AF37" },
  blue: { hub: "#3E7BD6", label: "藍色輪", swatch: "#3E7BD6" },
};

export const BUFFER_STYLES: Record<BufferKey, { color: string; shape: "round" | "square"; label: string }> = {
  roundBlack: { color: "#2B2B2E", shape: "round", label: "黑色圓形" },
  roundGold: { color: "#D4AF37", shape: "round", label: "金色圓形" },
  square: { color: "#2B2B2E", shape: "square", label: "方形" },
};

export const FUNNEL_OPTIONS: { value: FunnelKey; label: string }[] = [
  { value: "classic", label: "經典煙囪" },
  { value: "tapered", label: "尖形煙囪" },
  { value: "stubby", label: "矮胖煙囪" },
  { value: "tall", label: "高瘦煙囪" },
];

export const BUFFER_OPTIONS: { value: BufferKey; label: string }[] = [
  { value: "roundBlack", label: "黑色圓形" },
  { value: "roundGold", label: "金色圓形" },
  { value: "square", label: "方形" },
];

export const TENDER_OPTIONS: { value: TenderKey; label: string }[] = [
  { value: "none", label: "不掛車廂" },
  { value: "coal", label: "煤水車" },
  { value: "passenger", label: "客車廂" },
  { value: "cargo", label: "貨物車" },
];

export const PLATE_OPTIONS: { value: PlateKey; label: string }[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
  { value: "7", label: "7" },
  { value: "8", label: "8" },
  { value: "9", label: "9" },
  { value: "star", label: "★" },
  { value: "heart", label: "♥" },
];

export const WHISTLE_OPTIONS: { value: WhistleKey; label: string; emoji: string }[] = [
  { value: "friendly", label: "友善長鳴", emoji: "📯" },
  { value: "happy", label: "開心雙鳴", emoji: "🎵" },
  { value: "high", label: "高音短鳴", emoji: "🔔" },
  { value: "deep", label: "低沉汽笛", emoji: "🎺" },
];

export const PART_CATEGORIES: {
  key: keyof TrainConfig;
  label: string;
  icon: string;
}[] = [
  { key: "body", label: "車身顏色", icon: "🎨" },
  { key: "face", label: "表情", icon: "😊" },
  { key: "funnel", label: "煙囪", icon: "🚂" },
  { key: "buffers", label: "緩衝器", icon: "⚪" },
  { key: "wheels", label: "車輪", icon: "⚙️" },
  { key: "tender", label: "後車廂", icon: "🚋" },
  { key: "plate", label: "號碼牌", icon: "🔢" },
  { key: "whistle", label: "汽笛聲", icon: "📯" },
];

/** Repairs a stored config: fills gaps and upgrades a legacy face preset name. */
export function normaliseConfig(raw: unknown): TrainConfig {
  const partial = (raw && typeof raw === "object" ? raw : {}) as Partial<TrainConfig>;
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    face: normaliseFace((partial as { face?: unknown }).face),
  };
}

export function loadConfig(): TrainConfig {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normaliseConfig(JSON.parse(raw)) : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function randomConfig(): TrainConfig {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return {
    body: pick(Object.keys(BODY_COLORS) as ColorKey[]),
    face: randomFace(),
    funnel: pick(FUNNEL_OPTIONS.map((f) => f.value)),
    buffers: pick(BUFFER_OPTIONS.map((f) => f.value)),
    wheels: pick(Object.keys(WHEEL_COLORS) as WheelKey[]),
    tender: pick(TENDER_OPTIONS.map((f) => f.value)),
    plate: pick(PLATE_OPTIONS.map((f) => f.value)),
    whistle: pick(WHISTLE_OPTIONS.map((f) => f.value)),
  };
}
