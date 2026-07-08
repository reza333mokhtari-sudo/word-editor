import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, FileQuestion, Loader2, RotateCw, ArrowRight } from "lucide-react";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed />
      <main className="max-w-2xl mx-auto px-4 py-16">{children}</main>
    </div>
  );
}

export function DocLoading({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">{label}</p>
      </div>
    </Shell>
  );
}

export function DocError({ error, reset, title = "خطا در بارگذاری" }: { error: Error; reset?: () => void; title?: string }) {
  const message = error?.message || "خطای ناشناخته رخ داد.";
  const friendly =
    /permission|rls|denied|not authorized/i.test(message) ? "شما اجازه دسترسی به این محتوا را ندارید." :
    /network|fetch|failed to fetch|timeout/i.test(message) ? "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید." :
    /not.?found|no rows|pgrst116/i.test(message) ? "این سند پیدا نشد یا حذف شده است." :
    "مشکلی در پردازش درخواست پیش آمد. لطفاً دوباره تلاش کنید.";
  return (
    <Shell>
      <Card className="border-destructive/40">
        <CardContent className="py-10 text-center">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-2">{friendly}</p>
          <p className="text-xs text-muted-foreground/70 mt-3 break-all" dir="ltr">{message}</p>
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            {reset && (
              <Button onClick={reset}><RotateCw className="h-4 w-4 ms-1" />تلاش دوباره</Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/documents"><ArrowRight className="h-4 w-4 ms-1" />بازگشت به اسناد</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}

export function DocNotFound() {
  return (
    <Shell>
      <Card>
        <CardContent className="py-12 text-center">
          <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold">سند پیدا نشد</h1>
          <p className="text-muted-foreground mt-2">این سند وجود ندارد، حذف شده، یا به آن دسترسی ندارید.</p>
          <Button className="mt-6" asChild>
            <Link to="/documents"><ArrowRight className="h-4 w-4 ms-1" />بازگشت به اسناد من</Link>
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}