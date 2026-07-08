import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Sparkles, Users, Shield, LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={authed} />
      <main className="max-w-6xl mx-auto px-4 py-16">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium mb-6">
            <Sparkles className="h-3 w-3" /> ویرایشگر ابری فارسی نگارش
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground leading-tight">
            سندهای حرفه‌ای بسازید،<br />با هوش مصنوعی خلاصه کنید.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            یک ویرایشگر متن کامل با تمام امکانات Word، پشتیبانی از فارسی و راست‌چین،
            خلاصه‌سازی هوشمند، حذف تکرار و پنل پشتیبانی داخلی.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to={authed ? "/documents" : "/auth"}>شروع کنید</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/help">راهنما و تغییرات</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: FileText, title: "ادیتور حرفه‌ای", body: "فونت، رنگ، جدول، تصویر، فهرست، چک‌لیست و بیشتر." },
            { icon: Sparkles, title: "هوش مصنوعی", body: "خلاصه‌سازی، حذف جملات تکراری و بازنویسی سفارشی." },
            { icon: Users, title: "همکاری تیمی", body: "کار روی سندها به‌صورت شخصی یا سازمانی." },
            { icon: LifeBuoy, title: "پشتیبانی", body: "ثبت تیکت و پیگیری داخل سایت، پاسخ از تیم مدیریت." },
          ].map((f) => (
            <Card key={f.title} className="border-border/60">
              <CardContent className="pt-6">
                <f.icon className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-20 rounded-2xl border bg-card p-8 flex items-center gap-6 flex-col md:flex-row">
          <Shield className="h-10 w-10 text-primary shrink-0" />
          <div className="flex-1 text-center md:text-start">
            <h2 className="text-xl font-bold">امن، سریع و کاملاً فارسی</h2>
            <p className="text-muted-foreground mt-1">
              احراز هویت حرفه‌ای، دسترسی نقش‌محور و رمزنگاری داده‌ها.
            </p>
          </div>
          <Button asChild><Link to={authed ? "/documents" : "/auth"}>ورود</Link></Button>
        </section>
      </main>

      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} نگارش — تمامی حقوق محفوظ است.
      </footer>
    </div>
  );
}
