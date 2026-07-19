import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { SketchDoc, SketchShape } from "./SketchEditor";
import { Camera, X, Move3d, RotateCcw, RotateCw } from "lucide-react";

/**
 * 3D isometric/perspective preview of the sketch. Rects & rooms become extruded
 * floor tiles, lines become walls. Controls follow 3ds Max conventions:
 *   - LMB drag                → orbit around target
 *   - MMB drag                → pan (truck/pedestal)
 *   - RMB drag                → dolly / zoom
 *   - Wheel                   → dolly
 *   - RMB held + W/A/S/D/Q/E  → fly the camera (like 3ds Max walkthrough)
 *   - Alt+LMB                 → orbit (Maya style, alt binding)
 *   - Ctrl+Shift+RMB          → fast fly (x3 speed)
 */
export function Sketch3DPreview({ doc, onClose }: { doc: SketchDoc; onClose: () => void }) {
  const mount = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<"iso" | "perspective">("perspective");
  const [autoRotate, setAutoRotate] = useState(false);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const autoRotateRef = useRef(false);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    if (!mount.current) return;
    const el = mount.current;
    const w = el.clientWidth, h = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(new THREE.Color(doc.background).getHex());
    scene.fog = new THREE.Fog(scene.background.getHex(), 800, 4000);
    sceneRef.current = scene;

    const persp = new THREE.PerspectiveCamera(55, w / h, 1, 8000);
    persp.position.set(doc.width / 2, 700, doc.height + 300);
    persp.lookAt(doc.width / 2, 0, doc.height / 2);
    const s = Math.max(doc.width, doc.height) * 0.9;
    const iso = new THREE.OrthographicCamera(-s / 2, s / 2, s / 2, -s / 2, 0.1, 8000);
    iso.position.set(doc.width / 2 + 1000, 1200, doc.height / 2 + 1000);
    iso.lookAt(doc.width / 2, 0, doc.height / 2);
    cameraRef.current = mode === "iso" ? iso : persp;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff2d1, 0.9);
    key.position.set(doc.width, 1500, doc.height);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ecfff, 0.4);
    fill.position.set(-doc.width, 800, -doc.height);
    scene.add(fill);

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(doc.width * 4, doc.height * 4), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(doc.width / 2, 0, doc.height / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid helper
    const grid = new THREE.GridHelper(Math.max(doc.width, doc.height) * 3, 60, 0x666666, 0x2c2c34);
    grid.position.set(doc.width / 2, 0.1, doc.height / 2);
    scene.add(grid);

    // Build shapes
    buildShapes(scene, doc.shapes, doc.height);

    // Controls state
    const state = {
      target: new THREE.Vector3(doc.width / 2, 0, doc.height / 2),
      dragging: null as null | "orbit" | "pan" | "dolly",
      last: { x: 0, y: 0 },
      keys: new Set<string>(),
      rmbDown: false,
    };

    function orbit(dx: number, dy: number) {
      const cam = cameraRef.current!;
      const offset = cam.position.clone().sub(state.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi - dy * 0.005));
      offset.setFromSpherical(spherical);
      cam.position.copy(state.target).add(offset);
      cam.lookAt(state.target);
    }
    function pan(dx: number, dy: number) {
      const cam = cameraRef.current!;
      const right = new THREE.Vector3(); const up = new THREE.Vector3();
      cam.matrix.extractBasis(right, up, new THREE.Vector3());
      const d = cam.position.distanceTo(state.target) * 0.0015;
      const delta = right.multiplyScalar(-dx * d).add(up.multiplyScalar(dy * d));
      cam.position.add(delta); state.target.add(delta);
    }
    function dolly(dy: number) {
      const cam = cameraRef.current!;
      const dir = cam.position.clone().sub(state.target);
      const scale = 1 + dy * 0.002;
      dir.multiplyScalar(Math.max(0.1, scale));
      cam.position.copy(state.target).add(dir);
    }

    const onDown = (e: PointerEvent) => {
      renderer.domElement.setPointerCapture(e.pointerId);
      state.last = { x: e.clientX, y: e.clientY };
      if (e.button === 2) { state.rmbDown = true; state.dragging = "dolly"; }
      else if (e.button === 1) state.dragging = "pan";
      else if (e.button === 0) state.dragging = e.altKey ? "orbit" : "orbit";
    };
    const onMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.last.x, dy = e.clientY - state.last.y;
      state.last = { x: e.clientX, y: e.clientY };
      if (state.dragging === "orbit") orbit(dx, dy);
      else if (state.dragging === "pan") pan(dx, dy);
      else if (state.dragging === "dolly") dolly(dy);
    };
    const onUp = (e: PointerEvent) => {
      if (e.button === 2) state.rmbDown = false;
      state.dragging = null;
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); dolly(e.deltaY); };
    const onCtx = (e: MouseEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => { state.keys.add(e.key.toLowerCase()); if (e.key === "Escape") onClose(); };
    const onKeyUp = (e: KeyboardEvent) => state.keys.delete(e.key.toLowerCase());

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const dt = clock.getDelta();
      // Auto-rotate around target
      if (autoRotateRef.current && cameraRef.current) {
        const cam = cameraRef.current;
        const offset = cam.position.clone().sub(state.target);
        const sph = new THREE.Spherical().setFromVector3(offset);
        sph.theta -= dt * 0.35;
        offset.setFromSpherical(sph);
        cam.position.copy(state.target).add(offset);
        cam.lookAt(state.target);
      }
      // Fly with RMB held + WASD (3ds Max walkthrough)
      if (state.rmbDown && cameraRef.current) {
        const cam = cameraRef.current;
        const speed = (state.keys.has("shift") ? 900 : 350) * dt;
        const forward = new THREE.Vector3(); cam.getWorldDirection(forward); forward.y = 0; forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
        const move = new THREE.Vector3();
        if (state.keys.has("w")) move.add(forward);
        if (state.keys.has("s")) move.sub(forward);
        if (state.keys.has("d")) move.add(right);
        if (state.keys.has("a")) move.sub(right);
        if (state.keys.has("e")) move.y += 1;
        if (state.keys.has("q")) move.y -= 1;
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(speed);
          cam.position.add(move); state.target.add(move);
        }
      }
      renderer.render(scene, cameraRef.current!);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight;
      renderer.setSize(nw, nh);
      const cam = cameraRef.current!;
      if (cam instanceof THREE.PerspectiveCamera) { cam.aspect = nw / nh; cam.updateProjectionMatrix(); }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, mode]);

  function screenshot() {
    const r = rendererRef.current; if (!r) return;
    r.render(sceneRef.current!, cameraRef.current!);
    const url = r.domElement.toDataURL("image/png");
    const a = document.createElement("a"); a.href = url; a.download = "dungeon-3d.png"; a.click();
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-white/10 text-white text-xs">
        <div className="flex items-center gap-1 rounded bg-white/10 px-2 py-1">
          <Camera className="h-3.5 w-3.5" /> نمای سه‌بعدی
        </div>
        <button onClick={() => setMode(mode === "iso" ? "perspective" : "iso")} className="rounded bg-white/10 hover:bg-white/20 px-2 py-1 flex items-center gap-1">
          <Move3d className="h-3.5 w-3.5" /> {mode === "iso" ? "Perspective" : "Isometric"}
        </button>
        <button onClick={() => setAutoRotate((v) => !v)} className={`rounded px-2 py-1 flex items-center gap-1 ${autoRotate ? "bg-emerald-500/30 hover:bg-emerald-500/40" : "bg-white/10 hover:bg-white/20"}`} title="چرخش خودکار">
          <RotateCw className="h-3.5 w-3.5" /> {autoRotate ? "چرخش روشن" : "چرخش خودکار"}
        </button>
        <button onClick={screenshot} className="rounded bg-white/10 hover:bg-white/20 px-2 py-1">Screenshot PNG</button>
        <div className="flex-1 text-center opacity-70">
          LMB=Orbit · MMB=Pan · RMB=Dolly · RMB+WASD/QE=Fly (Shift=Fast) · Wheel=Zoom · ESC=خروج
        </div>
        <button onClick={onClose} className="rounded bg-white/10 hover:bg-red-500/30 px-2 py-1 flex items-center gap-1">
          <X className="h-3.5 w-3.5" /> خروج
        </button>
        <button onClick={() => setMode(mode)} className="rounded bg-white/10 hover:bg-white/20 px-2 py-1" title="Reset"><RotateCcw className="h-3.5 w-3.5" /></button>
      </div>
      <div ref={mount} className="flex-1 relative" />
    </div>
  );
}

function buildShapes(scene: THREE.Scene, shapes: SketchShape[], mapH: number) {
  const wallH = 90;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 0.85 });
  const roomMat = new THREE.MeshStandardMaterial({ color: 0xd6c9a4, roughness: 1 });
  shapes.forEach((s) => {
    if (s.hidden) return;
    if (s.type === "rect") {
      const geo = new THREE.BoxGeometry(s.w, 4, s.h);
      const m = new THREE.Mesh(geo, roomMat);
      m.position.set(s.x + s.w / 2, 2, mapH - (s.y + s.h / 2));
      m.receiveShadow = true; scene.add(m);
      // border walls
      addWall(scene, s.x, s.y, s.x + s.w, s.y, wallH, mapH, wallMat);
      addWall(scene, s.x + s.w, s.y, s.x + s.w, s.y + s.h, wallH, mapH, wallMat);
      addWall(scene, s.x + s.w, s.y + s.h, s.x, s.y + s.h, wallH, mapH, wallMat);
      addWall(scene, s.x, s.y + s.h, s.x, s.y, wallH, mapH, wallMat);
    } else if (s.type === "line") {
      addWall(scene, s.x1, s.y1, s.x2, s.y2, wallH, mapH, wallMat, Math.max(6, s.strokeWidth * 2));
    } else if (s.type === "ellipse") {
      const geo = new THREE.CylinderGeometry(s.w / 2, s.w / 2, 4, 32);
      const m = new THREE.Mesh(geo, roomMat);
      m.scale.z = s.h / s.w;
      m.position.set(s.x + s.w / 2, 2, mapH - (s.y + s.h / 2));
      scene.add(m);
    } else if (s.type === "stamp") {
      addStamp(scene, s, mapH);
    }
  });
}

function addWall(scene: THREE.Scene, x1: number, y1: number, x2: number, y2: number, h: number, mapH: number, mat: THREE.Material, thickness = 8) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy); if (len < 1) return;
  const geo = new THREE.BoxGeometry(len, h, thickness);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  m.position.set((x1 + x2) / 2, h / 2, mapH - (y1 + y2) / 2);
  m.rotation.y = -Math.atan2(dy, dx);
  scene.add(m);
}

function addStamp(scene: THREE.Scene, s: Extract<SketchShape, { type: "stamp" }>, mapH: number) {
  // A stamp's SVG bounding box in the editor is a size×size square centered on
  // (s.x, s.y). We mirror that footprint in 3D so what the user sees on the
  // canvas matches what appears in the preview.
  //
  // Layer heights (Y is up):
  //   floor tile ......... y = 0.1  (drawn by buildShapes for rooms/rects)
  //   water surface ...... y = 0.6  (below the base tile so lakes read as water)
  //   base tile .......... y = 1.0  (thin colored disc that anchors the stamp)
  //   wall / door body ... base at y = 1.2, extruded upward
  //   props .............. rest on base tile (y = 1.0 + height/2)
  const cx = s.x, cz = mapH - s.y;
  const size = s.size;
  const half = size / 2;
  const color = new THREE.Color(s.color || "#2b2b2b");
  const kind = s.kind;

  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  // Every stamp gets a footprint disc so its "layer" is visually explicit and
  // its origin matches the SVG center exactly.
  const isFloorLayer = kind.startsWith("lake") || kind === "pond" || kind === "river" || kind === "waterfall" || kind === "elem-water" || kind === "elem-air" || kind === "elem-storm" || kind === "compass" || kind === "scale-bar";
  if (!isFloorLayer) {
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0xece2c6, roughness: 1, transparent: true, opacity: 0.45 }),
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.y = 1.0;
    tile.receiveShadow = true;
    group.add(tile);
  }

  const add = (mesh: THREE.Object3D) => { mesh.castShadow = true; group.add(mesh); };

  if (kind.startsWith("wall-")) {
    // 2D: a size×size square filled as wall. 3D: full-footprint block that
    // stands from the base tile upward.
    const wallH = size * 0.9;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(size, wallH, size),
      new THREE.MeshStandardMaterial({ color: kind === "wall-brick" ? 0x9a5a3a : kind === "wall-rubble" ? 0x6a5a4a : 0x7a6a4a, roughness: 0.95 }),
    );
    m.position.y = 1.2 + wallH / 2;
    add(m);
  } else if (kind.startsWith("door")) {
    // 2D door spans width = size, height = size*0.3 across the doorway.
    const doorH = size * 0.9;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(size, doorH, size * 0.15),
      new THREE.MeshStandardMaterial({ color: kind === "door-iron" || kind === "door-vault" ? 0x555555 : 0x5a3d1e, metalness: kind === "door-iron" ? 0.6 : 0, roughness: 0.7 }),
    );
    frame.position.y = 1.2 + doorH / 2;
    add(frame);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(size * 0.05), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 }));
    knob.position.set(size * 0.3, 1.2 + doorH / 2, size * 0.09);
    group.add(knob);
  } else if (kind.startsWith("lake") || kind === "pond" || kind === "river" || kind === "waterfall" || kind === "elem-water") {
    // Water fills the footprint at its own low layer (below base tile height).
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x2a6ba8, roughness: 0.2, metalness: 0.5, transparent: true, opacity: 0.85 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.6;
    group.add(m);
  } else if (kind.startsWith("bridge")) {
    // Bridge deck spans exactly `size` across its footprint.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(size, size * 0.08, size * 0.6),
      new THREE.MeshStandardMaterial({ color: kind === "bridge-rock" || kind === "bridge-arch" ? 0x8a8a8a : 0x8b5a2b, roughness: 0.85 }),
    );
    deck.position.y = 1.2 + size * 0.04;
    add(deck);
  } else if (kind === "elem-fire") {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(size * 0.33, size * 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff3a00, emissiveIntensity: 0.9 }),
    );
    flame.position.y = 1.0 + size * 0.45;
    add(flame);
    const light = new THREE.PointLight(0xff8040, 1.2, size * 4);
    light.position.y = size;
    group.add(light);
  } else if (kind === "elem-earth") {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(size * 0.4), new THREE.MeshStandardMaterial({ color: 0x8b6a3b, roughness: 1 }));
    m.position.y = 1.0 + size * 0.4;
    add(m);
  } else if (kind === "elem-air" || kind === "elem-storm") {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(size * 0.4, size * 0.06, 12, 32),
      new THREE.MeshStandardMaterial({ color: kind === "elem-storm" ? 0x6a4aa8 : 0xa8c8e0, transparent: true, opacity: 0.75 }),
    );
    t.rotation.x = -Math.PI / 2;
    t.position.y = 1.0 + size * 0.4;
    group.add(t);
  } else if (kind === "pillar") {
    // 2D pillar is a circle of diameter=size. 3D column matches that diameter.
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(half * 0.85, half * 0.85, size * 1.4, 20),
      new THREE.MeshStandardMaterial({ color: 0xcfc7b3 }),
    );
    m.position.y = 1.2 + size * 0.7;
    add(m);
  } else if (kind === "stairs-up" || kind === "stairs-down") {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const g = new THREE.BoxGeometry(size, size * 0.08, size / steps);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x9a8a6a }));
      const level = kind === "stairs-up" ? (i + 1) : (steps - i);
      const stepH = size * 0.08;
      m.position.set(0, 1.0 + level * stepH - stepH / 2, -half + (i + 0.5) * (size / steps));
      add(m);
    }
  } else if (kind === "spiral-stairs") {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const stepH = size * 0.07;
      const m = new THREE.Mesh(new THREE.BoxGeometry(size * 0.45, stepH, size * 0.18), new THREE.MeshStandardMaterial({ color: 0x9a8a6a }));
      m.position.set(Math.cos(a) * size * 0.28, 1.0 + (i + 1) * stepH, Math.sin(a) * size * 0.28);
      m.rotation.y = -a;
      add(m);
    }
  } else if (kind === "treasure") {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, size * 0.4, size * 0.5), new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 0.8 }));
    chest.position.y = 1.0 + size * 0.2;
    add(chest);
    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.35, 20, 10, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 }),
    );
    lid.position.y = 1.0 + size * 0.4;
    lid.rotation.x = -Math.PI / 2;
    lid.scale.z = 0.5 / 0.35; // stretch to chest depth
    group.add(lid);
  } else if (kind === "monster" || kind === "trap") {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(half * 0.75, size * 0.9, kind === "trap" ? 3 : 5),
      new THREE.MeshStandardMaterial({ color: kind === "trap" ? 0xa83030 : 0x603060, emissive: kind === "trap" ? 0x400000 : 0x200030, emissiveIntensity: 0.35 }),
    );
    m.position.y = 1.0 + size * 0.45;
    add(m);
  } else if (kind === "compass" || kind === "scale-bar") {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(half, half, 2, 24), new THREE.MeshStandardMaterial({ color: 0xf0e6c8 }));
    m.position.y = 0.7;
    group.add(m);
  } else {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.4, 16, 16),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 }),
    );
    cap.position.y = 1.0 + size * 0.4;
    add(cap);
  }

  scene.add(group);
}