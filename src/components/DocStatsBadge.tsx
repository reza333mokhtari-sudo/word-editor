import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { AlignJustify } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Live document-stats + FPS badge for the editor toolbar.
 * Rendered as an inverted-color pill with the `|||` glyph; open to see
 * a small breakdown (lines, tables, characters, tool-use count, FPS).
 */
export function DocStatsBadge({ editor, toolUses }: { editor: Editor | null; toolUses: number }) {
  const [fps, setFps] = useState(60);
  const framesRef = useRef(0);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      framesRef.current += 1;
      const now = performance.now();
      if (now - lastRef.current >= 500) {
        setFps(Math.round((framesRef.current * 1000) / (now - lastRef.current)));
        framesRef.current = 0;
        lastRef.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Recompute doc stats whenever the doc mutates.
  const [stats, setStats] = useState({ lines: 0, tables: 0, chars: 0, words: 0 });
  useEffect(() => {
    if (!editor) return;
    const compute = () => {
      const doc = editor.state.doc;
      let tables = 0;
      let lines = 0;
      doc.descendants((node) => {
        if (node.type.name === "table") tables += 1;
        if (["paragraph", "heading", "listItem", "taskItem", "blockquote", "codeBlock"].includes(node.type.name)) lines += 1;
      });
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setStats({ lines, tables, chars: text.length, words });
    };
    compute();
    editor.on("update", compute);
    return () => { editor.off("update", compute); };
  }, [editor]);

  const fpsTone = fps >= 50 ? "var(--color-accent)" : fps >= 30 ? "var(--color-primary)" : "var(--color-destructive)";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="آمار سند و FPS"
          className="h-7 shrink-0 inline-flex items-center gap-2 px-3 text-xs font-medium tabular-nums"
          style={{
            borderRadius: 45,
            background: "var(--color-foreground)",
            color: "var(--color-background)",
            border: "1px solid var(--color-foreground)",
          }}
        >
          <AlignJustify className="h-3.5 w-3.5 rotate-90" />
          <span>{stats.lines} خط · {stats.chars} نویسه · {stats.tables} جدول</span>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: fpsTone, boxShadow: `0 0 6px ${fpsTone}` }}
            aria-hidden
          />
          <span>{fps} FPS</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 text-xs space-y-1.5">
        <Row label="خط‌ها"        value={stats.lines} />
        <Row label="نویسه‌ها"      value={stats.chars} />
        <Row label="کلمه‌ها"       value={stats.words} />
        <Row label="جدول‌ها"       value={stats.tables} />
        <Row label="استفاده از ابزار" value={toolUses} />
        <div className="h-px bg-border my-1" />
        <Row label="FPS" value={`${fps}`} />
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}