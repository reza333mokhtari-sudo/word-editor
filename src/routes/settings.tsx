import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings as SettingsIcon, Mail, KeyRound, LogOut } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "تنظیمات حساب — نگارش" },
    { name: "description", content: "مدیریت اطلاعات حساب کاربری، رمز عبور و ایمیل." },
  ]}),
  component: SettingsPage,
});

function SettingsPage() {
  const nav = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { nav({ to: "/auth" }); return; }
      setAuthed(true);
      setEmail(data.user.email ?? "");
      setNewEmail(data.user.email ?? "");
    });
  }, [nav]);

  async function updateEmail() {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoading(false);
    if (error) toast.error(error.message); else toast.success("ایمیل تغییر کرد — لینک تایید ارسال شد.");
  }
  async function updatePass() {
    if (newPass.length < 6) return toast.error("رمز باید حداقل ۶ کاراکتر باشد");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setLoading(false);
    if (error) toast.error(error.message); else { toast.success("رمز عبور به‌روز شد"); setNewPass(""); }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={authed} />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><SettingsIcon className="h-7 w-7 text-primary" />تنظیمات حساب</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />ایمیل</CardTitle>
            <CardDescription>برای تغییر ایمیل، آدرس جدید را وارد کنید. لینک تایید ارسال می‌شود.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>ایمیل فعلی</Label>
            <Input value={email} readOnly dir="ltr" />
            <Label>ایمیل جدید</Label>
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} dir="ltr" />
            <Button disabled={loading || newEmail === email} onClick={updateEmail}>ذخیره ایمیل</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />رمز عبور</CardTitle>
            <CardDescription>یک رمز عبور جدید انتخاب کنید.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>رمز جدید</Label>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} dir="ltr" />
            <Button disabled={loading || !newPass} onClick={updatePass}>تغییر رمز</Button>
          </CardContent>
        </Card>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild><Link to="/privacy">بیانیه حریم خصوصی</Link></Button>
          <Button variant="outline" asChild><Link to="/dmca">DMCA</Link></Button>
          <Button variant="destructive" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth", replace: true }); }}>
            <LogOut className="ms-1 h-4 w-4" />خروج از حساب
          </Button>
        </div>
      </main>
    </div>
  );
}