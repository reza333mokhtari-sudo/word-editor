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
} from "lucide-react";
import { Sketch3DPreview } from "./Sketch3DPreview";

export type SketchShape =
  | ({ id: string; type: "path"; d: string; stroke: string; strokeWidth: number; fill?: string } & ShapeCommon)
  | ({ id: string; type: "rect"; x: number; y: number; w: number; h: number; radius: number; stroke: string; strokeWidth: number; fill: string } & ShapeCommon)
  | ({ id: string; type: "ellipse"; x: number; y: number; w: number; h: number; stroke: string; strokeWidth: number; fill: string } & ShapeCommon)
  | ({ id: string; type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number } & ShapeCommon)
  | ({ id: string; type: "text"; x: number; y: number; text: string; fontSize: number; fill: string } & ShapeCommon);

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

type Tool = "select" | "move" | "pen" | "rect" | "ellipse" | "line" | "text" | "wall" | "room" | "cave";

const uid = () => Math.random().toString(36).slice(2, 10);

function shapeName(s: SketchShape) {
  if (s.name) return s.name;
  return { path: "طرح", rect: "مستطیل", ellipse: "بیضی", line: "خط", text: "متن" }[s.type];
}

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
          <span className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={() => setGridType(gridType === "square" ? "hex" : gridType === "hex" ? "none" : "square")} title="گرید">
            {gridType === "hex" ? <Hexagon className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
            <span className="ms-1 text-[10px]">{gridType}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={generateDungeon} title="ساخت سیاه‌چال (BSP)">
            <Wand2 className="h-4 w-4 ms-1" />سیاه‌چال
          </Button>
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
            </defs>
            {gridType !== "none" && (
              <rect x={-100000} y={-100000} width={200000} height={200000} fill={`url(#${gridType === "hex" ? "hex-grid" : "sq-grid"})`} pointerEvents="none" />
            )}
            {visibleShapes.map((s) => renderShape(s, selectedId, setSelectedId, tool === "select" || tool === "move", startDragShape))}
            {draft && renderShape(draft, null, () => {}, false, () => {})}
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
  if (s.type === "rect") return <rect {...commonProps} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.radius} ry={s.radius} stroke={s.stroke} strokeWidth={s.strokeWidth} fill={s.fill} style={{ ...commonProps.style, ...selStyle }} />;
  if (s.type === "ellipse") return <ellipse {...commonProps} cx={s.x + s.w / 2} cy={s.y + s.h / 2} rx={s.w / 2} ry={s.h / 2} stroke={s.stroke} strokeWidth={s.strokeWidth} fill={s.fill} style={{ ...commonProps.style, ...selStyle }} />;
  if (s.type === "line") return <line {...commonProps} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeLinecap="round" style={{ ...commonProps.style, ...selStyle }} />;
  if (s.type === "text") return <text {...commonProps} x={s.x} y={s.y} fontSize={s.fontSize} fill={s.fill} style={{ ...commonProps.style, ...selStyle, userSelect: "none" }}>{s.text}</text>;
  return null;
}