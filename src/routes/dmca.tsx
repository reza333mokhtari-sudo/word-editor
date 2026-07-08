import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileWarning } from "lucide-react";

export const Route = createFileRoute("/dmca")({
  head: () => ({ meta: [
    { title: "DMCA — نگارش" },
    { name: "description", content: "سیاست DMCA و روند گزارش نقض حقوق مالکیت معنوی." },
  ]}),
  component: DmcaPage,
});

function DmcaPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session)); }, []);
  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={authed} />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-4 leading-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><FileWarning className="h-7 w-7 text-primary" />بیانیه DMCA</h1>
        <p>نگارش به قانون Digital Millennium Copyright Act (DMCA) پایبند است و به گزارش‌های نقض حق مؤلف در سریع‌ترین زمان ممکن رسیدگی می‌کند.</p>
        <h2 className="text-xl font-bold mt-6">ارسال گزارش تخلف</h2>
        <p>اگر معتقدید محتوایی در این پلتفرم حق مؤلف شما را نقض می‌کند، گزارشی شامل موارد زیر ارسال کنید:</p>
        <ul className="list-disc pr-6 space-y-1">
          <li>مشخصات اثر دارای حق مؤلف</li>
          <li>لینک دقیق محتوای نقض‌کننده</li>
          <li>اطلاعات تماس شما (نام، آدرس، ایمیل)</li>
          <li>بیانیه‌ای مبنی بر صحت ادعا و اختیار قانونی</li>
          <li>امضای الکترونیک</li>
        </ul>
        <h2 className="text-xl font-bold mt-6">درخواست ضدنقض (Counter-Notice)</h2>
        <p>اگر محتوای شما اشتباهاً حذف شده، می‌توانید درخواست بازگردانی ارسال کنید.</p>
        <h2 className="text-xl font-bold mt-6">تماس</h2>
        <p>گزارش‌ها را از طریق بخش «پشتیبانی» با موضوع DMCA ارسال کنید.</p>
      </main>
    </div>
  );
}