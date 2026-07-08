import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { HelpCircle, Rocket, LifeBuoy, Sparkles, Keyboard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type Change = { id: string; title: string; version: string; released_at: string; body: string };

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl + B / I / U", label: "پررنگ / کج / زیرخط" },
  { keys: "Ctrl + Z / Shift+Z", label: "برگرداندن / تکرار" },
  { keys: "Esc", label: "خروج از حالت مداد" },
  { keys: "V / P / R / O / L / T", label: "ابزارهای طراحی Sketch" },
  { keys: "Delete", label: "حذف شکل انتخاب‌شده" },
];

export function HelpPanel({ authed }: { authed: boolean }) {
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || changes.length) return;
    setLoading(true);
    supabase.from("changelog").select("id,title,version,released_at,body").order("released_at", { ascending: false }).limit(5)
      .then(({ data }) => { setChanges((data ?? []) as Change[]); setLoading(false); });
  }, [open, changes.length]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" title="راهنما و پشتیبانی">
          <HelpCircle className="ms-1 h-4 w-4" />کمک
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="text-right">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />مرکز کمک</SheetTitle>
          <SheetDescription>راهنما، آخرین تغییرات و ارتباط با پشتیبانی.</SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="help" className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="help"><HelpCircle className="h-4 w-4 ms-1" />راهنما</TabsTrigger>
            <TabsTrigger value="changelog"><Rocket className="h-4 w-4 ms-1" />تغییرات</TabsTrigger>
            <TabsTrigger value="support"><LifeBuoy className="h-4 w-4 ms-1" />پشتیبانی</TabsTrigger>
          </TabsList>

          <TabsContent value="help" className="space-y-4 mt-4">
            <section>
              <h3 className="font-semibold mb-2">شروع سریع</h3>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal pe-4 leading-6">
                <li>روی «سند جدید» بزنید و بین <b>متن (Word)</b> یا <b>طراحی (Sketch)</b> انتخاب کنید.</li>
                <li>در Word از نوار ابزار برای قالب‌بندی، جدول و هوش مصنوعی استفاده کنید.</li>
                <li>در Sketch از پنل ابزار سمت راست/چپ برای رسم شکل و مدیریت لایه‌ها استفاده کنید.</li>
                <li>ذخیره خودکار انجام می‌شود؛ برای دانلود از منوی «دانلود» بهره ببرید.</li>
              </ol>
            </section>
            <section>
              <h3 className="font-semibold mb-2 flex items-center gap-2"><Keyboard className="h-4 w-4" />میان‌برهای صفحه‌کلید</h3>
              <div className="rounded-md border divide-y">
                {SHORTCUTS.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{s.label}</span>
                    <kbd className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </section>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild className="flex-1" onClick={() => setOpen(false)}>
                <Link to="/help">راهنمای کامل <ExternalLink className="h-3 w-3 ms-1" /></Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="flex-1" onClick={() => setOpen(false)}>
                <Link to="/design-system">Design System</Link>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="changelog" className="space-y-3 mt-4">
            {loading && <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>}
            {!loading && !changes.length && <p className="text-sm text-muted-foreground">هنوز به‌روزرسانی ثبت نشده است.</p>}
            {changes.map((c) => (
              <div key={c.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-sm">{c.title}</h4>
                  <span className="text-xs text-muted-foreground">v{c.version}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{format(new Date(c.released_at), "yyyy/MM/dd")}</p>
                <p className="text-sm whitespace-pre-line leading-6">{c.body}</p>
              </div>
            ))}
            <Button variant="ghost" size="sm" asChild className="w-full" onClick={() => setOpen(false)}>
              <Link to="/changelog">مشاهده همه تغییرات</Link>
            </Button>
          </TabsContent>

          <TabsContent value="support" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground leading-6">
              سؤالی دارید یا با مشکل مواجه شده‌اید؟ تیکت جدیدی ایجاد کنید تا تیم پشتیبانی در سریع‌ترین زمان پاسخ دهد.
            </p>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="text-xs text-muted-foreground">ارتباط مستقیم</div>
              <a href="mailto:support@example.com" className="text-sm text-primary hover:underline block">support@example.com</a>
            </div>
            {authed ? (
              <Button className="w-full" asChild onClick={() => setOpen(false)}>
                <Link to="/support"><LifeBuoy className="h-4 w-4 ms-1" />رفتن به تیکت‌ها</Link>
              </Button>
            ) : (
              <Button className="w-full" asChild onClick={() => setOpen(false)}>
                <Link to="/auth">ابتدا وارد شوید</Link>
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}