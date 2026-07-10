import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { SketchDoc, SketchShape } from "./SketchEditor";
import { Camera, X, Move3d, RotateCcw } from "lucide-react";

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
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

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