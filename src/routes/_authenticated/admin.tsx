import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Shield, Loader2, Pencil, X, Trash2, FileText, Users, Activity } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Ticket = { id: string; subject: string; status: string; priority: string; updated_at: string; user_id: string };
type ChangelogRow = { id: string; version: string; title: string; body: string; released_at: string };
type AdminUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null; roles: string[]; documents_count: number; tickets_count: number };
type AdminDoc = { id: string; title: string; owner_id: string; owner_email: string | null; created_at: string; updated_at: string };
type ActivityRow = { id: string; actor_id: string | null; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string };

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "پنل مدیریت — نگارش" }] }),
  component: AdminPage,
});

function AdminPage() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [ok, setOk] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<ChangelogRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [meId, setMeId] = useState<string>("");
  const [nv, setNv] = useState({ version: "", title: "", body: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { nav({ to: "/auth" }); return; }
      setMeId(user.id);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!data) { setChecking(false); setOk(false); return; }
      setOk(true); setChecking(false);
      load();
    })();
  }, [nav]);

  async function load() {
    const [{ data: t }, { data: c }, { data: u }, { data: d }, { data: a }] = await Promise.all([
      supabase.from("tickets").select("id,subject,status,priority,updated_at,user_id").order("updated_at", { ascending: false }),
      supabase.from("changelog").select("*").order("released_at", { ascending: false }),
      supabase.rpc("admin_list_users"),
      supabase.rpc("admin_list_documents"),
      supabase.rpc("admin_list_activity", { _limit: 200 }),
    ]);
    setTickets((t ?? []) as Ticket[]);
    setLogs((c ?? []) as ChangelogRow[]);
    setUsers((u ?? []) as AdminUser[]);
    setDocs((d ?? []) as AdminDoc[]);
    setActivity((a ?? []) as ActivityRow[]);
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`حذف کامل حساب ${email}؟ همه‌ی داده‌های وابسته از بین می‌رود.`)) return;
    const { error } = await supabase.rpc("admin_delete_user", { _user_id: id });
    if (error) return toast.error(error.message);
    toast.success("حساب حذف شد");
    load();
  }
  async function deleteDoc(id: string) {
    if (!confirm("سند حذف شود؟")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("سند حذف شد");
    load();
  }
  async function deleteTicket(id: string) {
    if (!confirm("تیکت حذف شود؟")) return;
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تیکت حذف شد");
    load();
  }

  async function saveLog() {
    if (!nv.version.trim() || !nv.title.trim() || !nv.body.trim()) return toast.error("همه‌ی فیلدها الزامی است.");
    if (nv.version.length > 20 || nv.title.length > 200 || nv.body.length > 5000) return toast.error("طول ورودی بیش از حد مجاز است.");
    setSaving(true);
    const payload = { version: nv.version.trim(), title: nv.title.trim(), body: nv.body.trim() };
    const { error } = editingId
      ? await supabase.from("changelog").update(payload).eq("id", editingId)
      : await supabase.from("changelog").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    setNv({ version: "", title: "", body: "" });
    setEditingId(null);
    toast.success(editingId ? "به‌روزرسانی شد" : "افزوده شد");
    load();
  }
  function startEdit(l: ChangelogRow) {
    setEditingId(l.id);
    setNv({ version: l.version, title: l.title, body: l.body });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditingId(null);
    setNv({ version: "", title: "", body: "" });
  }
  async function deleteLog(id: string) {
    if (!confirm("حذف شود؟")) return;
    const { error } = await supabase.from("changelog").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (editingId === id) cancelEdit();
    load();
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!ok) return (
    <div className="min-h-screen bg-background">
      <AppHeader authed />
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">دسترسی مدیریت ندارید</h1>
        <p className="text-muted-foreground mt-2">برای دسترسی به این صفحه باید نقش «مدیر» داشته باشید.</p>
        <p className="text-xs text-muted-foreground mt-4">برای فعال‌سازی اولین مدیر، از پنل Backend نقش <code>admin</code> را به کاربر خود اختصاص دهید.</p>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Shield className="h-6 w-6 text-primary" />پنل مدیریت</h1>
        <Tabs defaultValue="tickets">
          <TabsList>
            <TabsTrigger value="tickets">تیکت‌ها ({tickets.length})</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 ms-1" />حساب‌ها ({users.length})</TabsTrigger>
            <TabsTrigger value="docs"><FileText className="h-4 w-4 ms-1" />اسناد ({docs.length})</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="h-4 w-4 ms-1" />لاگ</TabsTrigger>
            <TabsTrigger value="changelog">تغییرات</TabsTrigger>
          </TabsList>
          <TabsContent value="tickets" className="mt-4 space-y-2">
            {tickets.length === 0 && <p className="text-muted-foreground text-sm">تیکتی وجود ندارد.</p>}
            {tickets.map((t) => (
              <Card key={t.id} className="hover:border-primary/60">
                <CardContent className="py-4 flex items-center gap-3">
                  <Link to="/support/$id" params={{ id: t.id }} className="flex-1">
                    <h3 className="font-medium">{t.subject}</h3>
                    <p className="text-xs text-muted-foreground">{format(new Date(t.updated_at), "yyyy/MM/dd HH:mm")} · کاربر: <span dir="ltr">{t.user_id.slice(0, 8)}</span></p>
                  </Link>
                  <Badge variant="outline">اولویت: {t.priority}</Badge>
                  <Badge>{t.status}</Badge>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteTicket(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            {users.length === 0 && <p className="text-muted-foreground text-sm">حسابی یافت نشد.</p>}
            {users.length > 0 && (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>ایمیل</TableHead>
                    <TableHead>ثبت‌نام</TableHead>
                    <TableHead>آخرین ورود</TableHead>
                    <TableHead>اسناد</TableHead>
                    <TableHead>تیکت</TableHead>
                    <TableHead>نقش‌ها</TableHead>
                    <TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell><span dir="ltr">{u.email}</span>{!u.email_confirmed_at && <Badge variant="outline" className="ms-2">تأیید نشده</Badge>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(u.created_at), "yyyy/MM/dd")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "yyyy/MM/dd HH:mm") : "—"}</TableCell>
                        <TableCell>{u.documents_count}</TableCell>
                        <TableCell>{u.tickets_count}</TableCell>
                        <TableCell className="flex gap-1 flex-wrap">{u.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-destructive" disabled={u.id === meId} onClick={() => deleteUser(u.id, u.email)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="docs" className="mt-4">
            {docs.length === 0 && <p className="text-muted-foreground text-sm">سندی وجود ندارد.</p>}
            {docs.length > 0 && (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>عنوان</TableHead>
                    <TableHead>مالک</TableHead>
                    <TableHead>ساخته شد</TableHead>
                    <TableHead>آخرین ویرایش</TableHead>
                    <TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {docs.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Link to="/documents/$id" params={{ id: d.id }} className="text-primary hover:underline">{d.title || "بدون عنوان"}</Link>
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.owner_id === meId ? (
                            <Badge variant="secondary">YOU</Badge>
                          ) : (
                            <span dir="ltr">{d.owner_email ?? d.owner_id.slice(0, 8)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "yyyy/MM/dd HH:mm")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(d.updated_at), "yyyy/MM/dd HH:mm")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDoc(d.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            {activity.length === 0 && <p className="text-muted-foreground text-sm">فعالیتی ثبت نشده.</p>}
            {activity.length > 0 && (
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>زمان</TableHead>
                    <TableHead>اقدام‌کننده</TableHead>
                    <TableHead>عمل</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead>جزئیات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {activity.map((a) => {
                      const meta = a.metadata ?? {};
                      const title = (meta as { title?: string; email?: string }).title ?? (meta as { email?: string }).email ?? (a.entity_id?.slice(0, 8) ?? "");
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(a.created_at), "yyyy/MM/dd HH:mm")}</TableCell>
                          <TableCell className="text-xs">
                            {a.actor_id === meId ? <Badge variant="secondary">YOU</Badge> : <span dir="ltr">{a.actor_email ?? "—"}</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.action === "delete" ? "destructive" : "outline"}>{a.action}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{a.entity_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[280px]">{title}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </TabsContent>
          <TabsContent value="changelog" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>{editingId ? "ویرایش نسخه" : "افزودن نسخه جدید"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>نسخه</Label><Input dir="ltr" placeholder="1.0.0" value={nv.version} onChange={(e) => setNv({ ...nv, version: e.target.value })} /></div>
                  <div className="col-span-2"><Label>عنوان</Label><Input value={nv.title} onChange={(e) => setNv({ ...nv, title: e.target.value })} /></div>
                </div>
                <div><Label>توضیحات</Label><Textarea rows={4} value={nv.body} onChange={(e) => setNv({ ...nv, body: e.target.value })} /></div>
                <div className="flex gap-2">
                  <Button onClick={saveLog} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin ms-1" />}
                    {editingId ? "ذخیره تغییرات" : "ثبت"}
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={cancelEdit}><X className="h-4 w-4 ms-1" />انصراف</Button>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {logs.map((l) => (
                <Card key={l.id}>
                  <CardContent className="py-4 flex items-start gap-3">
                    <Badge variant="secondary">v{l.version}</Badge>
                    <div className="flex-1">
                      <h3 className="font-medium">{l.title}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{l.body}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(l)}>
                      <Pencil className="h-4 w-4 ms-1" />ویرایش
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteLog(l.id)}>حذف</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}