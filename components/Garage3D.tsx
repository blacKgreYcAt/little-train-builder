"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas, type RootState } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Grid } from "@react-three/drei";
import TrainModel3D from "./TrainModel3D";
import type { TrainConfig } from "@/lib/parts";

export default function Garage3D({ config }: { config: TrainConfig }) {
  // Bumping this remounts the Canvas, which is how we recover from a lost
  // WebGL context (browsers cap live contexts, and a lost one never repaints).
  const [canvasKey, setCanvasKey] = useState(0);

  // Some embedding contexts don't fire the canvas' initial ResizeObserver
  // callback; a follow-up resize event nudges @react-three/fiber to size correctly.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, [canvasKey]);

  const handleCreated = useCallback(({ gl }: RootState) => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      setCanvasKey((k) => k + 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 40%, #243128 0%, #121a16 60%, #0b100e 100%)" }}>
      <Canvas
        key={canvasKey}
        shadows
        camera={{ position: [7.6, 3.0, 6.4], fov: 34 }}
        onCreated={handleCreated}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[4, 6, 3]}
            intensity={1.3}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-3, 2, -4]} intensity={0.35} />
          <hemisphereLight color="#cfe6ff" groundColor="#1a2a22" intensity={0.55} />

          <group position={[0, -0.62, 0]}>
            <TrainModel3D config={config} />
          </group>

          <Grid
            position={[0, -0.62, 0]}
            args={[10, 10]}
            cellSize={0.3}
            cellThickness={0.6}
            cellColor="#3a5a4b"
            sectionSize={1.5}
            sectionThickness={1}
            sectionColor="#5d8f78"
            fadeDistance={9}
            fadeStrength={1.5}
            infiniteGrid
          />
          <mesh position={[0, -0.63, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[6, 48]} />
            <meshStandardMaterial color="#1c2a23" roughness={0.95} />
          </mesh>
          <ContactShadows position={[0, -0.6, 0]} opacity={0.7} scale={7} blur={2.2} far={2.4} />

          <OrbitControls
            enablePan={false}
            minDistance={4}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2 - 0.02}
            target={[0, 0.8, 0]}
            autoRotate
            autoRotateSpeed={0.6}
          />
        </Suspense>
      </Canvas>
      <div className="ws-label pointer-events-none absolute bottom-3 left-0 right-0 text-center">
        拖曳旋轉 · 滾輪縮放
      </div>
    </div>
  );
}
