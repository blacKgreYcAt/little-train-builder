"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playClunk, playWhistle, primeAudio } from "@/lib/sound";
import type { Controls } from "@/lib/driving";
import type { TrainConfig } from "@/lib/parts";

/**
 * The footplate: a photograph of a real cab, with the forward window cut away
 * so the live 3D line runs past out there, and invisible hotspots sitting on
 * the actual levers in the picture.
 *
 * Artwork and hotspots share one SVG coordinate space, so they can't drift
 * apart on any screen shape.
 *
 * CALIBRATION
 * -----------
 * Everything below is measured against the photo at its natural size (see
 * PHOTO_W/H). If you swap the photo, that's the only block that needs redoing:
 * flip DEBUG_HOTSPOTS on, reload, and drag the numbers until the boxes sit on
 * the real controls.
 */
const CAB_PHOTO = "/cab.jpg";
const PHOTO_W = 1024;
const PHOTO_H = 559;

/** Set true to see the touch targets while lining them up with the photo. */
const DEBUG_HOTSPOTS = false;

/** The centre spectacle window — cut out so the moving line shows through. */
const WINDOW = { x: 486, y: 114, w: 252, h: 216, r: 10 };

/**
 * Each one sits on the real fitting in the photograph.
 * Keys are the SVG attribute names — spreading `w`/`h` onto a <rect> silently
 * gives you a zero-sized, untouchable target.
 */
const HOTSPOTS = {
  /** the brass lever above the REGULATOR nameplate */
  regulator: { x: 552, y: 348, width: 152, height: 104 },
  /** the round GWR reverser quadrant on the driver's side */
  reverser: { x: 710, y: 388, width: 110, height: 118 },
  /** the big FORWARD/BACKWARD screw handwheel, bottom centre */
  brake: { x: 462, y: 440, width: 166, height: 112 },
  /** brass valve handles low on the left of the backhead */
  injector: { x: 40, y: 352, width: 132, height: 126 },
  /** lever cluster just to the left of the regulator boss */
  whistle: { x: 418, y: 344, width: 125, height: 116 },
};

/** Where the fire shows through the firehole, for the glow overlay. */
const FIRE = { cx: 286, cy: 402, rx: 62, ry: 44 };

export default function CabOverlay({
  config,
  controlsRef,
}: {
  config: TrainConfig;
  controlsRef: React.RefObject<Controls>;
}) {
  const fire = useRef<SVGEllipseElement>(null);
  const detach = useRef<(() => void) | null>(null);
  const [photoBroken, setPhotoBroken] = useState(false);

  // Values live in a ref driven by the 3D frame loop, so poll them rather than
  // re-rendering React sixty times a second.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = controlsRef.current;
      if (c && fire.current) {
        // brighter when she's working hard, with a live flicker
        const flicker = 0.28 + Math.random() * 0.16 + c.regulator * 0.45;
        fire.current.setAttribute("opacity", String(Math.min(0.92, flicker)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controlsRef]);

  useEffect(() => () => detach.current?.(), []);

  /** Drag a lever: vertical finger travel maps onto its range. */
  const startDrag = useCallback(
    (kind: "regulator" | "reverser") => (e: React.PointerEvent) => {
      e.stopPropagation();
      primeAudio();
      const c = controlsRef.current;
      if (!c) return;
      const startY = e.clientY;
      const from = kind === "regulator" ? c.regulator : c.reverser;

      const move = (ev: PointerEvent) => {
        const cur = controlsRef.current;
        if (!cur) return;
        const delta = (ev.clientY - startY) / 150;
        if (kind === "regulator") {
          cur.regulator = Math.min(1, Math.max(0, from + delta));
        } else {
          const raw = from - delta * 1.8;
          const snapped = raw > 0.4 ? 1 : raw < -0.4 ? -1 : 0;
          if (snapped !== cur.reverser) {
            cur.reverser = snapped as -1 | 0 | 1;
            playClunk();
          }
        }
      };
      const up = () => {
        detach.current?.();
        detach.current = null;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      detach.current = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
    },
    [controlsRef]
  );

  const hold = (key: "brake" | "injector") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      primeAudio();
      const c = controlsRef.current;
      if (!c) return;
      if (key === "brake") c.brake = 1;
      else c.injector = true;
    },
    onPointerUp: () => {
      const c = controlsRef.current;
      if (!c) return;
      if (key === "brake") c.brake = 0;
      else c.injector = false;
    },
    onPointerLeave: () => {
      const c = controlsRef.current;
      if (!c) return;
      if (key === "brake") c.brake = 0;
      else c.injector = false;
    },
    onPointerCancel: () => {
      const c = controlsRef.current;
      if (!c) return;
      if (key === "brake") c.brake = 0;
      else c.injector = false;
    },
  });

  const debugStyle = DEBUG_HOTSPOTS
    ? { fill: "#00e5ff", fillOpacity: 0.28, stroke: "#00e5ff", strokeWidth: 3 }
    : { fill: "transparent" };

  return (
    <svg
      viewBox={`0 0 ${PHOTO_W} ${PHOTO_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id="fireGlow" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#fff1b8" />
          <stop offset="45%" stopColor="#ff9d21" />
          <stop offset="100%" stopColor="#ff6a00" stopOpacity="0" />
        </radialGradient>
        {/* opaque everywhere except the forward window */}
        <mask id="cabMask">
          <rect x="0" y="0" width={PHOTO_W} height={PHOTO_H} fill="#fff" />
          <rect
            x={WINDOW.x}
            y={WINDOW.y}
            width={WINDOW.w}
            height={WINDOW.h}
            rx={WINDOW.r}
            fill="#000"
          />
        </mask>
      </defs>

      {photoBroken ? (
        // The photo hasn't been dropped in yet — keep the cab usable rather
        // than showing a broken image.
        <g mask="url(#cabMask)">
          <rect x="0" y="0" width={PHOTO_W} height={PHOTO_H} fill="#232a25" />
          <rect x={WINDOW.x - 12} y={WINDOW.y - 12} width={WINDOW.w + 24} height={WINDOW.h + 24} rx="20" fill="#39433b" />
        </g>
      ) : (
        <image
          href={CAB_PHOTO}
          x="0"
          y="0"
          width={PHOTO_W}
          height={PHOTO_H}
          preserveAspectRatio="xMidYMid slice"
          mask="url(#cabMask)"
          onError={() => setPhotoBroken(true)}
        />
      )}

      {/* fire in the firehole, breathing with how hard she's working */}
      <ellipse
        ref={fire}
        cx={FIRE.cx}
        cy={FIRE.cy}
        rx={FIRE.rx}
        ry={FIRE.ry}
        fill="url(#fireGlow)"
        opacity="0.4"
        style={{ mixBlendMode: "screen" }}
      />

      {/* ---------- the only interactive bits ---------- */}
      <g className="pointer-events-auto" style={{ touchAction: "none" }}>
        <rect
          {...HOTSPOTS.regulator}
          {...debugStyle}
          rx="12"
          aria-label="調速桿"
          onPointerDown={startDrag("regulator")}
        />
        <rect
          {...HOTSPOTS.reverser}
          {...debugStyle}
          rx="12"
          aria-label="換向桿"
          onPointerDown={startDrag("reverser")}
        />
        <rect {...HOTSPOTS.brake} {...debugStyle} rx="12" aria-label="煞車" {...hold("brake")} />
        <rect
          {...HOTSPOTS.injector}
          {...debugStyle}
          rx="12"
          aria-label="注水器"
          {...hold("injector")}
        />
        <rect
          {...HOTSPOTS.whistle}
          {...debugStyle}
          rx="12"
          aria-label="汽笛"
          onPointerDown={(e) => {
            e.stopPropagation();
            primeAudio();
            playWhistle(config.whistle);
          }}
        />
      </g>
    </svg>
  );
}
