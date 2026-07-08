import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Palette, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DocLoading, DocError } from "@/components/DocStates";
import { exportAsDocx } from "@/lib/exporters";
import { generateHTML } from "@tiptap/react";
import { getEditorExtensions } from "@/components/Editor";
import { normalizeEditorContent } from "@/lib/editor-content";
import { NewDocDialog } from "@/components/NewDocDialog";
import { emptySketchDoc } from "@/components/SketchEditor";

type Doc = { id: string; title: string; updated_at: string };

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({ meta: [{ title: "اسناد من — نگارش" }] }),
  component: DocsPage,
  pendingComponent: () => <DocLoading label="در حال بارگذاری اسناد…" />,
  errorComponent: ({ error, reset }) => <DocError error={error as Error} reset={reset} title="خطا در بارگذاری اسناد" />,
});

function DocsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<Error | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const nav = useNavigate();

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await supabase.from("documents").select("id,title,updated_at").order("updated_at", { ascending: false });
    setLoading(false);
    if (error) { setErr(new Error(error.message)); return; }
    setDocs((data ?? []) as Doc[]);
  }
  useEffect(() => { load(); }, []);

  async function create(kind: "word" | "sketch") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const title = kind === "sketch" ? "طرح بدون عنوان" : "سند بدون عنوان";
    const content = kind === "sketch" ? (emptySketchDoc() as unknown as never) : (undefined as unknown as never);
    const payload: { owner_id: string; title: string; content?: never } = { owner_id: user.id, title };
    if (content !== undefined) payload.content = content;
    const { data, error } = await supabase.from("documents").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    setPickerOpen(false);
    nav({ to: "/documents/$id", params: { id: data.id } });
  }
  async function remove(id: string) {
    if (!confirm("این سند حذف شود؟")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setDocs((d) => d.filter((x) => x.id !== id));
    toast.success("حذف شد");
  }

  async function quickDownload(id: string, title: string) {
    const { data, error } = await supabase.from("documents").select("content").eq("id", id).maybeSingle();
    if (error) return toast.error(error.message);
    if (!data) return toast.error("سند پیدا نشد");
    let html = "";
    try {
      const content = normalizeEditorContent(data.content);
      html = typeof content === "string" ? content : content ? generateHTML(content as never, getEditorExtensions()) : "";
    } catch {
      html = "";
    }
    try {
      await exportAsDocx(title, html || "<p></p>");
      toast.success("فایل Word دانلود شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت فایل");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">اسناد من</h1>
          <Button onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4 ms-1" />سند جدید</Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />در حال بارگذاری…</div>
        ) : err ? (
          <DocError error={err} reset={load} title="خطا در بارگذاری اسناد" />
        ) : docs.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">هنوز سندی نساخته‌اید.</p>
            <Button className="mt-4" onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4 ms-1" />ساخت اولین سند</Button>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((d) => (
              <Card key={d.id} className="hover:border-primary/60 transition-colors">
                <CardContent className="pt-6 flex flex-col gap-3">
                  <Link to="/documents/$id" params={{ id: d.id }} className="block">
                    {d.title.startsWith("طرح") ? <Palette className="h-6 w-6 text-accent-foreground mb-2" /> : <FileText className="h-6 w-6 text-primary mb-2" />}
                    <h3 className="font-semibold line-clamp-1">{d.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">آخرین ویرایش: {format(new Date(d.updated_at), "yyyy/MM/dd HH:mm")}</p>
                  </Link>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => quickDownload(d.id, d.title)} title="دانلود Word">
                      <Download className="h-4 w-4 ms-1" />دانلود
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(d.id)}>
                      <Trash2 className="h-4 w-4 ms-1" />حذف
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <NewDocDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={create} />
    </div>
  );
}