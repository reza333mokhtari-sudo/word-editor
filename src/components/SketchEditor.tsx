import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MousePointer2, Move as MoveIcon, Pen, Square, Circle, Minus, Type as TypeIcon, Image as ImageIcon,
  Trash2, Undo2, Redo2, Download, Palette, Layers, Copy, ArrowUp, ArrowDown, Lock, Unlock, Eye, EyeOff,
  Grid3x3, Hexagon, Wand2, Box, Camera, ZoomIn, ZoomOut, Maximize2,
  DoorClosed, DoorOpen, KeyRound, Fence, ChevronsUp, ChevronsDown, RotateCw,
  Columns3, Gem, Skull, AlertTriangle, Compass, Ruler, Hash, Printer, Sparkle,
  BrickWall, Flame, Droplets, Mountain, Wind, CloudLightning, Waves, Tornado,
} from "lucide-react";
import { Sketch3DPreview } from "./Sketch3DPreview";

export type SketchShape =
  | ({ id: string; type: "path"; d: string; stroke: string; strokeWidth: number; fill?: string } & ShapeCommon)
  | ({ id: string; type: "rect"; x: number; y: number; w: number; h: number; radius: number; stroke: string; strokeWidth: number; fill: string } & ShapeCommon)
  | ({ id: string; type: "ellipse"; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number; fill: string } & ShapeCommon)
  | ({ id: string; type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number } & ShapeCommon)
  | ({ id: string; type: "text"; x: number; y: number; text: string; fontSize: number; fill: string } & ShapeCommon)
  | ({ id: string; type: "stamp"; kind: StampKind; x: number; y: number; size: number; color: string; label?: string } & ShapeCommon);

export type StampKind =
  | "door" | "secret-door" | "locked-door" | "portcullis"
  | "stairs-up" | "stairs-down" | "spiral-stairs"
  | "pillar" | "treasure" | "monster" | "trap"
  | "compass" | "scale-bar"
  // 5 doors (extra models)
  | "door-iron" | "door-arched" | "door-double" | "door-hidden-arch" | "door-vault"
  // 5 walls
  | "wall-stone" | "wall-brick" | "wall-rubble" | "wall-thick" | "wall-broken"
  // 5 lakes / water bodies
  | "lake-small" | "lake-large" | "pond" | "river" | "waterfall"
  // 5 bridges (wood + rock)
  | "bridge-wood" | "bridge-rock" | "bridge-rope" | "bridge-arch" | "bridge-broken"
  // 5 elementals
  | "elem-fire" | "elem-water" | "elem-earth" | "elem-air" | "elem-storm";

type ShapeCommon = {
  opacity?: number; locked?: boolean; hidden?: boolean; name?: string;
  tx?: number; ty?: number; rotation?: number; scaleX?: number; scaleY?: number;
};

export type SketchDoc = { kind: "sketch"; version: 1; width: number; height: number; background: string; shapes: SketchShape[] };

export function emptySketchDoc(): SketchDoc {
  return { kind: "sketch", version: 1, width: 1600, height: 1000, background: "#ffffff", shapes: [] };
}

export function isSketchDoc(v: unknown): v is SketchDoc {
  return !!v && typeof v === "object" && (v as { kind?: string }).kind === "sketch";
}

type Tool = "select" | "move" | "pen" | "rect" | "ellipse" | "line" | "text" | "wall" | "room" | "cave" | "stamp";

const uid = () => Math.random().toString(36).slice(2, 10);

function shapeName(s: SketchShape) {
  if (s.name) return s.name;
  const map: Record<string, string> = { path: "طرح", rect: "مستطیل", ellipse: "بیضی", line: "خط", text: "متن", stamp: "نماد" };
  return map[s.type] ?? s.type;
}

type StampGroup = "doors" | "walls" | "lakes" | "bridges" | "elementals" | "features" | "map";
const STAMPS: { kind: StampKind; label: string; group: StampGroup; Icon: React.ComponentType<{ className?: string }> }[] = [
  // Doors — 5 base + 5 extra models
  { kind: "door", label: "در ساده", group: "doors", Icon: DoorClosed },
  { kind: "secret-door", label: "در مخفی", group: "doors", Icon: DoorOpen },
  { kind: "locked-door", label: "در قفل", group: "doors", Icon: KeyRound },
  { kind: "portcullis", label: "دروازه شبکه‌ای", group: "doors", Icon: Fence },
  { kind: "door-iron", label: "در آهنی", group: "doors", Icon: DoorClosed },
  { kind: "door-arched", label: "در قوسی", group: "doors", Icon: DoorOpen },
  { kind: "door-double", label: "در دولنگه", group: "doors", Icon: DoorOpen },
  { kind: "door-hidden-arch", label: "طاق مخفی", group: "doors", Icon: DoorOpen },
  { kind: "door-vault", label: "در گاوصندوق", group: "doors", Icon: KeyRound },
  // Walls — 5 models
  { kind: "wall-stone", label: "دیوار سنگی", group: "walls", Icon: BrickWall },
  { kind: "wall-brick", label: "دیوار آجری", group: "walls", Icon: BrickWall },
  { kind: "wall-rubble", label: "آوار", group: "walls", Icon: BrickWall },
  { kind: "wall-thick", label: "دیوار قطور", group: "walls", Icon: BrickWall },
  { kind: "wall-broken", label: "دیوار شکسته", group: "walls", Icon: BrickWall },
  // Lakes — 5 water bodies
  { kind: "lake-small", label: "دریاچه کوچک", group: "lakes", Icon: Droplets },
  { kind: "lake-large", label: "دریاچه بزرگ", group: "lakes", Icon: Waves },
  { kind: "pond", label: "برکه", group: "lakes", Icon: Droplets },
  { kind: "river", label: "رودخانه", group: "lakes", Icon: Waves },
  { kind: "waterfall", label: "آبشار", group: "lakes", Icon: Waves },
  // Bridges — 5 models (wood + rock)
  { kind: "bridge-wood", label: "پل چوبی", group: "bridges", Icon: Minus },
  { kind: "bridge-rock", label: "پل سنگی", group: "bridges", Icon: Mountain },
  { kind: "bridge-rope", label: "پل طنابی", group: "bridges", Icon: Minus },
  { kind: "bridge-arch", label: "پل طاقی", group: "bridges", Icon: Mountain },
  { kind: "bridge-broken", label: "پل شکسته", group: "bridges", Icon: Minus },
  // Elementals — fire/water/earth/air/storm
  { kind: "elem-fire", label: "آتش", group: "elementals", Icon: Flame },
  { kind: "elem-water", label: "آب", group: "elementals", Icon: Droplets },
  { kind: "elem-earth", label: "خاک", group: "elementals", Icon: Mountain },
  { kind: "elem-air", label: "باد", group: "elementals", Icon: Wind },
  { kind: "elem-storm", label: "طوفان", group: "elementals", Icon: CloudLightning },
  // Features
  { kind: "stairs-up", label: "پله بالا", group: "features", Icon: ChevronsUp },
  { kind: "stairs-down", label: "پله پایین", group: "features", Icon: ChevronsDown },
  { kind: "spiral-stairs", label: "پله مارپیچ", group: "features", Icon: RotateCw },
  { kind: "pillar", label: "ستون", group: "features", Icon: Columns3 },
  { kind: "treasure", label: "گنج", group: "features", Icon: Gem },
  { kind: "monster", label: "هیولا", group: "features", Icon: Skull },
  { kind: "trap", label: "تله", group: "features", Icon: AlertTriangle },
  // Map annotations
  { kind: "compass", label: "قطب‌نما", group: "map", Icon: Compass },
  { kind: "scale-bar", label: "مقیاس", group: "map", Icon: Ruler },
];

const STAMP_GROUP_LABEL: Record<StampGroup, string> = {
  doors: "درها",
  walls: "دیوارها",
  lakes: "دریاچه و آب",
  bridges: "پل‌ها",
  elementals: "عناصر",
  features: "ویژگی‌ها",
  map: "نقشه",
};

type Theme = { id: string; label: string; bg: string; stroke: string; roomFill: string; hatched: boolean };
const THEMES: Theme[] = [
  { id: "classic",   label: "کلاسیک B&W",   bg: "#ffffff", stroke: "#111111", roomFill: "#f4f1e8", hatched: true },
  { id: "sepia",     label: "سپیا وینتیج",  bg: "#f6ecd2", stroke: "#3a2a1a", roomFill: "#e8dbb3", hatched: true },
  { id: "blueprint", label: "نقشه آبی",     bg: "#0e3a68", stroke: "#e8f4ff", roomFill: "#134a80", hatched: false },
  { id: "parchment", label: "پوست‌نبشته",    bg: "#efe3c3", stroke: "#4a2f1a", roomFill: "#dcc99a", hatched: true },
];

type Props = {
  doc: SketchDoc;
  onChange: (d: SketchDoc) => void;
  title: string;
};

export function SketchEditor({ doc, onChange, title }: Props) {
  const [tool, setTool] = useState<Tool>("select");
  const [stroke, setStroke] = useState("#111827");
  const [fill, setFill] = useState("#a5f3fc");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(24);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<SketchDoc[]>([]);
  const [future, setFuture] = useState<SketchDoc[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState({ x: -200, y: -200, zoom: 1 });
  const [gridType, setGridType] = useState<"none" | "square" | "hex">("square");
  const [gridSize, setGridSize] = useState(48);
  const [show3D, setShow3D] = useState(false);
  const [stampKind, setStampKind] = useState<StampKind>("door");
  const [stampSize, setStampSize] = useState(48);
  const [hatched, setHatched] = useState(true);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // in-progress drawing state
  const drawingRef = useRef<{ startX: number; startY: number; points?: [number, number][]; id?: string } | null>(null);
  const [draft, setDraft] = useState<SketchShape | null>(null);
  // drag-to-move state (select/move tools)
  const dragRef = useRef<{ id: string; startX: number; startY: number; baseTx: number; baseTy: number } | null>(null);
  // transform dialog
  const [transformFor, setTransformFor] = useState<string | null>(null);

  const commit = useCallback((next: SketchDoc) => {
    setHistory((h) => [...h.slice(-49), doc]);
    setFuture([]);
    onChange(next);
  }, [doc, onChange]);

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [doc, ...f].slice(0, 50));
    onChange(prev);
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h.slice(-49), doc]);
    onChange(next);
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Escape") { setTool("select"); setSelectedId(null); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) { e.preventDefault(); commit({ ...doc, shapes: doc.shapes.filter((s) => s.id !== selectedId) }); setSelectedId(null); }
      }
      const map: Record<string, Tool> = { v: "select", p: "pen", r: "rect", o: "ellipse", l: "line", t: "text", w: "wall", c: "cave" };
      if (map[e.key.toLowerCase()]) { setTool(map[e.key.toLowerCase()]); }
    if (e.key.toLowerCase() === "m") { setTool("move"); }
    if (e.key.toLowerCase() === "s") { setTool("stamp"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, selectedId, history, future]);

  function pointerCoords(e: React.PointerEvent<SVGSVGElement>): [number, number] {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    const p = pt.matrixTransform(ctm.inverse());
    return [Math.round(p.x), Math.round(p.y)];
  }

  function snap(v: number) { return gridType === "none" ? v : Math.round(v / gridSize) * gridSize; }

  function smoothPath(points: [number, number][]) {
    if (points.length < 2) return "";
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      d += ` Q ${x1} ${y1} ${mx} ${my}`;
    }
    const [lx, ly] = points[points.length - 1];
    d += ` L ${lx} ${ly}`;
    return d;
  }

  // Rough/organic cave-brush path — jitters each point for a hand-drawn look.
  function roughPath(points: [number, number][]) {
    if (points.length < 2) return "";
    const j = (v: number) => v + (Math.random() - 0.5) * 3;
    let d = `M ${j(points[0][0])} ${j(points[0][1])}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      d += ` Q ${j(x1)} ${j(y1)} ${j(mx)} ${j(my)}`;
    }
    const [lx, ly] = points[points.length - 1];
    d += ` L ${j(lx)} ${j(ly)}`;
    return d;
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Middle-mouse or space+drag = pan
    if (e.button === 1 || (e.button === 0 && (e.shiftKey && (tool === "select" || tool === "move")))) {
      panRef.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const [x, y] = pointerCoords(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);

    if (tool === "select" || tool === "move") {
      // click on empty area deselects
      if (e.target === svgRef.current) { setSelectedId(null); return; }
      // shape-level onPointerDown will set selectedId + start drag
      return;
    }
    if (tool === "text") {
      const value = prompt("متن:", "متن نمونه");
      if (!value) return;
      const s: SketchShape = { id: uid(), type: "text", x: snap(x), y: snap(y), text: value, fontSize, fill: stroke };
      commit({ ...doc, shapes: [...doc.shapes, s] });
      setSelectedId(s.id);
      setTool("select");
      return;
    }
    if (tool === "stamp") {
      const s: SketchShape = { id: uid(), type: "stamp", kind: stampKind, x: snap(x), y: snap(y), size: stampSize, color: stroke };
      commit({ ...doc, shapes: [...doc.shapes, s] });
      setSelectedId(s.id);
      return;
    }
    if (tool === "pen" || tool === "cave") {
      drawingRef.current = { startX: x, startY: y, points: [[x, y]], id: uid() };
      setDraft({ id: drawingRef.current.id!, type: "path", d: `M ${x} ${y}`, stroke, strokeWidth: tool === "cave" ? Math.max(strokeWidth, 4) : strokeWidth });
      return;
    }
    const sx = snap(x), sy = snap(y);
    drawingRef.current = { startX: sx, startY: sy, id: uid() };
    if (tool === "rect" || tool === "room") setDraft({ id: drawingRef.current.id!, type: "rect", x: sx, y: sy, w: 0, h: 0, radius: tool === "room" ? 0 : 6, stroke, strokeWidth: tool === "room" ? Math.max(strokeWidth, 3) : strokeWidth, fill: tool === "room" ? "#e8dbb3" : fill });
    else if (tool === "ellipse") setDraft({ id: drawingRef.current.id!, type: "ellipse", x, y, w: 0, h: 0, stroke, strokeWidth, fill });
    else if (tool === "line" || tool === "wall") setDraft({ id: drawingRef.current.id!, type: "line", x1: sx, y1: sy, x2: sx, y2: sy, stroke, strokeWidth: tool === "wall" ? Math.max(strokeWidth, 5) : strokeWidth });
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (panRef.current) {
      const p = panRef.current;
      setView((v) => ({ ...v, x: p.ox - (e.clientX - p.sx) / v.zoom, y: p.oy - (e.clientY - p.sy) / v.zoom }));
      return;
    }
    const [x, y] = pointerCoords(e);
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = x - d.startX, dy = y - d.startY;
      onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === d.id ? { ...s, tx: d.baseTx + dx, ty: d.baseTy + dy } as SketchShape : s) });
      return;
    }
    if (!drawingRef.current) return;
    const st = drawingRef.current;
    if ((tool === "pen" || tool === "cave") && st.points) {
      st.points.push([x, y]);
      const d = tool === "cave" ? roughPath(st.points) : smoothPath(st.points);
      setDraft({ id: st.id!, type: "path", d, stroke, strokeWidth: tool === "cave" ? Math.max(strokeWidth, 4) : strokeWidth });
    } else if (tool === "rect" || tool === "room") {
      const nx = snap(x), ny = snap(y);
      setDraft({ id: st.id!, type: "rect", x: Math.min(st.startX, nx), y: Math.min(st.startY, ny), w: Math.abs(nx - st.startX), h: Math.abs(ny - st.startY), radius: tool === "room" ? 0 : 6, stroke, strokeWidth: tool === "room" ? Math.max(strokeWidth, 3) : strokeWidth, fill: tool === "room" ? "#e8dbb3" : fill });
    } else if (tool === "ellipse") {
      setDraft({ id: st.id!, type: "ellipse", x: Math.min(st.startX, x), y: Math.min(st.startY, y), w: Math.abs(x - st.startX), h: Math.abs(y - st.startY), stroke, strokeWidth, fill });
    } else if (tool === "line" || tool === "wall") {
      const nx = snap(x), ny = snap(y);
      setDraft({ id: st.id!, type: "line", x1: st.startX, y1: st.startY, x2: nx, y2: ny, stroke, strokeWidth: tool === "wall" ? Math.max(strokeWidth, 5) : strokeWidth });
    }
  }

  function onPointerUp() {
    if (panRef.current) { panRef.current = null; return; }
    if (dragRef.current) { dragRef.current = null; commit(doc); return; }
    if (!drawingRef.current || !draft) { drawingRef.current = null; return; }
    const s = draft;
    // filter out zero-size shapes
    const isZero =
      (s.type === "rect" && s.w < 2 && s.h < 2) ||
      (s.type === "ellipse" && s.w < 2 && s.h < 2) ||
      (s.type === "line" && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < 2) ||
      (s.type === "path" && !s.d.includes("L") && !s.d.includes("Q"));
    if (!isZero) commit({ ...doc, shapes: [...doc.shapes, s] });
    drawingRef.current = null;
    setDraft(null);
    if (tool !== "pen" && tool !== "cave" && tool !== "wall" && tool !== "room") setTool("select");
    if (!isZero) setSelectedId(s.id);
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setView((v) => ({ ...v, zoom: Math.max(0.1, Math.min(6, v.zoom * factor)) }));
  }

  function generateDungeon() {
    // Simple BSP dungeon: split area, add rooms + corridor walls.
    const W = 1600, H = 1000, MIN = 220;
    type R = { x: number; y: number; w: number; h: number };
    const rooms: R[] = [];
    function split(x: number, y: number, w: number, h: number, depth: number) {
      if (depth === 0 || (w < MIN * 2 && h < MIN * 2)) {
        const pad = 30 + Math.random() * 40;
        rooms.push({ x: x + pad, y: y + pad, w: Math.max(80, w - pad * 2), h: Math.max(80, h - pad * 2) });
        return;
      }
      const horiz = w < h ? true : w > h ? false : Math.random() < 0.5;
      if (horiz) {
        const s = h * (0.35 + Math.random() * 0.3);
        split(x, y, w, s, depth - 1); split(x, y + s, w, h - s, depth - 1);
      } else {
        const s = w * (0.35 + Math.random() * 0.3);
        split(x, y, s, h, depth - 1); split(x + s, y, w - s, h, depth - 1);
      }
    }
    split(60, 60, W - 120, H - 120, 4);
    const shapes: SketchShape[] = [];
    rooms.forEach((r) => {
      shapes.push({ id: uid(), type: "rect", x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h), radius: 0, stroke: "#3a2a1a", strokeWidth: 4, fill: "#e8dbb3" });
    });
    // corridors between consecutive room centers
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
      shapes.push({ id: uid(), type: "line", x1: Math.round(ax), y1: Math.round(ay), x2: Math.round(bx), y2: Math.round(ay), stroke: "#3a2a1a", strokeWidth: 6 });
      shapes.push({ id: uid(), type: "line", x1: Math.round(bx), y1: Math.round(ay), x2: Math.round(bx), y2: Math.round(by), stroke: "#3a2a1a", strokeWidth: 6 });
    }
    commit({ ...doc, shapes: [...doc.shapes, ...shapes] });
    toast.success(`سیاه‌چال با ${rooms.length} اتاق ساخته شد`);
  }

  function resetView() { setView({ x: -200, y: -200, zoom: 1 }); }

  function applyTheme(t: Theme) {
    setStroke(t.stroke);
    setFill(t.roomFill);
    setHatched(t.hatched);
    commit({
      ...doc,
      background: t.bg,
      shapes: doc.shapes.map((s) => {
        if (s.type === "rect") return { ...s, stroke: t.stroke, fill: t.roomFill } as SketchShape;
        if (s.type === "line" || s.type === "path") return { ...s, stroke: t.stroke } as SketchShape;
        return s;
      }),
    });
    toast.success(`تم «${t.label}» اعمال شد`);
  }

  function autoNumberRooms() {
    let n = 1;
    const extras: SketchShape[] = [];
    doc.shapes.forEach((s) => {
      if (s.type === "rect" && s.w > 40 && s.h > 40) {
        extras.push({
          id: uid(), type: "text",
          x: s.x + 8, y: s.y + 24,
          text: String(n++), fontSize: 22, fill: stroke, name: `شماره اتاق ${n - 1}`,
        });
      }
    });
    if (!extras.length) { toast.error("اتاقی یافت نشد"); return; }
    commit({ ...doc, shapes: [...doc.shapes, ...extras] });
    toast.success(`${extras.length} اتاق شماره‌گذاری شد`);
  }

  async function printPdf() {
    const svg = svgRef.current; if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll("[data-overlay]").forEach((n) => n.remove());
    clone.setAttribute("viewBox", `0 0 ${doc.width} ${doc.height}`);
    clone.setAttribute("width", String(doc.width));
    clone.setAttribute("height", String(doc.height));
    const src = new XMLSerializer().serializeToString(clone);
    const w = window.open("", "_blank");
    if (!w) { toast.error("مرورگر پنجره جدید را بست"); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title || "map"}</title>
      <style>@page{size:auto;margin:12mm} body{margin:0;background:${doc.background}} svg{width:100%;height:auto;display:block}</style>
      </head><body>${src}<script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script></body></html>`);
    w.document.close();
  }

  function updateSelected(patch: Partial<SketchShape>) {
    if (!selectedId) return;
    commit({ ...doc, shapes: doc.shapes.map((s) => (s.id === selectedId ? ({ ...s, ...patch } as SketchShape) : s)) });
  }

  function reorder(id: string, dir: "up" | "down") {
    const idx = doc.shapes.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = dir === "up" ? idx + 1 : idx - 1;
    if (target < 0 || target >= doc.shapes.length) return;
    const arr = [...doc.shapes];
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    commit({ ...doc, shapes: arr });
  }

  function toggleLayer(id: string, key: "locked" | "hidden") {
    commit({ ...doc, shapes: doc.shapes.map((s) => (s.id === id ? ({ ...s, [key]: !s[key] } as SketchShape) : s)) });
  }

  function duplicateSelected() {
    const s = doc.shapes.find((x) => x.id === selectedId);
    if (!s) return;
    const copy = { ...s, id: uid() } as SketchShape;
    if ("x" in copy) (copy as { x: number }).x = (copy as { x: number }).x + 12;
    if ("y" in copy) (copy as { y: number }).y = (copy as { y: number }).y + 12;
    commit({ ...doc, shapes: [...doc.shapes, copy] });
    setSelectedId(copy.id);
  }

  function exportSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    // remove selection overlays
    clone.querySelectorAll("[data-overlay]").forEach((n) => n.remove());
    const src = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${src}`], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title || "sketch"}.svg`; a.click();
    URL.revokeObjectURL(url);
    toast.success("SVG دانلود شد");
  }

  async function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll("[data-overlay]").forEach((n) => n.remove());
    const src = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    const svgUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(src)));
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = svgUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = doc.width; canvas.height = doc.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = doc.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title || "sketch"}.png`; a.click();
      URL.revokeObjectURL(url);
      toast.success("PNG دانلود شد");
    });
  }

  const selected = useMemo(() => doc.shapes.find((s) => s.id === selectedId) ?? null, [doc.shapes, selectedId]);
  const visibleShapes = doc.shapes;

  const tools: { id: Tool; icon: React.ComponentType<{ className?: string }>; label: string; hint: string }[] = [
    { id: "select", icon: MousePointer2, label: "انتخاب", hint: "V" },
    { id: "move", icon: MoveIcon, label: "جابجایی", hint: "M" },
    { id: "pen", icon: Pen, label: "قلم", hint: "P" },
    { id: "wall", icon: Minus, label: "دیوار", hint: "W" },
    { id: "room", icon: Square, label: "اتاق", hint: "" },
    { id: "cave", icon: Pen, label: "قلم غار", hint: "C" },
    { id: "rect", icon: Square, label: "مستطیل", hint: "R" },
    { id: "ellipse", icon: Circle, label: "بیضی", hint: "O" },
    { id: "line", icon: Minus, label: "خط", hint: "L" },
    { id: "text", icon: TypeIcon, label: "متن", hint: "T" },
    { id: "stamp", icon: Sparkle, label: "نماد", hint: "S" },
  ];

  const transformTarget = doc.shapes.find((s) => s.id === transformFor) ?? null;

  function startDragShape(id: string, e: React.PointerEvent) {
    if (tool !== "select" && tool !== "move") return;
    const s = doc.shapes.find((x) => x.id === id);
    if (!s || s.locked) return;
    const [x, y] = pointerCoords(e as unknown as React.PointerEvent<SVGSVGElement>);
    dragRef.current = { id, startX: x, startY: y, baseTx: s.tx ?? 0, baseTy: s.ty ?? 0 };
    setHistory((h) => [...h.slice(-49), doc]);
    setFuture([]);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-t-lg border bg-card">
      {/* left tools */}
      <aside className="w-14 shrink-0 border-e bg-muted/40 flex flex-col items-center py-2 gap-1">
        {tools.map((t) => (
          <button
            key={t.id}
            title={`${t.label} (${t.hint})`}
            onClick={() => setTool(t.id)}
            className={`h-10 w-10 rounded-md flex items-center justify-center transition ${tool === t.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            <t.icon className="h-5 w-5" />
          </button>
        ))}
        <div className="mt-2 h-px w-8 bg-border" />
        <button title="عکس" onClick={() => toast.message("در نسخه بعدی")} className="h-10 w-10 rounded-md hover:bg-accent flex items-center justify-center opacity-60">
          <ImageIcon className="h-5 w-5" />
        </button>
      </aside>

      {/* main canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* top bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={redo} title="Redo (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
          <span className="w-px h-6 bg-border mx-1" />
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" title="خط">
                <span className="inline-block h-4 w-4 rounded" style={{ background: stroke }} /> خط
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-2">
              <label className="text-xs">رنگ خط</label>
              <Input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} />
              <label className="text-xs">ضخامت: {strokeWidth}</label>
              <Slider value={[strokeWidth]} min={1} max={40} step={1} onValueChange={(v) => setStrokeWidth(v[0])} />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" title="پرکننده">
                <span className="inline-block h-4 w-4 rounded" style={{ background: fill }} /> پرکردن
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-2">
              <label className="text-xs">رنگ پرکردن</label>
              <Input type="color" value={fill} onChange={(e) => setFill(e.target.value)} />
              <Button size="sm" variant="ghost" onClick={() => setFill("transparent")}>بدون رنگ</Button>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" title="پس‌زمینه">
                <Palette className="h-4 w-4" /> پس‌زمینه
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-2">
              <Input type="color" value={doc.background} onChange={(e) => commit({ ...doc, background: e.target.value })} />
            </PopoverContent>
          </Popover>
          {tool === "text" && (
            <div className="flex items-center gap-2 text-xs">
              اندازه: <input type="number" className="w-16 border rounded px-1 py-0.5" value={fontSize} onChange={(e) => setFontSize(+e.target.value || 16)} />
            </div>
          )}
          <div className="flex-1" />
          {selected && (
            <>
              <Button variant="ghost" size="sm" onClick={duplicateSelected} title="کپی"><Copy className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { commit({ ...doc, shapes: doc.shapes.filter((s) => s.id !== selectedId) }); setSelectedId(null); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportSvg}><Download className="h-4 w-4 ms-1" />SVG</Button>
          <Button variant="outline" size="sm" onClick={exportPng}><Download className="h-4 w-4 ms-1" />PNG</Button>
          <Button variant="outline" size="sm" onClick={printPdf} title="چاپ / ذخیره PDF"><Printer className="h-4 w-4 ms-1" />PDF</Button>
          <span className="w-px h-6 bg-border mx-1" />
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" title="تم نقشه">
                <Palette className="h-4 w-4" /> تم
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-1">
              {THEMES.map((t) => (
                <Button key={t.id} size="sm" variant="ghost" className="w-full justify-start" onClick={() => applyTheme(t)}>
                  <span className="inline-block h-3 w-3 rounded me-2 border" style={{ background: t.bg }} />
                  {t.label}
                </Button>
              ))}
              <div className="flex items-center gap-2 text-xs pt-2 border-t">
                <input id="hatch" type="checkbox" checked={hatched} onChange={(e) => setHatched(e.target.checked)} />
                <label htmlFor="hatch">هاشورزنی اتاق‌ها</label>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" onClick={autoNumberRooms} title="شماره‌گذاری خودکار اتاق‌ها">
            <Hash className="h-4 w-4 ms-1" />شماره
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setGridType(gridType === "square" ? "hex" : gridType === "hex" ? "none" : "square")} title="گرید">
            {gridType === "hex" ? <Hexagon className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
            <span className="ms-1 text-[10px]">{gridType}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={generateDungeon} title="ساخت سیاه‌چال (BSP)">
            <Wand2 className="h-4 w-4 ms-1" />سیاه‌چال
          </Button>
          {tool === "stamp" && (
            <Popover open>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs" title="نمادها">
                  <Sparkle className="h-4 w-4" /> نماد: {STAMPS.find((x) => x.kind === stampKind)?.label}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-[420px] overflow-auto">
                {(Object.keys(STAMP_GROUP_LABEL) as StampGroup[]).map((g) => {
                  const items = STAMPS.filter((s) => s.group === g);
                  if (!items.length) return null;
                  return (
                    <div key={g} className="mb-2">
                      <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{STAMP_GROUP_LABEL[g]}</div>
                      <div className="grid grid-cols-5 gap-1">
                        {items.map((s) => (
                          <button
                            key={s.kind}
                            onClick={() => setStampKind(s.kind)}
                            title={s.label}
                            className={`aspect-square rounded flex items-center justify-center border ${stampKind === s.kind ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                          >
                            <s.Icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="mt-2 text-xs">اندازه: {stampSize}px</div>
                <Slider value={[stampSize]} min={16} max={200} step={2} onValueChange={(v) => setStampSize(v[0])} />
              </PopoverContent>
            </Popover>
          )}
          <Button variant={show3D ? "default" : "outline"} size="sm" onClick={() => setShow3D(true)} title="نمای سه‌بعدی">
            <Box className="h-4 w-4 ms-1" />3D
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setView((v) => ({ ...v, zoom: Math.min(6, v.zoom * 1.2) }))}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.1, v.zoom / 1.2) }))}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={resetView} title="ریست دید"><Maximize2 className="h-4 w-4" /></Button>
          <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-center">{Math.round(view.zoom * 100)}%</span>
        </div>

        {/* canvas viewport */}
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden bg-muted/30 relative"
          style={{ background: doc.background }}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={`${view.x} ${view.y} ${(viewportRef.current?.clientWidth ?? 1200) / view.zoom} ${(viewportRef.current?.clientHeight ?? 800) / view.zoom}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{ cursor: panRef.current ? "grabbing" : tool === "select" ? "default" : "crosshair", touchAction: "none", direction: "ltr" }}
          >
            <defs>
              <pattern id="sq-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
              </pattern>
              <pattern id="hex-grid" width={gridSize * 1.732} height={gridSize * 1.5} patternUnits="userSpaceOnUse">
                <path d={`M ${gridSize * 0.866} 0 L ${gridSize * 1.732} ${gridSize * 0.5} L ${gridSize * 1.732} ${gridSize * 1.5} L ${gridSize * 0.866} ${gridSize * 2} L 0 ${gridSize * 1.5} L 0 ${gridSize * 0.5} Z`} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              </pattern>
              <pattern id="hatch-fill" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" fill={fill} />
                <line x1="0" y1="0" x2="0" y2="8" stroke={stroke} strokeWidth="1" opacity="0.35" />
              </pattern>
              <pattern id="hatch-cross" width="10" height="10" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="10" y2="10" stroke={stroke} strokeWidth="0.8" opacity="0.3" />
                <line x1="10" y1="0" x2="0" y2="10" stroke={stroke} strokeWidth="0.8" opacity="0.3" />
              </pattern>
            </defs>
            {gridType !== "none" && (
              <rect x={-100000} y={-100000} width={200000} height={200000} fill={`url(#${gridType === "hex" ? "hex-grid" : "sq-grid"})`} pointerEvents="none" />
            )}
            {visibleShapes.map((s) => renderShape(s, selectedId, setSelectedId, tool === "select" || tool === "move", startDragShape, hatched))}
            {draft && renderShape(draft, null, () => {}, false, () => {}, hatched)}
          </svg>
          {show3D && (
            <button
              onClick={() => setShow3D(true)}
              className="absolute top-3 right-3 rounded-full bg-primary text-primary-foreground h-10 w-10 flex items-center justify-center shadow-lg"
              title="حالت سه‌بعدی فعال است"
            >
              <Camera className="h-5 w-5" />
            </button>
          )}
          <div className="absolute bottom-2 left-2 rounded-md bg-background/80 backdrop-blur px-2 py-1 text-[10px] text-muted-foreground border" dir="ltr">
            MMB / Shift+Drag = Pan · Ctrl+Wheel = Zoom · بی‌نهایت
          </div>
        </div>
      </div>

      {/* right layers */}
      <aside className="w-64 shrink-0 border-s bg-muted/40 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Layers className="h-4 w-4" /> <span className="text-sm font-medium">لایه‌ها</span>
          <span className="ms-auto text-xs text-muted-foreground">{doc.shapes.length}</span>
        </div>
        <div className="flex-1 overflow-auto p-1">
          {[...doc.shapes].reverse().map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              onDoubleClick={() => setTransformFor(s.id)}
              className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs cursor-pointer ${selectedId === s.id ? "bg-primary/15 text-foreground" : "hover:bg-accent"}`}
            >
              <button onClick={(e) => { e.stopPropagation(); toggleLayer(s.id, "hidden"); }} title="نمایش">
                {s.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleLayer(s.id, "locked"); }} title="قفل">
                {s.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5 opacity-40" />}
              </button>
              <span className="truncate flex-1">{shapeName(s)}</span>
              <button onClick={(e) => { e.stopPropagation(); reorder(s.id, "up"); }} className="opacity-0 group-hover:opacity-100"><ArrowUp className="h-3 w-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); reorder(s.id, "down"); }} className="opacity-0 group-hover:opacity-100"><ArrowDown className="h-3 w-3" /></button>
            </div>
          ))}
          {!doc.shapes.length && <p className="text-xs text-muted-foreground p-3 text-center">هنوز شکلی نکشیده‌اید</p>}
        </div>

        {selected && (
          <div className="border-t p-3 space-y-2 text-xs">
            <div className="font-medium">ویژگی‌ها</div>
            {"opacity" in selected || true ? (
              <>
                <label>شفافیت: {Math.round((selected.opacity ?? 1) * 100)}%</label>
                <Slider value={[(selected.opacity ?? 1) * 100]} min={0} max={100} step={1} onValueChange={(v) => updateSelected({ opacity: v[0] / 100 })} />
              </>
            ) : null}
            {"stroke" in selected && (
              <>
                <label>رنگ خط</label>
                <Input type="color" value={selected.stroke} onChange={(e) => updateSelected({ stroke: e.target.value } as Partial<SketchShape>)} />
                <label>ضخامت</label>
                <Slider value={[selected.strokeWidth]} min={0} max={40} step={1} onValueChange={(v) => updateSelected({ strokeWidth: v[0] } as Partial<SketchShape>)} />
              </>
            )}
            {("fill" in selected) && selected.type !== "text" && (
              <>
                <label>پرکردن</label>
                <Input type="color" value={selected.fill === "transparent" ? "#ffffff" : selected.fill} onChange={(e) => updateSelected({ fill: e.target.value } as Partial<SketchShape>)} />
              </>
            )}
            {selected.type === "text" && (
              <>
                <label>متن</label>
                <Input value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} />
                <label>اندازه فونت</label>
                <Slider value={[selected.fontSize]} min={8} max={140} step={1} onValueChange={(v) => updateSelected({ fontSize: v[0] })} />
                <label>رنگ</label>
                <Input type="color" value={selected.fill} onChange={(e) => updateSelected({ fill: e.target.value })} />
              </>
            )}
            {selected.type === "rect" && (
              <>
                <label>گردی گوشه: {selected.radius}</label>
                <Slider value={[selected.radius]} min={0} max={80} step={1} onValueChange={(v) => updateSelected({ radius: v[0] })} />
              </>
            )}
          </div>
        )}
      </aside>

      <Dialog open={!!transformTarget} onOpenChange={(o) => !o && setTransformFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تنظیمات تبدیل — {transformTarget && shapeName(transformTarget)}</DialogTitle></DialogHeader>
          {transformTarget && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="col-span-1">جابجایی X
                <Input type="number" value={transformTarget.tx ?? 0} onChange={(e) => onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === transformTarget.id ? { ...s, tx: +e.target.value || 0 } as SketchShape : s) })} />
              </label>
              <label className="col-span-1">جابجایی Y
                <Input type="number" value={transformTarget.ty ?? 0} onChange={(e) => onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === transformTarget.id ? { ...s, ty: +e.target.value || 0 } as SketchShape : s) })} />
              </label>
              <div className="col-span-2">چرخش: {Math.round(transformTarget.rotation ?? 0)}°
                <Slider value={[transformTarget.rotation ?? 0]} min={-180} max={180} step={1} onValueChange={(v) => onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === transformTarget.id ? { ...s, rotation: v[0] } as SketchShape : s) })} />
              </div>
              <div className="col-span-1">مقیاس X: {(transformTarget.scaleX ?? 1).toFixed(2)}
                <Slider value={[(transformTarget.scaleX ?? 1) * 100]} min={10} max={400} step={5} onValueChange={(v) => onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === transformTarget.id ? { ...s, scaleX: v[0] / 100 } as SketchShape : s) })} />
              </div>
              <div className="col-span-1">مقیاس Y: {(transformTarget.scaleY ?? 1).toFixed(2)}
                <Slider value={[(transformTarget.scaleY ?? 1) * 100]} min={10} max={400} step={5} onValueChange={(v) => onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === transformTarget.id ? { ...s, scaleY: v[0] / 100 } as SketchShape : s) })} />
              </div>
              <label className="col-span-2">نام لایه
                <Input value={transformTarget.name ?? ""} placeholder={shapeName(transformTarget)} onChange={(e) => onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === transformTarget.id ? { ...s, name: e.target.value } as SketchShape : s) })} />
              </label>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { if (!transformTarget) return; onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === transformTarget.id ? { ...s, tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 } as SketchShape : s) }); }}>ریست</Button>
            <Button size="sm" onClick={() => { commit(doc); setTransformFor(null); }}>ذخیره</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {show3D && <Sketch3DPreview doc={doc} onClose={() => setShow3D(false)} />}
    </div>
  );
}

function renderShape(
  s: SketchShape,
  selectedId: string | null,
  onSelect: (id: string) => void,
  interactive: boolean,
  onStartDrag: (id: string, e: React.PointerEvent) => void,
  hatched: boolean = false,
) {
  if (s.hidden) return null;
  const isSel = s.id === selectedId;
  const cx = "x" in s ? (s as { x: number; w?: number }).x + ((s as { w?: number }).w ?? 0) / 2 : 0;
  const cy = "y" in s ? (s as { y: number; h?: number }).y + ((s as { h?: number }).h ?? 0) / 2 : 0;
  const parts: string[] = [];
  if (s.tx || s.ty) parts.push(`translate(${s.tx ?? 0} ${s.ty ?? 0})`);
  if (s.rotation) parts.push(`rotate(${s.rotation} ${cx} ${cy})`);
  if ((s.scaleX && s.scaleX !== 1) || (s.scaleY && s.scaleY !== 1)) parts.push(`translate(${cx} ${cy}) scale(${s.scaleX ?? 1} ${s.scaleY ?? 1}) translate(${-cx} ${-cy})`);
  const transform = parts.join(" ") || undefined;
  const commonProps = {
    key: s.id,
    opacity: s.opacity ?? 1,
    onPointerDown: (e: React.PointerEvent) => { if (interactive && !s.locked) { e.stopPropagation(); onSelect(s.id); onStartDrag(s.id, e); } },
    style: { cursor: interactive ? "move" : undefined },
    transform,
  } as const;
  const selStyle = isSel ? { filter: "drop-shadow(0 0 0 hsl(var(--primary)))", outline: "1px dashed hsl(var(--primary))" } : {};
  if (s.type === "path") return <path {...commonProps} d={s.d} stroke={s.stroke} strokeWidth={s.strokeWidth} fill={s.fill ?? "none"} strokeLinecap="round" strokeLinejoin="round" style={{ ...commonProps.style, ...selStyle }} />;
  if (s.type === "rect") {
    const useHatch = hatched && s.fill !== "transparent" && s.fill !== "#ffffff";
    return (
      <g {...commonProps} style={{ ...commonProps.style, ...selStyle }}>
        <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius} ry={s.radius} fill={s.fill} stroke="none" />
        {useHatch && <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius} ry={s.radius} fill="url(#hatch-cross)" stroke="none" />}
        <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius} ry={s.radius} fill="none" stroke={s.stroke} strokeWidth={s.strokeWidth} />
      </g>
    );
  }
  if (s.type === "ellipse") return <ellipse {...commonProps} cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} stroke={s.stroke} strokeWidth={s.strokeWidth} fill={s.fill} style={{ ...commonProps.style, ...selStyle }} />;
  if (s.type === "line") return <line {...commonProps} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeLinecap="round" style={{ ...commonProps.style, ...selStyle }} />;
  if (s.type === "text") return <text {...commonProps} x={s.x} y={s.y} fontSize={s.fontSize} fill={s.fill} style={{ ...commonProps.style, ...selStyle, userSelect: "none" }}>{s.text}</text>;
  if (s.type === "stamp") return renderStamp(s, commonProps, selStyle);
  return null;
}

function renderStamp(
  s: Extract<SketchShape, { type: "stamp" }>,
  common: { key: string; opacity: number; onPointerDown: (e: React.PointerEvent) => void; style: React.CSSProperties; transform: string | undefined },
  selStyle: React.CSSProperties,
) {
  const { x, y, size, color, kind } = s;
  const h = size / 2;
  const style = { ...common.style, ...selStyle };
  const sw = Math.max(2, size / 16);
  switch (kind) {
    case "door":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.15} width={size} height={size * 0.3} fill="#f5efdc" stroke={color} strokeWidth={sw} />
          <line x1={x} y1={y - h * 0.15} x2={x} y2={y + h * 0.15} stroke={color} strokeWidth={sw} />
        </g>
      );
    case "secret-door":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.2} width={size} height={size * 0.4} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${sw * 2} ${sw * 2}`} />
          <text x={x} y={y + sw} fontSize={size * 0.35} fill={color} textAnchor="middle" fontWeight="bold">S</text>
        </g>
      );
    case "locked-door":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.2} width={size} height={size * 0.4} fill="#f5efdc" stroke={color} strokeWidth={sw} />
          <circle cx={x} cy={y} r={size * 0.12} fill={color} />
        </g>
      );
    case "portcullis":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.25} width={size} height={size * 0.5} fill="none" stroke={color} strokeWidth={sw} />
          {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
            <line key={i} x1={x - h + size * f} y1={y - h * 0.25} x2={x - h + size * f} y2={y + h * 0.25} stroke={color} strokeWidth={sw} />
          ))}
        </g>
      );
    case "stairs-up":
    case "stairs-down": {
      const dir = kind === "stairs-up" ? 1 : -1;
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h} width={size} height={size} fill="none" stroke={color} strokeWidth={sw} />
          {[0.2, 0.4, 0.6, 0.8].map((f, i) => (
            <line key={i} x1={x - h} y1={y - h + size * f} x2={x + h} y2={y - h + size * f} stroke={color} strokeWidth={sw * 0.7} />
          ))}
          <polygon points={`${x},${y - h * 0.6 * dir} ${x - h * 0.35},${y + h * 0.1 * dir} ${x + h * 0.35},${y + h * 0.1 * dir}`} fill={color} />
        </g>
      );
    }
    case "spiral-stairs":
      return (
        <g {...common} style={style}>
          <circle cx={x} cy={y} r={h} fill="none" stroke={color} strokeWidth={sw} />
          <path d={`M ${x} ${y} m -${h * 0.7} 0 a ${h * 0.7} ${h * 0.7} 0 1 1 ${h * 1.4} 0`} fill="none" stroke={color} strokeWidth={sw} />
          <line x1={x} y1={y} x2={x + h} y2={y} stroke={color} strokeWidth={sw} />
        </g>
      );
    case "pillar":
      return <circle {...common} cx={x} cy={y} r={h * 0.6} fill={color} style={style} />;
    case "treasure":
      return (
        <g {...common} style={style}>
          <rect x={x - h * 0.7} y={y - h * 0.5} width={size * 0.7} height={size * 0.5} fill="#d4a15a" stroke={color} strokeWidth={sw} />
          <line x1={x - h * 0.7} y1={y - h * 0.15} x2={x + h * 0.7} y2={y - h * 0.15} stroke={color} strokeWidth={sw} />
          <circle cx={x} cy={y - h * 0.15} r={size * 0.05} fill={color} />
        </g>
      );
    case "monster":
      return (
        <g {...common} style={style}>
          <circle cx={x} cy={y} r={h * 0.75} fill="#8b1a1a" stroke={color} strokeWidth={sw} />
          <text x={x} y={y + size * 0.15} fontSize={size * 0.55} fill="#fff" textAnchor="middle" fontWeight="bold">M</text>
        </g>
      );
    case "trap":
      return (
        <g {...common} style={style}>
          <polygon points={`${x},${y - h * 0.8} ${x + h * 0.8},${y + h * 0.6} ${x - h * 0.8},${y + h * 0.6}`} fill="#f5c542" stroke={color} strokeWidth={sw} />
          <text x={x} y={y + h * 0.35} fontSize={size * 0.5} fill={color} textAnchor="middle" fontWeight="bold">!</text>
        </g>
      );
    case "compass":
      return (
        <g {...common} style={style}>
          <circle cx={x} cy={y} r={h} fill="none" stroke={color} strokeWidth={sw} />
          <polygon points={`${x},${y - h * 0.85} ${x + h * 0.2},${y} ${x},${y + h * 0.85} ${x - h * 0.2},${y}`} fill={color} />
          <text x={x} y={y - h - sw} fontSize={size * 0.25} fill={color} textAnchor="middle" fontWeight="bold">N</text>
        </g>
      );
    case "scale-bar":
      return (
        <g {...common} style={style}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={x - h + (size / 4) * i} y={y - size * 0.08} width={size / 4} height={size * 0.16} fill={i % 2 === 0 ? color : "#ffffff"} stroke={color} strokeWidth={sw * 0.6} />
          ))}
          <text x={x} y={y + size * 0.45} fontSize={size * 0.22} fill={color} textAnchor="middle">10ft</text>
        </g>
      );
    /* ---------- Extra doors ---------- */
    case "door-iron":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.25} width={size} height={size * 0.5} fill="#6b7280" stroke={color} strokeWidth={sw} />
          {[0.25, 0.5, 0.75].map((f, i) => <circle key={i} cx={x - h + size * f} cy={y - h * 0.15} r={sw} fill={color} />)}
          {[0.25, 0.5, 0.75].map((f, i) => <circle key={i + 3} cx={x - h + size * f} cy={y + h * 0.15} r={sw} fill={color} />)}
        </g>
      );
    case "door-arched":
      return (
        <g {...common} style={style}>
          <path d={`M ${x - h} ${y + h * 0.3} L ${x - h} ${y} A ${h} ${h} 0 0 1 ${x + h} ${y} L ${x + h} ${y + h * 0.3} Z`} fill="#f5efdc" stroke={color} strokeWidth={sw} />
          <line x1={x} y1={y - h * 0.6} x2={x} y2={y + h * 0.3} stroke={color} strokeWidth={sw * 0.8} />
        </g>
      );
    case "door-double":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.2} width={size} height={size * 0.4} fill="#f5efdc" stroke={color} strokeWidth={sw} />
          <line x1={x} y1={y - h * 0.2} x2={x} y2={y + h * 0.2} stroke={color} strokeWidth={sw * 1.2} />
          <circle cx={x - h * 0.25} cy={y} r={sw} fill={color} />
          <circle cx={x + h * 0.25} cy={y} r={sw} fill={color} />
        </g>
      );
    case "door-hidden-arch":
      return (
        <g {...common} style={style}>
          <path d={`M ${x - h} ${y + h * 0.3} L ${x - h} ${y} A ${h} ${h} 0 0 1 ${x + h} ${y} L ${x + h} ${y + h * 0.3}`} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${sw * 2} ${sw * 2}`} />
          <text x={x} y={y + h * 0.15} fontSize={size * 0.3} fill={color} textAnchor="middle" fontWeight="bold">?</text>
        </g>
      );
    case "door-vault":
      return (
        <g {...common} style={style}>
          <circle cx={x} cy={y} r={h * 0.85} fill="#6b7280" stroke={color} strokeWidth={sw} />
          <circle cx={x} cy={y} r={h * 0.55} fill="none" stroke={color} strokeWidth={sw * 0.6} />
          {[0, 60, 120, 180, 240, 300].map((a) => {
            const rad = (a * Math.PI) / 180;
            return <line key={a} x1={x + Math.cos(rad) * h * 0.55} y1={y + Math.sin(rad) * h * 0.55} x2={x + Math.cos(rad) * h * 0.85} y2={y + Math.sin(rad) * h * 0.85} stroke={color} strokeWidth={sw * 0.6} />;
          })}
          <circle cx={x} cy={y} r={h * 0.12} fill={color} />
        </g>
      );
    /* ---------- Walls ---------- */
    case "wall-stone":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.2} width={size} height={size * 0.4} fill="#b8b0a0" stroke={color} strokeWidth={sw} />
          {[0.15, 0.35, 0.55, 0.75].map((f, i) => (
            <line key={i} x1={x - h + size * f} y1={y - h * 0.2} x2={x - h + size * f + (i % 2 ? -sw : sw)} y2={y + h * 0.2} stroke={color} strokeWidth={sw * 0.6} />
          ))}
          <line x1={x - h} y1={y} x2={x + h} y2={y} stroke={color} strokeWidth={sw * 0.6} />
        </g>
      );
    case "wall-brick":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.25} width={size} height={size * 0.5} fill="#b45f3c" stroke={color} strokeWidth={sw} />
          {[0, 1, 2].map((row) => {
            const yy = y - h * 0.25 + (row + 0.5) * (size * 0.5 / 3);
            const offset = row % 2 === 0 ? 0 : size / 8;
            return (
              <g key={row}>
                <line x1={x - h} y1={yy} x2={x + h} y2={yy} stroke={color} strokeWidth={sw * 0.4} />
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                  <line key={f} x1={x - h + size * f + offset} y1={yy - size * 0.5 / 6} x2={x - h + size * f + offset} y2={yy + size * 0.5 / 6} stroke={color} strokeWidth={sw * 0.4} />
                ))}
              </g>
            );
          })}
        </g>
      );
    case "wall-rubble":
      return (
        <g {...common} style={style}>
          {[[-0.35, -0.05, 0.18], [-0.05, 0.1, 0.14], [0.25, -0.1, 0.2], [-0.2, 0.15, 0.12], [0.35, 0.05, 0.17]].map(([dx, dy, r], i) => (
            <circle key={i} cx={x + size * dx} cy={y + size * dy} r={size * r} fill="#9c948a" stroke={color} strokeWidth={sw * 0.7} />
          ))}
        </g>
      );
    case "wall-thick":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.35} width={size} height={size * 0.7} fill="#8a8275" stroke={color} strokeWidth={sw * 1.4} />
          <rect x={x - h + sw * 2} y={y - h * 0.35 + sw * 2} width={size - sw * 4} height={size * 0.7 - sw * 4} fill="none" stroke={color} strokeWidth={sw * 0.5} strokeDasharray={`${sw} ${sw * 2}`} />
        </g>
      );
    case "wall-broken":
      return (
        <g {...common} style={style}>
          <path d={`M ${x - h} ${y} L ${x - h * 0.4} ${y - h * 0.2} L ${x - h * 0.2} ${y + h * 0.15} L ${x + h * 0.1} ${y - h * 0.25} L ${x + h * 0.4} ${y + h * 0.1} L ${x + h} ${y}`} fill="none" stroke={color} strokeWidth={sw * 1.2} strokeLinejoin="round" />
          <circle cx={x - h * 0.15} cy={y + h * 0.3} r={sw * 1.2} fill={color} opacity="0.5" />
          <circle cx={x + h * 0.3} cy={y + h * 0.35} r={sw} fill={color} opacity="0.5" />
        </g>
      );
    /* ---------- Lakes / water ---------- */
    case "lake-small":
      return (
        <g {...common} style={style}>
          <ellipse cx={x} cy={y} rx={h * 0.85} ry={h * 0.6} fill="#5aa9d6" stroke={color} strokeWidth={sw} />
          <path d={`M ${x - h * 0.4} ${y - h * 0.1} q ${h * 0.2} -${h * 0.15} ${h * 0.4} 0`} fill="none" stroke="#ffffff" strokeWidth={sw * 0.6} opacity="0.7" />
        </g>
      );
    case "lake-large":
      return (
        <g {...common} style={style}>
          <path d={`M ${x - h} ${y} Q ${x - h * 0.6} ${y - h * 0.8} ${x} ${y - h * 0.7} Q ${x + h * 0.9} ${y - h * 0.5} ${x + h} ${y + h * 0.1} Q ${x + h * 0.5} ${y + h * 0.9} ${x - h * 0.1} ${y + h * 0.7} Q ${x - h * 0.9} ${y + h * 0.3} ${x - h} ${y} Z`} fill="#4c98c8" stroke={color} strokeWidth={sw} />
          {[[-0.3, -0.2], [0.2, 0.1], [-0.1, 0.3]].map(([dx, dy], i) => (
            <path key={i} d={`M ${x + size * dx - h * 0.2} ${y + size * dy} q ${h * 0.2} -${h * 0.1} ${h * 0.4} 0`} fill="none" stroke="#ffffff" strokeWidth={sw * 0.5} opacity="0.6" />
          ))}
        </g>
      );
    case "pond":
      return (
        <g {...common} style={style}>
          <circle cx={x} cy={y} r={h * 0.75} fill="#6fb0d8" stroke={color} strokeWidth={sw} />
          <circle cx={x} cy={y} r={h * 0.45} fill="none" stroke="#ffffff" strokeWidth={sw * 0.4} opacity="0.6" />
          <circle cx={x} cy={y} r={h * 0.2} fill="none" stroke="#ffffff" strokeWidth={sw * 0.4} opacity="0.5" />
        </g>
      );
    case "river":
      return (
        <g {...common} style={style}>
          <path d={`M ${x - h} ${y - h * 0.4} Q ${x - h * 0.2} ${y + h * 0.2} ${x + h * 0.2} ${y - h * 0.2} Q ${x + h * 0.8} ${y + h * 0.4} ${x + h} ${y}`} fill="none" stroke="#5aa9d6" strokeWidth={sw * 4} strokeLinecap="round" />
          <path d={`M ${x - h} ${y - h * 0.4} Q ${x - h * 0.2} ${y + h * 0.2} ${x + h * 0.2} ${y - h * 0.2} Q ${x + h * 0.8} ${y + h * 0.4} ${x + h} ${y}`} fill="none" stroke="#ffffff" strokeWidth={sw * 0.6} opacity="0.6" />
        </g>
      );
    case "waterfall":
      return (
        <g {...common} style={style}>
          <rect x={x - h * 0.6} y={y - h} width={size * 0.6} height={size * 0.35} fill="#7c8794" stroke={color} strokeWidth={sw * 0.8} />
          {[-0.4, -0.15, 0.1, 0.35].map((f, i) => (
            <path key={i} d={`M ${x + size * f * 0.6} ${y - h * 0.3} Q ${x + size * f * 0.6 + sw} ${y + h * 0.2} ${x + size * f * 0.6} ${y + h * 0.8}`} fill="none" stroke="#7ec4e6" strokeWidth={sw * 1.2} />
          ))}
          <ellipse cx={x} cy={y + h * 0.85} rx={h * 0.8} ry={h * 0.15} fill="#5aa9d6" stroke={color} strokeWidth={sw * 0.6} />
        </g>
      );
    /* ---------- Bridges (wood + rock) ---------- */
    case "bridge-wood":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.2} width={size} height={size * 0.4} fill="#c69456" stroke={color} strokeWidth={sw} />
          {[0.12, 0.28, 0.44, 0.6, 0.76, 0.92].map((f, i) => (
            <line key={i} x1={x - h + size * f} y1={y - h * 0.2} x2={x - h + size * f} y2={y + h * 0.2} stroke={color} strokeWidth={sw * 0.6} />
          ))}
          <line x1={x - h} y1={y - h * 0.2} x2={x + h} y2={y - h * 0.2} stroke={color} strokeWidth={sw * 0.9} />
          <line x1={x - h} y1={y + h * 0.2} x2={x + h} y2={y + h * 0.2} stroke={color} strokeWidth={sw * 0.9} />
        </g>
      );
    case "bridge-rock":
      return (
        <g {...common} style={style}>
          <path d={`M ${x - h} ${y + h * 0.15} Q ${x} ${y - h * 0.6} ${x + h} ${y + h * 0.15} L ${x + h} ${y + h * 0.35} L ${x - h} ${y + h * 0.35} Z`} fill="#9c948a" stroke={color} strokeWidth={sw} />
          {[-0.6, -0.2, 0.2, 0.6].map((f, i) => (
            <line key={i} x1={x + size * f * 0.5} y1={y - h * 0.35} x2={x + size * f * 0.5} y2={y + h * 0.15} stroke={color} strokeWidth={sw * 0.5} />
          ))}
        </g>
      );
    case "bridge-rope":
      return (
        <g {...common} style={style}>
          <path d={`M ${x - h} ${y - h * 0.4} Q ${x} ${y + h * 0.2} ${x + h} ${y - h * 0.4}`} fill="none" stroke={color} strokeWidth={sw} />
          <path d={`M ${x - h} ${y + h * 0.1} Q ${x} ${y + h * 0.5} ${x + h} ${y + h * 0.1}`} fill="none" stroke={color} strokeWidth={sw} />
          {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((f, i) => {
            const px = x - h + size * f;
            const t = f;
            const topY = y - h * 0.4 + 4 * h * 0.6 * t * (1 - t);
            const botY = y + h * 0.1 + 4 * h * 0.4 * t * (1 - t);
            return <line key={i} x1={px} y1={topY} x2={px} y2={botY} stroke={color} strokeWidth={sw * 0.5} />;
          })}
        </g>
      );
    case "bridge-arch":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y} width={size} height={size * 0.25} fill="#9c948a" stroke={color} strokeWidth={sw} />
          <path d={`M ${x - h * 0.7} ${y + h * 0.25} A ${h * 0.7} ${h * 0.5} 0 0 1 ${x + h * 0.7} ${y + h * 0.25}`} fill="#ffffff" stroke={color} strokeWidth={sw} />
          <path d={`M ${x - h} ${y - h * 0.05} Q ${x} ${y - h * 0.5} ${x + h} ${y - h * 0.05}`} fill="none" stroke={color} strokeWidth={sw} />
          <rect x={x - h} y={y - h * 0.05} width={size} height={size * 0.1} fill="#c9c1b3" stroke={color} strokeWidth={sw * 0.6} />
        </g>
      );
    case "bridge-broken":
      return (
        <g {...common} style={style}>
          <rect x={x - h} y={y - h * 0.15} width={size * 0.35} height={size * 0.3} fill="#c69456" stroke={color} strokeWidth={sw} />
          <rect x={x + h * 0.3} y={y - h * 0.1} width={size * 0.4} height={size * 0.25} fill="#c69456" stroke={color} strokeWidth={sw} />
          <path d={`M ${x - h * 0.3} ${y - h * 0.15} L ${x - h * 0.15} ${y + h * 0.5} L ${x - h * 0.05} ${y + h * 0.15} L ${x + h * 0.1} ${y + h * 0.6}`} fill="none" stroke={color} strokeWidth={sw * 0.6} strokeDasharray={`${sw * 1.5} ${sw}`} />
        </g>
      );
    /* ---------- Elementals ---------- */
    case "elem-fire":
      return (
        <g {...common} style={style}>
          <path d={`M ${x} ${y - h * 0.85} C ${x + h * 0.6} ${y - h * 0.2}, ${x + h * 0.5} ${y + h * 0.6}, ${x} ${y + h * 0.7} C ${x - h * 0.5} ${y + h * 0.6}, ${x - h * 0.6} ${y - h * 0.2}, ${x} ${y - h * 0.85} Z`} fill="#ff8a3c" stroke={color} strokeWidth={sw} />
          <path d={`M ${x} ${y - h * 0.45} C ${x + h * 0.35} ${y}, ${x + h * 0.3} ${y + h * 0.4}, ${x} ${y + h * 0.5} C ${x - h * 0.3} ${y + h * 0.4}, ${x - h * 0.35} ${y}, ${x} ${y - h * 0.45} Z`} fill="#ffd166" opacity="0.85" />
        </g>
      );
    case "elem-water":
      return (
        <g {...common} style={style}>
          <path d={`M ${x} ${y - h * 0.85} C ${x + h * 0.7} ${y - h * 0.1}, ${x + h * 0.5} ${y + h * 0.7}, ${x} ${y + h * 0.75} C ${x - h * 0.5} ${y + h * 0.7}, ${x - h * 0.7} ${y - h * 0.1}, ${x} ${y - h * 0.85} Z`} fill="#3d8fc4" stroke={color} strokeWidth={sw} />
          <path d={`M ${x - h * 0.25} ${y + h * 0.25} q ${h * 0.15} -${h * 0.15} ${h * 0.3} 0`} fill="none" stroke="#ffffff" strokeWidth={sw * 0.6} opacity="0.7" />
        </g>
      );
    case "elem-earth":
      return (
        <g {...common} style={style}>
          <polygon points={`${x - h * 0.8},${y + h * 0.6} ${x - h * 0.3},${y - h * 0.4} ${x + h * 0.2},${y - h * 0.7} ${x + h * 0.7},${y - h * 0.2} ${x + h * 0.8},${y + h * 0.6}`} fill="#8a6a3d" stroke={color} strokeWidth={sw} />
          <polygon points={`${x - h * 0.3},${y - h * 0.4} ${x + h * 0.2},${y - h * 0.7} ${x + h * 0.7},${y - h * 0.2} ${x + h * 0.15},${y + h * 0.05}`} fill="#a37f4a" opacity="0.85" />
          {[[-0.4, 0.35], [0.2, 0.25], [-0.05, 0.4]].map(([dx, dy], i) => <circle key={i} cx={x + size * dx * 0.8} cy={y + size * dy * 0.8} r={sw} fill={color} opacity="0.6" />)}
        </g>
      );
    case "elem-air":
      return (
        <g {...common} style={style}>
          {[-0.4, -0.1, 0.2].map((dy, i) => (
            <path key={i} d={`M ${x - h * 0.8} ${y + size * dy} q ${h * 0.4} -${h * 0.2} ${h * 0.9} 0 q ${h * 0.3} ${h * 0.15} ${h * 0.5} -${h * 0.05}`} fill="none" stroke="#8fb4c7" strokeWidth={sw * 1.3} strokeLinecap="round" />
          ))}
          <path d={`M ${x - h * 0.6} ${y + h * 0.5} q ${h * 0.4} -${h * 0.15} ${h * 0.8} 0`} fill="none" stroke={color} strokeWidth={sw * 0.7} />
        </g>
      );
    case "elem-storm":
      return (
        <g {...common} style={style}>
          <ellipse cx={x} cy={y - h * 0.3} rx={h * 0.9} ry={h * 0.35} fill="#5a6472" stroke={color} strokeWidth={sw} />
          <ellipse cx={x - h * 0.4} cy={y - h * 0.15} rx={h * 0.4} ry={h * 0.25} fill="#5a6472" />
          <ellipse cx={x + h * 0.4} cy={y - h * 0.15} rx={h * 0.4} ry={h * 0.25} fill="#5a6472" />
          <polygon points={`${x - h * 0.1},${y + h * 0.05} ${x + h * 0.2},${y + h * 0.05} ${x + h * 0.05},${y + h * 0.4} ${x + h * 0.25},${y + h * 0.4} ${x - h * 0.05},${y + h * 0.85} ${x + h * 0.05},${y + h * 0.45} ${x - h * 0.15},${y + h * 0.45}`} fill="#ffd23f" stroke={color} strokeWidth={sw * 0.5} />
        </g>
      );
  }
  return null;
}