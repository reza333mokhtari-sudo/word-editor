import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Bold, Italic, UnderlineIcon, Strikethrough, AlignRight, AlignCenter, AlignLeft, AlignJustify,
  List, ListOrdered, ListChecks, Quote, Code, Undo2, Redo2, Heading1, Heading2, Heading3,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon, Highlighter, Superscript as SupIcon,
  Subscript as SubIcon, Sparkles, Loader2, Eraser, Pencil, Eraser as EraserIcon, Trash2, Type,
  Pen, PenTool, Brush, Minus, Feather, Wand2, Languages, Save, Printer, FileText, Home as HomeIcon,
  Plus, Palette, Layout as LayoutIcon, BookOpen, Eye, Maximize2, Minimize2, Youtube, Sigma, Search,
} from "lucide-react";
import type { PenType } from "@/components/DrawOverlay";
import { useCallback, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { DocStatsBadge } from "@/components/DocStatsBadge";

export function getEditorExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
    TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "right" }),
    Link.configure({ openOnClick: false, autolink: true }),
    Image,
    Table.configure({ resizable: true }),
    TableRow, TableCell, TableHeader,
    Highlight.configure({ multicolor: true }),
    TextStyle, Color, FontFamily,
    Placeholder.configure({ placeholder: "شروع به نوشتن کنید…" }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Subscript, Superscript,
  ];
}

export function useDocEditor(initial: unknown, onUpdate: (json: unknown) => void) {
  const editor = useEditor({
    extensions: getEditorExtensions(),
    content: initial ?? { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => onUpdate(editor.getJSON()),
    editorProps: { attributes: { dir: "rtl", spellcheck: "false" } },
    immediatelyRender: false,
  });
  return editor;
}

function Btn({ active, onClick, children, title, disabled }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string; disabled?: boolean }) {
  return (
    <Button
      type="button" variant={active ? "secondary" : "ghost"} size="icon"
      className="h-8 w-8"
      disabled={disabled}
      // Prevent the toolbar button from stealing focus / collapsing the editor selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

export type PencilState = {
  active: boolean;
  color: string;
  size: number;
  eraser: boolean;
  penType: PenType;
  smooth: boolean;
  onToggle: () => void;
  onColorChange: (c: string) => void;
  onSizeChange: (n: number) => void;
  onPenTypeChange: (t: PenType) => void;
  onSmoothToggle: () => void;
  onEraserToggle: () => void;
  onClear: () => void;
};

const PEN_TYPES: { value: PenType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "ballpoint",   label: "خودکار",   Icon: Pen },
  { value: "pencil",      label: "مداد",     Icon: Pencil },
  { value: "marker",      label: "ماژیک",    Icon: PenTool },
  { value: "brush",       label: "قلم‌مو",   Icon: Brush },
  { value: "highlighter", label: "هایلایتر", Icon: Highlighter },
  { value: "fineliner",   label: "راپید",    Icon: Feather },
  { value: "dashed",      label: "خط‌چین",   Icon: Minus },
];

export type RibbonTab = "home" | "insert" | "design" | "layout" | "review" | "view";

export function EditorToolbar({ editor, onAi, aiLoading, pencil, onToolUse, toolUses = 0, fullscreen, onToggleFullscreen }: { editor: Editor | null; onAi: (mode: "summarize" | "dedupe" | "custom") => void; aiLoading: boolean; pencil?: PencilState; onToolUse?: () => void; toolUses?: number; fullscreen?: boolean; onToggleFullscreen?: () => void }) {
  const [textDir, setTextDir] = useState<"rtl" | "ltr">("rtl");
  const [tab, setTab] = useState<RibbonTab>("home");
  const runTextCommand = useCallback((command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (!editor || !editor.isEditable) return;
    const { empty, from, to } = editor.state.selection;
    const docSize = editor.state.doc.content.size;
    // Clamp caret positions so we never point outside the doc after the command runs.
    const safeFrom = Math.min(Math.max(from, 0), docSize);
    const safeTo = Math.min(Math.max(to, 0), docSize);
    let chain = editor.chain().focus();
    if (editor.isActive("codeBlock")) chain = chain.toggleCodeBlock();
    if (empty) chain = chain.selectAll();
    command(chain).run();
    if (empty) {
      const newSize = editor.state.doc.content.size;
      const pos = Math.min(safeFrom, newSize);
      editor.commands.setTextSelection({ from: pos, to: Math.min(safeTo, newSize) });
    }
    onToolUse?.();
  }, [editor, onToolUse]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("آدرس لینک:", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    runTextCommand((chain) => chain.extendMarkRange("link").setLink({ href: url }));
  }, [editor, runTextCommand]);
  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("آدرس تصویر:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);
  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);
  const clearFormatting = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  }, [editor]);

  const applyDir = useCallback((dir: "rtl" | "ltr") => {
    if (!editor) return;
    setTextDir(dir);
    editor.view.dom.setAttribute("dir", dir);
    editor.chain().focus().setTextAlign(dir === "rtl" ? "right" : "left").run();
  }, [editor]);

  if (!editor) return null;

  const { empty: selEmpty, from: selFrom, to: selTo } = editor.state.selection;
  const selCount = selEmpty ? 0 : selTo - selFrom;
  const currentPen = pencil ? PEN_TYPES.find((p) => p.value === pencil.penType) ?? PEN_TYPES[0] : null;
  const PenActiveIcon = currentPen?.Icon ?? Pencil;

  const insertYouTube = () => {
    const url = window.prompt("لینک YouTube/YouTube Music را وارد کنید:");
    if (!url) return;
    const m = url.match(/(?:youtu\.be\/|v=|music\.youtube\.com\/watch\?v=)([\w-]{6,})/);
    const id = m?.[1];
    if (!id) { window.alert("لینک نامعتبر"); return; }
    const html = `<div class="yt-embed"><iframe src="https://www.youtube.com/embed/${id}" allow="autoplay; encrypted-media" allowfullscreen></iframe></div><p></p>`;
    editor.chain().focus().insertContent(html).run();
  };
  const insertSymbol = () => {
    const s = window.prompt("سمبل ریاضی یا حرف را وارد کنید (مثال: √, π, ∑, ≠):");
    if (s) editor.chain().focus().insertContent(s).run();
  };
  const insertEquation = () => {
    const s = window.prompt("معادله را وارد کنید:", "E = mc^2");
    if (s) editor.chain().focus().insertContent(`<code>${s}</code>`).run();
  };
  const insertHR = () => editor.chain().focus().setHorizontalRule().run();
  const insertTextBox = () => {
    editor.chain().focus().insertContent(
      `<blockquote><p>متن جعبه…</p></blockquote>`
    ).run();
  };

  return (
    <div className="border-b bg-card sticky top-14 z-20">
      {/* Title bar / Quick Access Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-l from-primary/10 to-transparent px-3 py-1.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground/80">نگارش</span>
          <span className="opacity-50">·</span>
          <span>سند در حال ویرایش</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Btn title="ذخیره" onClick={() => onToolUse?.()}><Save className="h-3.5 w-3.5" /></Btn>
          <Btn title="واگرد" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-3.5 w-3.5" /></Btn>
          <Btn title="ازنو" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-3.5 w-3.5" /></Btn>
          <Btn title="چاپ" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /></Btn>
          {onToggleFullscreen && (
            <Btn title={fullscreen ? "خروج از تمام صفحه (ESC)" : "تمام صفحه"} onClick={onToggleFullscreen}>
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Btn>
          )}
        </div>
      </div>
      {/* Ribbon tabs */}
      <div className="flex items-center gap-1 px-3 pt-1 border-b border-border/50 text-xs">
        {([
          ["home", "خانه", HomeIcon],
          ["insert", "درج", Plus],
          ["design", "طراحی", Palette],
          ["layout", "چیدمان", LayoutIcon],
          ["review", "بازبینی", BookOpen],
          ["view", "نمایش", Eye],
        ] as [RibbonTab, string, React.ComponentType<{ className?: string }>][]).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 border-b-2 transition-colors ${
              tab === id
                ? "border-primary text-primary bg-primary/5 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      {/* Ribbon content */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2">
      {tab === "home" && (<>
      <Badge
        variant={selEmpty ? "outline" : "secondary"}
        title={selEmpty ? "متنی انتخاب نشده — دستورها روی کل سند اعمال می‌شوند" : "دستورها فقط روی متن انتخاب‌شده اعمال می‌شوند"}
        className="h-7 shrink-0 gap-1 font-normal tabular-nums"
      >
        {selEmpty ? "کل سند" : `${selCount} نویسه`}
      </Badge>
      <DocStatsBadge editor={editor} toolUses={toolUses} />
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="پاک‌سازی قالب" onClick={clearFormatting}><Eraser className="h-4 w-4" /></Btn>
      <Separator orientation="vertical" className="h-6 mx-1" />

      <Select value={textDir} onValueChange={(v) => applyDir(v as "rtl" | "ltr")}>
        <SelectTrigger className="h-8 w-28" title="جهت متن (RTL / LTR)">
          <span className="flex items-center gap-1"><Languages className="h-4 w-4" /><SelectValue /></span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rtl">راست‌به‌چپ (RTL)</SelectItem>
          <SelectItem value="ltr">چپ‌به‌راست (LTR)</SelectItem>
        </SelectContent>
      </Select>

      <Select value={
        editor.isActive("heading", { level: 1 }) ? "h1" :
        editor.isActive("heading", { level: 2 }) ? "h2" :
        editor.isActive("heading", { level: 3 }) ? "h3" : "p"
      } onValueChange={(v) => {
        runTextCommand((chain) => v === "p" ? chain.setParagraph() : chain.toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }));
      }}>
        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="p">متن معمولی</SelectItem>
          <SelectItem value="h1">عنوان ۱</SelectItem>
          <SelectItem value="h2">عنوان ۲</SelectItem>
          <SelectItem value="h3">عنوان ۳</SelectItem>
        </SelectContent>
      </Select>

      <Select value={editor.getAttributes("textStyle").fontFamily || "default"} onValueChange={(v) => {
        runTextCommand((chain) => v === "default" ? chain.unsetFontFamily() : chain.setFontFamily(v));
      }}>
        <SelectTrigger className="h-8 w-32"><SelectValue placeholder="فونت" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="default">پیش‌فرض</SelectItem>
          <SelectItem value="Vazirmatn">وزیر</SelectItem>
          <SelectItem value="Tahoma">تاهوما</SelectItem>
          <SelectItem value="Arial">Arial</SelectItem>
          <SelectItem value="Georgia">Georgia</SelectItem>
        </SelectContent>
      </Select>

      <input type="color" title="رنگ متن" className="h-8 w-8 rounded cursor-pointer border"
        onChange={(e) => runTextCommand((chain) => chain.setColor(e.target.value))}
        value={editor.getAttributes("textStyle").color || "#000000"} />

      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn active={editor.isActive("bold")} title="پررنگ" onClick={() => runTextCommand((chain) => chain.toggleBold())}><Bold className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("italic")} title="کج" onClick={() => runTextCommand((chain) => chain.toggleItalic())}><Italic className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("underline")} title="زیرخط" onClick={() => runTextCommand((chain) => chain.toggleUnderline())}><UnderlineIcon className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("strike")} title="خط‌خورده" onClick={() => runTextCommand((chain) => chain.toggleStrike())}><Strikethrough className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("highlight")} title="هایلایت" onClick={() => runTextCommand((chain) => chain.toggleHighlight({ color: "#fef08a" }))}><Highlighter className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("superscript")} title="بالانویس" onClick={() => runTextCommand((chain) => chain.toggleSuperscript())}><SupIcon className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("subscript")} title="زیرنویس" onClick={() => runTextCommand((chain) => chain.toggleSubscript())}><SubIcon className="h-4 w-4" /></Btn>

      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn active={editor.isActive({ textAlign: "right" })} title="راست‌چین" onClick={() => runTextCommand((chain) => chain.setTextAlign("right"))}><AlignRight className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive({ textAlign: "center" })} title="وسط‌چین" onClick={() => runTextCommand((chain) => chain.setTextAlign("center"))}><AlignCenter className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive({ textAlign: "left" })} title="چپ‌چین" onClick={() => runTextCommand((chain) => chain.setTextAlign("left"))}><AlignLeft className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive({ textAlign: "justify" })} title="تراز" onClick={() => runTextCommand((chain) => chain.setTextAlign("justify"))}><AlignJustify className="h-4 w-4" /></Btn>

      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn active={editor.isActive("bulletList")} title="فهرست نقطه‌ای" onClick={() => runTextCommand((chain) => chain.toggleBulletList())}><List className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("orderedList")} title="فهرست شماره‌دار" onClick={() => runTextCommand((chain) => chain.toggleOrderedList())}><ListOrdered className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("taskList")} title="چک‌لیست" onClick={() => runTextCommand((chain) => chain.toggleTaskList())}><ListChecks className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("blockquote")} title="نقل‌قول" onClick={() => runTextCommand((chain) => chain.toggleBlockquote())}><Quote className="h-4 w-4" /></Btn>
      <Btn active={editor.isActive("codeBlock")} title="بلوک کد" onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code className="h-4 w-4" /></Btn>

      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title="لینک" active={editor.isActive("link")} onClick={setLink}><LinkIcon className="h-4 w-4" /></Btn>
      <Btn title="تصویر" onClick={addImage}><ImageIcon className="h-4 w-4" /></Btn>
      <Btn title="جدول" onClick={insertTable}><TableIcon className="h-4 w-4" /></Btn>

      <Separator orientation="vertical" className="h-6 mx-1" />
      <Btn title={aiLoading ? "در حال پردازش…" : "خلاصه‌سازی با هوش مصنوعی"} disabled={aiLoading} onClick={() => onAi("summarize")}>
        {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      </Btn>
      <Btn title="حذف تکرار با هوش مصنوعی" disabled={aiLoading} onClick={() => onAi("dedupe")}><Wand2 className="h-4 w-4" /></Btn>
      <Btn title="دستور سفارشی هوش مصنوعی" disabled={aiLoading} onClick={() => onAi("custom")}><PenTool className="h-4 w-4" /></Btn>

      {pencil ? (
        <>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Btn
            active={pencil.active}
            title={pencil.active ? "حالت طراحی فعال — کلیک برای برگشت به نوشتن" : "حالت نوشتن فعال — کلیک برای طراحی"}
            onClick={pencil.onToggle}
          >
            {pencil.active
              ? <PenActiveIcon className="h-4 w-4 pencil-wiggle" />
              : <Type className="h-4 w-4" />}
          </Btn>
          {pencil.active ? (
            <>
              <Select value={pencil.penType} onValueChange={(v) => pencil.onPenTypeChange(v as PenType)}>
                <SelectTrigger className="h-8 w-32"><SelectValue placeholder="نوع مداد" /></SelectTrigger>
                <SelectContent>
                  {PEN_TYPES.map(({ value, label, Icon }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="تنظیمات مداد"
                    className="h-8 w-8 rounded border flex items-center justify-center"
                    style={{ background: pencil.color }}
                  >
                    <span className="sr-only">تنظیمات مداد</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">رنگ</Label>
                    <input type="color" className="h-8 w-full rounded border cursor-pointer"
                      value={pencil.color} onChange={(e) => pencil.onColorChange(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ضخامت: {pencil.size}px</Label>
                    <input type="range" min={1} max={20} value={pencil.size}
                      onChange={(e) => pencil.onSizeChange(Number(e.target.value))} className="w-full" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">صاف‌سازی هوشمند خط</Label>
                    <input type="checkbox" checked={pencil.smooth} onChange={pencil.onSmoothToggle} className="h-4 w-4" />
                  </div>
                </PopoverContent>
              </Popover>
              <Btn active={pencil.eraser} title="پاک‌کن" onClick={pencil.onEraserToggle}><EraserIcon className="h-4 w-4" /></Btn>
              <Btn title="پاک کردن همه خطوط" onClick={pencil.onClear}><Trash2 className="h-4 w-4" /></Btn>
            </>
          ) : null}
        </>
      ) : null}
      </>)}
      {tab === "insert" && (<>
        <Btn title="تصویر" onClick={addImage}><ImageIcon className="h-4 w-4" /></Btn>
        <Btn title="جدول" onClick={insertTable}><TableIcon className="h-4 w-4" /></Btn>
        <Btn title="لینک" onClick={setLink}><LinkIcon className="h-4 w-4" /></Btn>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Btn title="جعبه متن" onClick={insertTextBox}><Type className="h-4 w-4" /></Btn>
        <Btn title="خط جداکننده" onClick={insertHR}><Minus className="h-4 w-4" /></Btn>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Btn title="یوتیوب / یوتیوب موزیک" onClick={insertYouTube}><Youtube className="h-4 w-4" /></Btn>
        <Btn title="سمبل" onClick={insertSymbol}><Sigma className="h-4 w-4" /></Btn>
        <Btn title="معادله" onClick={insertEquation}><Sigma className="h-4 w-4" /></Btn>
      </>)}
      {tab === "design" && (<>
        <span className="text-xs text-muted-foreground me-2">تم:</span>
        {[
          { name: "سینمایی", bg: "linear-gradient(135deg,#0a0a0a,#3a1a5c,#c9a94a)" },
          { name: "کاغذ", bg: "linear-gradient(135deg,#fdf6e3,#f0e6c8)" },
          { name: "شب", bg: "linear-gradient(135deg,#0d1b2a,#1b263b)" },
          { name: "طلایی", bg: "linear-gradient(135deg,#3a2a00,#c9a94a)" },
        ].map((t) => (
          <button key={t.name} title={t.name} onClick={() => {
            const el = document.querySelector<HTMLElement>(".ProseMirror");
            if (el) el.style.background = t.bg;
          }} className="h-8 w-16 rounded-md border border-border" style={{ background: t.bg }} />
        ))}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <span className="text-xs text-muted-foreground">رنگ متن:</span>
        <input type="color" className="h-8 w-10 rounded cursor-pointer border"
          onChange={(e) => runTextCommand((chain) => chain.setColor(e.target.value))}
          defaultValue="#e9e9e9" />
      </>)}
      {tab === "layout" && (<>
        <span className="text-xs text-muted-foreground me-2">فاصله سطر:</span>
        {[1.4, 1.7, 2, 2.4].map((h) => (
          <button key={h} className="h-8 px-3 rounded border border-border text-xs hover:bg-accent/10"
            onClick={() => { const el = document.querySelector<HTMLElement>(".ProseMirror"); if (el) el.style.lineHeight = String(h); }}>
            {h}
          </button>
        ))}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <span className="text-xs text-muted-foreground me-2">حاشیه:</span>
        {["3rem", "4.5rem", "6rem"].map((p) => (
          <button key={p} className="h-8 px-3 rounded border border-border text-xs hover:bg-accent/10"
            onClick={() => { const el = document.querySelector<HTMLElement>(".ProseMirror"); if (el) el.style.paddingInline = p; }}>
            {p}
          </button>
        ))}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Select value={textDir} onValueChange={(v) => applyDir(v as "rtl" | "ltr")}>
          <SelectTrigger className="h-8 w-28"><span className="flex items-center gap-1"><Languages className="h-4 w-4" /><SelectValue /></span></SelectTrigger>
          <SelectContent>
            <SelectItem value="rtl">راست‌به‌چپ (RTL)</SelectItem>
            <SelectItem value="ltr">چپ‌به‌راست (LTR)</SelectItem>
          </SelectContent>
        </Select>
      </>)}
      {tab === "review" && (<>
        <Btn title="خلاصه‌سازی" disabled={aiLoading} onClick={() => onAi("summarize")}>
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </Btn>
        <Btn title="حذف تکرار" disabled={aiLoading} onClick={() => onAi("dedupe")}><Wand2 className="h-4 w-4" /></Btn>
        <Btn title="دستور سفارشی" disabled={aiLoading} onClick={() => onAi("custom")}><PenTool className="h-4 w-4" /></Btn>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Btn title="یافتن (Ctrl+F)" onClick={() => document.execCommand("find")}><Search className="h-4 w-4" /></Btn>
        <DocStatsBadge editor={editor} toolUses={toolUses} />
      </>)}
      {tab === "view" && (<>
        {onToggleFullscreen && (
          <button className="flex items-center gap-1.5 h-8 px-3 rounded border border-border text-xs hover:bg-accent/10" onClick={onToggleFullscreen}>
            {fullscreen ? <><Minimize2 className="h-4 w-4" />خروج تمام صفحه</> : <><Maximize2 className="h-4 w-4" />تمام صفحه</>}
          </button>
        )}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <span className="text-xs text-muted-foreground me-2">بزرگنمایی:</span>
        {[0.9, 1, 1.15, 1.3, 1.5].map((z) => (
          <button key={z} className="h-8 px-3 rounded border border-border text-xs hover:bg-accent/10"
            onClick={() => { const el = document.querySelector<HTMLElement>(".ProseMirror"); if (el) el.style.zoom = String(z); }}>
            {Math.round(z * 100)}%
          </button>
        ))}
      </>)}
      </div>
    </div>
  );
}

export function EditorSurface({ editor, children }: { editor: Editor | null; children?: React.ReactNode }) {
  // Auto-focus on first mount only, so drawing/pencil mode doesn't steal focus back.
  useEffect(() => { if (editor) editor.commands.focus("end", { scrollIntoView: false }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  return (
    <div className="relative">
      <EditorContent editor={editor} className="bg-card min-h-[calc(100vh-8rem)]" />
      {children}
    </div>
  );
}