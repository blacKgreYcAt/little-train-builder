"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Track3D, { type CameraMode } from "@/components/Track3D";
import CabOverlay from "@/components/CabOverlay";
import { playWhistle, primeAudio } from "@/lib/sound";
import { INITIAL_CONTROLS, type Controls } from "@/lib/driving";
import { DEFAULT_CONFIG, loadConfig, type TrainConfig } from "@/lib/parts";
import {
  DEFAULT_WEATHER,
  SKY_ICON,
  SKY_ORDER,
  TIME_ICON,
  TIME_ORDER,
  WEATHER_STORAGE_KEY,
  loadWeather,
  type WeatherChoice,
} from "@/lib/weather";
import {
  DEFAULT_ROUTE,
  ROUTES,
  ROUTE_ORDER,
  ROUTE_STORAGE_KEY,
  loadRoute,
  type RouteKey,
} from "@/lib/routes";

const CAMERAS: { mode: CameraMode; label: string; icon: string }[] = [
  { mode: "chase", label: "跟著跑", icon: "🎥" },
  { mode: "cab", label: "駕駛座", icon: "👀" },
  { mode: "sky", label: "從天上看", icon: "🦅" },
];

/** How fast the simple buttons wind the regulator open and shut. */
const REGULATOR_RATE = 1.6;

export default function TrackPage() {
  const [config, setConfig] = useState<TrainConfig>(DEFAULT_CONFIG);
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  // starts on the default and picks up the saved choice after mount, so the
  // server-rendered markup and the first client render agree
  const [weather, setWeather] = useState<WeatherChoice>(DEFAULT_WEATHER);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [route, setRoute] = useState<RouteKey>(DEFAULT_ROUTE);

  useEffect(() => {
    setWeather(loadWeather());
    setRoute(loadRoute());
  }, []);

  const chooseRoute = (key: RouteKey) => {
    primeAudio();
    setRoute(key);
    try {
      window.localStorage.setItem(ROUTE_STORAGE_KEY, key);
    } catch {
      // private browsing — the choice just won't be remembered
    }
  };

  // takes a patch and updates from the previous value, so two changes in quick
  // succession can't each overwrite the other with stale state
  const chooseWeather = (patch: Partial<WeatherChoice>) => {
    primeAudio();
    setWeather((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // private browsing — the choice just won't be remembered
      }
      return next;
    });
  };

  const controlsRef = useRef<Controls>({ ...INITIAL_CONTROLS });
  const speedRef = useRef(0);
  /** What the child is holding down right now. */
  const held = useRef({ throttle: false, brake: false });
  const [reverser, setReverser] = useState<1 | -1>(1);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  /**
   * The arrow buttons don't bypass the real controls — they work the reverser
   * and regulator for you, so switching to the cab shows the engine set exactly
   * as you left it.
   */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = controlsRef.current;
      const h = held.current;
      if (cameraMode !== "cab") {
        // Throttle opens the regulator; let go and it closes again. The brake is
        // its own pedal rather than "the other arrow", which is what a child
        // actually reaches for.
        c.reverser = reverser;
        c.regulator = h.throttle
          ? Math.min(1, c.regulator + REGULATOR_RATE * dt)
          : Math.max(0, c.regulator - REGULATOR_RATE * dt * 1.6);
        c.brake = h.brake ? 1 : 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraMode, reverser]);

  const press = useCallback((which: "throttle" | "brake", down: boolean) => {
    primeAudio();
    held.current[which] = down;
  }, []);

  const honk = useCallback(() => {
    primeAudio();
    playWhistle(config.whistle);
  }, [config.whistle]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.code === "ArrowRight" || e.code === "ArrowUp") press("throttle", true);
      if (e.code === "ArrowLeft" || e.code === "ArrowDown") press("brake", true);
      if (e.code === "Space") {
        e.preventDefault();
        honk();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "ArrowRight" || e.code === "ArrowUp") press("throttle", false);
      if (e.code === "ArrowLeft" || e.code === "ArrowDown") press("brake", false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [press, honk]);

  const holdProps = (which: "throttle" | "brake") => ({
    onPointerDown: (e: React.PointerEvent) => {
      press(which, true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // no active pointer to capture — the hold still works
      }
    },
    onPointerUp: () => press(which, false),
    onPointerCancel: () => press(which, false),
    onPointerLeave: () => press(which, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const inCab = cameraMode === "cab";

  return (
    <div className="no-touch-scroll fixed inset-0 bg-[#0b100e]">
      <div className="absolute inset-0">
        <Track3D
          config={config}
          controlsRef={controlsRef}
          speedRef={speedRef}
          cameraMode={cameraMode}
          onWhistle={honk}
          weather={weather}
          route={route}
        />
      </div>

      <div className="safe-top safe-x pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <Link
          href="/garage"
          className="pointer-events-auto rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-lg backdrop-blur-sm transition active:scale-95 active:bg-black/45"
          aria-label="回車庫"
        >
          🔧
        </Link>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="天氣與時間"
            className={`rounded-lg border px-3 py-1.5 text-lg backdrop-blur-sm transition active:scale-95 ${
              pickerOpen ? "border-[#e63b2e]/80 bg-[#e63b2e]/35" : "border-white/20 bg-black/25"
            }`}
          >
            {TIME_ICON[weather.time]}
          </button>
          {CAMERAS.map((c) => (
            <button
              key={c.mode}
              type="button"
              onClick={() => setCameraMode(c.mode)}
              aria-label={c.label}
              title={c.label}
              className={`rounded-lg border px-3 py-1.5 text-lg backdrop-blur-sm transition active:scale-95 ${
                cameraMode === c.mode
                  ? "border-[#e63b2e]/80 bg-[#e63b2e]/35"
                  : "border-white/20 bg-black/25"
              }`}
            >
              {c.icon}
            </button>
          ))}
        </div>
      </div>

      {pickerOpen && (
        <div className="safe-top safe-x pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end p-3">
          {/* the offset is a margin on the panel, not padding on this wrapper:
              .safe-top sets padding-top itself and would override pt-* */}
          <div className="pointer-events-auto mt-12 flex flex-col gap-2 rounded-xl border border-white/20 bg-black/45 p-2 backdrop-blur-md">
            <div className="flex gap-2">
              {TIME_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => chooseWeather({ time: t })}
                  aria-label={t}
                  className={`h-12 w-12 rounded-lg border text-2xl transition active:scale-90 ${
                    weather.time === t
                      ? "border-[#e63b2e] bg-[#e63b2e]/30"
                      : "border-white/20 bg-black/25"
                  }`}
                >
                  {TIME_ICON[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {ROUTE_ORDER.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => chooseRoute(r)}
                  aria-label={r}
                  className={`h-12 w-12 rounded-lg border text-2xl transition active:scale-90 ${
                    route === r
                      ? "border-[#f4b942] bg-[#f4b942]/30"
                      : "border-white/20 bg-black/25"
                  }`}
                >
                  {ROUTES[r].icon}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {SKY_ORDER.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => chooseWeather({ sky: w })}
                  aria-label={w}
                  className={`h-12 w-12 rounded-lg border text-2xl transition active:scale-90 ${
                    weather.sky === w
                      ? "border-[#3b8bff] bg-[#3b8bff]/30"
                      : "border-white/20 bg-black/25"
                  }`}
                >
                  {SKY_ICON[w]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="關閉"
                className="ml-1 h-12 w-12 rounded-lg border border-white/25 bg-[#2f9e44]/50 text-2xl transition active:scale-90"
              >
                ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On the footplate you drive with the real levers, so the buttons go. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {inCab && <CabOverlay config={config} controlsRef={controlsRef} />}
      </div>

      {!inCab && (
        <>
          {/* Direction lives over on the left, away from the driving hand — it's
              set once at a standstill, not used while running. */}
          <div className="safe-bottom safe-x pointer-events-none absolute bottom-0 left-0 z-20 p-3">
            <button
              type="button"
              onClick={() => {
                primeAudio();
                // only swap direction once she's actually stopped
                if (Math.abs(speedRef.current) < 0.6) setReverser((r) => (r === 1 ? -1 : 1));
              }}
              aria-label={reverser === 1 ? "目前前進,點一下改後退" : "目前後退,點一下改前進"}
              className="pointer-events-auto rounded-full border border-white/20 bg-black/25 px-4 py-2 text-xl backdrop-blur-sm transition active:scale-90 active:bg-black/45"
            >
              {reverser === 1 ? "⬆️" : "⬇️"}
            </button>
          </div>

          {/* The driving controls sit together under the right thumb, stacked
              品-fashion: whistle up top, brake and throttle beneath. Kept small
              and see-through so they don't eat the view out of the window. */}
          <div className="safe-bottom safe-x pointer-events-none absolute bottom-0 right-0 z-20 flex flex-col items-center gap-2 p-3">
            <button
              type="button"
              onClick={honk}
              aria-label="鳴笛"
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-[#e63b2e]/35 text-2xl backdrop-blur-sm transition active:scale-90 active:bg-[#e63b2e]/70"
            >
              📯
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                {...holdProps("brake")}
                aria-label="煞車"
                className="pointer-events-auto flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/25 bg-[#c0392b]/35 text-3xl backdrop-blur-sm transition active:scale-95 active:bg-[#c0392b]/80"
              >
                🛑
              </button>
              <button
                type="button"
                {...holdProps("throttle")}
                aria-label="油門"
                className="pointer-events-auto flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-white/25 bg-[#2f9e44]/35 text-3xl backdrop-blur-sm transition active:scale-95 active:bg-[#2f9e44]/80"
              >
                ▶️
              </button>
            </div>
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-0 z-30 hidden items-center justify-center bg-[#0b100e]/95 text-center text-[#e8ede9] portrait:max-md:flex">
        <div className="px-8">
          <div className="text-6xl">📱↻</div>
          <p className="ws-title mt-4 text-3xl">把手機轉橫的<br/>來開火車!</p>
        </div>
      </div>
    </div>
  );
}
