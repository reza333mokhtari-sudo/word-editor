import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, BookOpen, Sparkles, Shield } from "lucide-react";
import { format } from "date-fns";

type ChangelogRow = { id: string; version: string; title: string; body: string; released_at: string };

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "تغییرات و راهنما — نگارش" },
      { name: "description", content: "تاریخچه به‌روزرسانی‌های نگارش به‌همراه راهنمای استفاده از قابلیت‌ها." },
      { property: "og:title", content: "تغییرات و راهنما — نگارش" },
      { property: "og:description", content: "آخرین نسخه‌ها، ویژگی‌های جدید و راهنمای شروع سریع." },
    ],
  }),
  component: ChangelogPage,
});

function ChangelogPage() {
  const [authed, setAuthed] = useState(false);
  const [logs, setLogs] = useState<ChangelogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      setAuthed(!!user);
      if (user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        setIsAdmin(!!r);
      }
      const { data } = await supabase.from("changelog").select("*").order("released_at", { ascending: false });
      setLogs((data ?? []) as ChangelogRow[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={authed} />
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Rocket className="h-7 w-7 text-primary" />تغییرات نسخه‌ها</h1>
            <p className="text-muted-foreground mt-2">پیگیری آخرین به‌روزرسانی‌ها، ویژگی‌های جدید و رفع اشکالات نگارش.</p>
          </div>
          {isAdmin && (
            <Button asChild><Link to="/admin">افزودن نسخه جدید</Link></Button>
          )}
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />راهنمای این بخش</CardTitle>
            <CardDescription>در این صفحه چه چیزی خواهید دید؟</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7">
            <div className="flex gap-3">
              <Badge variant="secondary" className="shrink-0">۱</Badge>
              <p><strong>شماره نسخه:</strong> هر نسخه با فرمت <code dir="ltr">MAJOR.MINOR.PATCH</code> (مثلاً <code dir="ltr">1.2.0</code>) شناخته می‌شود.</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="secondary" className="shrink-0">۲</Badge>
              <p><strong>عنوان نسخه:</strong> خلاصه‌ای کوتاه از مهم‌ترین تغییر آن نسخه.</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="secondary" className="shrink-0">۳</Badge>
              <p><strong>توضیحات:</strong> فهرست کامل تغییرات؛ می‌توانید در آن به دنبال قابلیت موردنظر خود بگردید.</p>
            </div>
            <div className="flex gap-3">
              <Badge variant="secondary" className="shrink-0">۴</Badge>
              <p><strong>افزودن نسخه:</strong> فقط مدیر سایت می‌تواند از پنل مدیریت نسخه‌ی جدید ثبت کند. کاربران عادی نسخه‌ها را فقط مشاهده می‌کنند.</p>
            </div>
            <div className="pt-2 flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" asChild><Link to="/help"><Sparkles className="h-4 w-4 ms-1" />راهنمای کامل</Link></Button>
              {authed && <Button size="sm" variant="outline" asChild><Link to="/support">ثبت پیشنهاد یا مشکل</Link></Button>}
              {isAdmin && <Button size="sm" variant="outline" asChild><Link to="/admin"><Shield className="h-4 w-4 ms-1" />پنل مدیریت</Link></Button>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>}
          {!loading && logs.length === 0 && (
            <Card><CardContent className="py-10 text-center text-muted-foreground">هنوز نسخه‌ای منتشر نشده است.</CardContent></Card>
          )}
          {logs.map((l) => (
            <Card key={l.id}>
              <CardHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge>v{l.version}</Badge>
                  <CardTitle className="text-lg">{l.title}</CardTitle>
                  <span className="text-xs text-muted-foreground ms-auto">{format(new Date(l.released_at), "yyyy/MM/dd")}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-7">{l.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}