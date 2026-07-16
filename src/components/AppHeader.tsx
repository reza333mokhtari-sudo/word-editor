import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, LifeBuoy, Shield, LogOut, Pencil, Music, ChevronDown, Palette, Radio, Mic2, Settings, FileWarning, Lock, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HelpPanel } from "@/components/HelpPanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { emptySketchDoc } from "@/components/SketchEditor";

export function AppHeader({ authed }: { authed: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!authed) { setIsAdmin(false); setEmail(""); return; }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!cancelled) setEmail(user.email ?? "");
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [authed]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function createDoc(kind: "word" | "sketch") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate({ to: "/auth" }); return; }
    const title = kind === "sketch" ? "طرح بدون عنوان" : "سند بدون عنوان";
    const payload: { owner_id: string; title: string; content?: unknown } = { owner_id: user.id, title };
    if (kind === "sketch") payload.content = emptySketchDoc();
    const { data, error } = await supabase.from("documents").insert(payload as never).select("id").single();
    if (error) return toast.error(error.message);
    navigate({ to: "/documents/$id", params: { id: data.id } });
  }

  const initial = (email || "?").trim().charAt(0).toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(180deg, #0a0a0d 0%, #14141a 55%, #1c1c22 100%)",
        boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center gap-2 px-4 h-14 text-zinc-200">
        <Link
          to="/"
          className="font-bold text-lg tracking-tight bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(135deg,#f5f5f5,#a1a1aa 55%,#e5e5e5)" }}
        >
          نگارش
        </Link>
        <nav className="flex items-center gap-1 mr-4">
          {authed && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/documents"><FileText className="ms-1 h-4 w-4" />اسناد من</Link>
            </Button>
          )}
          {authed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Pencil className="ms-1 h-4 w-4" />ادیت<ChevronDown className="ms-1 h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => createDoc("word")}>
                  <FileText className="ms-2 h-4 w-4" />سند Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => createDoc("sketch")}>
                  <Palette className="ms-2 h-4 w-4" />طراحی Sketch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/music"><Music className="ms-1 h-4 w-4" />موزیک</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/radio"><Radio className="ms-1 h-4 w-4" />رادیو</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/podcasts"><Mic2 className="ms-1 h-4 w-4" />پادکست</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/about"><Info className="ms-1 h-4 w-4" />درباره ما</Link>
          </Button>
          {authed && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/support"><LifeBuoy className="ms-1 h-4 w-4" />پشتیبانی</Link>
            </Button>
          )}
          <HelpPanel authed={authed} />
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin"><Shield className="ms-1 h-4 w-4" />مدیریت</Link>
            </Button>
          )}
        </nav>
        <div className="ms-auto">
          {authed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border border-border bg-background px-1 py-1 pe-3 hover:bg-accent/20"
                  aria-label="حساب کاربری"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">{initial}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs opacity-70">{email || "حساب کاربری"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/settings"><Settings className="ms-2 h-4 w-4" />تنظیمات حساب</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/privacy"><Lock className="ms-2 h-4 w-4" />بیانیه حریم خصوصی</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/dmca"><FileWarning className="ms-2 h-4 w-4" />DMCA</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="ms-2 h-4 w-4" />خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild><Link to="/auth">ورود / ثبت نام</Link></Button>
          )}
        </div>
      </div>
    </header>
  );
}