import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type ChangelogRow = { id: string; version: string; title: string; body: string; released_at: string };

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "راهنما و تغییرات — نگارش" }, { name: "description", content: "راهنمای استفاده، تاریخچه تغییرات و تماس با پشتیبانی." }] }),
  component: HelpPage,
});

function HelpPage() {
  const [authed, setAuthed] = useState(false);
  const [logs, setLogs] = useState<ChangelogRow[]>([]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    supabase.from("changelog").select("*").order("released_at", { ascending: false }).then(({ data }) => {
      if (data) setLogs(data as ChangelogRow[]);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={authed} />
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">راهنما و پشتیبانی</h1>
          <p className="text-muted-foreground mt-2">همه‌ی چیزهایی که برای شروع کار با نگارش نیاز دارید.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>سؤالات پرتکرار</CardTitle></CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger>چطور یک سند جدید بسازم؟</AccordionTrigger>
                <AccordionContent>در صفحه‌ی «اسناد من» روی دکمه «سند جدید» کلیک کنید. سند بلافاصله باز می‌شود و تغییرات به‌طور خودکار ذخیره می‌شوند.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>چطور متن را خلاصه‌سازی کنم؟</AccordionTrigger>
                <AccordionContent>در نوار ابزار بالای ادیتور روی «خلاصه‌سازی» بزنید. برای حذف جملات تکراری از «حذف تکرار» و برای دستور دلخواه از «سفارشی» استفاده کنید.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>چطور تیکت پشتیبانی ثبت کنم؟</AccordionTrigger>
                <AccordionContent>وارد بخش «پشتیبانی» شوید، روی «تیکت جدید» کلیک کنید و موضوع و پیام خود را بنویسید. پاسخ مدیر در همان صفحه نمایش داده می‌شود.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger>آیا داده‌های من امن هستند؟</AccordionTrigger>
                <AccordionContent>بله. هر کاربر تنها به سندهای خودش دسترسی دارد و داده‌ها با سیاست‌های امنیتی سختگیرانه ذخیره می‌شوند.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger>چطور از سند خروجی بگیرم؟</AccordionTrigger>
                <AccordionContent>
                  در بالای صفحه‌ی هر سند روی دکمه‌ی «دانلود» کلیک کنید. چهار فرمت در دسترس است:
                  <ul className="list-disc ps-5 mt-2 space-y-1">
                    <li><strong>Word (.docx)</strong>: برای ویرایش در Microsoft Word، Google Docs یا LibreOffice.</li>
                    <li><strong>PDF</strong>: پنجره چاپ باز می‌شود و از گزینه «Save as PDF» فایل ذخیره کنید.</li>
                    <li><strong>HTML</strong>: صفحه‌ای مستقل که در هر مرورگر باز می‌شود.</li>
                    <li><strong>متن ساده (.txt)</strong>: بدون قالب‌بندی، مناسب کپی سریع.</li>
                  </ul>
                  همچنین در صفحه «اسناد من» کنار هر سند دکمه «دانلود» برای گرفتن سریع فایل Word وجود دارد.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>تماس با پشتیبانی</CardTitle>
              <CardDescription>تیکت خود را در پنل کاربری ثبت کنید.</CardDescription>
            </div>
            <Button asChild><Link to={authed ? "/support" : "/auth"}>ثبت تیکت</Link></Button>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تاریخچه تغییرات (Changelog)</CardTitle>
            <CardDescription>آخرین تغییرات و ویژگی‌های اضافه‌شده به نگارش.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">هنوز تغییری ثبت نشده است.</p>}
            {logs.map((l) => (
              <div key={l.id} className="border-s-2 border-primary/60 ps-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">v{l.version}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(l.released_at), "yyyy/MM/dd")}</span>
                </div>
                <h3 className="font-semibold mt-1">{l.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{l.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}