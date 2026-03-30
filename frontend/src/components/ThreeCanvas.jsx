import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Text, Billboard } from '@react-three/drei';
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

const ROOM_COLORS = {
  LIVING_ROOM: '#1a2535', GREAT_ROOM: '#1a2535',
  BEDROOM: '#1a2030', BEDROOM_1: '#1a2030', BEDROOM_2: '#1a2030',
  BEDROOM_3: '#1a2030', BEDROOM_4: '#1a2030',
  KITCHEN: '#1a2520', BATHROOM: '#151a25', BATH: '#151a25',
  LAUNDRY: '#201a25', FOYER: '#252015', HALLWAY: '#202020',
  STORAGE: '#1a1a1a', GARAGE: '#202518', DEFAULT: '#181820',
};

function filterWalls(walls) {
  const MIN_LEN = 0.04;
  let filtered = walls.filter(w => {
    const [x1, y1] = w.start || [0, 0];
    const [x2, y2] = w.end || [0, 0];
    return Math.sqrt((x2-x1)**2 + (y2-y1)**2) >= MIN_LEN;
  });
  const kept = [];
  for (let i = 0; i < filtered.length; i++) {
    const w1 = filtered[i];
    const cx1 = (w1.start[0]+w1.end[0])/2, cy1 = (w1.start[1]+w1.end[1])/2;
    let dup = false;
    for (let j = 0; j < kept.length; j++) {
      const w2 = kept[j];
      const cx2 = (w2.start[0]+w2.end[0])/2, cy2 = (w2.start[1]+w2.end[1])/2;
      if (Math.sqrt((cx1-cx2)**2+(cy1-cy2)**2) < 0.03) { dup=true; break; }
    }
    if (!dup) kept.push(w1);
  }
  return kept.slice(0, 80);
}

const WallMesh = ({ wall, index, wireframe }) => {
  const [x1n, y1n] = wall.start || [0, 0];
  const [x2n, y2n] = wall.end || [0.1, 0];
  const x1=x1n*W, z1=y1n*W, x2=x2n*W, z2=y2n*W;
  const dx=x2-x1, dz=z2-z1;
  const len = Math.sqrt(dx*dx+dz*dz);
  const cls = wall.classification || 'PARTITION';
  const isLB = cls === 'LOAD_BEARING';
  const h = (isLB ? WALL_HEIGHT : WALL_HEIGHT*0.96) + index*0.001;
  const geometry = useMemo(() => new THREE.BoxGeometry(len+0.02, h, isLB?0.35:0.18), [len, h, isLB]);
  return (
    <group position={[(x1+x2)/2, h/2, (z1+z2)/2]} rotation={[0, -Math.atan2(dz,dx), 0]}>
      <mesh castShadow geometry={geometry}>
        <meshStandardMaterial color={MAT_COLORS[cls]||MAT_COLORS.PARTITION} roughness={0.7} metalness={0.2} wireframe={wireframe}/>
      </mesh>
    </group>
  );
};

const RoomFloor = ({ room }) => {
  const [cx, cy] = room.centroid_normalized || [0.5, 0.5];
  const label = (room.label||'ROOM').replace(/_/g,' ');
  const colorKey = (room.label||'').toUpperCase().replace(/ /g,'_');
  const color = ROOM_COLORS[colorKey] || ROOM_COLORS.DEFAULT;
  return (
    <group>
      <mesh position={[cx*W, 0.02, cy*W]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[W*0.22, W*0.22]}/>
        <meshStandardMaterial color={color} roughness={0.9}/>
      </mesh>
      <Billboard position={[cx*W, 0.9, cy*W]}>
        <Text fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle"
          outlineWidth={0.03} outlineColor="#000000" maxWidth={3} textAlign="center">
          {label}
        </Text>
      </Billboard>
    </group>
  );
};

const DoorMarker = ({ opening }) => {
  const [ox, oy] = opening.location || [0.5, 0.5];
  return (
    <group position={[ox*W, 0.05, oy*W]}>
      <mesh rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[0.25, 0.4, 16, 1, 0, Math.PI/2]}/>
        <meshStandardMaterial color="#f5c518" side={THREE.DoubleSide}/>
      </mesh>
      <Billboard position={[0, 0.7, 0]}>
        <Text fontSize={0.22} color="#f5c518" outlineWidth={0.02} outlineColor="#000">DOOR</Text>
      </Billboard>
    </group>
  );
};

const SceneContent = ({ parsedData, wireframe }) => {
  if (!parsedData || !parsedData.walls) return null;
  const walls = filterWalls(parsedData.walls);
  const rooms = parsedData.rooms || [];
  const doors = (parsedData.openings||[]).filter(o=>o.type==='DOOR').slice(0,10);
  return (
    <group>
      <mesh position={[W/2,0,W/2]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[W+10,W+10]}/>
        <meshStandardMaterial color="#0a0a0f" roughness={1} metalness={0}/>
      </mesh>
      <Grid position={[W/2,0.01,W/2]} args={[30,30]} cellSize={1} cellThickness={0.5}
        cellColor="#1e1e2e" sectionSize={5} sectionThickness={1} sectionColor="#2a2a3e" fadeDistance={40}/>
      {rooms.map((room,i) => <RoomFloor key={i} room={room}/>)}
      {doors.map((d,i) => <DoorMarker key={i} opening={d}/>)}
      {walls.map((wall,i) => <WallMesh key={i} wall={wall} index={i} wireframe={wireframe}/>)}
    </group>
  );
};

const ThreeCanvas = React.forwardRef(({ parsedData, isLoading }, ref) => {
  const [wireframe, setWireframe] = React.useState(false);
  const controlsRef = React.useRef();

  React.useImperativeHandle(ref, () => ({
    resetCamera: () => { if(controlsRef.current){controlsRef.current.reset();controlsRef.current.target.set(5,1.5,5);} },
    setView: (view) => {
      if(!controlsRef.current) return;
      const c = controlsRef.current.object;
      controlsRef.current.target.set(5,1.5,5);
      let r=18, theta=Math.PI/4, phi=Math.PI/3.2;
      if(view==='top'){r=20;theta=0;phi=0.01;}
      else if(view==='front'){r=18;theta=0;phi=Math.PI/2;}
      c.position.set(r*Math.sin(phi)*Math.sin(theta)+5, r*Math.cos(phi)+1.5, r*Math.sin(phi)*Math.cos(theta)+5);
      controlsRef.current.update();
    },
    toggleWireframe: () => setWireframe(w=>!w)
  }));

  return (
    <main className="canvas-area">
      <Canvas shadows camera={{position:[20,18,22],fov:35}} gl={{antialias:true,alpha:true}}>
        <ambientLight intensity={0.6} color="#ffffff"/>
        <directionalLight position={[15,25,15]} intensity={1.2} castShadow shadow-mapSize={[2048,2048]} shadow-bias={-0.0005} color="#ffffff"/>
        <pointLight position={[-10,10,-10]} intensity={1.5} color="#00e5ff"/>
        <pointLight position={[20,5,20]} intensity={1.0} color="#ff4d00"/>
        <Environment preset="city"/>
        <SceneContent parsedData={parsedData} wireframe={wireframe}/>
        <OrbitControls ref={controlsRef} makeDefault target={[5,1.5,5]} enableDamping dampingFactor={0.05} minDistance={2} maxDistance={40} maxPolarAngle={Math.PI/2-0.05}/>
      </Canvas>
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="mono">INITIALIZING ENGINE...</div>
        </div>
      )}
      <div className="canvas-overlay">
        <button className="cam-btn" onClick={()=>ref.current?.resetCamera()}>⟳ Reset</button>
        <button className="cam-btn" onClick={()=>ref.current?.setView('top')}>⊡ Top</button>
        <button className="cam-btn" onClick={()=>ref.current?.setView('front')}>◫ Front</button>
        <button className="cam-btn" onClick={()=>ref.current?.setView('iso')}>⬡ Iso</button>
        <button className={`cam-btn ${wireframe?'active':''}`} onClick={()=>setWireframe(!wireframe)}>⬜ Wireframe</button>
      </div>
    </main>
  );
});

export default ThreeCanvas;
