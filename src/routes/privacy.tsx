import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "بیانیه حریم خصوصی — نگارش" },
    { name: "description", content: "بیانیه حریم خصوصی و نحوه نگهداری اطلاعات کاربران." },
  ]}),
  component: PrivacyPage,
});

function PrivacyPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session)); }, []);
  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={authed} />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-4 leading-8">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Lock className="h-7 w-7 text-primary" />بیانیه حریم خصوصی</h1>
        <p>نگارش به حفظ حریم خصوصی کاربران احترام می‌گذارد. این بیانیه شرح می‌دهد چه اطلاعاتی جمع‌آوری، چگونه استفاده و چگونه محافظت می‌شود.</p>
        <h2 className="text-xl font-bold mt-6">۱. اطلاعاتی که جمع‌آوری می‌کنیم</h2>
        <p>ایمیل حساب، محتوای اسناد شما، تاریخ‌های ایجاد/ویرایش و لاگ فعالیت مدیریتی. هیچ اطلاعات پرداختی نگهداری نمی‌شود.</p>
        <h2 className="text-xl font-bold mt-6">۲. نحوه استفاده</h2>
        <p>اطلاعات صرفاً برای ارائه سرویس، پشتیبانی و بهبود عملکرد استفاده می‌شود. داده‌ها فروخته یا با اشخاص ثالث تبلیغاتی به اشتراک گذاشته نمی‌شود.</p>
        <h2 className="text-xl font-bold mt-6">۳. امنیت</h2>
        <p>اسناد شما با سیاست‌های Row-Level Security محافظت می‌شوند و تنها مالک به آن‌ها دسترسی دارد. رمز عبور به‌صورت هش ذخیره می‌شود.</p>
        <h2 className="text-xl font-bold mt-6">۴. حق کاربر</h2>
        <p>در هر زمان می‌توانید داده‌های خود را از بخش «تنظیمات حساب» مشاهده، اصلاح یا حذف کنید. برای درخواست حذف کامل حساب با پشتیبانی تماس بگیرید.</p>
        <h2 className="text-xl font-bold mt-6">۵. تماس</h2>
        <p>سؤالات مربوط به حریم خصوصی را از طریق بخش «پشتیبانی» ارسال کنید.</p>
      </main>
    </div>
  );
}