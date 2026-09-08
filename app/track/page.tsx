"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Track3D, { type CameraMode } from "@/components/Track3D";
import CabOverlay from "@/components/CabOverlay";
import { playWhistle, primeAudio } from "@/lib/sound";
import { INITIAL_CONTROLS, type Controls } from "@/lib/driving";
import { DEFAULT_CONFIG, loadConfig, type TrainConfig } from "@/lib/parts";

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

  const controlsRef = useRef<Controls>({ ...INITIAL_CONTROLS });
  const speedRef = useRef(0);
  const held = useRef<{ forward: boolean; backward: boolean }>({
    forward: false,
    backward: false,
  });

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
      if (h.forward || h.backward) {
        const want = h.forward ? 1 : -1;
        // never slam it into reverse while still rolling the other way
        if (c.reverser !== want && Math.abs(speedRef.current) < 0.6) {
          c.reverser = want;
        }
        if (c.reverser === want) {
          c.regulator = Math.min(1, c.regulator + REGULATOR_RATE * dt);
          c.brake = 0;
        } else {
          c.regulator = 0;
          c.brake = 1;
        }
      } else if (cameraMode !== "cab") {
        // in the simple views, letting go shuts off and applies the brake
        c.regulator = Math.max(0, c.regulator - REGULATOR_RATE * dt);
        c.brake = 0.55;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cameraMode]);

  const press = useCallback((dir: "forward" | "backward", down: boolean) => {
    primeAudio();
    held.current[dir] = down;
    if (down) controlsRef.current.brake = 0;
  }, []);

  const honk = useCallback(() => {
    primeAudio();
    playWhistle(config.whistle);
  }, [config.whistle]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.code === "ArrowRight" || e.code === "ArrowUp") press("forward", true);
      if (e.code === "ArrowLeft" || e.code === "ArrowDown") press("backward", true);
      if (e.code === "Space") {
        e.preventDefault();
        honk();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "ArrowRight" || e.code === "ArrowUp") press("forward", false);
      if (e.code === "ArrowLeft" || e.code === "ArrowDown") press("backward", false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [press, honk]);

  const holdProps = (dir: "forward" | "backward") => ({
    onPointerDown: (e: React.PointerEvent) => {
      press(dir, true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // no active pointer to capture — the hold still works
      }
    },
    onPointerUp: () => press(dir, false),
    onPointerCancel: () => press(dir, false),
    onPointerLeave: () => press(dir, false),
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
        />
      </div>

      <div className="safe-top safe-x pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <Link
          href="/garage"
          className="ws-btn pointer-events-auto rounded px-4 py-2 text-xl active:scale-95"
          aria-label="回車庫"
        >
          🔧
        </Link>
        <div className="pointer-events-auto flex gap-2">
          {CAMERAS.map((c) => (
            <button
              key={c.mode}
              type="button"
              onClick={() => setCameraMode(c.mode)}
              aria-label={c.label}
              title={c.label}
              className={`rounded border px-4 py-2 text-xl transition active:scale-95 ${
                cameraMode === c.mode
                  ? "border-[#e63b2e] bg-[#2a1815]"
                  : "border-[#2c3d35] bg-[#16211c]"
              }`}
            >
              {c.icon}
            </button>
          ))}
        </div>
      </div>

      {/* On the footplate you drive with the real levers, so the buttons go. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {inCab && <CabOverlay config={config} controlsRef={controlsRef} />}
      </div>

      {!inCab && (
        <div className="safe-bottom safe-x pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4">
          <button
            type="button"
            {...holdProps("backward")}
            aria-label="後退"
            className="ws-btn pointer-events-auto rounded-md px-9 py-6 text-4xl active:scale-90"
          >
            ⬅️
          </button>
          <button
            type="button"
            onClick={honk}
            aria-label="鳴笛"
            className="ws-btn-red pointer-events-auto mb-1 rounded-full px-7 py-6 text-4xl active:scale-90"
          >
            📯
          </button>
          <button
            type="button"
            {...holdProps("forward")}
            aria-label="前進"
            className="ws-btn-red pointer-events-auto rounded-md px-9 py-6 text-4xl active:scale-90"
          >
            ➡️
          </button>
        </div>
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
