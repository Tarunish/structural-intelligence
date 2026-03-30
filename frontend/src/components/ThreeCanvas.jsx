import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Text, Billboard, Sky } from '@react-three/drei';
import * as THREE from 'three';

const WALL_HEIGHT = 3.2;
const W = 14;

const ROOM_STYLES = {
  LIVING_ROOM:  { floor: '#c8b89a', label: '🛋 Living Room' },
  GREAT_ROOM:   { floor: '#c8b89a', label: '🛋 Great Room' },
  BEDROOM:      { floor: '#b8a898', label: '🛏 Bedroom' },
  BEDROOM_1:    { floor: '#b8a898', label: '🛏 Bedroom 1' },
  BEDROOM_2:    { floor: '#b8a898', label: '🛏 Bedroom 2' },
  BEDROOM_3:    { floor: '#b8a898', label: '🛏 Bedroom 3' },
  BEDROOM_4:    { floor: '#b8a898', label: '🛏 Bedroom 4' },
  KITCHEN:      { floor: '#d4c4a0', label: '🍳 Kitchen' },
  BATHROOM:     { floor: '#a0b8c8', label: '🚿 Bathroom' },
  BATH:         { floor: '#a0b8c8', label: '🚿 Bathroom' },
  LAUNDRY:      { floor: '#b0b0b0', label: '🧺 Laundry' },
  FOYER:        { floor: '#c0b090', label: '🚪 Foyer' },
  HALLWAY:      { floor: '#b8b0a0', label: '🚶 Hallway' },
  STORAGE:      { floor: '#909090', label: '📦 Storage' },
  GARAGE:       { floor: '#808878', label: '🚗 Garage' },
  DEFAULT:      { floor: '#c0b090', label: '🏠 Room' },
};

function filterWalls(walls) {
  let filtered = walls.filter(w => {
    const [x1,y1]=w.start||[0,0], [x2,y2]=w.end||[0,0];
    return Math.sqrt((x2-x1)**2+(y2-y1)**2) >= 0.04;
  });
  const kept = [];
  for (let i=0; i<filtered.length; i++) {
    const w1=filtered[i];
    const cx1=(w1.start[0]+w1.end[0])/2, cy1=(w1.start[1]+w1.end[1])/2;
    let dup=false;
    for (let j=0; j<kept.length; j++) {
      const w2=kept[j];
      const cx2=(w2.start[0]+w2.end[0])/2, cy2=(w2.start[1]+w2.end[1])/2;
      if (Math.sqrt((cx1-cx2)**2+(cy1-cy2)**2)<0.03){dup=true;break;}
    }
    if (!dup) kept.push(w1);
  }
  return kept.slice(0,80);
}

const WallMesh = ({ wall, index, wireframe }) => {
  const [x1n,y1n]=wall.start||[0,0], [x2n,y2n]=wall.end||[0.1,0];
  const x1=x1n*W, z1=y1n*W, x2=x2n*W, z2=y2n*W;
  const dx=x2-x1, dz=z2-z1;
  const len=Math.sqrt(dx*dx+dz*dz);
  const cls=wall.classification||'PARTITION';
  const isLB=cls==='LOAD_BEARING';
  const h=(isLB?WALL_HEIGHT:WALL_HEIGHT*0.96)+index*0.001;
  const thickness=isLB?0.32:0.16;

  // Realistic wall colors
  const wallColor = isLB ? '#d4c4b0' : '#e8e0d4';
  const geo=useMemo(()=>new THREE.BoxGeometry(len+0.02,h,thickness),[len,h,thickness]);

  return (
    <group position={[(x1+x2)/2,h/2,(z1+z2)/2]} rotation={[0,-Math.atan2(dz,dx),0]}>
      <mesh castShadow receiveShadow geometry={geo}>
        <meshStandardMaterial 
          color={wallColor} 
          roughness={0.85} 
          metalness={0.0}
          wireframe={wireframe}
        />
      </mesh>
      {/* Top edge darker */}
      <mesh position={[0, h/2-0.05, 0]}>
        <boxGeometry args={[len+0.02, 0.1, thickness+0.02]}/>
        <meshStandardMaterial color={isLB?'#b0a090':'#c8c0b4'} roughness={0.9}/>
      </mesh>
    </group>
  );
};

const RoomFloor = ({ room }) => {
  const [cx,cy]=room.centroid_normalized||[0.5,0.5];
  const key=(room.label||'').toUpperCase().replace(/ /g,'_');
  const style=ROOM_STYLES[key]||ROOM_STYLES.DEFAULT;

  return (
    <group>
      {/* Main floor tile */}
      <mesh position={[cx*W,0.01,cy*W]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[W*0.23,W*0.23]}/>
        <meshStandardMaterial color={style.floor} roughness={0.6} metalness={0.05}/>
      </mesh>
      {/* Floor border */}
      <mesh position={[cx*W,0.015,cy*W]} rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[W*0.115, W*0.12, 4, 1]}/>
        <meshStandardMaterial color="#8a7a6a" roughness={0.8}/>
      </mesh>
      {/* Room label */}
      <Billboard position={[cx*W,1.2,cy*W]}>
        <Text
          fontSize={0.28}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
          maxWidth={3}
          textAlign="center"
        >
          {style.label}
        </Text>
      </Billboard>
    </group>
  );
};

const DoorMarker = ({ opening }) => {
  const [ox,oy]=opening.location||[0.5,0.5];
  return (
    <group position={[ox*W,0.05,oy*W]}>
      <mesh rotation={[-Math.PI/2,0,0]}>
        <ringGeometry args={[0.3,0.45,16,1,0,Math.PI/2]}/>
        <meshStandardMaterial color="#f5c518" side={THREE.DoubleSide} roughness={0.3}/>
      </mesh>
      <mesh position={[0,0.01,0]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[0.08,0.9]}/>
        <meshStandardMaterial color="#8B6914" roughness={0.8}/>
      </mesh>
      <Billboard position={[0,0.8,0]}>
        <Text fontSize={0.2} color="#f5c518" outlineWidth={0.02} outlineColor="#000">🚪 DOOR</Text>
      </Billboard>
    </group>
  );
};

const SceneContent = ({ parsedData, wireframe }) => {
  if (!parsedData||!parsedData.walls) return null;
  const walls=filterWalls(parsedData.walls);
  const rooms=parsedData.rooms||[];
  const doors=(parsedData.openings||[]).filter(o=>o.type==='DOOR').slice(0,10);

  return (
    <group>
      {/* Ground plane */}
      <mesh position={[W/2,-0.05,W/2]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[W+20,W+20]}/>
        <meshStandardMaterial color="#4a4a3a" roughness={1}/>
      </mesh>

      {/* Base concrete slab */}
      <mesh position={[W/2,0,W/2]} rotation={[-Math.PI/2,0,0]} receiveShadow>
        <planeGeometry args={[W+1,W+1]}/>
        <meshStandardMaterial color="#9a9080" roughness={0.9} metalness={0}/>
      </mesh>

      {/* Grid overlay */}
      <Grid position={[W/2,0.02,W/2]} args={[W+1,W+1]} cellSize={1} cellThickness={0.3}
        cellColor="#707060" sectionSize={5} sectionThickness={0.8}
        sectionColor="#505040" fadeDistance={30}/>

      {/* Room floors */}
      {rooms.map((room,i)=><RoomFloor key={i} room={room}/>)}

      {/* Door markers */}
      {doors.map((d,i)=><DoorMarker key={i} opening={d}/>)}

      {/* Walls */}
      {walls.map((wall,i)=><WallMesh key={i} wall={wall} index={i} wireframe={wireframe}/>)}

      {/* Ceiling — semi transparent */}
      <mesh position={[W/2,WALL_HEIGHT+0.05,W/2]} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[W,W]}/>
        <meshStandardMaterial color="#f0ece4" roughness={1} transparent opacity={0.08} side={THREE.DoubleSide}/>
      </mesh>
    </group>
  );
};

const ThreeCanvas = React.forwardRef(({ parsedData, isLoading }, ref) => {
  const [wireframe,setWireframe]=React.useState(false);
  const controlsRef=React.useRef();

  React.useImperativeHandle(ref,()=>({
    resetCamera:()=>{
      if(controlsRef.current){controlsRef.current.reset();controlsRef.current.target.set(W/2,1.5,W/2);}
    },
    setView:(view)=>{
      if(!controlsRef.current) return;
      const c=controlsRef.current.object;
      controlsRef.current.target.set(W/2,1.5,W/2);
      if(view==='top'){c.position.set(W/2,22,W/2);}
      else if(view==='front'){c.position.set(W/2,4,W+8);}
      else{c.position.set(W+8,18,W+8);}
      controlsRef.current.update();
    },
    toggleWireframe:()=>setWireframe(w=>!w)
  }));

  return (
    <main className="canvas-area">
      <Canvas shadows camera={{position:[W+8,18,W+8],fov:40}} gl={{antialias:true,alpha:true}}>
        {/* Sky */}
        <Sky sunPosition={[100,20,100]} turbidity={8} rayleigh={0.5}/>
        
        {/* Lighting */}
        <ambientLight intensity={0.5} color="#fff8f0"/>
        <directionalLight position={[20,30,20]} intensity={1.4} castShadow
          shadow-mapSize={[2048,2048]} shadow-bias={-0.001} color="#fff5e0"/>
        <directionalLight position={[-10,15,-10]} intensity={0.4} color="#c8d8f0"/>
        <pointLight position={[W/2,8,W/2]} intensity={0.6} color="#ffe8c0" distance={20}/>

        <SceneContent parsedData={parsedData} wireframe={wireframe}/>

        <OrbitControls ref={controlsRef} makeDefault target={[W/2,1.5,W/2]}
          enableDamping dampingFactor={0.05} minDistance={3} maxDistance={50}
          maxPolarAngle={Math.PI/2-0.02}/>
      </Canvas>

      {isLoading&&(
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="mono">BUILDING 3D MODEL...</div>
        </div>
      )}

      <div className="canvas-overlay">
        <button className="cam-btn" onClick={()=>ref.current?.resetCamera()}>⟳ Reset</button>
        <button className="cam-btn" onClick={()=>ref.current?.setView('top')}>⊡ Top</button>
        <button className="cam-btn" onClick={()=>ref.current?.setView('front')}>◫ Front</button>
        <button className="cam-btn" onClick={()=>ref.current?.setView('iso')}>⬡ Iso</button>
        <button className={`cam-btn ${wireframe?'active':''}`} onClick={()=>setWireframe(!wireframe)}>⬜ Wire</button>
      </div>
    </main>
  );
});

export default ThreeCanvas;
