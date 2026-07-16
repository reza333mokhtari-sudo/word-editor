import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Sparkles, Palette, Music, Radio, Mic2, Shield, Rocket, Layers, Boxes, Wand2 } from "lucide-react";

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
    <div
      className="min-h-screen text-zinc-100"
      style={{
        background:
          "radial-gradient(1000px 500px at 15% -10%, rgba(200,200,220,0.10), transparent 60%), radial-gradient(900px 500px at 90% 0%, rgba(180,180,200,0.08), transparent 60%), linear-gradient(180deg,#0a0a0d 0%,#111116 45%,#0a0a0d 100%)",
      }}
    >
      <AppHeader authed={authed} />
      <main className="max-w-6xl mx-auto px-4 py-16">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium mb-6 text-zinc-300">
            <Sparkles className="h-3 w-3" /> پلتفرم خلاقیت نگارش
          </div>
          <h1
            className="text-5xl md:text-6xl font-black tracking-tight leading-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg,#ffffff 0%,#d4d4d8 40%,#a1a1aa 70%,#ffffff 100%)" }}
          >
            بنویس، طراحی کن،<br />بشنو — همه در یک جا.
          </h1>
          <p className="mt-6 text-lg text-zinc-400 leading-relaxed">
            ویرایشگر متن حرفه‌ای فارسی، سازنده نقشه‌های TTRPG با پیش‌نمایش سه‌بعدی،
            پخش‌کننده موزیک، رادیو، پادکست و ابزارهای هوش مصنوعی — همه در یک تجربه یکپارچه.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" className="bg-white text-zinc-900 hover:bg-zinc-200" asChild>
              <Link to={authed ? "/documents" : "/auth"}>شروع کنید</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-zinc-100 hover:bg-white/10" asChild>
              <Link to="/changelog">تغییرات نسخه‌ها</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: FileText, title: "ویرایشگر Word", body: "ریبون کامل با تب‌های Home/Insert/Design/Layout/References/Review/View، QAT و حالت تمام‌صفحه." },
            { icon: Palette, title: "Sketch — سازنده نقشه", body: "ابزار حرفه‌ای TTRPG به سبک Dungeon Scrawl: دیوار، غار، تونل، در، پل، عناصر جادویی و پیش‌نمایش سه‌بعدی." },
            { icon: Boxes, title: "پیش‌نمایش 3D", body: "نمای پرسپکتیو/ایزومتریک با کنترل‌های 3ds Max: LMB Orbit، MMB Pan، RMB Dolly، RMB+WASD Fly." },
            { icon: Wand2, title: "هوش مصنوعی", body: "خلاصه‌سازی، حذف جملات تکراری، بازنویسی و پاراگراف‌بندی خودکار." },
            { icon: Music, title: "موزیک SoundCloud", body: "جستجوی SoundCloud با فالبک Audius، Elastic Slider برای صدا و زمان، Dock Player دائمی." },
            { icon: Radio, title: "رادیو و پادکست", body: "ایستگاه‌های زنده، پادکست‌ها و پخش پس‌زمینه." },
            { icon: Layers, title: "لایه و استایل", body: "لایه‌بندی، تم Classic/Sepia/Blueprint/Parchment، هاچینگ OSR، شماره‌گذاری خودکار اتاق." },
            { icon: Rocket, title: "خروجی حرفه‌ای", body: "DOCX واقعی، PDF چاپی، HTML، Text و PNG با کیفیت بالا." },
            { icon: Shield, title: "امن و فارسی", body: "احراز هویت، RLS و نقش‌محور — کاملاً راست‌چین و بومی." },
          ].map((f) => (
            <Card key={f.title} className="border-white/10 bg-white/[0.04] backdrop-blur-sm hover:bg-white/[0.07] transition">
              <CardContent className="pt-6">
                <f.icon className="h-6 w-6 mb-3 text-zinc-200" />
                <h3 className="font-semibold mb-1 text-zinc-100">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-6">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-20 rounded-2xl border border-white/10 p-8 flex items-center gap-6 flex-col md:flex-row"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))" }}>
          <Shield className="h-10 w-10 text-zinc-200 shrink-0" />
          <div className="flex-1 text-center md:text-start">
            <h2 className="text-xl font-bold text-zinc-100">همه ابزار‌ها، یک اکانت</h2>
            <p className="text-zinc-400 mt-1">
              با یک ثبت‌نام به ویرایشگر، Sketch، موزیک، رادیو و پادکست دسترسی داشته باشید.
            </p>
          </div>
          <Button className="bg-white text-zinc-900 hover:bg-zinc-200" asChild>
            <Link to={authed ? "/documents" : "/auth"}>{authed ? "به اسناد من" : "ورود / ثبت‌نام"}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-white/10 mt-16 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} نگارش — تمامی حقوق محفوظ است.
      </footer>
    </div>
  );
}
