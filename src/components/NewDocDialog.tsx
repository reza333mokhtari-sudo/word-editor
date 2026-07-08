import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Palette } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (kind: "word" | "sketch") => void;
};

export function NewDocDialog({ open, onOpenChange, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-primary/30 bg-gradient-to-br from-background via-background to-secondary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl">چه چیزی می‌سازیم؟</DialogTitle>
          <DialogDescription>نوع سند جدید را انتخاب کنید. هر دو در فضای شما ذخیره می‌شوند.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <button
            type="button"
            onClick={() => onPick("word")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-right transition-all hover:border-primary hover:shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.4)] focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex flex-col gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">متن (Word)</h3>
              <p className="text-sm text-muted-foreground leading-6">
                ویرایشگر متن حرفه‌ای با قابلیت‌های Word، هوش مصنوعی، جدول، خروجی docx/PDF و مداد رسم.
              </p>
              <ul className="mt-1 text-xs text-muted-foreground space-y-1 list-disc pe-4">
                <li>پاراگراف، سرصفحه، لیست، جدول</li>
                <li>هوش مصنوعی: خلاصه، بازنویسی</li>
                <li>خروجی Word / PDF / HTML</li>
              </ul>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPick("sketch")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-right transition-all hover:border-accent hover:shadow-[0_10px_40px_-10px_hsl(var(--accent)/0.5)] focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/15 via-secondary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex flex-col gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground">
                <Palette className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">طراحی (Sketch)</h3>
              <p className="text-sm text-muted-foreground leading-6">
                بوم بی‌نهایت با ابزار وکتور، شکل، متن، لایه و پروتوتایپ برای طراحی UI/Design System.
              </p>
              <ul className="mt-1 text-xs text-muted-foreground space-y-1 list-disc pe-4">
                <li>Pen / شکل / متن / تصویر</li>
                <li>لایه‌ها، رنگ، سایه، شفافیت</li>
                <li>خروجی SVG / PNG</li>
              </ul>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}