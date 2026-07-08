import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  Copy, Scissors, Clipboard, Search, Link as LinkIcon, ImageDown, RefreshCw,
  ArrowRight, ArrowLeft, ArrowUp, Home, Share2, Info, Eye,
} from "lucide-react";
import { toast } from "sonner";

type MenuItem =
  | { type: "sep" }
  | { type: "item"; label: string; icon: React.ComponentType<{ className?: string }>; shortcut?: string; onSelect: () => void | Promise<void>; danger?: boolean };

type Ctx = {
  x: number;
  y: number;
  selection: string;
  linkHref: string | null;
  imgSrc: string | null;
  isEditable: boolean;
};

/**
 * Site-wide exclusive right-click menu.
 * Suppresses the native context menu and renders a themed panel
 * with content-aware actions (selection, link, image, editable field).
 */
export function GlobalContextMenu() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      // Allow the browser's native menu when the user holds Shift — escape hatch.
      if (e.shiftKey) return;
      e.preventDefault();
      const target = e.target as HTMLElement | null;
      const linkEl = target?.closest("a") as HTMLAnchorElement | null;
      const imgEl = target?.closest("img") as HTMLImageElement | null;
      const editable = !!target?.closest("input,textarea,[contenteditable=true],.ProseMirror");
      const selection = window.getSelection()?.toString() ?? "";
      setCtx({
        x: e.clientX,
        y: e.clientY,
        selection,
        linkHref: linkEl?.href ?? null,
        imgSrc: imgEl?.src ?? null,
        isEditable: editable,
      });
    };
    const onClose = () => setCtx(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtx(null); };
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("click", onClose);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("click", onClose);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const close = () => setCtx(null);

  const items = useMemo<MenuItem[]>(() => {
    if (!ctx) return [];
    const list: MenuItem[] = [];

    if (ctx.selection) {
      list.push({
        type: "item", label: "کپی", icon: Copy, shortcut: "Ctrl+C",
        onSelect: async () => { await navigator.clipboard.writeText(ctx.selection); toast.success("کپی شد"); },
      });
      if (ctx.isEditable) {
        list.push({
          type: "item", label: "بریدن", icon: Scissors, shortcut: "Ctrl+X",
          onSelect: async () => { await navigator.clipboard.writeText(ctx.selection); document.execCommand("delete"); },
        });
      }
      list.push({
        type: "item", label: "جست‌وجو در وب", icon: Search,
        onSelect: () => { window.open(`https://www.google.com/search?q=${encodeURIComponent(ctx.selection)}`, "_blank", "noopener"); },
      });
      list.push({ type: "sep" });
    }

    if (ctx.isEditable) {
      list.push({
        type: "item", label: "چسباندن", icon: Clipboard, shortcut: "Ctrl+V",
        onSelect: async () => {
          try {
            const text = await navigator.clipboard.readText();
            document.execCommand("insertText", false, text);
          } catch { toast.error("دسترسی به کلیپ‌بورد مجاز نیست"); }
        },
      });
      list.push({ type: "sep" });
    }

    if (ctx.linkHref) {
      list.push({
        type: "item", label: "کپی نشانی لینک", icon: LinkIcon,
        onSelect: async () => { await navigator.clipboard.writeText(ctx.linkHref!); toast.success("نشانی لینک کپی شد"); },
      });
      list.push({
        type: "item", label: "باز کردن در برگهٔ جدید", icon: Eye,
        onSelect: () => { window.open(ctx.linkHref!, "_blank", "noopener"); },
      });
      list.push({ type: "sep" });
    }

    if (ctx.imgSrc) {
      list.push({
        type: "item", label: "باز کردن تصویر در برگهٔ جدید", icon: ImageDown,
        onSelect: () => { window.open(ctx.imgSrc!, "_blank", "noopener"); },
      });
      list.push({
        type: "item", label: "کپی نشانی تصویر", icon: LinkIcon,
        onSelect: async () => { await navigator.clipboard.writeText(ctx.imgSrc!); toast.success("نشانی تصویر کپی شد"); },
      });
      list.push({ type: "sep" });
    }

    list.push(
      { type: "item", label: "برگشت", icon: ArrowRight, onSelect: () => window.history.back() },
      { type: "item", label: "جلو", icon: ArrowLeft, onSelect: () => window.history.forward() },
      { type: "item", label: "تازه‌سازی", icon: RefreshCw, shortcut: "F5", onSelect: () => router.invalidate() },
      { type: "item", label: "بالای صفحه", icon: ArrowUp, onSelect: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
      { type: "sep" },
      { type: "item", label: "کپی نشانی این صفحه", icon: Share2, onSelect: async () => { await navigator.clipboard.writeText(window.location.href); toast.success("نشانی کپی شد"); } },
      { type: "item", label: "صفحهٔ خانه", icon: Home, onSelect: () => { void navigate({ to: "/" }); } },
      { type: "item", label: "دربارهٔ نگارش", icon: Info, onSelect: () => { void navigate({ to: "/help" }); } },
    );
    return list;
  }, [ctx, navigate, router]);

  // Clamp inside viewport once rendered.
  useEffect(() => {
    if (!ctx || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    let { x, y } = ctx;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    x = Math.max(8, x); y = Math.max(8, y);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [ctx]);

  if (!ctx) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      dir="rtl"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[9999] min-w-[248px] rounded-xl border border-border bg-popover/95 backdrop-blur p-1 text-popover-foreground animate-scale-in"
      style={{
        top: ctx.y,
        left: ctx.x,
        boxShadow:
          "0 0 0 1px color-mix(in oklab, var(--color-accent) 30%, transparent), 0 20px 60px -20px color-mix(in oklab, var(--color-primary) 60%, transparent), 0 0 40px -10px color-mix(in oklab, var(--color-accent) 40%, transparent)",
        animation: "none", // avoid the global button tremor
      }}
    >
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border/60 mb-1">
        نگارش · منوی راست‌کلیک
      </div>
      {items.map((it, i) => it.type === "sep" ? (
        <div key={`s-${i}`} className="my-1 h-px bg-border/70" />
      ) : (
        <button
          key={`i-${i}`}
          type="button"
          onClick={(e) => { e.stopPropagation(); void it.onSelect(); close(); }}
          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-right hover:bg-accent hover:text-accent-foreground ${it.danger ? "text-destructive" : ""}`}
          style={{ animation: "none" }}
        >
          <it.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{it.label}</span>
          {it.shortcut ? <span className="text-[10px] text-muted-foreground tabular-nums">{it.shortcut}</span> : null}
        </button>
      ))}
    </div>
  );
}