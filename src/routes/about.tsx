import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { ProfileCard } from "@/components/ProfileCard";
import avatar from "@/assets/reza-avatar.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "درباره ما — نگارش" },
      { name: "description", content: "درباره تیم و سازنده پلتفرم نگارش." },
      { property: "og:title", content: "درباره ما — نگارش" },
      { property: "og:description", content: "درباره تیم و سازنده پلتفرم نگارش." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen">
      <AppHeader authed={false} />
      <main className="max-w-5xl mx-auto px-4 py-16">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-l from-primary via-accent to-primary bg-clip-text text-transparent">
            درباره ما
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            نگارش پروژه‌ای‌ست برای بازتعریف نوشتن، شنیدن و ساختن — با ترکیبی سینمایی از هوش مصنوعی، طراحی و صدا.
          </p>
        </header>

        <div className="flex justify-center">
          <ProfileCard
            name="رضا موریامو"
            handle="@rezamoriyama"
            title="سازنده و طراح"
            bio="بنیان‌گذار نگارش. عاشق سینما، موزیک و کد تمیز."
            avatar={avatar}
            href="https://x.com/rezamoriyama"
          />
        </div>

        <section className="mt-16 grid md:grid-cols-3 gap-4">
          <div className="pixel-card rounded-2xl border border-primary/20 bg-card/60 p-5">
            <div className="pixel-card-fx" aria-hidden />
            <h3 className="relative text-primary font-bold mb-2">هوش مصنوعی</h3>
            <p className="relative text-sm text-muted-foreground">خلاصه‌سازی، بازنویسی و دستور سفارشی روی متن.</p>
          </div>
          <div className="pixel-card rounded-2xl border border-primary/20 bg-card/60 p-5">
            <div className="pixel-card-fx" aria-hidden />
            <h3 className="relative text-primary font-bold mb-2">صدا و موزیک</h3>
            <p className="relative text-sm text-muted-foreground">پخش کامل، پادکست و رادیو در یک تجربه یکپارچه.</p>
          </div>
          <div className="pixel-card rounded-2xl border border-primary/20 bg-card/60 p-5">
            <div className="pixel-card-fx" aria-hidden />
            <h3 className="relative text-primary font-bold mb-2">سینمایی</h3>
            <p className="relative text-sm text-muted-foreground">پالت سیاه، طلایی و بنفش — با حرکت‌های نرم و ظریف.</p>
          </div>
        </section>
      </main>
    </div>
  );
}