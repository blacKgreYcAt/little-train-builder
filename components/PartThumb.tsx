import FaceSvg from "./FaceSvg";
import { DEFAULT_FACE, type FaceConfig } from "@/lib/face";
import {
  BODY_COLORS,
  BUFFER_STYLES,
  WHEEL_COLORS,
  type TrainConfig,
} from "@/lib/parts";

/**
 * Picture-only icons for the parts tray. The child can't read yet, so every
 * option has to be recognisable as a drawing of the actual part.
 * Drawn as SVG rather than 3D thumbnails — a WebGL context per tile would
 * flatten an iPad.
 */

type Category = keyof TrainConfig;

function Wheel({ hub, cx = 50, cy = 50, r = 34 }: { hub: string; cx?: number; cy?: number; r?: number }) {
  const spokes = Array.from({ length: 8 }, (_, i) => (i * 180) / 4);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1c1c1f" />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={hub} strokeWidth={r * 0.17} />
      {spokes.map((a) => (
        <line
          key={a}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos((a * Math.PI) / 180) * r * 0.72}
          y2={cy + Math.sin((a * Math.PI) / 180) * r * 0.72}
          stroke={hub}
          strokeWidth={r * 0.12}
          strokeLinecap="round"
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.2} fill={hub} stroke="#1c1c1f" strokeWidth={2} />
    </g>
  );
}

/** Tiny side-on engine, used for the paint swatches. */
function MiniEngine({ body }: { body: TrainConfig["body"] }) {
  const c = BODY_COLORS[body];
  return (
    <g>
      <rect x={10} y={62} width={78} height={6} rx={2} fill={c.dark} />
      <rect x={26} y={30} width={44} height={26} rx={13} fill={c.main} />
      <rect x={12} y={28} width={20} height={30} rx={15} fill="#2a2a2f" />
      <circle cx={22} cy={43} r={11} fill="#33333a" stroke={c.trim} strokeWidth={2.5} />
      <rect x={30} y={40} width={38} height={24} rx={3} fill={c.main} stroke={c.dark} strokeWidth={2} />
      <rect x={30} y={37} width={38} height={4} rx={2} fill={c.trim} />
      <rect x={68} y={22} width={22} height={34} rx={3} fill={c.main} stroke={c.dark} strokeWidth={2} />
      <rect x={64} y={18} width={30} height={5} rx={2} fill={c.dark} />
      <path d="M 20 30 L 22 12 L 32 12 L 34 30 Z" fill={c.dark} />
      <ellipse cx={27} cy={12} rx={7} ry={2.6} fill="#141416" />
      <ellipse cx={48} cy={29} rx={7} ry={5} fill={c.trim} />
      <Wheel hub={WHEEL_COLORS.black.hub} cx={34} cy={68} r={13} />
      <Wheel hub={WHEEL_COLORS.black.hub} cx={58} cy={68} r={13} />
      <Wheel hub={WHEEL_COLORS.black.hub} cx={80} cy={68} r={11} />
    </g>
  );
}

function FunnelThumb({ funnel }: { funnel: TrainConfig["funnel"] }) {
  const dark = "#274E8C";
  const base = 76;
  switch (funnel) {
    case "tapered":
      return (
        <g>
          <rect x={22} y={base} width={56} height={10} rx={3} fill="#2a2a2f" />
          <path d={`M 34 ${base} L 44 18 L 56 18 L 66 ${base} Z`} fill={dark} stroke="#141416" strokeWidth={3} />
          <ellipse cx={50} cy={18} rx={9} ry={4} fill="#141416" />
        </g>
      );
    case "stubby":
      return (
        <g>
          <rect x={22} y={base} width={56} height={10} rx={3} fill="#2a2a2f" />
          <rect x={28} y={44} width={44} height={33} rx={4} fill={dark} stroke="#141416" strokeWidth={3} />
          <ellipse cx={50} cy={44} rx={24} ry={6} fill="#141416" />
        </g>
      );
    case "tall":
      return (
        <g>
          <rect x={22} y={base} width={56} height={10} rx={3} fill="#2a2a2f" />
          <rect x={41} y={12} width={18} height={65} rx={2} fill={dark} stroke="#141416" strokeWidth={3} />
          <ellipse cx={50} cy={12} rx={13} ry={5} fill="#141416" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={22} y={base} width={56} height={10} rx={3} fill="#2a2a2f" />
          <path d={`M 33 ${base} L 39 24 L 61 24 L 67 ${base} Z`} fill={dark} stroke="#141416" strokeWidth={3} />
          <ellipse cx={50} cy={23} rx={17} ry={6} fill="#141416" />
        </g>
      );
  }
}

function BufferThumb({ buffers }: { buffers: TrainConfig["buffers"] }) {
  const { color, shape } = BUFFER_STYLES[buffers];
  return (
    <g>
      <rect x={18} y={16} width={16} height={68} rx={3} fill="#D6432E" stroke="#1c1c1f" strokeWidth={3} />
      {[34, 66].map((cy) => (
        <g key={cy}>
          <rect x={34} y={cy - 4} width={16} height={8} fill="#1c1c1f" />
          {shape === "square" ? (
            <rect x={48} y={cy - 15} width={26} height={30} rx={4} fill={color} stroke="#141416" strokeWidth={3} />
          ) : (
            <circle cx={61} cy={cy} r={15} fill={color} stroke="#141416" strokeWidth={3} />
          )}
        </g>
      ))}
    </g>
  );
}

function TenderThumb({ tender, body }: { tender: TrainConfig["tender"]; body: TrainConfig["body"] }) {
  const c = BODY_COLORS[body];
  if (tender === "none") {
    return (
      <g>
        <circle cx={50} cy={50} r={34} fill="none" stroke="#c3ccd6" strokeWidth={6} strokeDasharray="9 9" />
        <path d="M 32 68 L 68 32" stroke="#c3ccd6" strokeWidth={6} strokeLinecap="round" />
      </g>
    );
  }
  const wheels = (
    <>
      <Wheel hub={WHEEL_COLORS.black.hub} cx={34} cy={74} r={13} />
      <Wheel hub={WHEEL_COLORS.black.hub} cx={68} cy={74} r={13} />
      <rect x={16} y={62} width={70} height={8} rx={2} fill={c.dark} />
    </>
  );
  if (tender === "coal") {
    return (
      <g>
        {wheels}
        <rect x={18} y={36} width={66} height={26} rx={4} fill={c.main} stroke={c.dark} strokeWidth={3} />
        <circle cx={32} cy={34} r={10} fill="#232327" />
        <circle cx={50} cy={30} r={12} fill="#232327" />
        <circle cx={69} cy={34} r={10} fill="#232327" />
      </g>
    );
  }
  if (tender === "passenger") {
    return (
      <g>
        {wheels}
        <rect x={16} y={26} width={70} height={36} rx={5} fill={c.main} stroke={c.dark} strokeWidth={3} />
        <rect x={12} y={20} width={78} height={8} rx={3} fill="#e8e4dc" />
        {[26, 44, 62].map((x) => (
          <rect key={x} x={x} y={36} width={14} height={14} rx={3} fill="#BFE3F2" stroke={c.dark} strokeWidth={2} />
        ))}
      </g>
    );
  }
  return (
    <g>
      {wheels}
      <rect x={16} y={54} width={70} height={9} rx={2} fill="#8a6a4a" />
      <rect x={22} y={28} width={30} height={26} rx={3} fill="#D6432E" stroke="#9C2E1D" strokeWidth={3} />
      <rect x={56} y={34} width={28} height={20} rx={3} fill="#c8a24a" stroke="#8a6a1a" strokeWidth={3} />
    </g>
  );
}

function PlateThumb({ plate }: { plate: TrainConfig["plate"] }) {
  return (
    <g>
      <circle cx={50} cy={50} r={38} fill="#D4AF37" stroke="#8a6a1a" strokeWidth={5} />
      {plate === "star" ? (
        <path d="M50 24 L57 44 L78 45 L61 58 L67 78 L50 66 L33 78 L39 58 L22 45 L43 44 Z" fill="#5c4a10" />
      ) : plate === "heart" ? (
        <path d="M50 76 C 24 54, 32 28, 50 42 C 68 28, 76 54, 50 76 Z" fill="#5c4a10" />
      ) : (
        <text x={50} y={66} textAnchor="middle" fontSize={48} fontWeight={800} fill="#5c4a10">
          {plate}
        </text>
      )}
    </g>
  );
}

/** Sound can't be drawn, so the horn grows louder-looking with the pitch. */
function WhistleThumb({ whistle }: { whistle: TrainConfig["whistle"] }) {
  const waves = { friendly: 2, happy: 3, high: 1, deep: 4 }[whistle];
  const colour = { friendly: "#3E7BD6", happy: "#3FA34D", high: "#F2B705", deep: "#8A5FBF" }[whistle];
  return (
    <g>
      <path d="M 18 40 L 38 40 L 52 26 L 52 74 L 38 60 L 18 60 Z" fill={colour} stroke="#1c1c1f" strokeWidth={3} strokeLinejoin="round" />
      {Array.from({ length: waves }, (_, i) => (
        <path
          key={i}
          d={`M ${60 + i * 9} ${50 - 10 - i * 6} Q ${68 + i * 9} 50 ${60 + i * 9} ${50 + 10 + i * 6}`}
          stroke={colour}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

export default function PartThumb({
  category,
  value,
  body = "blue",
  face,
  className,
}: {
  category: Category;
  /** the option to draw; ignored for "face", which is drawn from `face` */
  value?: string;
  /** paint colour to draw body-tinted parts (the tender) in */
  body?: TrainConfig["body"];
  face?: FaceConfig;
  className?: string;
}) {
  let content: React.ReactNode = null;
  switch (category) {
    case "body":
      content = <MiniEngine body={value as TrainConfig["body"]} />;
      break;
    case "face":
      content = <FaceSvg face={face ?? DEFAULT_FACE} cx={50} cy={50} r={42} rim="#D6432E" />;
      break;
    case "funnel":
      content = <FunnelThumb funnel={value as TrainConfig["funnel"]} />;
      break;
    case "buffers":
      content = <BufferThumb buffers={value as TrainConfig["buffers"]} />;
      break;
    case "wheels":
      content = <Wheel hub={WHEEL_COLORS[value as TrainConfig["wheels"]].hub} />;
      break;
    case "tender":
      content = <TenderThumb tender={value as TrainConfig["tender"]} body={body} />;
      break;
    case "plate":
      content = <PlateThumb plate={value as TrainConfig["plate"]} />;
      break;
    case "whistle":
      content = <WhistleThumb whistle={value as TrainConfig["whistle"]} />;
      break;
  }

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden focusable="false">
      {content}
    </svg>
  );
}
