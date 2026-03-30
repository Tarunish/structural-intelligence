import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';

const MAT_COLORS = {
  LOAD_BEARING: '#ff4d00',
  PARTITION:    '#00e5ff',
  LONG_SPAN:    '#a0b4c8',
  SLAB:         '#8a2be2',
  COLUMN:       '#7c8a9a',
};

const WALL_HEIGHT = 3.2;
const W = 14;

function filterWalls(walls) {
  // Step 1: Remove very short walls
  const MIN_LEN = 0.04;
  let filtered = walls.filter(w => {
    const [x1, y1] = w.start || [0, 0];
    const [x2, y2] = w.end || [0, 0];
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    return len >= MIN_LEN;
  });

  // Step 2: Deduplicate walls that are very close to each other
  const kept = [];
  for (let i = 0; i < filtered.length; i++) {
    const w1 = filtered[i];
    const [ax1, ay1] = w1.start, [ax2, ay2] = w1.end;
    const cx1 = (ax1 + ax2) / 2, cy1 = (ay1 + ay2) / 2;
    let duplicate = false;
    for (let j = 0; j < kept.length; j++) {
      const w2 = kept[j];
      const [bx1, by1] = w2.start, [bx2, by2] = w2.end;
      const cx2 = (bx1 + bx2) / 2, cy2 = (by1 + by2) / 2;
      const dist = Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
      if (dist < 0.03) { duplicate = true; break; }
    }
    if (!duplicate) kept.push(w1);
  }

  // Step 3: Limit to max 80 walls to keep model clean
  return kept.slice(0, 80);
}

const WallMesh = ({ wall, index, wireframe }) => {
  const [x1n, y1n] = wall.start || [0, 0];
  const [x2n, y2n] = wall.end || [0.1, 0];

  const x1 = x1n * W, z1 = y1n * W;
  const x2 = x2n * W, z2 = y2n * W;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);

  const cls = wall.classification || 'PARTITION';
  const isLB = cls === 'LOAD_BEARING';
  const thickness = isLB ? 0.35 : 0.18;
  const color = MAT_COLORS[cls] || MAT_COLORS.PARTITION;

  const posX = (x1 + x2) / 2;
  const posZ = (z1 + z2) / 2;
  const rotY = -Math.atan2(dz, dx);
  const baseHeight = isLB ? WALL_HEIGHT : WALL_HEIGHT * 0.96;
  const h = baseHeight + (index * 0.001);

  const geometry = useMemo(() => new THREE.BoxGeometry(len + 0.02, h, thickness), [len, thickness, h]);

  return (
    <group position={[posX, h / 2, posZ]} rotation={[0, rotY, 0]}>
      <mesh castShadow geometry={geometry}>
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.2}
          wireframe={wireframe}
        />
      </mesh>
    </group>
  );
};

const RoomFloor = ({ centroid, index }) => {
  const [cx, cy] = centroid;
  const colors = ['#1a1a24', '#151520', '#1c1c28', '#111118', '#181822', '#14141e'];
  return (
    <mesh position={[cx * W, 0.02, cy * W]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[W * 0.22, W * 0.22]} />
      <meshStandardMaterial color={colors[index % colors.length]} roughness={0.9} />
    </mesh>
  );
};

const SceneContent = ({ parsedData, wireframe }) => {
  if (!parsedData || !parsedData.walls) return null;

  const walls = filterWalls(parsedData.walls);
  const rooms = parsedData.rooms || [];

  return (
    <group>
      <mesh position={[W / 2, 0, W / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W + 10, W + 10]} />
        <meshStandardMaterial color="#0a0a0f" roughness={1} metalness={0} />
      </mesh>

      <Grid
        position={[W/2, 0.01, W/2]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1e1e2e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#2a2a3e"
        fadeDistance={40}
      />

      {rooms.map((room, i) => (
        <RoomFloor key={i} centroid={room.centroid_normalized || [0.5, 0.5]} index={i} />
      ))}

      {walls.map((wall, i) => (
        <WallMesh key={i} wall={wall} index={i} wireframe={wireframe} />
      ))}
    </group>
  );
};

const ThreeCanvas = React.forwardRef(({ parsedData, isLoading }, ref) => {
  const [wireframe, setWireframe] = React.useState(false);
  const controlsRef = React.useRef();

  React.useImperativeHandle(ref, () => ({
    resetCamera: () => {
      if (controlsRef.current) {
        controlsRef.current.reset();
        controlsRef.current.target.set(5, 1.5, 5);
      }
    },
    setView: (view) => {
      if (!controlsRef.current) return;
      const c = controlsRef.current.object;
      controlsRef.current.target.set(5, 1.5, 5);
      let r = 18, theta = Math.PI / 4, phi = Math.PI / 3.2;

      if (view === 'top') { r = 20; theta = 0; phi = 0.01; }
      else if (view === 'front') { r = 18; theta = 0; phi = Math.PI / 2; }

      c.position.set(
        r * Math.sin(phi) * Math.sin(theta) + 5,
        r * Math.cos(phi) + 1.5,
        r * Math.sin(phi) * Math.cos(theta) + 5
      );
      controlsRef.current.update();
    },
    toggleWireframe: () => setWireframe(w => !w)
  }));

  return (
    <main className="canvas-area">
      <Canvas
        shadows
        camera={{ position: [20, 18, 22], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight
          position={[15, 25, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
          color="#ffffff"
        />
        <pointLight position={[-10, 10, -10]} intensity={1.5} color="#00e5ff" />
        <pointLight position={[20, 5, 20]} intensity={1.0} color="#ff4d00" />

        <Environment preset="city" />

        <SceneContent parsedData={parsedData} wireframe={wireframe} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[5, 1.5, 5]}
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="mono">INITIALIZING ENGINE...</div>
        </div>
      )}

      <div className="canvas-overlay">
        <button className="cam-btn" onClick={() => ref.current?.resetCamera()}>⟳ Reset</button>
        <button className="cam-btn" onClick={() => ref.current?.setView('top')}>⊡ Top</button>
        <button className="cam-btn" onClick={() => ref.current?.setView('front')}>◫ Front</button>
        <button className="cam-btn" onClick={() => ref.current?.setView('iso')}>⬡ Iso</button>
        <button className={`cam-btn ${wireframe ? 'active' : ''}`} onClick={() => setWireframe(!wireframe)}>⬜ Wireframe</button>
      </div>
    </main>
  );
});

export default ThreeCanvas;
