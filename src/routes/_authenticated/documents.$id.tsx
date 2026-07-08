import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EditorToolbar, EditorSurface, useDocEditor } from "@/components/Editor";
import { DrawOverlay, type PenType } from "@/components/DrawOverlay";
import { transformText } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Loader2, Save, Download, FileText, FileCode2, FileType } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DocLoading, DocError, DocNotFound } from "@/components/DocStates";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { exportAsDocx, exportAsHtml, exportAsPdf, exportAsText, tiptapJsonToText } from "@/lib/exporters";
import { normalizeEditorContent, textToEditorHtml } from "@/lib/editor-content";
import { SketchEditor, isSketchDoc, type SketchDoc } from "@/components/SketchEditor";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  component: DocPage,
  pendingComponent: () => <DocLoading label="در حال بارگذاری سند…" />,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return <DocError error={error as Error} reset={() => { router.invalidate(); reset(); }} />;
  },
  notFoundComponent: () => <DocNotFound />,
});

function DocPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [content, setContent] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [penOn, setPenOn] = useState(false);
  const [penColor, setPenColor] = useState("#ef4444");
  const [penSize, setPenSize] = useState(3);
  const [penEraser, setPenEraser] = useState(false);
  const [clearTick, setClearTick] = useState(0);
  const [penType, setPenType] = useState<PenType>("ballpoint");
  const [penSmooth, setPenSmooth] = useState(true);
  const [toolUses, setToolUses] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ESC exits pencil mode → then fullscreen; both preserve state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (penOn) {
        e.preventDefault(); setPenOn(false); setPenEraser(false);
        toast.message("مداد خاموش شد — خطوط حفظ شدند");
        return;
      }
      if (fullscreen) { e.preventDefault(); setFullscreen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [penOn, fullscreen]);
  const aiSelectionRef = useRef<{ from: number; to: number; empty: boolean } | null>(null);
  const transform = useServerFn(transformText);

  useEffect(() => {
    setLoading(true); setLoadError(null); setNotFound(false);
    supabase.from("documents").select("title,content").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error) { setLoadError(new Error(error.message)); setLoading(false); return; }
      if (!data) { setNotFound(true); setLoading(false); return; }
      setTitle(data.title);
      const raw = data.content;
      setContent(isSketchDoc(raw) ? raw : normalizeEditorContent(raw));
      setLoading(false);
    });
  }, [id]);

  const persist = useCallback(async (patch: { title?: string; content?: unknown }) => {
    setSaving(true);
    const { error } = await supabase.from("documents").update(patch as never).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
  }, [id]);

  const schedule = (patch: { title?: string; content?: unknown }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(patch), 800);
  };

  const editor = useDocEditor(content, (json) => schedule({ content: json }));

  useEffect(() => {
    if (editor && content) editor.commands.setContent(content as never, { emitUpdate: false });
  }, [editor, content]);

  async function runAi(mode: "summarize" | "dedupe" | "custom") {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const text = empty ? editor.getText() : editor.state.doc.textBetween(from, to, "\n");
    if (!text.trim()) { toast.warning("متنی برای پردازش وجود ندارد."); return; }
    aiSelectionRef.current = { from, to, empty };
    if (mode === "custom") { setCustomOpen(true); return; }
    setAiLoading(true);
    try {
      const res = await transform({ data: { text, mode } });
      const replacement = textToEditorHtml(res.result);
      if (empty) editor.chain().focus().setContent(replacement).run();
      else editor.chain().focus().deleteRange({ from, to }).insertContent(replacement).run();
      toast.success(empty ? "کل متن به‌روزرسانی شد" : "متن انتخاب‌شده به‌روزرسانی شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally { setAiLoading(false); }
  }

  async function runCustom() {
    if (!editor || !customPrompt.trim()) return;
    const selection = aiSelectionRef.current ?? editor.state.selection;
    const { from, to, empty } = selection;
    const text = empty ? editor.getText() : editor.state.doc.textBetween(from, to, "\n");
    if (!text.trim()) { toast.warning("متنی برای پردازش وجود ندارد."); return; }
    setCustomOpen(false); setAiLoading(true);
    try {
      const res = await transform({ data: { text, mode: "custom", instruction: customPrompt } });
      const replacement = textToEditorHtml(res.result);
      if (empty) editor.chain().focus().setContent(replacement).run();
      else editor.chain().focus().deleteRange({ from, to }).insertContent(replacement).run();
      toast.success(empty ? "کل متن به‌روزرسانی شد" : "متن انتخاب‌شده به‌روزرسانی شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally { setAiLoading(false); aiSelectionRef.current = null; }
  }

  async function download(kind: "docx" | "pdf" | "html" | "txt") {
    if (!editor) return;
    const html = editor.getHTML();
    try {
      if (kind === "docx") { await exportAsDocx(title, html); toast.success("فایل Word دانلود شد"); return; }
      if (kind === "html") { exportAsHtml(title, html); toast.success("فایل HTML دانلود شد"); return; }
      if (kind === "txt") { exportAsText(title, tiptapJsonToText(editor.getJSON())); toast.success("فایل متنی دانلود شد"); return; }
      if (kind === "pdf") {
        const ok = exportAsPdf(title, html);
        if (!ok) toast.error("پنجره چاپ باز نشد. مسدودکننده pop-up را غیرفعال کنید.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت فایل");
    }
  }

  if (loading) return <DocLoading label="در حال بارگذاری سند…" />;
  if (notFound) return <DocNotFound />;
  if (loadError) return <DocError error={loadError} reset={() => { setLoadError(null); setLoading(true); nav({ to: "/documents/$id", params: { id } }); }} />;

  if (isSketchDoc(content)) {
    return (
      <div className="min-h-screen bg-muted/30">
        <AppHeader authed />
        <div className="max-w-[1600px] mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Button variant="ghost" size="sm" onClick={() => nav({ to: "/documents" })}><ArrowRight className="h-4 w-4 ms-1" />بازگشت</Button>
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); schedule({ title: e.target.value }); }}
              className="text-lg font-semibold border-transparent bg-transparent hover:bg-accent focus-visible:bg-card"
            />
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              {saving ? <><Loader2 className="h-3 w-3 animate-spin" />در حال ذخیره</> : <><Save className="h-3 w-3" />ذخیره شد</>}
            </span>
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-4">
          <SketchEditor
            doc={content as SketchDoc}
            title={title}
            onChange={(d) => { setContent(d); schedule({ content: d as unknown }); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader authed />
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="sm" onClick={() => nav({ to: "/documents" })}><ArrowRight className="h-4 w-4 ms-1" />بازگشت</Button>
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); schedule({ title: e.target.value }); }}
            className="text-lg font-semibold border-transparent bg-transparent hover:bg-accent focus-visible:bg-card"
          />
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
            {saving ? <><Loader2 className="h-3 w-3 animate-spin" />در حال ذخیره</> : <><Save className="h-3 w-3" />ذخیره شد</>}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <Download className="h-4 w-4 ms-1" />دانلود
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>فرمت خروجی</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => download("docx")}>
                <FileText className="h-4 w-4 ms-2 text-blue-600" />Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("pdf")}>
                <FileType className="h-4 w-4 ms-2 text-red-600" />PDF (چاپ)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("html")}>
                <FileCode2 className="h-4 w-4 ms-2 text-orange-600" />HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => download("txt")}>
                <FileText className="h-4 w-4 ms-2 text-muted-foreground" />متن ساده (.txt)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className={fullscreen ? "fixed inset-0 z-[70] bg-card overflow-auto" : "max-w-5xl mx-auto bg-card rounded-t-lg border shadow-sm overflow-hidden"}>
        <EditorToolbar
          editor={editor}
          onAi={runAi}
          aiLoading={aiLoading}
          onToolUse={() => setToolUses((n) => n + 1)}
          toolUses={toolUses}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen((v) => !v)}
          pencil={{
            active: penOn,
            color: penColor,
            size: penSize,
            eraser: penEraser,
            penType,
            smooth: penSmooth,
            onToggle: () => { setPenOn((v) => !v); setPenEraser(false); },
            onColorChange: setPenColor,
            onSizeChange: setPenSize,
            onPenTypeChange: setPenType,
            onSmoothToggle: () => setPenSmooth((v) => !v),
            onEraserToggle: () => setPenEraser((v) => !v),
            onClear: () => setClearTick((n) => n + 1),
          }}
        />
        <EditorSurface editor={editor}>
          <DrawOverlay active={penOn} color={penColor} size={penSize} penType={penType} smooth={penSmooth} eraser={penEraser} clearSignal={clearTick} />
        </EditorSurface>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>دستور سفارشی هوش مصنوعی</DialogTitle></DialogHeader>
          <Textarea rows={4} placeholder="مثلاً: متن را رسمی‌تر کن و به سه پاراگراف تقسیم کن." value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>انصراف</Button>
            <Button onClick={runCustom}>اجرا</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}