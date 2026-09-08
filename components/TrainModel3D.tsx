"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BODY_COLORS, WHEEL_COLORS, type TrainConfig } from "@/lib/parts";
import { FACE_SKINS, faceMetrics, type FaceConfig } from "@/lib/face";

/**
 * Proportions follow a real British 0-6-0 side-tank steam locomotive (the kind
 * of turn-of-the-century tank engine these toy engines are all drawn from).
 * The silhouette — side tanks, round smokebox door, running plate, buffer beam,
 * spoked wheels with coupling rods — is public-domain industrial design, and it
 * is what makes the shape read as "a proper little steam engine".
 */
const WHEEL_R = 0.38;
const PLATE_Y = 0.8; // running plate (footplate) height
const BOILER_R = 0.38;
const BOILER_Y = 1.24; // boiler axis height
const SMOKEBOX_R = 0.41;
const DOOR_X = 1.485; // front face of the smokebox — where the face lives
const TANK_OUT_Z = 0.6; // outer face of the side tanks

/** Optional live speed (world units/sec) so wheels and rods turn while driving. */
export type SpeedRef = { current: number } | undefined;

function SpokedWheel({
  x,
  hub,
  z = 0.52,
  r = WHEEL_R,
  speedRef,
}: {
  x: number;
  hub: string;
  z?: number;
  r?: number;
  speedRef?: SpeedRef;
}) {
  const spin = useRef<THREE.Group>(null);
  const spokes = useMemo(
    () => Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8),
    []
  );

  useFrame((_, dt) => {
    if (spin.current && speedRef) {
      spin.current.rotation.z -= (speedRef.current * dt) / r;
    }
  });

  const wheel = (zz: number) => (
    <group key={zz} position={[0, 0, zz]}>
      {/* steel tire */}
      <mesh castShadow>
        <torusGeometry args={[r * 0.86, r * 0.15, 10, 28]} />
        <meshStandardMaterial color="#1c1c1f" roughness={0.6} />
      </mesh>
      {/* hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.22, r * 0.22, 0.14, 16]} />
        <meshStandardMaterial color={hub} roughness={0.45} metalness={0.15} />
      </mesh>
      {/* spokes */}
      {spokes.map((a) => (
        <mesh
          key={a}
          position={[Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 0]}
          rotation={[0, 0, a]}
        >
          <boxGeometry args={[r * 0.75, 0.05, 0.055]} />
          <meshStandardMaterial color={hub} roughness={0.5} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group position={[x, r, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, z * 2, 12]} />
        <meshStandardMaterial color="#26262b" />
      </mesh>
      <group ref={spin}>
        {wheel(z)}
        {wheel(-z)}
      </group>
    </group>
  );
}

/**
 * The rod hangs on the crank pins, so it doesn't rotate — it translates around
 * a small circle in step with the wheels. Same phase as the wheel rotation.
 */
function CouplingRods({
  axles,
  hub,
  speedRef,
}: {
  axles: number[];
  hub: string;
  speedRef?: SpeedRef;
}) {
  const group = useRef<THREE.Group>(null);
  const phase = useRef(-Math.PI / 2);
  const front = Math.max(...axles);
  const back = Math.min(...axles);
  const throwR = 0.2;

  useFrame((_, dt) => {
    if (!group.current) return;
    if (speedRef) phase.current -= (speedRef.current * dt) / WHEEL_R;
    group.current.position.x = Math.cos(phase.current) * throwR;
    group.current.position.y = WHEEL_R + Math.sin(phase.current) * throwR;
  });

  return (
    <group ref={group} position={[0, WHEEL_R - throwR, 0]}>
      {[0.63, -0.63].map((zz) => (
        <group key={zz}>
          <mesh position={[(front + back) / 2, 0, zz]} castShadow>
            <boxGeometry args={[front - back + 0.22, 0.085, 0.05]} />
            <meshStandardMaterial color="#b8b8bd" metalness={0.6} roughness={0.35} />
          </mesh>
          {axles.map((ax) => (
            <mesh key={ax} position={[ax, 0, zz > 0 ? zz + 0.03 : zz - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.06, 12]} />
              <meshStandardMaterial color={hub} metalness={0.3} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Funnel({ type, color }: { type: TrainConfig["funnel"]; color: string }) {
  const base = 1.58;
  const specs: Record<
    TrainConfig["funnel"],
    { top: number; bottom: number; h: number }
  > = {
    classic: { top: 0.13, bottom: 0.16, h: 0.4 },
    tapered: { top: 0.07, bottom: 0.16, h: 0.46 },
    stubby: { top: 0.19, bottom: 0.21, h: 0.24 },
    tall: { top: 0.11, bottom: 0.12, h: 0.76 },
  };
  const s = specs[type];
  return (
    <group position={[1.2, base + s.h / 2, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[s.top, s.bottom, s.h, 20]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* flared cap */}
      <mesh position={[0, s.h / 2 + 0.02, 0]} castShadow>
        <cylinderGeometry args={[s.top + 0.045, s.top + 0.02, 0.07, 20]} />
        <meshStandardMaterial color="#141416" roughness={0.45} />
      </mesh>
    </group>
  );
}

/**
 * The face sits on the flat round smokebox door, exactly where a real engine
 * carries its door. Everything is driven by the same parameters the 2D
 * renderers use, scaled by the door radius, and pushed just proud of the door
 * plane so nothing sinks into the mesh.
 */
function Face({ face }: { face: FaceConfig }) {
  const m = faceMetrics(face);
  const ink = "#1c1c1f";
  const R = SMOKEBOX_R;
  const fx = DOOR_X + 0.02;
  const u = (v: number) => v * R;

  const eyeR = u(m.eyeR);
  const eyeY = BOILER_Y + u(m.eyeY) * -1; // +y is up in 3D, -y is down in SVG
  const lid = Math.max(0.12, m.openness);

  const openEye = (z: number) => (
    <group key={z} position={[fx, eyeY, z]}>
      <mesh rotation={[0, Math.PI / 2, 0]} scale={[1, lid, 1]}>
        <sphereGeometry args={[eyeR, 18, 16]} />
        <meshStandardMaterial color="#fdfdfd" roughness={0.35} />
      </mesh>
      <mesh
        position={[eyeR * 0.55, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[1, Math.min(1, lid * 1.3), 1]}
      >
        <sphereGeometry args={[Math.min(u(m.pupilR), eyeR * 0.8), 14, 12]} />
        <meshStandardMaterial color={ink} roughness={0.3} />
      </mesh>
    </group>
  );

  const shutEye = (z: number) => (
    <mesh key={z} position={[fx + 0.02, eyeY, z]} rotation={[0, Math.PI / 2, Math.PI]}>
      <torusGeometry args={[eyeR * 0.85, Math.max(0.012, eyeR * 0.16), 8, 14, Math.PI]} />
      <meshStandardMaterial color={ink} />
    </mesh>
  );

  const brow = (z: number, sign: number) => (
    <mesh
      key={`b${z}`}
      position={[fx + 0.01, BOILER_Y - u(m.browY), z]}
      rotation={[m.browTilt * sign, 0, 0]}
    >
      <boxGeometry args={[0.03, u(m.browW), u(m.browLen)]} />
      <meshStandardMaterial color={ink} />
    </mesh>
  );

  const mouthY = BOILER_Y - u(m.mouthY);
  const mouth =
    m.mouthOpen > 0.02 ? (
      <group position={[fx + 0.01, mouthY, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]} scale={[1, u(m.mouthOpen) / u(m.mouthW), 1]}>
          <sphereGeometry args={[u(m.mouthW), 16, 12]} />
          <meshStandardMaterial color={ink} />
        </mesh>
        {face.tongue && (
          <mesh
            position={[0.03, -u(m.mouthOpen) * 0.45, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1, 0.55, 1]}
          >
            <sphereGeometry args={[u(m.mouthW) * 0.5, 12, 10]} />
            <meshStandardMaterial color="#e8788a" />
          </mesh>
        )}
      </group>
    ) : (
      <mesh
        position={[fx + 0.01, mouthY, 0]}
        rotation={[0, Math.PI / 2, m.mouthCurve >= 0 ? Math.PI : 0]}
      >
        <torusGeometry
          args={[
            u(m.mouthW),
            Math.max(0.014, R * 0.04),
            8,
            20,
            Math.PI * (0.35 + Math.abs(m.mouthCurve) * 1.1),
          ]}
        />
        <meshStandardMaterial color={ink} />
      </mesh>
    );

  const shut = m.openness <= 0.12;

  return (
    <group>
      {face.blush > 0.02 &&
        [1, -1].map((sign) => (
          <mesh
            key={`c${sign}`}
            position={[fx - 0.02, BOILER_Y - u(0.16), sign * u(m.eyeX + 0.26)]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1, 0.6, 1]}
          >
            <sphereGeometry args={[R * 0.17, 12, 10]} />
            <meshStandardMaterial
              color="#e8788a"
              transparent
              opacity={0.35 + face.blush * 0.5}
            />
          </mesh>
        ))}
      {shut ? shutEye(u(m.eyeX)) : openEye(u(m.eyeX))}
      {shut || face.wink ? shutEye(-u(m.eyeX)) : openEye(-u(m.eyeX))}
      {face.browVisible && brow(u(m.eyeX), 1)}
      {face.browVisible && brow(-u(m.eyeX), -1)}
      {mouth}
    </group>
  );
}

function usePlateTexture(label: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#D4AF37";
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#8a6a1a";
      ctx.stroke();
      ctx.fillStyle = "#5c4a10";
      ctx.font = "bold 72px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 64, 68);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, [label]);
}

/** Number plate, carried on the side tank the way real engines did. */
function PlateBadge({ plate }: { plate: string }) {
  const label = plate === "star" ? "★" : plate === "heart" ? "♥" : plate;
  const texture = usePlateTexture(label);
  return (
    <>
      <mesh position={[0.3, 1.14, TANK_OUT_Z + 0.005]}>
        <circleGeometry args={[0.17, 32]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      <mesh position={[0.3, 1.14, -TANK_OUT_Z - 0.005]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.17, 32]} />
        <meshStandardMaterial map={texture} />
      </mesh>
    </>
  );
}

function Buffers({ style }: { style: TrainConfig["buffers"] }) {
  const color = style === "roundGold" ? "#D4AF37" : "#1c1c1f";
  return (
    <>
      {[0.42, -0.42].map((z) => (
        <group key={z} position={[1.55, 0.78, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.12, 10]} />
            <meshStandardMaterial color="#1c1c1f" />
          </mesh>
          <mesh position={[0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            {style === "square" ? (
              <boxGeometry args={[0.06, 0.19, 0.19]} />
            ) : (
              <cylinderGeometry args={[0.1, 0.1, 0.06, 18]} />
            )}
            <meshStandardMaterial
              color={color}
              metalness={style === "roundGold" ? 0.45 : 0.1}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Tender({ config, speedRef }: { config: TrainConfig; speedRef?: SpeedRef }) {
  if (config.tender === "none") return null;
  const c = BODY_COLORS[config.body];
  const hub = WHEEL_COLORS[config.wheels].hub;
  const r = 0.3;

  return (
    <group position={[-2.35, 0, 0]}>
      {/* drawbar back to the engine */}
      <mesh position={[0.78, 0.62, 0]}>
        <boxGeometry args={[0.34, 0.07, 0.12]} />
        <meshStandardMaterial color="#1c1c1f" />
      </mesh>
      {/* frame */}
      <mesh position={[0, 0.66, 0]} castShadow>
        <boxGeometry args={[1.35, 0.12, 1.12]} />
        <meshStandardMaterial color={c.dark} />
      </mesh>
      <SpokedWheel x={-0.42} hub={hub} r={r} z={0.5} speedRef={speedRef} />
      <SpokedWheel x={0.42} hub={hub} r={r} z={0.5} speedRef={speedRef} />

      {config.tender === "coal" && (
        <>
          <mesh position={[0, 1.02, 0]} castShadow>
            <boxGeometry args={[1.25, 0.62, 1.05]} />
            <meshStandardMaterial color={c.main} roughness={0.5} />
          </mesh>
          {[
            [-0.36, 0.2],
            [-0.1, -0.18],
            [0.18, 0.22],
            [0.4, -0.12],
            [0.04, 0.06],
          ].map(([dx, dz], i) => (
            <mesh key={i} position={[dx, 1.36, dz]} castShadow>
              <sphereGeometry args={[0.15, 10, 10]} />
              <meshStandardMaterial color="#232327" roughness={0.95} />
            </mesh>
          ))}
        </>
      )}

      {config.tender === "passenger" && (
        <>
          <mesh position={[0, 1.15, 0]} castShadow>
            <boxGeometry args={[1.3, 0.85, 1.08]} />
            <meshStandardMaterial color={c.main} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.62, 0]} castShadow>
            <boxGeometry args={[1.36, 0.1, 1.16]} />
            <meshStandardMaterial color="#e8e4dc" />
          </mesh>
          {[-0.38, 0, 0.38].map((dx) =>
            [0.545, -0.545].map((dz) => (
              <mesh key={`${dx}-${dz}`} position={[dx, 1.22, dz]}>
                <boxGeometry args={[0.26, 0.3, 0.02]} />
                <meshStandardMaterial color="#BFE3F2" />
              </mesh>
            ))
          )}
        </>
      )}

      {config.tender === "cargo" && (
        <>
          <mesh position={[0, 0.76, 0]} castShadow>
            <boxGeometry args={[1.3, 0.1, 1.08]} />
            <meshStandardMaterial color="#8a6a4a" />
          </mesh>
          {[-0.3, 0.3].map((dx) => (
            <mesh key={dx} position={[dx, 1.0, 0]} castShadow>
              <boxGeometry args={[0.5, 0.42, 0.62]} />
              <meshStandardMaterial color={dx > 0 ? "#D6432E" : "#c8a24a"} roughness={0.7} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

export default function TrainModel3D({
  config,
  speedRef,
  bobbing = true,
}: {
  config: TrainConfig;
  /** Live speed so the wheels and coupling rods turn while driving. */
  speedRef?: SpeedRef;
  /** Gentle idle bob — nice in the garage, distracting on the rails. */
  bobbing?: boolean;
}) {
  const c = BODY_COLORS[config.body];
  const hub = WHEEL_COLORS[config.wheels].hub;
  const group = useRef<THREE.Group>(null);
  const axles = [0.72, 0.0, -0.72];

  const hasTender = config.tender !== "none";
  const bob = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    if (group.current && bobbing) {
      group.current.position.y = Math.sin(clock.elapsedTime * 1.4 + bob) * 0.018;
    }
  });

  return (
    <group ref={group} position={[hasTender ? 0.55 : 0, 0, 0]}>
      {/* running plate */}
      <mesh position={[0.15, PLATE_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.08, 1.28]} />
        <meshStandardMaterial color={c.dark} roughness={0.55} />
      </mesh>
      {/* valance under the plate edge */}
      {[0.635, -0.635].map((z) => (
        <mesh key={z} position={[0.15, PLATE_Y - 0.11, z]}>
          <boxGeometry args={[2.7, 0.14, 0.03]} />
          <meshStandardMaterial color={c.dark} roughness={0.6} />
        </mesh>
      ))}

      {/* boiler */}
      <mesh position={[0.32, BOILER_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[BOILER_R, BOILER_R, 1.28, 28]} />
        <meshStandardMaterial color={c.main} roughness={0.42} />
      </mesh>
      {/* boiler bands */}
      {[0.02, 0.68].map((x) => (
        <mesh key={x} position={[x, BOILER_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[BOILER_R + 0.012, BOILER_R + 0.012, 0.05, 28]} />
          <meshStandardMaterial color={c.trim} metalness={0.3} roughness={0.4} />
        </mesh>
      ))}

      {/* smokebox + door (the face plate) */}
      <mesh position={[1.22, BOILER_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[SMOKEBOX_R, SMOKEBOX_R, 0.53, 28]} />
        <meshStandardMaterial color="#2a2a2f" roughness={0.65} />
      </mesh>
      <mesh position={[DOOR_X, BOILER_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[SMOKEBOX_R - 0.015, 32]} />
        <meshStandardMaterial color={FACE_SKINS[config.face.skin]} roughness={0.55} />
      </mesh>
      {/* door rim — the ring must lie in the ZY plane so it circles the door */}
      <mesh position={[DOOR_X + 0.005, BOILER_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[SMOKEBOX_R - 0.03, 0.02, 8, 32]} />
        <meshStandardMaterial color={c.trim} metalness={0.35} roughness={0.4} />
      </mesh>

      {/* side tanks — the defining feature of a tank engine */}
      {[0.48, -0.48].map((z) => (
        <mesh key={z} position={[0.3, 1.12, z]} castShadow receiveShadow>
          <boxGeometry args={[1.24, 0.6, 0.24]} />
          <meshStandardMaterial color={c.main} roughness={0.45} />
        </mesh>
      ))}
      {/* tank top rails */}
      {[0.48, -0.48].map((z) => (
        <mesh key={`r${z}`} position={[0.3, 1.43, z]}>
          <boxGeometry args={[1.26, 0.04, 0.26]} />
          <meshStandardMaterial color={c.trim} roughness={0.5} />
        </mesh>
      ))}

      {/* dome + safety valve */}
      <mesh position={[0.42, 1.57, 0]} scale={[1, 0.75, 1]} castShadow>
        <sphereGeometry args={[0.17, 18, 18]} />
        <meshStandardMaterial color={c.trim} metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[-0.06, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.075, 0.14, 12]} />
        <meshStandardMaterial color="#c9a227" metalness={0.5} roughness={0.35} />
      </mesh>

      <Funnel type={config.funnel} color={c.dark} />

      {/* cab */}
      {[0.58, -0.58].map((z) => (
        <mesh key={z} position={[-0.78, 1.28, z]} castShadow>
          <boxGeometry args={[0.86, 0.92, 0.08]} />
          <meshStandardMaterial color={c.main} roughness={0.45} />
        </mesh>
      ))}
      {/* cab windows */}
      {[0.625, -0.625].map((z) => (
        <mesh key={`w${z}`} position={[-0.6, 1.52, z]}>
          <boxGeometry args={[0.32, 0.3, 0.02]} />
          <meshStandardMaterial color="#BFE3F2" roughness={0.2} />
        </mesh>
      ))}
      {/* cab back sheet */}
      <mesh position={[-1.19, 1.28, 0]} castShadow>
        <boxGeometry args={[0.08, 0.92, 1.24]} />
        <meshStandardMaterial color={c.main} roughness={0.45} />
      </mesh>
      {/* cab roof */}
      <mesh position={[-0.8, 1.79, 0]} castShadow>
        <boxGeometry args={[1.0, 0.09, 1.34]} />
        <meshStandardMaterial color={c.dark} roughness={0.5} />
      </mesh>

      {/* cylinder blocks at the front */}
      {[0.54, -0.54].map((z) => (
        <mesh key={z} position={[1.12, 0.52, z]} castShadow>
          <boxGeometry args={[0.42, 0.32, 0.26]} />
          <meshStandardMaterial color={c.dark} roughness={0.6} />
        </mesh>
      ))}

      {/* buffer beam + buffers */}
      <mesh position={[1.52, 0.76, 0]} castShadow>
        <boxGeometry args={[0.07, 0.3, 1.3]} />
        <meshStandardMaterial color={c.trim} roughness={0.5} />
      </mesh>
      <Buffers style={config.buffers} />

      <Face face={config.face} />
      <PlateBadge plate={config.plate} />

      {axles.map((x) => (
        <SpokedWheel key={x} x={x} hub={hub} speedRef={speedRef} />
      ))}
      <CouplingRods axles={axles} hub={hub} speedRef={speedRef} />

      <Tender config={config} speedRef={speedRef} />
    </group>
  );
}
