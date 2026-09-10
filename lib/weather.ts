/**
 * Time of day and weather.
 *
 * Everything the look of the world depends on is gathered into one `Mood`
 * object, so the scene reads its lighting from a single place rather than
 * having day-time colours scattered through the components. The tunnel
 * darkening then works on top of whatever the mood happens to be, which is why
 * a night-time tunnel still gets darker instead of bottoming out.
 */

export type TimeKey = "day" | "dusk" | "night";
export type SkyKey = "clear" | "rain" | "snow";

export const TIME_ORDER: TimeKey[] = ["day", "dusk", "night"];
export const SKY_ORDER: SkyKey[] = ["clear", "rain", "snow"];

/** No words anywhere — a six-year-old picks these by picture. */
export const TIME_ICON: Record<TimeKey, string> = {
  day: "☀️",
  dusk: "🌆",
  night: "🌙",
};
export const SKY_ICON: Record<SkyKey, string> = {
  clear: "🌤️",
  rain: "🌧️",
  snow: "❄️",
};

export interface Mood {
  sunColour: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  skyTop: string;
  skyHorizon: string;
  fogColour: string;
  fogNear: number;
  fogFar: number;
  /** multiplied over the ground, so snow can wash the fields out */
  groundTint: string;
  cloudTint: string;
  cloudOpacity: number;
  /** 0 = no stars, 1 = full night sky */
  stars: number;
  /** the sun disc is silly at night and wrong in the rain */
  showSun: boolean;
  /**
   * Under snow the ground drops its grass texture and field colours entirely.
   * Tinting alone can't get there: a pale tint multiplied by a green texture
   * and green vertex colours is still green.
   */
  snowy: boolean;
}

const TIMES: Record<TimeKey, Mood> = {
  day: {
    sunColour: "#fff6e2",
    sunIntensity: 1.45,
    sunPosition: [70, 90, 50],
    hemiSky: "#cfeaff",
    hemiGround: "#7cc264",
    hemiIntensity: 0.9,
    skyTop: "#3f8fd6",
    skyHorizon: "#cfe6f5",
    fogColour: "#a8dcf7",
    fogNear: 150,
    fogFar: 480,
    groundTint: "#ffffff",
    cloudTint: "#ffffff",
    cloudOpacity: 0.85,
    stars: 0,
    showSun: true,
    snowy: false,
  },
  dusk: {
    // low sun coming in almost horizontally — long shadows are most of why
    // evening reads as evening
    sunColour: "#ff9a52",
    sunIntensity: 1.15,
    sunPosition: [-120, 26, 46],
    hemiSky: "#ffc79c",
    hemiGround: "#4f5340",
    hemiIntensity: 0.5,
    skyTop: "#28407e",
    skyHorizon: "#ff9c5e",
    fogColour: "#e0925f",
    fogNear: 95,
    fogFar: 400,
    groundTint: "#ffd9bc",
    cloudTint: "#ffb98a",
    cloudOpacity: 0.9,
    stars: 0.18,
    showSun: true,
    snowy: false,
  },
  night: {
    // a moon, not a sun: cold, dim, and from the other side
    sunColour: "#a9c0ee",
    sunIntensity: 0.3,
    sunPosition: [-50, 78, -62],
    hemiSky: "#2b3d61",
    hemiGround: "#18211c",
    hemiIntensity: 0.24,
    skyTop: "#050a17",
    skyHorizon: "#16233f",
    fogColour: "#0c1424",
    fogNear: 55,
    fogFar: 300,
    groundTint: "#8f9fbe",
    cloudTint: "#5a6580",
    cloudOpacity: 0.5,
    stars: 1,
    showSun: false,
    snowy: false,
  },
};

/** Mixes two hex colours; t = 0 keeps `a`. */
export function mixColour(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const out = [16, 8, 0].map((shift) => {
    const ca = (pa >> shift) & 255;
    const cb = (pb >> shift) & 255;
    return Math.round(ca + (cb - ca) * t);
  });
  return "#" + out.map((c) => c.toString(16).padStart(2, "0")).join("");
}

/**
 * Weather is applied as a modifier rather than as its own set of presets, so
 * rain at dusk still keeps the low orange sun instead of jumping to some
 * generic grey.
 */
export function moodFor(time: TimeKey, sky: SkyKey): Mood {
  const base = { ...TIMES[time] };
  if (sky === "clear") return base;

  if (sky === "rain") {
    const grey = "#6c7a86";
    return {
      ...base,
      sunColour: mixColour(base.sunColour, grey, 0.55),
      sunIntensity: base.sunIntensity * 0.62,
      hemiSky: mixColour(base.hemiSky, grey, 0.6),
      hemiGround: mixColour(base.hemiGround, "#3b4640", 0.5),
      hemiIntensity: base.hemiIntensity * 1.15,
      skyTop: mixColour(base.skyTop, "#4b5762", 0.7),
      skyHorizon: mixColour(base.skyHorizon, "#8894a0", 0.7),
      fogColour: mixColour(base.fogColour, "#7b8894", 0.7),
      // you cannot see far in rain, and that is most of the effect
      fogNear: base.fogNear * 0.4,
      fogFar: base.fogFar * 0.45,
      groundTint: mixColour(base.groundTint, "#93a3ad", 0.45),
      cloudTint: mixColour(base.cloudTint, "#555f6b", 0.75),
      cloudOpacity: 0.95,
      stars: 0,
      showSun: false,
      snowy: false,
    };
  }

  // snow
  const pale = "#dce8f2";
  return {
    ...base,
    sunColour: mixColour(base.sunColour, pale, 0.5),
    sunIntensity: base.sunIntensity * 0.72,
    hemiSky: mixColour(base.hemiSky, pale, 0.6),
    hemiGround: mixColour(base.hemiGround, "#c9d6e0", 0.75),
    hemiIntensity: base.hemiIntensity * 1.15,
    skyTop: mixColour(base.skyTop, "#9fb0bf", 0.7),
    skyHorizon: mixColour(base.skyHorizon, "#dfe8ef", 0.75),
    fogColour: mixColour(base.fogColour, "#cdd9e3", 0.75),
    fogNear: base.fogNear * 0.5,
    fogFar: base.fogFar * 0.55,
    // washes the field patchwork out — snow-dusted rather than buried, since
    // the grass texture is still underneath
    groundTint: mixColour(base.groundTint, "#e9f2f8", 0.85),
    cloudTint: mixColour(base.cloudTint, "#c3ced8", 0.7),
    cloudOpacity: 0.95,
    stars: base.stars * 0.3,
    showSun: false,
    snowy: true,
  };
}

export const WEATHER_STORAGE_KEY = "ltb-weather";

export interface WeatherChoice {
  time: TimeKey;
  sky: SkyKey;
}

export const DEFAULT_WEATHER: WeatherChoice = { time: "day", sky: "clear" };

export function loadWeather(): WeatherChoice {
  if (typeof window === "undefined") return DEFAULT_WEATHER;
  try {
    const raw = window.localStorage.getItem(WEATHER_STORAGE_KEY);
    if (!raw) return DEFAULT_WEATHER;
    const parsed = JSON.parse(raw) as Partial<WeatherChoice>;
    return {
      time: TIME_ORDER.includes(parsed.time as TimeKey) ? (parsed.time as TimeKey) : "day",
      sky: SKY_ORDER.includes(parsed.sky as SkyKey) ? (parsed.sky as SkyKey) : "clear",
    };
  } catch {
    return DEFAULT_WEATHER;
  }
}
