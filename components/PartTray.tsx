"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartThumb from "./PartThumb";
import FaceEditor from "./FaceEditor";
import type { FaceConfig } from "@/lib/face";
import { playClunk, playWhistle, primeAudio } from "@/lib/sound";
import {
  BODY_COLORS,
  BUFFER_OPTIONS,
  FUNNEL_OPTIONS,
  PLATE_OPTIONS,
  TENDER_OPTIONS,
  WHEEL_COLORS,
  WHISTLE_OPTIONS,
  type ColorKey,
  type TrainConfig,
  type WheelKey,
  type WhistleKey,
} from "@/lib/parts";

type Category = keyof TrainConfig;

const CATEGORY_ORDER: Category[] = [
  "body",
  "face",
  "funnel",
  "buffers",
  "wheels",
  "tender",
  "plate",
  "whistle",
];

const OPTIONS: Record<Category, string[]> = {
  body: Object.keys(BODY_COLORS) as ColorKey[],
  face: [], // the face gets its own editor rather than a row of tiles
  funnel: FUNNEL_OPTIONS.map((o) => o.value),
  buffers: BUFFER_OPTIONS.map((o) => o.value),
  wheels: Object.keys(WHEEL_COLORS) as WheelKey[],
  tender: TENDER_OPTIONS.map((o) => o.value),
  plate: PLATE_OPTIONS.map((o) => o.value),
  whistle: WHISTLE_OPTIONS.map((o) => o.value),
};

/** How far a finger must travel before we treat it as a drag rather than a tap. */
const DRAG_THRESHOLD = 8;

export default function PartTray({
  config,
  onChange,
  onFaceChange,
  dropZoneRef,
  onDragChange,
}: {
  config: TrainConfig;
  onChange: (category: Category, value: string) => void;
  onFaceChange: (face: FaceConfig) => void;
  /** The train preview — dropping anywhere inside it fits the part. */
  dropZoneRef: React.RefObject<HTMLElement | null>;
  onDragChange?: (state: { active: boolean; overDropZone: boolean }) => void;
}) {
  const [category, setCategory] = useState<Category>("body");
  const [dragging, setDragging] = useState<{ category: Category; value: string } | null>(null);
  const [overDrop, setOverDrop] = useState(false);

  const ghostRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ category: Category; value: string; pointerId: number } | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const movedEnough = useRef(false);
  const overDropRef = useRef(false);

  useEffect(() => {
    onDragChange?.({ active: dragging !== null, overDropZone: overDrop });
  }, [dragging, overDrop, onDragChange]);

  const apply = useCallback(
    (cat: Category, value: string) => {
      onChange(cat, value);
      playClunk();
      if (cat === "whistle") playWhistle(value as WhistleKey);
    },
    [onChange]
  );

  const isInsideDropZone = useCallback(
    (x: number, y: number) => {
      const el = dropZoneRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    },
    [dropZoneRef]
  );

  const moveGhost = useCallback((x: number, y: number) => {
    if (ghostRef.current) {
      ghostRef.current.style.transform = `translate3d(${x - 46}px, ${y - 46}px, 0)`;
    }
  }, []);

  const detach = useRef<(() => void) | null>(null);

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const held = pending.current;
      const moved = movedEnough.current;
      pending.current = null;
      movedEnough.current = false;
      detach.current?.();
      detach.current = null;
      overDropRef.current = false;
      setOverDrop(false);
      setDragging(null);
      if (!held) return;
      // A tap counts too — a six-year-old who can't complete a drag must never
      // get stuck with a part that won't fit.
      if (!moved || isInsideDropZone(clientX, clientY)) {
        apply(held.category, held.value);
      }
    },
    [apply, isInsideDropZone]
  );

  useEffect(() => () => detach.current?.(), []);

  const startDrag = (cat: Category, value: string) => (e: React.PointerEvent) => {
    primeAudio();
    if (pending.current) return; // ignore a second finger mid-drag
    pending.current = { category: cat, value, pointerId: e.pointerId };
    start.current = { x: e.clientX, y: e.clientY };
    movedEnough.current = false;
    setDragging({ category: cat, value });
    moveGhost(e.clientX, e.clientY);

    // Attached here rather than in an effect: an effect only runs after the
    // re-render, so a quick tap can release before the listeners exist.
    const onMove = (ev: PointerEvent) => {
      if (!pending.current || ev.pointerId !== pending.current.pointerId) return;
      ev.preventDefault();
      moveGhost(ev.clientX, ev.clientY);
      if (Math.hypot(ev.clientX - start.current.x, ev.clientY - start.current.y) > DRAG_THRESHOLD) {
        movedEnough.current = true;
      }
      const inside = isInsideDropZone(ev.clientX, ev.clientY);
      if (inside !== overDropRef.current) {
        overDropRef.current = inside;
        setOverDrop(inside);
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (!pending.current || ev.pointerId !== pending.current.pointerId) return;
      finishDrag(ev.clientX, ev.clientY);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    detach.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  };

  return (
    <>
      <div className="flex h-full min-h-0 gap-2">
        {/* which bin of parts — each icon is the part currently fitted */}
        <div className="no-touch-scroll flex shrink-0 flex-col gap-2 overflow-y-auto pr-1">
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              aria-label={cat}
              className={`shrink-0 rounded-2xl border-2 bg-[#1d2a24] p-1 transition active:scale-95 ${
                category === cat
                  ? "border-[#e63b2e] shadow-lg"
                  : "border-[#2c3d35] opacity-70"
              }`}
            >
              <PartThumb
                category={cat}
                value={config[cat] as string}
                body={config.body}
                face={config.face}
                className="h-11 w-11 sm:h-12 sm:w-12"
              />
            </button>
          ))}
        </div>

        {/* the face is built rather than picked, so it gets its own workshop */}
        {category === "face" ? (
          <div className="min-h-0 flex-1">
            <FaceEditor
              face={config.face}
              onChange={(next: FaceConfig) => onFaceChange(next)}
            />
          </div>
        ) : (
        <div className="no-touch-scroll min-h-0 flex-1 overflow-y-auto rounded-xl bg-[#0e1512] p-2 border border-[#2c3d35]">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {OPTIONS[category].map((value) => {
              const equipped = config[category] === value;
              return (
                <button
                  key={value}
                  type="button"
                  onPointerDown={startDrag(category, value)}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={`${category} ${value}`}
                  className={`no-touch-scroll relative aspect-square rounded-lg border-2 bg-[#1d2a24] p-1 transition active:scale-95 ${
                    equipped ? "border-[#3b8bff]" : "border-[#2c3d35]"
                  } ${
                    dragging?.category === category && dragging.value === value
                      ? "opacity-30"
                      : ""
                  }`}
                >
                  <PartThumb
                    category={category}
                    value={value}
                    body={config.body}
                    className="h-full w-full"
                  />
                  {equipped && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3b8bff] text-xs text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {/* the piece stuck to the finger */}
      {dragging && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed left-0 top-0 z-50"
          style={{ willChange: "transform" }}
        >
          <div
            className={`rounded-xl bg-[#1d2a24] border border-[#3b8bff] p-1 shadow-2xl transition-transform ${
              overDrop ? "scale-125" : "scale-100"
            }`}
          >
            <PartThumb
              category={dragging.category}
              value={dragging.value}
              body={config.body}
              className="h-20 w-20"
            />
          </div>
        </div>
      )}
    </>
  );
}
