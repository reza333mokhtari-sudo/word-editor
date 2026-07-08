import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, MessageSquare } from "lucide-react";
import { format } from "date-fns";

type Ticket = { id: string; subject: string; status: string; priority: string; updated_at: string };

export const Route = createFileRoute("/_authenticated/support/")({
  head: () => ({ meta: [{ title: "پشتیبانی — نگارش" }] }),
  component: SupportPage,
});

const statusLabel: Record<string, string> = { open: "باز", pending: "در انتظار", closed: "بسته" };
const priorityLabel: Record<string, string> = { low: "کم", normal: "متوسط", high: "زیاد" };

function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const nav = useNavigate();

  async function load() {
    const { data } = await supabase.from("tickets").select("id,subject,status,priority,updated_at").order("updated_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!subject.trim() || !body.trim()) return toast.error("موضوع و پیام الزامی است.");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: t, error } = await supabase.from("tickets").insert({ user_id: user.id, subject, priority }).select("id").single();
    if (error) return toast.error(error.message);
    const { error: mErr } = await supabase.from("ticket_messages").insert({ ticket_id: t.id, author_id: user.id, body, is_admin: false });
    if (mErr) return toast.error(mErr.message);
    setOpen(false); setSubject(""); setBody(""); setPriority("normal");
    toast.success("تیکت ثبت شد");
    nav({ to: "/support/$id", params: { id: t.id } });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">پشتیبانی</h1>
            <p className="text-muted-foreground text-sm">تیکت‌های شما و پاسخ تیم مدیریت.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ms-1" />تیکت جدید</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>ثبت تیکت جدید</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>موضوع</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} /></div>
                <div>
                  <Label>اولویت</Label>
                  <Select value={priority} onValueChange={(v: "low" | "normal" | "high") => setPriority(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">کم</SelectItem>
                      <SelectItem value="normal">متوسط</SelectItem>
                      <SelectItem value="high">زیاد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>پیام</Label><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} /></div>
                <Button className="w-full" onClick={create}>ارسال</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {tickets.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">هنوز تیکتی ثبت نکرده‌اید.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Link key={t.id} to="/support/$id" params={{ id: t.id }} className="block">
                <Card className="hover:border-primary/60">
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="flex-1">
                      <h3 className="font-medium">{t.subject}</h3>
                      <p className="text-xs text-muted-foreground">{format(new Date(t.updated_at), "yyyy/MM/dd HH:mm")}</p>
                    </div>
                    <Badge variant="outline">اولویت: {priorityLabel[t.priority]}</Badge>
                    <Badge variant={t.status === "closed" ? "secondary" : "default"}>{statusLabel[t.status]}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}