import { useRef, useState } from "react";

type Props = {
  name: string;
  handle: string;
  title: string;
  bio: string;
  avatar: string;
  href?: string;
};

/**
 * Profile card with pixel-hover effect + 3D tilt, inspired by reactbits.dev.
 */
export function ProfileCard({ name, handle, title, bio, avatar, href }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: dx * 12, y: -dy * 12 });
  };
  const onLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="pixel-card group relative w-[320px] rounded-3xl border border-primary/30 bg-card/60 backdrop-blur-xl p-6 shadow-2xl shadow-primary/20 transition-transform duration-300"
      style={{ transform: `perspective(900px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
    >
      <div className="pixel-card-fx" aria-hidden />
      <div className="relative">
        <div className="mx-auto h-32 w-32 rounded-full overflow-hidden border-4 border-primary/60 shadow-xl shadow-primary/30">
          <img src={avatar} alt={name} width={512} height={512} loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className="mt-4 text-center">
          <div className="text-2xl font-bold text-primary">{name}</div>
          <div className="text-xs text-accent-foreground/70 mt-0.5">{title}</div>
          <div className="text-xs text-muted-foreground mt-2">{bio}</div>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-1.5 text-xs text-primary hover:bg-primary/20"
            >
              {handle}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}