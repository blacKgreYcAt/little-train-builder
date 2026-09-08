import FaceSvg from "./FaceSvg";
import {
  BODY_COLORS,
  BUFFER_STYLES,
  WHEEL_COLORS,
  type TrainConfig,
} from "@/lib/parts";

/**
 * Side view of the same 0-6-0 side-tank locomotive the 3D garage model is built
 * from: buffer beam, smokebox with the face on its door, boiler showing above
 * the side tank, cab, and spoked driving wheels joined by a coupling rod.
 * The engine faces LEFT — /track relies on that when it orients the train.
 */
const WHEEL_Y = 162;
const WHEEL_R = 27;
const AXLES = [132, 192, 252];

function SpokedWheel({ cx, cy, r, hub }: { cx: number; cy: number; r: number; hub: string }) {
  const spokes = Array.from({ length: 8 }, (_, i) => (i * 180) / 4);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1c1c1f" />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={hub} strokeWidth={r * 0.16} />
      {spokes.map((a) => (
        <line
          key={a}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos((a * Math.PI) / 180) * r * 0.72}
          y2={cy + Math.sin((a * Math.PI) / 180) * r * 0.72}
          stroke={hub}
          strokeWidth={r * 0.11}
          strokeLinecap="round"
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.2} fill={hub} stroke="#1c1c1f" strokeWidth={1.5} />
    </g>
  );
}

function Funnel({ type, dark }: { type: TrainConfig["funnel"]; dark: string }) {
  const cx = 86;
  const base = 62;
  switch (type) {
    case "tapered":
      return (
        <g>
          <path d={`M ${cx - 13} ${base} L ${cx - 5} 18 L ${cx + 5} 18 L ${cx + 13} ${base} Z`} fill={dark} stroke="#141416" strokeWidth={2} />
          <ellipse cx={cx} cy={18} rx={9} ry={3.5} fill="#141416" />
        </g>
      );
    case "stubby":
      return (
        <g>
          <rect x={cx - 17} y={38} width={34} height={26} rx={4} fill={dark} stroke="#141416" strokeWidth={2} />
          <ellipse cx={cx} cy={38} rx={20} ry={5} fill="#141416" />
        </g>
      );
    case "tall":
      return (
        <g>
          <rect x={cx - 9} y={-8} width={18} height={72} rx={2} fill={dark} stroke="#141416" strokeWidth={2} />
          <ellipse cx={cx} cy={-6} rx={14} ry={5} fill="#141416" />
        </g>
      );
    case "classic":
    default:
      return (
        <g>
          <path d={`M ${cx - 13} ${base} L ${cx - 9} 22 L ${cx + 9} 22 L ${cx + 13} ${base} Z`} fill={dark} stroke="#141416" strokeWidth={2} />
          <ellipse cx={cx} cy={21} rx={15} ry={5} fill="#141416" />
        </g>
      );
  }
}

function Tender({ config }: { config: TrainConfig }) {
  if (config.tender === "none") return null;
  const c = BODY_COLORS[config.body];
  const hub = WHEEL_COLORS[config.wheels].hub;

  return (
    <g>
      {/* drawbar */}
      <rect x={322} y={140} width={26} height={7} fill="#1c1c1f" />
      <rect x={348} y={140} width={128} height={10} rx={2} fill={c.dark} />
      <SpokedWheel cx={378} cy={166} r={21} hub={hub} />
      <SpokedWheel cx={446} cy={166} r={21} hub={hub} />

      {config.tender === "coal" && (
        <g>
          <rect x={350} y={98} width={124} height={44} rx={5} fill={c.main} stroke={c.dark} strokeWidth={2} />
          <circle cx={374} cy={96} r={14} fill="#232327" />
          <circle cx={400} cy={90} r={16} fill="#232327" />
          <circle cx={428} cy={94} r={15} fill="#232327" />
          <circle cx={454} cy={98} r={13} fill="#232327" />
        </g>
      )}

      {config.tender === "passenger" && (
        <g>
          <rect x={350} y={82} width={124} height={60} rx={7} fill={c.main} stroke={c.dark} strokeWidth={2} />
          <rect x={344} y={74} width={136} height={10} rx={4} fill="#e8e4dc" />
          {[364, 400, 436].map((x) => (
            <rect key={x} x={x} y={96} width={26} height={24} rx={4} fill="#BFE3F2" stroke={c.dark} strokeWidth={2} />
          ))}
        </g>
      )}

      {config.tender === "cargo" && (
        <g>
          <rect x={350} y={128} width={124} height={12} rx={2} fill="#8a6a4a" />
          <rect x={360} y={92} width={50} height={38} rx={4} fill="#D6432E" stroke="#9C2E1D" strokeWidth={3} />
          <rect x={416} y={100} width={46} height={30} rx={4} fill="#c8a24a" stroke="#8a6a1a" strokeWidth={3} />
        </g>
      )}
    </g>
  );
}

export default function TrainSvg({
  config,
  className,
}: {
  config: TrainConfig;
  className?: string;
}) {
  const c = BODY_COLORS[config.body];
  const hub = WHEEL_COLORS[config.wheels].hub;
  const buffer = BUFFER_STYLES[config.buffers];
  const plate = config.plate;

  return (
    <svg viewBox="0 0 520 220" className={className} role="img" aria-label="我的小火車">
      <Tender config={config} />

      {/* running plate */}
      <rect x={44} y={134} width={278} height={11} rx={2} fill={c.dark} />
      <rect x={50} y={145} width={266} height={6} fill={c.dark} opacity={0.75} />

      {/* buffer beam */}
      <rect x={40} y={118} width={12} height={34} rx={2} fill={c.trim} stroke="#1c1c1f" strokeWidth={1.5} />
      {[127, 145].map((cy) =>
        buffer.shape === "square" ? (
          <rect key={cy} x={30} y={cy - 7} width={13} height={14} rx={2} fill={buffer.color} stroke="#141416" strokeWidth={1.5} />
        ) : (
          <circle key={cy} cx={36} cy={cy} r={7.5} fill={buffer.color} stroke="#141416" strokeWidth={1.5} />
        )
      )}

      {/* cylinder block */}
      <rect x={96} y={110} width={34} height={26} rx={3} fill={c.dark} stroke="#1c1c1f" strokeWidth={1.5} />

      {/* boiler (upper part shows above the tank) */}
      <rect x={104} y={60} width={158} height={52} rx={26} fill={c.main} />
      {[140, 216].map((x) => (
        <rect key={x} x={x} y={60} width={5} height={52} fill={c.trim} opacity={0.85} />
      ))}

      {/* smokebox + door: the face plate */}
      <rect x={52} y={58} width={58} height={58} rx={29} fill="#2a2a2f" />

      {/* side tank */}
      <rect x={112} y={82} width={142} height={52} rx={5} fill={c.main} stroke={c.dark} strokeWidth={2} />
      <rect x={112} y={78} width={142} height={7} rx={3} fill={c.trim} />
      <rect x={120} y={90} width={126} height={36} rx={3} fill="none" stroke={c.trim} strokeWidth={2.5} opacity={0.85} />

      {/* dome + safety valve */}
      <ellipse cx={176} cy={58} rx={17} ry={14} fill={c.trim} stroke="#1c1c1f" strokeWidth={1.5} />
      <rect x={228} y={48} width={13} height={14} rx={3} fill="#c9a227" stroke="#8a6a1a" strokeWidth={1.5} />

      <Funnel type={config.funnel} dark={c.dark} />

      {/* cab */}
      <rect x={254} y={50} width={68} height={84} rx={5} fill={c.main} stroke={c.dark} strokeWidth={2} />
      <rect x={246} y={40} width={84} height={12} rx={4} fill={c.dark} />
      <rect x={268} y={64} width={40} height={34} rx={5} fill="#BFE3F2" stroke="#1c1c1f" strokeWidth={2} />

      {/* number plate on the side tank */}
      <g>
        <circle cx={183} cy={108} r={17} fill="#D4AF37" stroke="#8a6a1a" strokeWidth={2.5} />
        {plate === "star" ? (
          <path d="M183 98 L186.4 105.6 L194.5 106.4 L188.4 111.6 L190.4 119.5 L183 115.2 L175.6 119.5 L177.6 111.6 L171.5 106.4 L179.6 105.6 Z" fill="#5c4a10" />
        ) : plate === "heart" ? (
          <path d="M183 118 C 172 108, 175 98, 183 104 C 191 98, 194 108, 183 118 Z" fill="#5c4a10" />
        ) : (
          <text x={183} y={115} textAnchor="middle" fontSize={19} fontWeight={700} fill="#5c4a10">
            {plate}
          </text>
        )}
      </g>

      <FaceSvg face={config.face} cx={78} cy={88} r={28} rim={c.trim} />

      {/* wheels + coupling rod */}
      {AXLES.map((x) => (
        <SpokedWheel key={x} cx={x} cy={WHEEL_Y} r={WHEEL_R} hub={hub} />
      ))}
      <rect x={AXLES[0] - 8} y={WHEEL_Y + 12} width={AXLES[2] - AXLES[0] + 16} height={7} rx={3} fill="#b8b8bd" stroke="#6d6d73" strokeWidth={1.2} />
      {AXLES.map((x) => (
        <circle key={`crank-${x}`} cx={x} cy={WHEEL_Y + 15.5} r={4} fill={hub} stroke="#1c1c1f" strokeWidth={1.2} />
      ))}
    </svg>
  );
}
