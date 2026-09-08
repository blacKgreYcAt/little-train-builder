"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import TrainModel3D from "./TrainModel3D";
import { playChuff } from "@/lib/sound";
import { stepDriving, type Controls } from "@/lib/driving";
import { sprite, tiled } from "@/lib/textures";
import {
  BALLAST_HALF_WIDTH,
  CROSSING_CLEAR_RADIUS,
  GAUGE,
  OffsetRouteCurve,
  SubRouteCurve,
  RAIL_HEIGHT,
  ROUTE_LENGTH,
  lateralAt,
  orientationFromTangent,
  sampleRoute,
} from "@/lib/route";
import {
  LAKE_BASIN,
  LAKE_LEVEL,
  TUNNEL_FROM,
  TUNNEL_HILL,
  TUNNEL_TO,
  buildRouteSamples,
  buildTerrainGeometry,
  groundHeightNear,
  landHeight,
  BORE_LIFT,
  BORE_RADIUS,
} from "@/lib/terrain";
import type { TrainConfig } from "@/lib/parts";
import { moodFor, type Mood, type SkyKey, type WeatherChoice } from "@/lib/weather";

/* ------------------------------------------------------------ track bed --- */

/** Flat ribbon following the route — the ballast the sleepers sit on. */
function ballastGeometry(halfWidth: number, lift: number, segments: number) {
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const lat = new THREE.Vector3();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const dist = (i / segments) * ROUTE_LENGTH;
    sampleRoute(dist, p, tan);
    lateralAt(tan, lat);
    positions.push(p.x + lat.x * halfWidth, p.y + lift, p.z + lat.z * halfWidth);
    positions.push(p.x - lat.x * halfWidth, p.y + lift, p.z - lat.z * halfWidth);
    // v runs with the rails so the stones don't stretch down the straights
    const v = dist / 2.2;
    uvs.push(0, v, 1, v);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Earth banking from the raised track down to ground level, so the climb
 * doesn't look like floating track. Skipped near the crossing, where the line
 * has to be a bridge with clear space underneath.
 */
function embankmentGeometry(side: 1 | -1, segments: number) {
  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const lat = new THREE.Vector3();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let strip: number[] = [];
  let stripUv: number[] = [];

  const flush = () => {
    if (strip.length >= 4) {
      const base = positions.length / 3;
      for (const v of strip) positions.push(v);
      for (const v of stripUv) uvs.push(v);
      const quads = strip.length / 6 - 1;
      for (let i = 0; i < quads; i++) {
        const a = base + i * 2;
        // The two banks mirror each other, so one needs the opposite winding or
        // its normals end up facing into the hill and it renders black.
        if (side === 1) {
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        } else {
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    strip = [];
    stripUv = [];
  };

  for (let i = 0; i <= segments; i++) {
    sampleRoute((i / segments) * ROUTE_LENGTH, p, tan);
    const overCrossing = Math.hypot(p.x, p.z) < CROSSING_CLEAR_RADIUS;
    if (p.y < 0.35 || overCrossing) {
      flush();
      continue;
    }
    lateralAt(tan, lat);
    const topX = p.x + lat.x * BALLAST_HALF_WIDTH * side;
    const topZ = p.z + lat.z * BALLAST_HALF_WIDTH * side;
    // splay the foot outward so it reads as a bank of earth
    const splay = 0.55 + p.y * 0.75;
    const footX = topX + lat.x * splay * side;
    const footZ = topZ + lat.z * splay * side;
    strip.push(topX, p.y + 0.02, topZ);
    // sink the foot into the rolling ground rather than stopping at y=0,
    // otherwise the bank reads as a slab standing on the landscape
    strip.push(footX, landHeight(footX, footZ) - 0.9, footZ);
    const v = ((i / segments) * ROUTE_LENGTH) / 6;
    stripUv.push(0, v, 1, v);
  }
  flush();

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function Bridge() {
  // Spans the gap the embankment leaves open, carrying the upper line over the
  // lower one. Sampled from the route so the deck lines up with the rails.
  const { deck, piers } = useMemo(() => {
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const segments = 900;
    const spans: { pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
    for (let i = 0; i < segments; i++) {
      sampleRoute((i / segments) * ROUTE_LENGTH, p, tan);
      if (p.y > 1 && Math.hypot(p.x, p.z) < CROSSING_CLEAR_RADIUS + 1.5) {
        orientationFromTangent(tan, q);
        spans.push({ pos: p.clone(), quat: q.clone() });
      }
    }
    const step = Math.max(1, Math.floor(spans.length / 26));
    const deck = spans.filter((_, i) => i % step === 0);
    // Piers only at the two abutments. Anything nearer the middle would land on
    // the lower line the bridge is supposed to clear.
    const piers = spans.length
      ? [spans[Math.floor(spans.length * 0.1)], spans[Math.floor(spans.length * 0.9)]]
      : [];
    return { deck, piers };
  }, []);

  return (
    <group>
      {deck.map((d, i) => (
        <group key={`d${i}`} position={d.pos} quaternion={d.quat}>
          <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.45, 3.6]} />
            <meshStandardMaterial map={tiled("stone.jpg", 1, 2)} roughness={0.9} />
          </mesh>
          {/* parapets, so it reads as a bridge rather than a slab */}
          {[1.62, -1.62].map((z) => (
            <mesh key={z} position={[0, 0.42, z]} castShadow>
              <boxGeometry args={[1.6, 0.62, 0.22]} />
              <meshStandardMaterial map={tiled("stone.jpg", 1, 1)} color="#d8d2c6" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}
      {piers.map((d, i) => (
        <group key={`p${i}`}>
          <mesh position={[d.pos.x, d.pos.y / 2 - 3.2, d.pos.z]} castShadow receiveShadow>
            <boxGeometry args={[1.5, d.pos.y + 6, 2.6]} />
            <meshStandardMaterial map={tiled("stone.jpg", 1, 3)} roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Track() {
  const segments = 900;
  const ballast = useMemo(() => ballastGeometry(BALLAST_HALF_WIDTH, 0.02, segments), []);
  const bankL = useMemo(() => embankmentGeometry(1, segments), []);
  const bankR = useMemo(() => embankmentGeometry(-1, segments), []);
  const railL = useMemo(
    () => new THREE.TubeGeometry(new OffsetRouteCurve(GAUGE, RAIL_HEIGHT), 1400, 0.07, 6, true),
    []
  );
  const railR = useMemo(
    () => new THREE.TubeGeometry(new OffsetRouteCurve(-GAUGE, RAIL_HEIGHT), 1400, 0.07, 6, true),
    []
  );

  const sleepers = useRef<THREE.InstancedMesh>(null);
  const count = Math.round(ROUTE_LENGTH / 1.15);

  useEffect(() => {
    if (!sleepers.current) return;
    const dummy = new THREE.Object3D();
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      sampleRoute((i / count) * ROUTE_LENGTH, p, tan);
      orientationFromTangent(tan, q);
      dummy.position.set(p.x, p.y + 0.1, p.z);
      dummy.quaternion.copy(q);
      dummy.updateMatrix();
      sleepers.current.setMatrixAt(i, dummy.matrix);
    }
    sleepers.current.instanceMatrix.needsUpdate = true;
  }, [count]);

  return (
    <group>
      {[bankL, bankR].map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial map={tiled("rock.jpg", 1, 1)} roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Bridge />
      <mesh geometry={ballast} receiveShadow>
        <meshStandardMaterial map={tiled("ballast.jpg", 1, 1)} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh ref={sleepers} args={[undefined, undefined, count]} receiveShadow>
        <boxGeometry args={[0.36, 0.14, 2.1]} />
        <meshStandardMaterial map={tiled("wood.jpg", 1, 1)} color="#a89070" roughness={0.9} />
      </instancedMesh>
      <mesh geometry={railL}>
        <meshStandardMaterial color="#6f7378" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh geometry={railR}>
        <meshStandardMaterial color="#6f7378" metalness={0.65} roughness={0.35} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------- scenery --- */

type Placed = { x: number; y: number; z: number; s: number; kind: number };

/** Conifer, round-headed broadleaf, and a scrubby bush. */
function Tree({ p }: { p: Placed }) {
  const trunk = "#7a5a3c";
  if (p.kind === 0) {
    return (
      <group position={[p.x, p.y, p.z]} scale={p.s}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.22, 1, 5]} />
          <meshStandardMaterial color={trunk} roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.8, 0]} castShadow>
          <coneGeometry args={[1.0, 2.4, 7]} />
          <meshStandardMaterial color="#3f7f3c" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.9, 0]} castShadow>
          <coneGeometry args={[0.72, 1.6, 7]} />
          <meshStandardMaterial color="#4d9247" roughness={0.9} />
        </mesh>
      </group>
    );
  }
  if (p.kind === 1) {
    return (
      <group position={[p.x, p.y, p.z]} scale={p.s}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.26, 1.6, 5]} />
          <meshStandardMaterial color={trunk} roughness={0.95} />
        </mesh>
        <mesh position={[0, 2.3, 0]} castShadow>
          <sphereGeometry args={[1.25, 8, 7]} />
          <meshStandardMaterial color="#5aa04a" roughness={0.9} />
        </mesh>
        <mesh position={[0.5, 1.8, 0.35]} castShadow>
          <sphereGeometry args={[0.8, 7, 6]} />
          <meshStandardMaterial color="#6cb257" roughness={0.9} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[p.x, p.y, p.z]} scale={p.s}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <sphereGeometry args={[0.75, 7, 6]} />
        <meshStandardMaterial color="#5c8f42" roughness={1} />
      </mesh>
      <mesh position={[0.5, 0.32, 0.2]} castShadow>
        <sphereGeometry args={[0.5, 6, 5]} />
        <meshStandardMaterial color="#6b9c4c" roughness={1} />
      </mesh>
    </group>
  );
}

/**
 * Telegraph poles marching along the lineside. In the cab these are what
 * actually sell the speed — distant hills barely move, but a pole whipping past
 * the window every couple of seconds tells you how fast the engine is going.
 */
function TelegraphPoles() {
  const poles = useMemo(() => {
    const out: { pos: THREE.Vector3; rot: number }[] = [];
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const lat = new THREE.Vector3();
    const spacing = 13;
    const count = Math.floor(ROUTE_LENGTH / spacing);
    for (let i = 0; i < count; i++) {
      sampleRoute(i * spacing, p, tan);
      lateralAt(tan, lat);
      out.push({
        pos: new THREE.Vector3(p.x + lat.x * 4.6, p.y, p.z + lat.z * 4.6),
        rot: Math.atan2(tan.x, tan.z),
      });
    }
    return out;
  }, []);

  return (
    <group>
      {poles.map((pole, i) => (
        <group key={i} position={pole.pos} rotation={[0, pole.rot, 0]}>
          <mesh position={[0, 2.4, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.15, 5.4, 6]} />
            <meshStandardMaterial color="#6b4f34" roughness={0.95} />
          </mesh>
          {[4.5, 3.9].map((y) => (
            <mesh key={y} position={[0, y, 0]} castShadow>
              <boxGeometry args={[0.07, 0.07, 1.5]} />
              <meshStandardMaterial color="#5a4229" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}


/**
 * The line bores straight through the hill. There is no CSG here, so the hole
 * is a tube rendered inside-out — the hill covers the track, and this is what
 * you actually see while you are in there.
 */
function Tunnel() {
  const from = TUNNEL_FROM * ROUTE_LENGTH;
  const to = TUNNEL_TO * ROUTE_LENGTH;

  const bore = useMemo(
    () => new THREE.TubeGeometry(new SubRouteCurve(from, to, BORE_LIFT), 160, BORE_RADIUS, 16, false),
    [from, to]
  );

  /** Stone surround at each mouth: two jambs and a lintel, opening left clear. */
  const portals = useMemo(() => {
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const q = new THREE.Quaternion();
    // at the hill's edge, where the line actually disappears into it — not at
    // the ends of the bore, which run well beyond the hill
    const mid = (from + to) / 2;
    return [mid - TUNNEL_HILL.r, mid + TUNNEL_HILL.r].map((d) => {
      sampleRoute(d, p, tan);
      orientationFromTangent(tan, q);
      return { pos: p.clone(), quat: q.clone() };
    });
  }, [from, to]);

  return (
    <group>
      <mesh geometry={bore}>
        <meshStandardMaterial map={tiled("stone.jpg", 3, 10)} color="#6a6258" side={THREE.BackSide} roughness={1} />
      </mesh>
      {portals.map((portal, i) => (
        <group key={i} position={portal.pos} quaternion={portal.quat}>
          {[3.1, -3.1].map((z) => (
            <mesh key={z} position={[0, 2.1, z]} castShadow receiveShadow>
              <boxGeometry args={[1.5, 5.6, 1.6]} />
              <meshStandardMaterial map={tiled("stone.jpg", 1, 2)} roughness={0.95} />
            </mesh>
          ))}
          <mesh position={[0, 5.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 1.5, 7.8]} />
            <meshStandardMaterial map={tiled("stone.jpg", 2, 1)} color="#c8c2b6" roughness={0.95} />
          </mesh>
          <mesh position={[0, 6.2, 0]} castShadow>
            <boxGeometry args={[1.9, 0.6, 8.6]} />
            <meshStandardMaterial map={tiled("stone.jpg", 2, 1)} roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Water sitting in the hollow beside the line. */
function Lake() {
  return (
    <group position={[LAKE_BASIN.x, LAKE_LEVEL, LAKE_BASIN.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[LAKE_BASIN.r * 0.72, 40]} />
        <meshStandardMaterial
          color="#3f7f9c"
          roughness={0.18}
          metalness={0.35}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------- lineside kit --- */

/**
 * Post-and-rail fencing down both sides of the line. Instanced, because it's
 * roughly a thousand pieces — and it's the closest thing to the window, so it's
 * what actually gives the cab view its sense of speed.
 */
function Fences({ samples }: { samples: { x: number; y: number; z: number }[] }) {
  const SPACING = 2.7;
  const OFFSET = 6.6;
  const count = Math.floor(ROUTE_LENGTH / SPACING) * 2;

  const posts = useRef<THREE.InstancedMesh>(null);
  const railsLow = useRef<THREE.InstancedMesh>(null);
  const railsHigh = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const lat = new THREE.Vector3();
    const q = new THREE.Quaternion();
    let i = 0;
    for (let n = 0; n * SPACING < ROUTE_LENGTH; n++) {
      sampleRoute(n * SPACING, p, tan);
      lateralAt(tan, lat);
      orientationFromTangent(tan, q);
      for (const side of [1, -1] as const) {
        const x = p.x + lat.x * OFFSET * side;
        const z = p.z + lat.z * OFFSET * side;
        const y = groundHeightNear(x, z, samples);

        dummy.position.set(x, y + 0.55, z);
        dummy.quaternion.copy(q);
        dummy.updateMatrix();
        posts.current?.setMatrixAt(i, dummy.matrix);

        // rails reach forward to meet the next post
        dummy.position.set(
          x + tan.x * SPACING * 0.5,
          y + 0.42,
          z + tan.z * SPACING * 0.5
        );
        dummy.updateMatrix();
        railsLow.current?.setMatrixAt(i, dummy.matrix);
        dummy.position.y = y + 0.82;
        dummy.updateMatrix();
        railsHigh.current?.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    for (const m of [posts, railsLow, railsHigh]) {
      if (m.current) {
        m.current.count = i;
        m.current.instanceMatrix.needsUpdate = true;
      }
    }
  }, [samples, count]);

  const timber = <meshStandardMaterial color="#6b5334" roughness={0.95} />;
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={[0.09, 1.1, 0.09]} />
        {timber}
      </instancedMesh>
      <instancedMesh ref={railsLow} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={[SPACING, 0.07, 0.05]} />
        {timber}
      </instancedMesh>
      <instancedMesh ref={railsHigh} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={[SPACING, 0.07, 0.05]} />
        {timber}
      </instancedMesh>
    </group>
  );
}

/**
 * Semaphore signals. The arm actually works: it drops to clear as the engine
 * gets close and swings back to danger once it's gone by.
 */
function Signals({ distanceRef }: { distanceRef: React.RefObject<number> }) {
  const arms = useRef<(THREE.Group | null)[]>([]);

  const posts = useMemo(() => {
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const lat = new THREE.Vector3();
    const q = new THREE.Quaternion();
    return [0.16, 0.46, 0.72].map((frac) => {
      const at = frac * ROUTE_LENGTH;
      sampleRoute(at, p, tan);
      lateralAt(tan, lat);
      orientationFromTangent(tan, q);
      return {
        at,
        pos: new THREE.Vector3(p.x + lat.x * 5.4, p.y, p.z + lat.z * 5.4),
        quat: q.clone(),
      };
    });
  }, []);

  useFrame((_, dt) => {
    const d = ((distanceRef.current ?? 0) % ROUTE_LENGTH + ROUTE_LENGTH) % ROUTE_LENGTH;
    posts.forEach((s, i) => {
      const arm = arms.current[i];
      if (!arm) return;
      // how far the engine still is from this signal, going forwards
      const gap = (s.at - d + ROUTE_LENGTH) % ROUTE_LENGTH;
      const clear = gap < 48 ? 1 : 0;
      const target = -clear * 0.75; // horizontal = danger, dropped = clear
      arm.rotation.z += (target - arm.rotation.z) * Math.min(1, dt * 5);
    });
  });

  return (
    <group>
      {posts.map((s, i) => (
        <group key={i} position={s.pos} quaternion={s.quat}>
          <mesh position={[0, 2.4, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.12, 4.8, 8]} />
            <meshStandardMaterial color="#d8d2c4" roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.7, 0.3, 0.7]} />
            <meshStandardMaterial color="#3d4a40" roughness={0.9} />
          </mesh>
          {/* the arm pivots on the post */}
          <group ref={(el) => { arms.current[i] = el; }} position={[0, 4.3, 0.12]}>
            <mesh position={[0, 0, 0.52]} castShadow>
              <boxGeometry args={[0.12, 0.26, 1.15]} />
              <meshStandardMaterial color="#c0392b" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0, 1.0]}>
              <boxGeometry args={[0.13, 0.2, 0.2]} />
              <meshStandardMaterial color="#f4f1e8" roughness={0.7} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/** Sheep in the fields — the thing a small boy will actually look for. */
function Sheep({ samples }: { samples: { x: number; y: number; z: number }[] }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const COUNT = 64;

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const lat = new THREE.Vector3();
    let seed = 4021;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < COUNT; i++) {
      sampleRoute(rand() * ROUTE_LENGTH, p, tan);
      lateralAt(tan, lat);
      const side = rand() < 0.5 ? 1 : -1;
      const away = 12 + rand() * 34;
      const x = p.x + lat.x * away * side + (rand() - 0.5) * 12;
      const z = p.z + lat.z * away * side + (rand() - 0.5) * 12;
      const y = groundHeightNear(x, z, samples);
      const facing = rand() * Math.PI * 2;

      dummy.position.set(x, y + 0.34, z);
      dummy.rotation.set(0, facing, 0);
      dummy.scale.set(0.62, 0.5, 0.42);
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(
        x + Math.sin(facing) * 0.34,
        y + 0.44,
        z + Math.cos(facing) * 0.34
      );
      dummy.scale.setScalar(0.19);
      dummy.updateMatrix();
      heads.current?.setMatrixAt(i, dummy.matrix);
    }
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  }, [samples]);

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, COUNT]} castShadow>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#f2efe6" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, COUNT]} castShadow>
        <sphereGeometry args={[1, 7, 6]} />
        <meshStandardMaterial color="#3a3630" roughness={1} />
      </instancedMesh>
    </group>
  );
}

/** A couple of flocks turning slowly overhead. */
function Birds() {
  const flocks = useRef<(THREE.Group | null)[]>([]);
  const spec = useMemo(
    () => [
      { c: [-40, 34, 30] as const, r: 26, speed: 0.16, n: 6 },
      { c: [60, 42, -20] as const, r: 34, speed: -0.11, n: 5 },
    ],
    []
  );

  useFrame(({ clock }) => {
    flocks.current.forEach((g, i) => {
      if (!g) return;
      g.rotation.y = clock.elapsedTime * spec[i].speed;
      g.children.forEach((b, j) => {
        // lazy wingbeat
        b.scale.y = 0.55 + Math.sin(clock.elapsedTime * 6 + j) * 0.35;
      });
    });
  });

  return (
    <group>
      {spec.map((f, i) => (
        <group key={i} position={[f.c[0], f.c[1], f.c[2]]} ref={(el) => { flocks.current[i] = el; }}>
          {Array.from({ length: f.n }, (_, j) => {
            const a = (j / f.n) * Math.PI * 2;
            return (
              <mesh
                key={j}
                position={[Math.cos(a) * f.r, Math.sin(j * 1.7) * 3, Math.sin(a) * f.r]}
                rotation={[0, -a, 0]}
              >
                <boxGeometry args={[1.5, 0.12, 0.22]} />
                <meshStandardMaterial color="#33302b" roughness={1} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/** Placed against the route and dropped onto the land, so nothing floats. */
function Scenery({ mood }: { mood: Mood }) {
  const samples = useMemo(() => buildRouteSamples(), []);
  const terrain = useMemo(() => buildTerrainGeometry(), []);

  const trees = useMemo(() => {
    const out: Placed[] = [];
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const lat = new THREE.Vector3();
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    // woods rather than an even sprinkle
    for (let w = 0; w < 26; w++) {
      sampleRoute(rand() * ROUTE_LENGTH, p, tan);
      lateralAt(tan, lat);
      const side = rand() < 0.5 ? 1 : -1;
      const away = 14 + rand() * 40;
      const cx = p.x + lat.x * away * side + (rand() - 0.5) * 20;
      const cz = p.z + lat.z * away * side + (rand() - 0.5) * 20;
      const kind = rand() < 0.45 ? 0 : 1;
      const n = 3 + Math.floor(rand() * 7);
      for (let i = 0; i < n; i++) {
        const x = cx + (rand() - 0.5) * 22;
        const z = cz + (rand() - 0.5) * 22;
        out.push({
          x,
          y: groundHeightNear(x, z, samples) - 0.15,
          z,
          s: 0.8 + rand() * 0.8,
          kind: rand() < 0.2 ? 2 : kind,
        });
      }
    }
    // bushes close to the line, for near-field speed cues
    for (let i = 0; i < 40; i++) {
      sampleRoute(rand() * ROUTE_LENGTH, p, tan);
      lateralAt(tan, lat);
      const side = rand() < 0.5 ? 1 : -1;
      const away = 6 + rand() * 5;
      const x = p.x + lat.x * away * side;
      const z = p.z + lat.z * away * side;
      out.push({
        x,
        y: groundHeightNear(x, z, samples) - 0.1,
        z,
        s: 0.7 + rand() * 0.7,
        kind: 2,
      });
    }
    return out;
  }, [samples]);

  const station = useMemo(() => {
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const lat = new THREE.Vector3();
    const q = new THREE.Quaternion();
    sampleRoute(ROUTE_LENGTH * 0.08, p, tan);
    lateralAt(tan, lat);
    orientationFromTangent(tan, q);
    return {
      pos: new THREE.Vector3(p.x + lat.x * 4.6, p.y, p.z + lat.z * 4.6),
      quat: q.clone(),
    };
  }, []);

  return (
    <group>
      <mesh geometry={terrain} receiveShadow>
        {/* the patchwork field colours multiply over the grass, so the
            texture reads as different crops rather than one flat lawn */}
        {/* keyed so the material is rebuilt when snow drops the map and the
            vertex colours — toggling those needs a fresh shader, not a prop */}
        <meshStandardMaterial
          key={mood.snowy ? "snow" : "grass"}
          map={mood.snowy ? undefined : tiled("grass.jpg", 150, 150)}
          color={mood.snowy ? "#f2f7fc" : mood.groundTint}
          vertexColors={!mood.snowy}
          roughness={mood.snowy ? 0.72 : 1}
        />
      </mesh>

      {trees.map((t, i) => (
        <Tree key={i} p={t} />
      ))}
      <TelegraphPoles />
      <Fences samples={samples} />
      <Sheep samples={samples} />
      <Birds />
      <Tunnel />
      <Lake />

      {/* station, set back from the line */}
      <group position={station.pos} quaternion={station.quat}>
        <mesh position={[0, 0.35, -1.9]} receiveShadow castShadow>
          <boxGeometry args={[12, 0.7, 2.6]} />
          <meshStandardMaterial map={tiled("stone.jpg", 6, 1)} color="#ddd6c8" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.0, 0.9]} castShadow>
          <boxGeometry args={[7, 3.3, 3.6]} />
          <meshStandardMaterial color="#f2d9b6" roughness={0.8} />
        </mesh>
        <mesh position={[0, 4.1, 0.9]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[4.4, 1.8, 4]} />
          <meshStandardMaterial map={tiled("roof.jpg", 3, 2)} roughness={0.75} />
        </mesh>
        {[-2.1, 2.1].map((x) => (
          <mesh key={x} position={[x, 1.9, -0.92]}>
            <boxGeometry args={[1.3, 1.4, 0.06]} />
            <meshStandardMaterial color="#BFE3F2" roughness={0.25} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ----------------------------------------------------------------- sky --- */

const SKY_VERT = `
  varying vec3 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SKY_FRAG = `
  uniform vec3 topColour;
  uniform vec3 horizonColour;
  varying vec3 vWorldPos;
  void main() {
    float h = normalize(vWorldPos).y;
    float t = pow(max(h, 0.0), 0.62);
    gl_FragColor = vec4(mix(horizonColour, topColour, t), 1.0);
  }
`;

/** Gradient dome plus drifting cloud banks — a flat blue backdrop was half the
 *  reason the world looked like a diorama. */
function Sky({ mood }: { mood: Mood }) {
  const clouds = useRef<THREE.Group>(null);

  const uniforms = useMemo(
    () => ({
      topColour: { value: new THREE.Color(mood.skyTop) },
      horizonColour: { value: new THREE.Color(mood.skyHorizon) },
    }),
    []
  );
  // the dome material is built once, so push colour changes into the uniforms
  useEffect(() => {
    uniforms.topColour.value.set(mood.skyTop);
    uniforms.horizonColour.value.set(mood.skyHorizon);
  }, [uniforms, mood.skyTop, mood.skyHorizon]);

  const puffs = useMemo(() => {
    let seed = 91;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const out: { pos: [number, number, number]; s: number; f: number }[] = [];
    for (let i = 0; i < 34; i++) {
      const a = rand() * Math.PI * 2;
      const r = 150 + rand() * 260;
      out.push({
        pos: [Math.cos(a) * r, 78 + rand() * 52, Math.sin(a) * r],
        s: 16 + rand() * 30,
        f: 0.5 + rand() * 0.5,
      });
    }
    return out;
  }, []);

  useFrame((_, dt) => {
    if (clouds.current) clouds.current.rotation.y += dt * 0.004;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[620, 24, 16]} />
        <shaderMaterial
          vertexShader={SKY_VERT}
          fragmentShader={SKY_FRAG}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* sun */}
      <mesh position={[300, 260, 190]}>
        <sphereGeometry args={[26, 16, 12]} />
        <meshBasicMaterial color={mood.showSun ? "#fff6d8" : "#000000"} transparent opacity={mood.showSun ? 1 : 0} fog={false} />
      </mesh>

      <group ref={clouds}>
        {puffs.map((p, i) => (
          <sprite key={i} position={p.pos} scale={[p.s * 4.4, p.s * 2.6, 1]}>
            <spriteMaterial
              map={sprite("cloud.png")}
              color={mood.cloudTint}
              transparent
              opacity={(0.72 + p.f * 0.22) * mood.cloudOpacity}
              depthWrite={false}
              fog={false}
            />
          </sprite>
        ))}
      </group>
    </group>
  );
}

/**
 * Owns the lighting so it can dim when the engine runs into the hill.
 * Daylight, fog and a firebox glow all cross-fade on the same factor, which is
 * what makes the plunge into the dark feel like something happening.
 */
function TunnelMood({
  distanceRef,
  factorRef,
  mood,
}: {
  distanceRef: React.RefObject<number>;
  factorRef: React.RefObject<number>;
  mood: Mood;
}) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  // the tunnel darkens whatever the weather already is, rather than driving
  // towards a fixed daylight-to-black ramp
  const openFog = useMemo(() => new THREE.Color(mood.fogColour), [mood.fogColour]);
  const darkFog = useMemo(() => new THREE.Color("#0a0c0b"), []);
  const scratch = useMemo(() => new THREE.Color(), []);
  const inside = useRef(0);

  const from = TUNNEL_FROM * ROUTE_LENGTH;
  const to = TUNNEL_TO * ROUTE_LENGTH;
  const MOUTH = 7; // metres of fade either side of the portal

  useFrame((_, dt) => {
    const raw = distanceRef.current ?? 0;
    const d = ((raw % ROUTE_LENGTH) + ROUTE_LENGTH) % ROUTE_LENGTH;
    const intoIt = Math.min((d - from) / MOUTH, (to - d) / MOUTH);
    const target = Math.max(0, Math.min(1, intoIt));

    // ease rather than snap, so the mouths read as a rush of darkness
    inside.current += (target - inside.current) * Math.min(1, dt * 6);
    const k = inside.current;

    if (hemi.current) hemi.current.intensity = mood.hemiIntensity * (1 - k * 0.87);
    if (sun.current) sun.current.intensity = mood.sunIntensity * (1 - k * 0.91);
    factorRef.current = k;

    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      scratch.copy(openFog).lerp(darkFog, k);
      fog.color.copy(scratch);
      fog.near = mood.fogNear * (1 - k) + 4 * k;
      fog.far = mood.fogFar * (1 - k) + 50 * k;
    }
  });

  return (
    <>
      <hemisphereLight
        ref={hemi}
        color={mood.hemiSky}
        groundColor={mood.hemiGround}
        intensity={mood.hemiIntensity}
      />
      <directionalLight
        ref={sun}
        position={mood.sunPosition}
        color={mood.sunColour}
        intensity={mood.sunIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
        shadow-camera-far={260}
      />
    </>
  );
}

/* ---------------------------------------------------------- the weather --- */

/**
 * Rain and snow, as one instanced cloud of particles that travels with the
 * camera so the player is always inside it. Rain falls fast and straight; snow
 * drifts. `frustumCulled` has to be off — the instances move every frame, and
 * three.js would otherwise cull the whole batch against its original bounds.
 */
function Precipitation({ kind }: { kind: SkyKey }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const rain = kind === "rain";
  const COUNT = rain ? 520 : 420;
  const SPREAD = 64;
  const TOP = 44;

  const drops = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * SPREAD,
        y: Math.random() * TOP,
        z: (Math.random() - 0.5) * SPREAD,
        phase: Math.random() * Math.PI * 2,
        speed: rain ? 30 + Math.random() * 16 : 3 + Math.random() * 2.2,
      })),
    [COUNT, rain]
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { camera } = useThree();

  useFrame(({ clock }, dt) => {
    if (!mesh.current) return;
    const step = Math.min(dt, 0.05);
    const t = clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const d = drops[i];
      d.y -= d.speed * step;
      if (d.y < 0) {
        d.y += TOP;
        d.x = (Math.random() - 0.5) * SPREAD;
        d.z = (Math.random() - 0.5) * SPREAD;
      }
      // snow wanders on the way down; rain does not
      const sway = rain ? 0 : Math.sin(t * 0.8 + d.phase) * 1.8;
      const swayZ = rain ? 0 : Math.cos(t * 0.6 + d.phase) * 1.4;
      dummy.position.set(
        camera.position.x + d.x + sway,
        camera.position.y + d.y - TOP * 0.55,
        camera.position.z + d.z + swayZ
      );
      dummy.rotation.set(0, 0, rain ? 0.12 : 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
    >
      {rain ? (
        <boxGeometry args={[0.035, 1.1, 0.035]} />
      ) : (
        <sphereGeometry args={[0.11, 5, 4]} />
      )}
      <meshBasicMaterial
        color={rain ? "#c6dcee" : "#ffffff"}
        transparent
        opacity={rain ? 0.42 : 0.9}
        depthWrite={false}
        fog={false}
      />
    </instancedMesh>
  );
}

/** A dome of stars, only worth drawing once the sky is dark enough to see them. */
function Stars({ amount }: { amount: number }) {
  const geo = useMemo(() => {
    let seed = 7717;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pts: number[] = [];
    for (let i = 0; i < 500; i++) {
      // upper hemisphere only — stars under the ground help nobody
      const a = rand() * Math.PI * 2;
      const h = rand();
      const r = Math.sqrt(1 - h * h);
      pts.push(Math.cos(a) * r * 560, h * 520 + 20, Math.sin(a) * r * 560);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial
        color="#eaf1ff"
        size={2.2}
        sizeAttenuation={false}
        transparent
        opacity={amount}
        depthWrite={false}
        fog={false}
      />
    </points>
  );
}

/* --------------------------------------------------------------- steam --- */

const MAX_PUFFS = 26;
type Puff = { x: number; y: number; z: number; age: number; life: number; drift: number };

function Steam({ emitter }: { emitter: React.RefObject<Puff[]> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    const puffs = emitter.current;
    if (!mesh.current || !puffs) return;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const p = puffs[i];
      if (!p || p.age >= p.life) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.0001);
      } else {
        p.age += dt;
        const k = p.age / p.life;
        dummy.position.set(p.x + p.drift * k * 2.2, p.y + k * 2.3, p.z);
        dummy.scale.setScalar((0.32 + k * 1.0) * Math.min(1, 3 * (1 - k)));
      }
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    // Instances move every frame, so the geometry bounding sphere is
    // meaningless — without this the whole cloud gets culled.
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_PUFFS]} frustumCulled={false}>
      <sphereGeometry args={[0.5, 10, 8]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.34} depthWrite={false} roughness={1} />
    </instancedMesh>
  );
}

/* ---------------------------------------------------------- the driving --- */

export type CameraMode = "chase" | "cab" | "sky";

/**
 * Driver's eye on the footplate, in the engine's own coordinates. Sits where
 * the crew stood; the cab overlay is drawn to frame exactly this viewpoint.
 */
const CAB_EYE_X = -0.95;
const CAB_EYE_Y = 1.62;

function Driver({
  config,
  controlsRef,
  speedRef,
  distance,
  tunnelFactor,
  cameraMode,
  onWhistle,
}: {
  config: TrainConfig;
  controlsRef: React.RefObject<Controls>;
  speedRef: React.RefObject<number>;
  distance: React.RefObject<number>;
  /** 0 in daylight, 1 deep inside the hill — dims the world, lights the fire. */
  tunnelFactor: React.RefObject<number>;
  cameraMode: CameraMode;
  onWhistle: () => void;
}) {
  const fireLight = useRef<THREE.PointLight>(null);
  const train = useRef<THREE.Group>(null);
  const chuffAccum = useRef(0);
  const puffs = useRef<Puff[]>([]);
  const puffCursor = useRef(0);
  const { camera } = useThree();

  // TrainModel3D shifts itself forward when a tender is coupled up
  const engineDX = config.tender !== "none" ? 0.55 : 0;

  const pos = useMemo(() => new THREE.Vector3(), []);
  const tan = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const smoothLook = useRef(new THREE.Vector3());

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const ctl = controlsRef.current;
    if (!ctl) return;
    const speed = stepDriving(ctl, speedRef.current ?? 0, dt);
    speedRef.current = speed;

    distance.current += speed * dt;
    sampleRoute(distance.current, pos, tan);
    orientationFromTangent(tan, quat);

    if (train.current) {
      train.current.position.set(pos.x, pos.y + 0.22, pos.z);
      train.current.quaternion.copy(quat);
    }
    if (fireLight.current) {
      fireLight.current.intensity = (tunnelFactor.current ?? 0) * 26;
    }

    chuffAccum.current += Math.abs(speed) * dt;
    if (Math.abs(speed) > 0.6 && chuffAccum.current > 1.6) {
      chuffAccum.current = 0;
      playChuff(Math.min(0.4, Math.abs(speed) / 32));
      const i = puffCursor.current % MAX_PUFFS;
      puffCursor.current++;
      puffs.current[i] = {
        x: pos.x + tan.x * 1.75,
        y: pos.y + 2.15,
        z: pos.z + tan.z * 1.75,
        age: 0,
        life: 1.6,
        drift: (Math.random() - 0.5) * 0.6,
      };
    }

    if (cameraMode === "chase") {
      // Normally the camera rides above and behind — but that puts it through
      // the roof of the bore, and inside the hill that means the camera is in
      // solid rock, seeing the terrain's culled back faces and so straight
      // through the world. In the tunnel it ducks down and closes up to stay
      // inside the tube with the train.
      const k = tunnelFactor.current ?? 0;
      const back = 9.5 - 3.2 * k;
      const up = 4.4 - 1.9 * k;
      desired.set(pos.x - tan.x * back, pos.y + up, pos.z - tan.z * back);
      camera.position.lerp(desired, 1 - Math.pow(0.0016, dt));
      lookTarget.set(pos.x + tan.x * 4, pos.y + 1.4, pos.z + tan.z * 4);
    } else if (cameraMode === "cab") {
      // Standing on the footplate: the camera is rigidly fixed in the cab, so
      // the backhead and levers stay put on screen while the world goes by.
      const eye = CAB_EYE_X + engineDX;
      desired.set(
        pos.x + tan.x * eye,
        pos.y + 0.22 + CAB_EYE_Y,
        pos.z + tan.z * eye
      );
      camera.position.copy(desired);
      lookTarget.set(pos.x + tan.x * 26, pos.y + 1.15, pos.z + tan.z * 26);
      smoothLook.current.copy(lookTarget);
      camera.lookAt(smoothLook.current);
      return;
    } else {
      // the loop is no longer centred on the origin — the east lobe reaches
      // out to x=117 — so the bird's eye view sits over the middle of it
      desired.set(20, 152, 96);
      camera.position.lerp(desired, 1 - Math.pow(0.02, dt));
      lookTarget.set(20, 0, 0);
    }
    smoothLook.current.lerp(lookTarget, 1 - Math.pow(0.0009, dt));
    camera.lookAt(smoothLook.current);
  });

  return (
    <>
      <group ref={train}>
        {/* rides with the engine, so the firebox lights the tunnel wall */}
        <pointLight ref={fireLight} color="#ff9a3c" intensity={0} distance={40} decay={2} position={[0, 2, 0]} />
        {/* On the footplate the photograph already supplies the cab and the
            boiler, so rendering the engine too just wedges the lens between its
            own boiler top and cab roof. Out through the window is landscape. */}
        {cameraMode !== "cab" && (
          <TrainModel3D config={config} speedRef={speedRef as { current: number }} bobbing={false} />
        )}
      </group>
      <Steam emitter={puffs} />
    </>
  );
}

export default function Track3D({
  config,
  controlsRef,
  speedRef,
  cameraMode,
  onWhistle,
  weather,
}: {
  config: TrainConfig;
  controlsRef: React.RefObject<Controls>;
  speedRef: React.RefObject<number>;
  cameraMode: CameraMode;
  onWhistle: () => void;
  weather: WeatherChoice;
}) {
  const mood = useMemo(() => moodFor(weather.time, weather.sky), [weather.time, weather.sky]);
  const [canvasKey, setCanvasKey] = useState(0);
  /** How far the engine has travelled — shared so the lighting knows when it
      is inside the hill. */
  const distance = useRef(0);
  const tunnelFactor = useRef(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, [canvasKey]);

  return (
    <Canvas
      key={canvasKey}
      shadows
      // capped for iPad/iPhone retina — full DPR murders the frame rate
      dpr={[1, 1.6]}
      gl={{ powerPreference: "high-performance", antialias: true }}
      camera={{ position: [0, 8, -30], fov: 55, far: 700 }}
      onCreated={({ gl, scene }) => {
        scene.fog = new THREE.Fog(mood.fogColour, mood.fogNear, mood.fogFar);
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          setCanvasKey((v) => v + 1);
        });
      }}
    >
      <Sky mood={mood} />
      {mood.stars > 0.02 && <Stars amount={mood.stars} />}
      {weather.sky !== "clear" && <Precipitation kind={weather.sky} />}
      <TunnelMood distanceRef={distance} factorRef={tunnelFactor} mood={mood} />
      <Scenery mood={mood} />
      <Track />
      <Signals distanceRef={distance} />
      <Driver
        config={config}
        controlsRef={controlsRef}
        speedRef={speedRef}
        distance={distance}
        tunnelFactor={tunnelFactor}
        cameraMode={cameraMode}
        onWhistle={onWhistle}
      />
    </Canvas>
  );
}
