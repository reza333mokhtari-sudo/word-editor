import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";

type Msg = { id: string; body: string; is_admin: boolean; created_at: string };
type Ticket = { id: string; subject: string; status: string; priority: string; user_id: string };

export const Route = createFileRoute("/_authenticated/support/$id")({
  component: TicketPage,
});

function TicketPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    const [{ data: u }, { data: t }, { data: m }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("tickets").select("id,subject,status,priority,user_id").eq("id", id).single(),
      supabase.from("ticket_messages").select("id,body,is_admin,created_at").eq("ticket_id", id).order("created_at"),
    ]);
    if (!t) { toast.error("تیکت پیدا نشد"); nav({ to: "/support" }); return; }
    setTicket(t as Ticket);
    setMsgs((m ?? []) as Msg[]);
    setMe(u.user?.id ?? null);
    if (u.user) {
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!r);
    }
  }, [id, nav]);
  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!reply.trim() || !me) return;
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: id, author_id: me, body: reply, is_admin: isAdmin,
    });
    if (error) return toast.error(error.message);
    setReply("");
    load();
  }

  async function setStatus(status: "open" | "pending" | "closed") {
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("وضعیت به‌روزرسانی شد");
    load();
  }

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: isAdmin ? "/admin" : "/support" })}>
          <ArrowRight className="h-4 w-4 ms-1" />بازگشت
        </Button>
        <div className="mt-4 mb-6">
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge>{ticket.status}</Badge>
            <Badge variant="outline">اولویت: {ticket.priority}</Badge>
          </div>
        </div>

        <div className="space-y-3">
          {msgs.map((m) => (
            <Card key={m.id} className={m.is_admin ? "border-primary/50 bg-accent/30" : ""}>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={m.is_admin ? "default" : "secondary"}>{m.is_admin ? "پشتیبانی" : "شما"}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), "yyyy/MM/dd HH:mm")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ خود را بنویسید…" maxLength={5000} />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={send}>ارسال پاسخ</Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setStatus("pending")}>در انتظار کاربر</Button>
                <Button variant="outline" onClick={() => setStatus("closed")}>بستن تیکت</Button>
                <Button variant="outline" onClick={() => setStatus("open")}>بازگشایی</Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}