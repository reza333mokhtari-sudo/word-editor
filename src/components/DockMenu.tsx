import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Settings, User, Music, FileText, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

type Item = { to: string; label: string; Icon: React.ComponentType<{ className?: string }> };

const ITEMS: Item[] = [
  { to: "/", label: "خانه", Icon: Home },
  { to: "/music", label: "موزیک", Icon: Music },
  { to: "/documents", label: "اسناد", Icon: FileText },
  { to: "/about", label: "درباره ما", Icon: Info },
  { to: "/settings", label: "تنظیمات", Icon: Settings },
  { to: "/auth", label: "پروفایل", Icon: User },
];

/**
 * Floating macOS-like dock. Hidden inside the document editor for focus.
 */
export function DockMenu() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hover, setHover] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [barHover, setBarHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("negaresh:dock-visible");
    if (stored === "0") setVisible(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "X" || e.key === "x")) {
        e.preventDefault();
        setVisible((v) => {
          const next = !v;
          sessionStorage.setItem("negaresh:dock-visible", next ? "1" : "0");
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setVisible(false);
    if (typeof window !== "undefined") sessionStorage.setItem("negaresh:dock-visible", "0");
  };

  // Hide inside editor fullscreen or on the auth page itself.
  if (pathname.startsWith("/documents/") && pathname !== "/documents") return null;
  if (pathname === "/auth") return null;
  if (!visible) return null;

  return (
    <nav
      aria-label="نوار میانبر"
      onMouseEnter={() => setBarHover(true)}
      onMouseLeave={() => setBarHover(false)}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] hidden md:flex items-end gap-1 rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-primary/10"
      dir="ltr"
    >
      <button
        type="button"
        onClick={close}
        aria-label="بستن نوار میانبر (Ctrl+Shift+X)"
        title="بستن (Ctrl+Shift+X)"
        className={`absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg transition-all duration-200 ${
          barHover ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"
        }`}
      >
        <X className="h-3 w-3" />
      </button>
      {ITEMS.map(({ to, label, Icon }) => {
        const active = pathname === to;
        const h = hover === to;
        return (
          <Link
            key={to}
            to={to}
            onMouseEnter={() => setHover(to)}
            onMouseLeave={() => setHover(null)}
            className={`relative flex flex-col items-center justify-center rounded-xl transition-all duration-200 ${
              h ? "h-14 w-14 -translate-y-2" : "h-11 w-11"
            } ${active ? "bg-primary/20 text-primary" : "text-foreground/70 hover:text-primary"}`}
            title={label}
          >
            <Icon className={h ? "h-6 w-6" : "h-5 w-5"} />
            {h && (
              <span className="absolute -top-8 whitespace-nowrap rounded-md bg-card border border-primary/30 px-2 py-0.5 text-[10px] text-foreground shadow">
                {label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}