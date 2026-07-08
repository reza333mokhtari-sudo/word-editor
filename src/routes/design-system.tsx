import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/design-system")({
  head: () => ({ meta: [
    { title: "Design System — نگارش" },
    { name: "description", content: "توکن‌ها، پالت رنگ، تایپوگرافی و استانداردهای دسترس‌پذیری نگارش." },
  ]}),
  component: DesignSystemPage,
});

const COLORS = [
  { name: "background", label: "پس‌زمینه", token: "--color-background" },
  { name: "foreground", label: "متن اصلی", token: "--color-foreground" },
  { name: "primary", label: "اصلی", token: "--color-primary" },
  { name: "secondary", label: "ثانویه", token: "--color-secondary" },
  { name: "accent", label: "تأکید", token: "--color-accent" },
  { name: "muted", label: "خنثی", token: "--color-muted" },
  { name: "destructive", label: "خطر", token: "--color-destructive" },
  { name: "border", label: "کادر", token: "--color-border" },
];

const RADII = [
  { label: "sm", cls: "rounded-sm" },
  { label: "md", cls: "rounded-md" },
  { label: "lg", cls: "rounded-lg" },
  { label: "xl", cls: "rounded-xl" },
  { label: "2xl", cls: "rounded-2xl" },
  { label: "full", cls: "rounded-full" },
];

const SPACING = [1, 2, 3, 4, 6, 8, 12, 16];

function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={false} />
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Foundation</p>
          <h1 className="text-4xl font-bold">نگارش Design System</h1>
          <p className="text-muted-foreground max-w-2xl leading-7">
            توکن‌های اصلی طراحی، سازگار با تم روشن/تیره، دسترس‌پذیر (WCAG AA) و آماده استفاده در هر دو ویرایشگر Word و Sketch.
          </p>
        </header>

        <section>
          <h2 className="text-xl font-semibold mb-4">Color Tokens</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COLORS.map((c) => (
              <div key={c.name} className="rounded-lg border overflow-hidden">
                <div className="h-20" style={{ background: `var(${c.token})` }} />
                <div className="p-3">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.token}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Typography</h2>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Display / 4xl</div>
                <p className="text-4xl font-bold">ویرایش سریع، طراحی زیبا.</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Heading / 2xl</div>
                <p className="text-2xl font-semibold">نگارش، ابزار سند شما</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Body / base</div>
                <p className="leading-7">متن پایه با فونت Vazirmatn برای خوانایی بالا در فارسی و اعداد لاتین طراحی شده است.</p>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Caption / xs</div>
                <p className="text-xs text-muted-foreground">توضیحات، متادیتا و برچسب‌ها.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Radius</h2>
          <div className="flex gap-3 flex-wrap">
            {RADII.map((r) => (
              <div key={r.label} className="text-center">
                <div className={`h-16 w-16 bg-primary/20 border border-primary/40 ${r.cls}`} />
                <div className="text-xs mt-1 font-mono">{r.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Spacing (Tailwind scale)</h2>
          <div className="space-y-1">
            {SPACING.map((s) => (
              <div key={s} className="flex items-center gap-3 text-xs">
                <span className="w-8 font-mono text-muted-foreground">{s}</span>
                <div className="h-3 bg-primary/60 rounded" style={{ width: `${s * 0.25}rem` }} />
                <span className="text-muted-foreground">{s * 4}px</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Components</h2>
          <Card>
            <CardHeader><CardTitle>Buttons</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button disabled>Disabled</Button>
            </CardContent>
          </Card>
          <Card className="mt-3">
            <CardHeader><CardTitle>Badges & Input</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Badge>پیش‌فرض</Badge>
              <Badge variant="secondary">ثانویه</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">خطر</Badge>
              <Input placeholder="نمونه ورودی" className="max-w-xs" />
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Accessibility</h2>
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground space-y-2 leading-7">
              <p>• حداقل کنتراست متن/پس‌زمینه با استاندارد WCAG AA (۴٫۵:۱).</p>
              <p>• حالت فوکوس واضح روی همه دکمه‌ها و لینک‌ها با <code className="text-foreground">--color-ring</code>.</p>
              <p>• جهت RTL به‌صورت پیش‌فرض؛ استفاده از <code className="text-foreground">ms-*</code>/<code className="text-foreground">me-*</code> به جای <code className="text-foreground">ml-*</code>/<code className="text-foreground">mr-*</code>.</p>
              <p>• رعایت <code className="text-foreground">prefers-reduced-motion</code> برای انیمیشن‌ها.</p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}