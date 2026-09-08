import { FACE_SKINS, faceMetrics, type FaceConfig } from "@/lib/face";

/**
 * Draws the face onto the smokebox door at (cx, cy) with radius r.
 * Shared by the parts thumbnails and the 2D track view so an edited face looks
 * the same everywhere.
 */
export default function FaceSvg({
  face,
  cx,
  cy,
  r,
  rim,
  withDoor = true,
}: {
  face: FaceConfig;
  cx: number;
  cy: number;
  r: number;
  /** door rim colour — usually the engine's lining colour */
  rim?: string;
  withDoor?: boolean;
}) {
  const m = faceMetrics(face);
  const ink = "#1c1c1f";
  const u = (v: number) => v * r; // fraction of the door radius → user units

  const eyeR = u(m.eyeR);
  const eyeY = cy + u(m.eyeY);
  const lidR = eyeR * m.openness;

  const eye = (sign: number, shut: boolean) => {
    const x = cx + sign * u(m.eyeX);
    if (shut) {
      return (
        <path
          key={sign}
          d={`M ${x - eyeR} ${eyeY} Q ${x} ${eyeY + eyeR * 0.9} ${x + eyeR} ${eyeY}`}
          stroke={ink}
          strokeWidth={Math.max(1.2, eyeR * 0.28)}
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    return (
      <g key={sign}>
        <ellipse
          cx={x}
          cy={eyeY}
          rx={eyeR}
          ry={lidR}
          fill="#fdfdfd"
          stroke={ink}
          strokeWidth={Math.max(0.8, eyeR * 0.16)}
        />
        <ellipse
          cx={x + eyeR * 0.12}
          cy={eyeY}
          rx={Math.min(u(m.pupilR), eyeR * 0.8)}
          ry={Math.min(u(m.pupilR), lidR * 0.9)}
          fill={ink}
        />
        {lidR > eyeR * 0.4 && (
          <circle
            cx={x + eyeR * 0.32}
            cy={eyeY - lidR * 0.35}
            r={Math.max(0.8, eyeR * 0.16)}
            fill="#fff"
          />
        )}
      </g>
    );
  };

  const brow = (sign: number) => {
    const x = cx + sign * u(m.eyeX);
    const y = cy + u(m.browY);
    const half = u(m.browLen) / 2;
    // positive angle lifts the outer end (worried), negative drops it (cross)
    const dy = half * m.browTilt * sign * -1;
    return (
      <path
        key={`b${sign}`}
        d={`M ${x - half} ${y + (sign < 0 ? -dy : dy)} L ${x + half} ${y + (sign < 0 ? dy : -dy)}`}
        stroke={ink}
        strokeWidth={u(m.browW)}
        strokeLinecap="round"
      />
    );
  };

  const mouthY = cy + u(m.mouthY);
  const mouthW = u(m.mouthW);
  const mouth =
    m.mouthOpen > 0.02 ? (
      <g>
        <ellipse
          cx={cx}
          cy={mouthY}
          rx={mouthW}
          ry={u(m.mouthOpen)}
          fill={ink}
        />
        {face.tongue && (
          <ellipse
            cx={cx}
            cy={mouthY + u(m.mouthOpen) * 0.45}
            rx={mouthW * 0.5}
            ry={u(m.mouthOpen) * 0.55}
            fill="#e8788a"
          />
        )}
      </g>
    ) : (
      <path
        d={`M ${cx - mouthW} ${mouthY} Q ${cx} ${mouthY + u(m.mouthCurve) * 2} ${cx + mouthW} ${mouthY}`}
        stroke={ink}
        strokeWidth={Math.max(1.2, r * 0.075)}
        fill="none"
        strokeLinecap="round"
      />
    );

  return (
    <g>
      {withDoor && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={FACE_SKINS[face.skin]}
          stroke={rim}
          strokeWidth={rim ? r * 0.12 : 0}
        />
      )}
      {face.blush > 0.02 &&
        [-1, 1].map((sign) => (
          <ellipse
            key={`c${sign}`}
            cx={cx + sign * u(m.eyeX + 0.28)}
            cy={cy + u(0.16)}
            rx={r * 0.17}
            ry={r * 0.11}
            fill="#e8788a"
            opacity={0.25 + face.blush * 0.55}
          />
        ))}
      {eye(-1, m.openness <= 0.12)}
      {eye(1, face.wink || m.openness <= 0.12)}
      {face.browVisible && brow(-1)}
      {face.browVisible && brow(1)}
      {mouth}
    </g>
  );
}
