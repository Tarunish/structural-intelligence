import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const MAT_COLORS = {
  LOAD_BEARING: 0xc8a882,  // warm concrete/brick
  PARTITION:    0xe8dcc8,  // light plaster/drywall
  LONG_SPAN:    0xa0b4c8,  // steel grey-blue
  SLAB:         0x8a9bb0,
  COLUMN:       0x7c8a9a,
};

function filterWalls(walls) {
  const MIN_LEN = 0.03;
  const filtered = walls.filter(w => {
    const [x1, y1] = w.start || [0, 0];
    const [x2, y2] = w.end || [0, 0];
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    return len >= MIN_LEN;
  });

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
      if (dist < 0.025) { duplicate = true; break; }
    }
    if (!duplicate) kept.push(w1);
  }
  return kept;
}

const ThreeCanvas = forwardRef(({ parsedData, isLoading }, ref) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const walls3DRef = useRef([]);

  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(8, 10, 12);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // LIGHTS
    const ambient = new THREE.AmbientLight(0xfff8f0, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xc8d8e8, 0.4);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    const bounceLight = new THREE.DirectionalLight(0xf0e8d0, 0.2);
    bounceLight.position.set(0, -5, 0);
    scene.add(bounceLight);

    const grid = new THREE.GridHelper(20, 40, 0x1e1e2e, 0x1e1e2e);
    scene.add(grid);

    // CONTROLS (Replacing custom math with smooth OrbitControls)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05; // Smooth rotation inertia
    controls.target.set(5, 0, 5);
    controlsRef.current = controls;

    // RESIZE HANDLER
    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ANIMATION LOOP
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update(); // required for damping
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      controls.dispose();
    };
  }, []);

  // BUILD MODEL EFFECT MINIMISED
  useEffect(() => {
    if (!sceneRef.current || !parsedData) return;

    const scene = sceneRef.current;
    
    // Clear old walls
    walls3DRef.current.forEach(obj => scene.remove(obj));
    walls3DRef.current = [];
    scene.children.filter(c => c.userData.isFloor || c.userData.isRoom).forEach(c => scene.remove(c));

    const rawWalls = parsedData.walls || [];
    const walls = filterWalls(rawWalls);
    const rooms = parsedData.rooms || [];
    const W = 14;

    const floorGeo = new THREE.PlaneGeometry(W + 2, W + 2);
    const floorMat = new THREE.MeshPhongMaterial({ color: 0x9e9e8e, shininess: 10 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(W / 2, 0, W / 2);
    floor.receiveShadow = true;
    floor.userData.isFloor = true;
    scene.add(floor);

    const roomTileColors = [0xb5aa96, 0xb0b5a0, 0xa8a898, 0xb2a89a, 0xa0a8b0, 0xb0a8a0];
    rooms.forEach((room, i) => {
      const [cx, cy] = room.centroid_normalized || [0.5, 0.5];
      const geo = new THREE.PlaneGeometry(W * 0.22, W * 0.22);
      const mat = new THREE.MeshPhongMaterial({
        color: roomTileColors[i % roomTileColors.length],
        shininess: 20, transparent: true, opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cx * W, 0.02, cy * W);
      mesh.receiveShadow = true;
      mesh.userData.isRoom = true;
      scene.add(mesh);
    });

    const WALL_HEIGHT = 3.2;

    walls.forEach((wall, i) => {
      const [x1n, y1n] = wall.start || [0, 0];
      const [x2n, y2n] = wall.end || [0.1, 0];

      const x1 = x1n * W, z1 = y1n * W;
      const x2 = x2n * W, z2 = y2n * W;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.05) return;

      const cls = wall.classification || 'PARTITION';
      const isLB = cls === 'LOAD_BEARING';

      const thickness = isLB ? 0.28 : 0.14;
      const color = MAT_COLORS[cls] || MAT_COLORS.PARTITION;

      const geo = new THREE.BoxGeometry(len, WALL_HEIGHT, thickness);
      const mat = new THREE.MeshPhongMaterial({
        color,
        shininess: isLB ? 5 : 15,
        specular: 0x222222,
      });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.set((x1 + x2) / 2, WALL_HEIGHT / 2, (z1 + z2) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { classification: cls, wallIndex: i };

      scene.add(mesh);
      walls3DRef.current.push(mesh);

      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: isLB ? 0x8a6a4a : 0xb0a888,
        opacity: 0.4, transparent: true
      }));
      mesh.add(line);
    });

    const roofGeo = new THREE.PlaneGeometry(W, W);
    const roofMat = new THREE.MeshPhongMaterial({
      color: 0xaaccee, transparent: true, opacity: 0.06,
      side: THREE.DoubleSide, shininess: 80
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(W / 2, WALL_HEIGHT, W / 2);
    roof.userData.isFloor = true;
    scene.add(roof);

    const roofEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.08, W));
    const roofEdgeLine = new THREE.LineSegments(roofEdgeGeo, new THREE.LineBasicMaterial({ color: 0x8a9a8a, opacity: 0.5, transparent: true }));
    roofEdgeLine.position.set(W / 2, WALL_HEIGHT, W / 2);
    roofEdgeLine.userData.isFloor = true;
    scene.add(roofEdgeLine);

    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(5, 1.5, 5);
      cameraRef.current.position.set(18 * Math.sin(Math.PI/3.2) * Math.sin(Math.PI/4) + 5, 18 * Math.cos(Math.PI/3.2) + 1.5, 18 * Math.sin(Math.PI/3.2) * Math.cos(Math.PI/4) + 5);
      controlsRef.current.update();
    }
  }, [parsedData]);

  // LOCAL METHODS FOR BUTTON CONTROLS
  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    controlsRef.current.target.set(5, 1.5, 5);
    cameraRef.current.position.set(
      18 * Math.sin(Math.PI/3.2) * Math.sin(Math.PI/4) + 5, 
      18 * Math.cos(Math.PI/3.2) + 1.5, 
      18 * Math.sin(Math.PI/3.2) * Math.cos(Math.PI/4) + 5
    );
  };
  
  const setView = (view) => {
    if (!cameraRef.current || !controlsRef.current) return;
    controlsRef.current.target.set(5, 1.5, 5);
    
    let r = 18, theta = Math.PI/4, phi = Math.PI/3.2;
    if (view === 'top') { r = 20; theta = 0; phi = 0.05; }
    else if (view === 'front') { r = 18; theta = 0; phi = Math.PI/2; }
    
    cameraRef.current.position.set(
      r * Math.sin(phi) * Math.sin(theta) + 5,
      r * Math.cos(phi) + 1.5,
      r * Math.sin(phi) * Math.cos(theta) + 5
    );
  };

  const toggleWireframe = () => {
    const isWireframe = walls3DRef.current[0]?.material?.wireframe ?? false;
    walls3DRef.current.forEach(mesh => {
      mesh.material.wireframe = !isWireframe;
    });
  };

  useImperativeHandle(ref, () => ({ resetCamera, setView, toggleWireframe }));

  return (
    <main className="canvas-area">
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div>Initializing Engine / Processing Data...</div>
        </div>
      )}

      <div className="canvas-overlay">
        <button className="cam-btn" onClick={() => resetCamera()}>⟳ Reset View</button>
        <button className="cam-btn" onClick={() => setView('top')}>⊡ Top</button>
        <button className="cam-btn" onClick={() => setView('front')}>◫ Front</button>
        <button className="cam-btn" onClick={() => setView('iso')}>⬡ Iso</button>
        <button className="cam-btn" onClick={() => toggleWireframe()}>⬜ Wireframe</button>
      </div>
    </main>
  );
});

export default ThreeCanvas;
