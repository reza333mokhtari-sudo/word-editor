import { useEffect, useRef } from "react";

export type PenType =
  | "ballpoint"   // خودکار — نازک و یکنواخت
  | "pencil"      // مداد — کمی شفاف و لبه نرم
  | "marker"      // ماژیک — ضخیم و مات
  | "brush"       // قلم‌مو — تغییر ضخامت با سرعت
  | "highlighter" // هایلایتر — نیمه‌شفاف و پهن
  | "fineliner"   // راپید — بسیار نازک
  | "dashed";     // خط‌چین

type Props = {
  active: boolean;
  color: string;
  size: number;
  penType?: PenType;
  smooth?: boolean;
  eraser?: boolean;
  clearSignal?: number;
};

/**
 * Absolute canvas overlay that fills its parent element.
 * The parent must be `position: relative`.
 * When `active` is false, the canvas ignores pointer events so the
 * underlying editor keeps working normally.
 */
export function DrawOverlay({ active, color, size, penType = "ballpoint", smooth = true, eraser, clearSignal }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const smoothRef = useRef<{ x: number; y: number } | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastWidthRef = useRef<number>(size);

  // Keep canvas pixel size in sync with its rendered size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // preserve existing drawing
      const prev = document.createElement("canvas");
      prev.width = canvas.width;
      prev.height = canvas.height;
      const pctx = prev.getContext("2d");
      if (pctx && canvas.width && canvas.height) pctx.drawImage(canvas, 0, 0);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (prev.width && prev.height) ctx.drawImage(prev, 0, 0, rect.width, rect.height);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    window.addEventListener("resize", resize);
    return () => { ro.disconnect(); window.removeEventListener("resize", resize); };
  }, []);

  // Clear on demand.
  useEffect(() => {
    if (clearSignal === undefined) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [clearSignal]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointerPos(e);
    lastRef.current = p;
    smoothRef.current = p;
    lastTimeRef.current = performance.now();
    lastWidthRef.current = size;
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || !drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastRef.current || !smoothRef.current) return;
    const raw = pointerPos(e);

    // AI-style smoothing: exponential moving average toward the raw point.
    // Higher alpha = follow finger more closely. Lower = smoother, softer.
    const alpha = smooth ? 0.35 : 1;
    const sp = {
      x: smoothRef.current.x + (raw.x - smoothRef.current.x) * alpha,
      y: smoothRef.current.y + (raw.y - smoothRef.current.y) * alpha,
    };

    // Speed → dynamic width (used by brush type).
    const now = performance.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    const dx = sp.x - smoothRef.current.x;
    const dy = sp.y - smoothRef.current.y;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt;

    ctx.save();
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    let width = size;
    switch (eraser ? "ballpoint" : penType) {
      case "ballpoint":
        width = size;
        break;
      case "pencil":
        ctx.globalAlpha = 0.75;
        width = size * 0.9;
        // subtle grain via multiple thin strokes offset
        break;
      case "marker":
        width = size * 1.6;
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = color;
        ctx.shadowBlur = 0.4;
        break;
      case "brush": {
        // width shrinks as speed increases (pressure feel)
        const target = Math.max(size * 0.4, size * (1.8 - Math.min(1.4, speed * 1.5)));
        width = lastWidthRef.current + (target - lastWidthRef.current) * 0.35;
        lastWidthRef.current = width;
        break;
      }
      case "highlighter":
        width = size * 2.4;
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = eraser ? "destination-out" : "multiply";
        ctx.lineCap = "butt";
        break;
      case "fineliner":
        width = Math.max(1, size * 0.5);
        break;
      case "dashed":
        width = size;
        ctx.setLineDash([size * 2, size * 1.4]);
        break;
    }

    ctx.lineWidth = width;
    ctx.beginPath();
    // Quadratic curve through midpoints keeps the visible stroke silky-smooth.
    const mx = (smoothRef.current.x + sp.x) / 2;
    const my = (smoothRef.current.y + sp.y) / 2;
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.quadraticCurveTo(smoothRef.current.x, smoothRef.current.y, mx, my);
    ctx.stroke();
    ctx.restore();

    lastRef.current = { x: mx, y: my };
    smoothRef.current = sp;
    lastTimeRef.current = now;
  };
  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastRef.current = null;
    smoothRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={end}
      className={active ? "draw-canvas draw-canvas-active" : "draw-canvas"}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: active ? "auto" : "none",
        cursor: active
          ? (eraser
            ? "cell"
            : "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23222' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 19l7-7 3 3-7 7-3-3z'/><path d='M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z'/><path d='M2 2l7.586 7.586'/><circle cx='11' cy='11' r='2'/></svg>\") 2 22, crosshair")
          : "auto",
        touchAction: active ? "none" : "auto",
        zIndex: active ? 30 : 0,
      }}
    />
  );
}