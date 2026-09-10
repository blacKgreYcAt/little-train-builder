"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Garage3D from "@/components/Garage3D";
import PartTray from "@/components/PartTray";
import { primeAudio } from "@/lib/sound";
import type { FaceConfig } from "@/lib/face";
import {
  DEFAULT_ROUTE,
  ROUTES,
  ROUTE_ORDER,
  ROUTE_STORAGE_KEY,
  loadRoute,
  type RouteKey,
} from "@/lib/routes";
import {
  BODY_COLORS,
  DEFAULT_CONFIG,
  STORAGE_KEY,
  loadConfig,
  randomConfig,
  type TrainConfig,
} from "@/lib/parts";

/**
 * Spec-sheet numbers for the readout card. They're derived from the build so
 * every combination gets its own profile — a tall funnel breathes better, a
 * loaded tender weighs the engine down, gold buffers are pure showing off.
 */
function specsFor(c: TrainConfig) {
  const funnel = { classic: 72, tapered: 84, stubby: 58, tall: 91 }[c.funnel];
  const load = { none: 0, coal: 16, passenger: 24, cargo: 30 }[c.tender];
  const wheels = { red: 78, black: 70, gold: 88, blue: 82 }[c.wheels];
  const buffers = { roundBlack: 74, roundGold: 66, square: 86 }[c.buffers];
  return [
    { label: "速度 SPEED", value: Math.min(99, funnel + 4 - load / 4) },
    { label: "加速 ACCEL", value: Math.min(99, 96 - load) },
    { label: "過彎 CORNER", value: wheels },
    { label: "穩定 STABILITY", value: Math.min(99, buffers + load / 2) },
  ].map((s) => ({ ...s, value: Math.round(s.value) }));
}

const TAGLINES: Record<TrainConfig["body"], string> = {
  blue: "跑得快,也跑得遠。",
  green: "穩穩的,靠得住。",
  red: "有點衝,有點帥。",
  yellow: "陽光開朗的小傢伙。",
  purple: "神秘又愛耍帥。",
  black: "夜行快車,沉穩有力。",
};

export default function GaragePage() {
  const [config, setConfig] = useState<TrainConfig>(DEFAULT_CONFIG);
  const [mounted, setMounted] = useState(false);
  const [drag, setDrag] = useState({ active: false, overDropZone: false });
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [route, setRoute] = useState<RouteKey>(DEFAULT_ROUTE);

  useEffect(() => {
    setConfig(loadConfig());
    setRoute(loadRoute());
    setMounted(true);
  }, []);

  // the same key the track page reads, so the line you pick here is the one
  // you set off on
  const chooseRoute = (key: RouteKey) => {
    primeAudio();
    setRoute(key);
    try {
      window.localStorage.setItem(ROUTE_STORAGE_KEY, key);
    } catch {
      // private browsing — the choice just won't be remembered
    }
  };

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config, mounted]);

  const handleChange = useCallback((category: keyof TrainConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [category]: value }) as TrainConfig);
  }, []);
  const handleFaceChange = useCallback((face: FaceConfig) => {
    setConfig((prev) => ({ ...prev, face }));
  }, []);

  const specs = useMemo(() => specsFor(config), [config]);
  const plate = config.plate === "star" ? "★" : config.plate === "heart" ? "♥" : config.plate;

  return (
    <div className="workshop-bg no-touch-scroll fixed inset-0 flex flex-col">
      {/* ---- title bar ---- */}
      <header className="safe-top safe-x flex shrink-0 items-center justify-between border-b border-[#2c3d35] px-4 pb-2 pt-4">
        <div>
          <div className="ws-title text-2xl">
            小火車<span className="text-[#e63b2e]">工坊</span>
          </div>
          <div className="ws-label">Steam Workshop</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {ROUTE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => chooseRoute(r)}
                aria-label={r}
                title={ROUTES[r].blurb}
                className={`rounded-lg border px-2 py-1.5 text-lg transition active:scale-90 ${
                  route === r
                    ? "border-[#f4b942] bg-[#f4b942]/25"
                    : "border-[#2c3d35] bg-[#16211c] opacity-70"
                }`}
              >
                {ROUTES[r].icon}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              primeAudio();
              setConfig(randomConfig());
            }}
            aria-label="隨機組合"
            className="ws-btn rounded px-3 py-2 text-lg active:scale-95"
          >
            🎲
          </button>
          <Link href="/" aria-label="回首頁" className="ws-btn rounded px-3 py-2 text-lg active:scale-95">
            🏠
          </Link>
        </div>
      </header>

      {/* ---- model + readout ---- */}
      <div className="safe-x flex min-h-0 flex-1 gap-2 p-2">
        <div
          ref={dropZoneRef}
          className={`relative min-h-0 flex-1 overflow-hidden rounded-md border transition-all ${
            drag.overDropZone
              ? "border-[#3b8bff] ring-4 ring-[#3b8bff]/30"
              : drag.active
                ? "border-dashed border-[#e63b2e]"
                : "border-[#2c3d35]"
          }`}
        >
          <Garage3D config={config} />
          {drag.active && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-10">
              <div className="ws-panel rounded px-4 py-1 text-2xl">{drag.overDropZone ? "✨👇✨" : "👇"}</div>
            </div>
          )}
        </div>

        <aside className="ws-panel hidden w-[260px] shrink-0 flex-col rounded-md p-4 lg:flex">
          <div className="flex items-baseline justify-between">
            <span className="ws-label">{BODY_COLORS[config.body].label}小火車</span>
            <span className="ws-label">No. {plate}</span>
          </div>
          <div className="ws-title mt-1 text-3xl">
            {BODY_COLORS[config.body].label}
            <span className="text-[#e63b2e]">號</span>
          </div>
          <p className="mt-1 text-sm text-[#8fa39a]">{TAGLINES[config.body]}</p>

          <div className="mt-4 space-y-3">
            {specs.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex justify-between">
                  <span className="ws-label">{s.label}</span>
                  <span className="text-sm font-bold tabular-nums text-[#3b8bff]">{s.value}</span>
                </div>
                <div className="ws-bar">
                  <i style={{ width: `${s.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4">
            <div className="ws-label mb-2">Workshop Circuit</div>
            <Link
              href="/track"
              className="ws-btn-red block rounded-md py-4 text-center text-xl active:scale-[0.98]"
            >
              🛤️ 出發!
            </Link>
            <div className="ws-label mt-2 text-center">{ROUTES[route].blurb}</div>
          </div>
        </aside>
      </div>

      {/* ---- parts strip ---- */}
      <div className="safe-x safe-bottom h-[150px] shrink-0 border-t border-[#2c3d35] bg-[#0b100e]/85 p-2 sm:h-[172px]">
        <PartTray
          config={config}
          onChange={handleChange}
          onFaceChange={handleFaceChange}
          dropZoneRef={dropZoneRef}
          onDragChange={setDrag}
        />
      </div>

      {/* portrait gets the action button as a floating pill instead of the card */}
      <Link
        href="/track"
        className="ws-btn-red fixed bottom-[160px] right-3 rounded-full px-4 py-2 text-base shadow-lg lg:hidden sm:bottom-[182px]"
      >
        🛤️ 出發!
      </Link>
    </div>
  );
}
