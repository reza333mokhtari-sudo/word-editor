import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Building2, Sparkles, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "ورود — نگارش" }, { name: "description", content: "ورود یا ثبت‌نام در ویرایشگر نگارش." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoDomain, setSsoDomain] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/documents", replace: true }); });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("خطا: " + error.message);
    toast.success("خوش آمدید");
    navigate({ to: "/documents", replace: true });
  }
  async function signUp(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error("خطا: " + error.message);
    toast.success("حساب ساخته شد. لطفاً ایمیل خود را بررسی کنید.");
  }
  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error("خطا در ورود با گوگل");
    if (!result.redirected) navigate({ to: "/documents", replace: true });
  }
  async function sso() {
    if (!ssoDomain.trim()) return toast.error("دامنه سازمانی را وارد کنید");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithSSO({ domain: ssoDomain.trim() });
    setLoading(false);
    if (error) return toast.error("SSO برای این دامنه پیکربندی نشده است");
    if (data?.url) window.location.href = data.url;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--color-secondary) 40%, transparent), transparent 55%), radial-gradient(circle at 80% 90%, color-mix(in oklab, var(--color-primary) 20%, transparent), transparent 55%), var(--color-background)" }}>
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      <Card className="w-full max-w-md relative border-primary/30 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-[11px] tracking-[0.3em] uppercase text-primary">Exclusive Access</span>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <Link to="/" className="text-3xl font-bold text-primary">نگارش</Link>
          <CardTitle className="mt-4 text-xl">ورود به تجربه نگارش</CardTitle>
          <CardDescription>حسابی انحصاری برای نویسندگان جدی — با امنیت سازمانی.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 mb-4">
            <Button type="button" variant="outline" className="w-full" onClick={google}>
              ورود با Google
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setSsoOpen(true)}>
              <Building2 className="ms-2 h-4 w-4" />ورود با SSO سازمانی
            </Button>
          </div>
          <div className="text-center text-xs text-muted-foreground my-2">— یا با ایمیل —</div>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">ورود</TabsTrigger>
              <TabsTrigger value="signup">ثبت‌نام</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-3 mt-4">
                <div><Label htmlFor="e1">ایمیل</Label><Input id="e1" type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="p1">رمز عبور</Label><Input id="p1" type="password" required dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}ورود</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-3 mt-4">
                <div><Label htmlFor="e2">ایمیل</Label><Input id="e2" type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="p2">رمز عبور (حداقل ۶ کاراکتر)</Label><Input id="p2" type="password" required minLength={6} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}ایجاد حساب</Button>
              </form>
            </TabsContent>
          </Tabs>
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> رمزها هش می‌شوند • داده‌ها با RLS محافظت می‌شوند
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-[11px]">
            <Link to="/privacy" className="text-muted-foreground hover:text-primary">حریم خصوصی</Link>
            <span className="text-muted-foreground">•</span>
            <Link to="/dmca" className="text-muted-foreground hover:text-primary">DMCA</Link>
          </div>
        </CardContent>
      </Card>
      <Dialog open={ssoOpen} onOpenChange={setSsoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ورود با SSO سازمانی</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>دامنه ایمیل سازمانی</Label>
            <Input dir="ltr" placeholder="example.com" value={ssoDomain} onChange={(e) => setSsoDomain(e.target.value)} />
            <p className="text-xs text-muted-foreground">اگر سازمان شما SAML SSO فعال کرده باشد، به صفحه ورود سازمانی هدایت می‌شوید.</p>
          </div>
          <DialogFooter>
            <Button onClick={sso} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin ms-2" />}ادامه</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}