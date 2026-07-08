import { useEffect, useState } from "react";

/**
 * Site loader shown once on first mount, then fades out.
 * Uses a session flag so it doesn't re-appear on every route change.
 */
export function SiteLoader() {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("negaresh:loaded") === "1") {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem("negaresh:loaded", "1");
      setVisible(false);
    }, 900);
    return () => clearTimeout(t);
  }, []);

  if (!ready || !visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-xl bg-background/80 animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="relative rounded-3xl border border-primary/30 bg-card/80 px-10 py-8 shadow-2xl shadow-primary/20 text-center">
        <div className="ferrofluid-blob mx-auto mb-4 h-16 w-16" aria-hidden />
        <div className="text-primary text-lg font-bold tracking-widest">در حال بارگذاری…</div>
        <div className="text-muted-foreground text-xs mt-1">لطفاً چند لحظه صبر کنید</div>
        <div className="mt-4 h-1 w-56 overflow-hidden rounded-full bg-muted">
          <div className="site-loader-bar h-full bg-gradient-to-r from-primary via-accent to-primary" />
        </div>
      </div>
    </div>
  );
}