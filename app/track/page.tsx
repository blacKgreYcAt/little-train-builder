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
            {...holdProps("brake")}
            aria-label="煞車"
            className="pointer-events-auto rounded-2xl bg-[#c0392b] px-10 py-7 text-5xl text-white shadow-[0_6px_0_#7a1f16] active:translate-y-1 active:shadow-[0_2px_0_#7a1f16]"
          >
            🛑
          </button>

          <div className="pointer-events-auto flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                primeAudio();
                // only swap direction once she's actually stopped
                if (Math.abs(speedRef.current) < 0.6) setReverser((r) => (r === 1 ? -1 : 1));
              }}
              aria-label={reverser === 1 ? "目前前進,點一下改後退" : "目前後退,點一下改前進"}
              className="ws-btn rounded-full px-5 py-3 text-2xl active:scale-90"
            >
              {reverser === 1 ? "⬆️" : "⬇️"}
            </button>
            <button
              type="button"
              onClick={honk}
              aria-label="鳴笛"
              className="ws-btn-red rounded-full px-7 py-5 text-4xl active:scale-90"
            >
              📯
            </button>
          </div>

          <button
            type="button"
            {...holdProps("throttle")}
            aria-label="油門"
            className="pointer-events-auto rounded-2xl bg-[#2f9e44] px-10 py-7 text-5xl text-white shadow-[0_6px_0_#1c6129] active:translate-y-1 active:shadow-[0_2px_0_#1c6129]"
          >
            ▶️
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
