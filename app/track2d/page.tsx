"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import TrainSvg from "@/components/TrainSvg";
import { playChuff, playWhistle, primeAudio } from "@/lib/sound";
import { DEFAULT_CONFIG, loadConfig, type TrainConfig } from "@/lib/parts";

const TRACK_PATH =
  "M 260,140 L 540,140 A 100,100 0 0 1 540,340 L 260,340 A 100,100 0 0 1 260,140 Z";

const MAX_SPEED = 240; // px/sec
const REVERSE_MAX = 130;
const ACCEL = 320;
const FRICTION = 260;
const TRAIN_W = 185;
const TRAIN_H = (TRAIN_W * 220) / 520;
// Bottom of the wheels within TrainSvg's 520x220 viewBox, so the engine stands
// on the rail instead of being centred on it.
const TRAIN_RAIL_OFFSET = (TRAIN_H * 189) / 220;

type Puff = { id: number; x: number; y: number };

export default function TrackPage() {
  const [config, setConfig] = useState<TrainConfig>(DEFAULT_CONFIG);
  const [pose, setPose] = useState({ x: 260, y: 140, angle: 180 });
  const [puffs, setPuffs] = useState<Puff[]>([]);

  const pathRef = useRef<SVGPathElement | null>(null);
  const totalLenRef = useRef(0);
  const lengthPosRef = useRef(0);
  const speedRef = useRef(0);
  const puffAccumRef = useRef(0);
  const puffIdRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const keysRef = useRef({ forward: false, backward: false });

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  useEffect(() => {
    if (pathRef.current) {
      totalLenRef.current = pathRef.current.getTotalLength();
    }

    const loop = (now: number) => {
      if (lastTimeRef.current == null) lastTimeRef.current = now;
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      const keys = keysRef.current;
      let speed = speedRef.current;
      if (keys.forward) {
        speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
      } else if (keys.backward) {
        speed = Math.max(-REVERSE_MAX, speed - ACCEL * dt);
      } else if (speed > 0) {
        speed = Math.max(0, speed - FRICTION * dt);
      } else if (speed < 0) {
        speed = Math.min(0, speed + FRICTION * dt);
      }
      speedRef.current = speed;

      const total = totalLenRef.current;
      const path = pathRef.current;
      if (total > 0 && path) {
        let len = lengthPosRef.current + speed * dt;
        len = ((len % total) + total) % total;
        lengthPosRef.current = len;

        const p = path.getPointAtLength(len);
        const ahead = path.getPointAtLength((len + 1) % total);
        const tangent = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
        const angle = tangent + (speed < 0 ? 0 : 180);
        setPose({ x: p.x, y: p.y, angle });

        puffAccumRef.current += Math.abs(speed) * dt;
        if (Math.abs(speed) > 10 && puffAccumRef.current > 24) {
          puffAccumRef.current = 0;
          puffIdRef.current += 1;
          const id = puffIdRef.current;
          setPuffs((prev) => [...prev.slice(-8), { id, x: p.x, y: p.y - 16 }]);
          playChuff(Math.min(0.45, Math.abs(speed) / 320));
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setForward = useCallback((v: boolean) => {
    primeAudio();
    keysRef.current.forward = v;
  }, []);
  const setBackward = useCallback((v: boolean) => {
    primeAudio();
    keysRef.current.backward = v;
  }, []);
  const honk = useCallback(() => {
    primeAudio();
    playWhistle(config.whistle);
  }, [config.whistle]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.code === "ArrowRight" || e.code === "ArrowUp") setForward(true);
      if (e.code === "ArrowLeft" || e.code === "ArrowDown") setBackward(true);
      if (e.code === "Space") {
        e.preventDefault();
        honk();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "ArrowRight" || e.code === "ArrowUp") setForward(false);
      if (e.code === "ArrowLeft" || e.code === "ArrowDown") setBackward(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setForward, setBackward, honk]);

  return (
    <div className="flex min-h-svh flex-1 flex-col items-center gap-4 bg-gradient-to-b from-sky-300 to-sky-100 px-4 py-4 select-none">
      <div className="flex w-full max-w-4xl items-center justify-between">
        <Link href="/garage" className="text-sky-900/80 hover:underline">
          🔧 回車庫改造
        </Link>
        <h1 className="text-xl font-extrabold text-sky-900">🛤️ 開火車囉!</h1>
        <div className="w-24" />
      </div>

      <div className="w-full max-w-4xl overflow-hidden rounded-3xl shadow-xl">
        <svg viewBox="0 0 800 480" className="w-full bg-sky-200">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8ecdf5" />
              <stop offset="100%" stopColor="#d8f0fa" />
            </linearGradient>
            <radialGradient id="steam" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x={0} y={0} width={800} height={480} fill="url(#sky)" />
          <circle cx={700} cy={70} r={40} fill="#ffe07a" />
          {[[90, 70], [180, 55], [140, 95]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx={30} ry={16} fill="#ffffff" opacity={0.85} />
          ))}

          <path d="M 0,400 Q 400,340 800,400 L 800,480 L 0,480 Z" fill="#8fd17a" />
          <path d="M 0,420 Q 400,380 800,420 L 800,480 L 0,480 Z" fill="#79c065" />

          {[[100, 400], [700, 410], [60, 440]].map(([x, y], i) => (
            <g key={i}>
              <rect x={x - 4} y={y - 6} width={8} height={22} fill="#8a6a4a" />
              <circle cx={x} cy={y - 14} r={18} fill="#4f9e4a" />
            </g>
          ))}

          <g transform="translate(640,300)">
            <rect x={-45} y={-40} width={90} height={50} rx={4} fill="#f2d9b6" stroke="#b8895a" strokeWidth={3} />
            <polygon points="-55,-40 0,-72 55,-40" fill="#c0483a" stroke="#8a2f26" strokeWidth={2} />
            <rect x={-8} y={-16} width={16} height={26} fill="#8a6a4a" />
          </g>

          <path
            d={TRACK_PATH}
            fill="none"
            stroke="#b89468"
            strokeWidth={30}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={TRACK_PATH}
            fill="none"
            stroke="#8a6a4a"
            strokeWidth={24}
            strokeLinecap="butt"
            strokeDasharray="6 9"
            opacity={0.7}
          />
          <path
            ref={pathRef}
            d={TRACK_PATH}
            fill="none"
            stroke="#3a3a3f"
            strokeWidth={2.5}
          />

          {puffs.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={10}
              fill="url(#steam)"
              className="steam-puff"
              onAnimationEnd={() => setPuffs((prev) => prev.filter((x) => x.id !== p.id))}
            />
          ))}

          <svg
            x={pose.x - TRAIN_W / 2}
            y={pose.y - TRAIN_RAIL_OFFSET}
            width={TRAIN_W}
            height={TRAIN_H}
            viewBox="0 0 520 220"
            style={{
              transform: `rotate(${pose.angle}deg)`,
              transformOrigin: `${pose.x}px ${pose.y}px`,
            }}
          >
            <TrainSvg config={config} />
          </svg>
        </svg>
      </div>

      <div className="flex w-full max-w-4xl items-center justify-center gap-4 pb-4">
        <button
          type="button"
          onPointerDown={() => setBackward(true)}
          onPointerUp={() => setBackward(false)}
          onPointerLeave={() => setBackward(false)}
          onPointerCancel={() => setBackward(false)}
          className="rounded-full bg-slate-700 px-8 py-6 text-3xl font-extrabold text-white shadow-lg active:scale-90 active:bg-slate-800"
        >
          ⬅️
        </button>
        <button
          type="button"
          onClick={honk}
          className="rounded-full bg-amber-400 px-6 py-6 text-3xl font-extrabold text-amber-950 shadow-lg active:scale-90"
        >
          📯
        </button>
        <button
          type="button"
          onPointerDown={() => setForward(true)}
          onPointerUp={() => setForward(false)}
          onPointerLeave={() => setForward(false)}
          onPointerCancel={() => setForward(false)}
          className="rounded-full bg-emerald-500 px-8 py-6 text-3xl font-extrabold text-white shadow-lg active:scale-90 active:bg-emerald-600"
        >
          ➡️
        </button>
      </div>
      <p className="pb-4 text-center text-sm text-sky-900/70">
        也可以用鍵盤:← → 開動,空白鍵鳴笛
      </p>
    </div>
  );
}
