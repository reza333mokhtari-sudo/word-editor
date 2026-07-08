import { useRouterState, Link } from "@tanstack/react-router";
import { usePlayer, fmt } from "./PlayerContext";
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, X, Music } from "lucide-react";
import { memo, useState } from "react";

function DockedPlayerInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { track, playing, started, toggle, next, prev, skip, progress, duration } = usePlayer();
  const [dismissed, setDismissed] = useState(false);

  if (pathname === "/music") return null;
  if (!started) return null;
  if (dismissed) return null;

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div
      className="fixed bottom-4 left-4 z-[60] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-black/85 backdrop-blur-xl shadow-2xl shadow-black/40 text-white overflow-hidden"
      dir="rtl"
      style={{ willChange: "transform" }}
    >
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: `radial-gradient(600px 200px at 20% 0%, hsl(${track.hue} 80% 40%) 0%, transparent 60%)` }}
      />
      <div className="relative flex items-center gap-3 p-3">
        <img src={track.cover} alt="" className="h-12 w-12 rounded-md object-cover shrink-0" loading="lazy" />
        <div className="min-w-0 flex-1">
          <Link to="/music" className="block truncate text-sm font-medium hover:underline">
            {track.title}
          </Link>
          <div className="truncate text-xs text-white/60">{track.artist}</div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="بستن"
          className="p-1 text-white/50 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative h-1 bg-white/10">
        <div className="h-full bg-white/70 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>

      <div className="relative grid grid-cols-5 gap-1 p-2">
        <SkipBtn label="-30" onClick={() => skip(-30)} icon={<Rewind className="h-4 w-4" />} num="30" />
        <SkipBtn label="-10" onClick={() => skip(-10)} icon={<Rewind className="h-4 w-4" />} num="10" />
        <button
          onClick={toggle}
          className="mx-auto h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
          aria-label={playing ? "توقف" : "پخش"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <SkipBtn label="+10" onClick={() => skip(10)} icon={<FastForward className="h-4 w-4" />} num="10" />
        <SkipBtn label="+30" onClick={() => skip(30)} icon={<FastForward className="h-4 w-4" />} num="30" />
      </div>

      <div className="relative flex items-center justify-between px-3 pb-2 text-[10px] text-white/50 tabular-nums">
        <button onClick={prev} className="flex items-center gap-1 hover:text-white" aria-label="قبلی">
          <SkipBack className="h-3.5 w-3.5" /> قبلی
        </button>
        <span>{fmt(progress)} / {fmt(duration || track.duration)}</span>
        <button onClick={next} className="flex items-center gap-1 hover:text-white" aria-label="بعدی">
          بعدی <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      <Link
        to="/music"
        className="relative flex items-center justify-center gap-1 border-t border-white/10 py-1.5 text-[11px] text-white/60 hover:bg-white/5 hover:text-white"
      >
        <Music className="h-3 w-3" /> باز کردن پخش‌کننده کامل
      </Link>
    </div>
  );
}

function SkipBtnInner({ onClick, icon, num, label }: { onClick: () => void; icon: React.ReactNode; num: string; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
    >
      {icon}
      <span className="text-[10px] tabular-nums">{num}s</span>
    </button>
  );
}
const SkipBtn = memo(SkipBtnInner);

export const DockedPlayer = memo(DockedPlayerInner);