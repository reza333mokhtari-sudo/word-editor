import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";

const MODEL = "google/gemini-3-flash-preview";

const InputSchema = z.object({
  text: z.string().min(1).max(20000),
  mode: z.enum(["summarize", "dedupe", "rewrite", "custom"]),
  instruction: z.string().max(1000).optional(),
});

function promptFor(mode: string, text: string, instruction?: string) {
  switch (mode) {
    case "summarize":
      return `متن زیر را به فارسی روان و ساختاریافته خلاصه کن. نکات کلیدی را حفظ کن.\n\n${text}`;
    case "dedupe":
      return `در متن زیر جمله‌ها و عبارت‌های تکراری یا هم‌معنی را حذف کن و متن نهایی را یکپارچه و روان بازنویسی کن. فقط متن نهایی را برگردان.\n\n${text}`;
    case "rewrite":
      return `متن زیر را به فارسی روان و حرفه‌ای بازنویسی کن. ساختار مناسب پاراگراف‌بندی، سربرگ‌ها (Heading سطح ۱ و ۲) و در صورت نیاز فهرست‌ها را اعمال کن. از قالب Markdown استفاده کن (# برای عنوان اصلی، ## برای زیرعنوان، - برای فهرست). فقط خروجی نهایی را برگردان.\n\n${text}`;
    case "custom":
      return `دستور کاربر: ${instruction || "متن را بهبود بده"}\n\nمتن:\n${text}\n\nفقط متن نهایی را بدون توضیح برگردان.`;
  }
  return text;
}

export const transformText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("سرویس هوش مصنوعی پیکربندی نشده است.");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    try {
      const { text } = await generateText({
        model: gateway(MODEL),
        prompt: promptFor(data.mode, data.text, data.instruction),
      });
      return { result: text };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) throw new Error("محدودیت تعداد درخواست. لطفاً کمی بعد دوباره امتحان کنید.");
      if (msg.includes("402")) throw new Error("اعتبار سرویس هوش مصنوعی به پایان رسیده.");
      throw new Error("خطا در سرویس هوش مصنوعی: " + msg);
    }
  });