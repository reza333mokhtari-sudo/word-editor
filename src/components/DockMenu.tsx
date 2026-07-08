import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Settings, User, Music, FileText, Info } from "lucide-react";
import { useState } from "react";

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

  // Hide inside editor fullscreen or on the auth page itself.
  if (pathname.startsWith("/documents/") && pathname !== "/documents") return null;
  if (pathname === "/auth") return null;

  return (
    <nav
      aria-label="نوار میانبر"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] hidden md:flex items-end gap-1 rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-primary/10"
      dir="ltr"
    >
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