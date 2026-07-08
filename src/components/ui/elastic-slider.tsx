import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
  ariaLabel?: string;
  color?: string;
};

/**
 * Elastic slider inspired by reactbits.dev — the fill bar "stretches"
 * slightly past the thumb while dragging, then springs back on release.
 * Pure CSS transitions, no framer-motion dependency.
 */
export function ElasticSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  className,
  ariaLabel,
  color,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [overshoot, setOvershoot] = useState(0);

  const pct = ((value - min) / (max - min)) * 100;

  const commit = useCallback(
    (clientX: number) => {
      const el = barRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let x = (clientX - rect.left) / rect.width;
      // Elastic overshoot when the user drags outside the track.
      if (x < 0) setOvershoot(Math.max(-0.08, x));
      else if (x > 1) setOvershoot(Math.min(0.08, x - 1));
      else setOvershoot(0);
      x = Math.min(1, Math.max(0, x));
      const raw = min + x * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, snapped)));
    },
    [min, max, step, onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => commit(e.clientX);
    const up = () => { setDragging(false); setOvershoot(0); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, commit]);

  const scaleX = 1 + Math.abs(overshoot) * 0.6;
  const skew = overshoot * 12;

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={(e) => {
        setDragging(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        commit(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange(Math.max(min, value - step));
        if (e.key === "ArrowRight") onChange(Math.min(max, value + step));
      }}
      className={`relative h-6 flex items-center cursor-pointer select-none ${className ?? ""}`}
    >
      <div
        className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden"
        style={{
          transform: `scaleY(${dragging ? 1.6 : 1}) skewX(${skew}deg)`,
          transition: dragging ? "transform 80ms linear" : "transform 400ms cubic-bezier(.34,1.56,.64,1)",
          transformOrigin: overshoot >= 0 ? "left center" : "right center",
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color ?? "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
            transform: `scaleX(${scaleX})`,
            transformOrigin: "left center",
            transition: dragging ? "none" : "transform 400ms cubic-bezier(.34,1.56,.64,1)",
          }}
        />
      </div>
      <div
        aria-hidden
        className="absolute h-4 w-4 rounded-full bg-white shadow-lg shadow-primary/30 border border-primary/50 pointer-events-none"
        style={{
          left: `calc(${pct}% - 8px)`,
          transform: `scale(${dragging ? 1.25 : 1})`,
          transition: dragging ? "transform 80ms linear" : "transform 400ms cubic-bezier(.34,1.56,.64,1)",
        }}
      />
    </div>
  );
}