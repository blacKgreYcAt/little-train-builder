"use client";

import FaceSvg from "./FaceSvg";
import { playClunk, primeAudio } from "@/lib/sound";
import {
  FACE_PRESETS,
  FACE_PRESET_ORDER,
  FACE_SKINS,
  FACE_SKIN_ORDER,
  randomFace,
  type FaceConfig,
  type FaceSkinKey,
} from "@/lib/face";

/**
 * Make-your-own-face. No words anywhere: every control shows the thing it
 * changes, drawn at both ends of the slider so the direction is obvious.
 */

/**
 * Which slice of the face to show on a slider's end hints. Zoomed in on the
 * feature being changed — a whole face at thumbnail size makes "slightly bigger
 * eyes" and "slightly smaller eyes" look identical.
 */
type Focus = "eyes" | "brows" | "mouth" | "all";

const FOCUS_VIEWBOX: Record<Focus, string> = {
  eyes: "18 28 64 30",
  brows: "18 16 64 34",
  mouth: "22 50 56 32",
  all: "2 2 96 96",
};

/** The face with one parameter pushed to its extreme, cropped to that feature. */
function Hint({
  face,
  override,
  focus,
}: {
  face: FaceConfig;
  override: Partial<FaceConfig>;
  focus: Focus;
}) {
  return (
    <svg
      viewBox={FOCUS_VIEWBOX[focus]}
      className="h-10 w-10 shrink-0 rounded-md bg-[#0e1512] border border-[#2c3d35]"
      aria-hidden
      focusable="false"
    >
      <FaceSvg face={{ ...face, ...override }} cx={50} cy={50} r={44} withDoor={false} />
    </svg>
  );
}

function Slider({
  value,
  onChange,
  face,
  low,
  high,
  focus,
  min = 0,
  max = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  face: FaceConfig;
  low: Partial<FaceConfig>;
  high: Partial<FaceConfig>;
  focus: Focus;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#16211c] border border-[#2c3d35] px-2 py-1">
      <Hint face={face} override={low} focus={focus} />
      <input
        type="range"
        min={min}
        max={max}
        step={0.02}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={primeAudio}
        className="kid-range min-w-0 flex-1"
        style={{ touchAction: "none" }}
      />
      <Hint face={face} override={high} focus={focus} />
    </div>
  );
}

/** On/off control that shows the face with the feature on and off. */
function Toggle({
  on,
  onChange,
  face,
  when,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  face: FaceConfig;
  when: Partial<FaceConfig>;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        primeAudio();
        onChange(!on);
        playClunk();
      }}
      className={`rounded-lg border-2 bg-[#1d2a24] p-1 transition active:scale-95 ${
        on ? "border-[#3b8bff]" : "border-[#2c3d35] opacity-55"
      }`}
    >
      <svg viewBox="0 0 100 100" className="h-11 w-11" aria-hidden focusable="false">
        <FaceSvg face={{ ...face, ...when }} cx={50} cy={50} r={44} />
      </svg>
    </button>
  );
}

export default function FaceEditor({
  face,
  onChange,
}: {
  face: FaceConfig;
  onChange: (face: FaceConfig) => void;
}) {
  const set = <K extends keyof FaceConfig>(key: K, value: FaceConfig[K]) =>
    onChange({ ...face, [key]: value });

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto rounded-xl border border-[#2c3d35] bg-[#0e1512] p-2"
      /* the sliders below claim touch-action: none for themselves, so this only
         governs the gaps between them — which is what needs to scroll */
      style={{ touchAction: "pan-y" }}
    >
      {/* big mirror, so tiny changes are visible without hunting on the 3D model */}
      <div className="flex shrink-0 items-start gap-2">
        <svg viewBox="0 0 100 100" className="h-20 w-20 shrink-0" aria-hidden focusable="false">
          <FaceSvg face={face} cx={50} cy={50} r={46} rim="#D6432E" />
        </svg>
        <div className="flex min-w-0 flex-1 flex-wrap content-start gap-1.5">
          {FACE_PRESET_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                primeAudio();
                onChange({ ...FACE_PRESETS[key], skin: face.skin });
                playClunk();
              }}
              aria-label={key}
              className="h-14 w-14 shrink-0 rounded-lg border border-[#2c3d35] bg-[#1d2a24] p-0.5 transition active:scale-95 sm:h-16 sm:w-16"
            >
              <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden focusable="false">
                <FaceSvg face={{ ...FACE_PRESETS[key], skin: face.skin }} cx={50} cy={50} r={44} />
              </svg>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            primeAudio();
            onChange(randomFace());
            playClunk();
          }}
          aria-label="隨機臉"
          className="shrink-0 rounded-lg ws-btn px-3 py-3 text-2xl active:scale-95"
        >
          🎲
        </button>
      </div>

      {/* face colour */}
      <div className="flex gap-1.5 rounded-lg bg-[#16211c] border border-[#2c3d35] p-1.5">
        {FACE_SKIN_ORDER.map((skin: FaceSkinKey) => (
          <button
            key={skin}
            type="button"
            onClick={() => {
              primeAudio();
              set("skin", skin);
              playClunk();
            }}
            aria-label={skin}
            className={`h-9 flex-1 rounded-xl border-4 transition active:scale-90 ${
              face.skin === skin ? "border-[#e63b2e]" : "border-[#2c3d35]"
            }`}
            style={{ backgroundColor: FACE_SKINS[skin] }}
          />
        ))}
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
      {/* eyes */}
      <Slider
        face={face}
        value={face.eyeSize}
        onChange={(v) => set("eyeSize", v)}
        focus="eyes"
        low={{ eyeSize: 0 }}
        high={{ eyeSize: 1 }}
      />
      <Slider
        face={face}
        value={face.eyeSpacing}
        onChange={(v) => set("eyeSpacing", v)}
        focus="eyes"
        low={{ eyeSpacing: 0 }}
        high={{ eyeSpacing: 1 }}
      />
      <Slider
        face={face}
        value={face.pupilSize}
        onChange={(v) => set("pupilSize", v)}
        focus="eyes"
        low={{ pupilSize: 0 }}
        high={{ pupilSize: 1 }}
      />
      <Slider
        face={face}
        value={face.eyeOpen}
        onChange={(v) => set("eyeOpen", v)}
        focus="eyes"
        low={{ eyeOpen: 0 }}
        high={{ eyeOpen: 1 }}
      />

      {/* eyebrows */}
      <Slider
        face={face}
        value={face.browAngle}
        onChange={(v) => set("browAngle", v)}
        focus="brows"
        min={-1}
        low={{ browAngle: -1, browVisible: true }}
        high={{ browAngle: 1, browVisible: true }}
      />
      <Slider
        face={face}
        value={face.browHeight}
        onChange={(v) => set("browHeight", v)}
        focus="brows"
        low={{ browHeight: 0, browVisible: true }}
        high={{ browHeight: 1, browVisible: true }}
      />
      <Slider
        face={face}
        value={face.browThickness}
        onChange={(v) => set("browThickness", v)}
        focus="brows"
        low={{ browThickness: 0, browVisible: true }}
        high={{ browThickness: 1, browVisible: true }}
      />

      {/* mouth */}
      <Slider
        face={face}
        value={face.mouthCurve}
        onChange={(v) => set("mouthCurve", v)}
        focus="mouth"
        min={-1}
        low={{ mouthCurve: -1, mouthOpen: 0 }}
        high={{ mouthCurve: 1, mouthOpen: 0 }}
      />
      <Slider
        face={face}
        value={face.mouthWidth}
        onChange={(v) => set("mouthWidth", v)}
        focus="mouth"
        low={{ mouthWidth: 0 }}
        high={{ mouthWidth: 1 }}
      />
      <Slider
        face={face}
        value={face.mouthOpen}
        onChange={(v) => set("mouthOpen", v)}
        focus="mouth"
        low={{ mouthOpen: 0 }}
        high={{ mouthOpen: 1 }}
      />
      <Slider
        face={face}
        value={face.blush}
        onChange={(v) => set("blush", v)}
        focus="all"
        low={{ blush: 0 }}
        high={{ blush: 1 }}
      />

      </div>

      {/* the on/off bits */}
      <div className="flex justify-center gap-3 pb-1">
        <Toggle
          face={face}
          on={face.browVisible}
          onChange={(v) => set("browVisible", v)}
          when={{ browVisible: true }}
        />
        <Toggle
          face={face}
          on={face.wink}
          onChange={(v) => set("wink", v)}
          when={{ wink: true }}
        />
        <Toggle
          face={face}
          on={face.tongue}
          onChange={(v) => set("tongue", v)}
          when={{ tongue: true, mouthOpen: Math.max(0.4, face.mouthOpen) }}
        />
      </div>
    </div>
  );
}
