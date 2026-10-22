"use client";
import { useState } from "react";
import { Ruler, X } from "lucide-react";
import { num } from "@/lib/shopping";

// EU shoe size → foot length (cm), the usual Iranian shop chart.
const SHOES = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46].map((s) => [s, Math.round((s / 1.5 - 1.5) * 10) / 10] as const);
// Letter sizes → chest (cm), unisex average; brands differ, so it is a guide only.
const CLOTHES = [
  ["S", "۸۸–۹۴"],
  ["M", "۹۵–۱۰۱"],
  ["L", "۱۰۲–۱۰۸"],
  ["XL", "۱۰۹–۱۱۵"],
  ["2XL", "۱۱۶–۱۲۲"],
  ["3XL", "۱۲۳–۱۲۹"],
] as const;

/** «راهنمای سایز»: how to pick a size before going to the shop. Shoes use foot length, clothes chest width. */
export default function SizeGuide({ kind, sizes = [] }: { kind: "shoes" | "clothes"; sizes?: string[] }) {
  const [open, setOpen] = useState(false);
  const have = new Set(sizes);
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1 text-xs font-bold text-tj hover:underline">
        <Ruler size={13} /> راهنمای انتخاب سایز
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div dir="rtl" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-bold">
                <Ruler size={18} className="text-tj" /> راهنمای سایز {kind === "shoes" ? "کفش" : "لباس"}
              </p>
              <button onClick={() => setOpen(false)} aria-label="بستن" className="rounded-lg p-1 hover:bg-tj-page">
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-xs leading-6 text-tj-muted">
              {kind === "shoes"
                ? "عصر پایت را روی کاغذ بگذار و از پاشنه تا نوک بلندترین انگشت را اندازه بگیر. اگر بین دو سایز بودی، بزرگ‌تر را بگیر."
                : "دور سینه را از پهن‌ترین قسمت، زیر بغل، با متر نواری اندازه بگیر. جدول تقریبی است و برندها کمی فرق دارند."}
            </p>
            <table className="mt-3 w-full text-center text-sm">
              <thead>
                <tr className="bg-tj-page text-xs text-tj-muted">
                  <th className="rounded-r-lg py-2">سایز</th>
                  <th className="rounded-l-lg py-2">{kind === "shoes" ? "طول پا (سانتی‌متر)" : "دور سینه (سانتی‌متر)"}</th>
                </tr>
              </thead>
              <tbody>
                {(kind === "shoes" ? SHOES.map(([s, cm]) => [String(s), num(cm)]) : CLOTHES).map(([s, cm]) => (
                  <tr key={s} className={`border-b border-tj-line last:border-0 ${have.has(String(s)) ? "font-bold text-tj" : ""}`}>
                    <td className="py-1.5">{/^\d+$/.test(String(s)) ? num(Number(s)) : s}</td>
                    <td className="py-1.5">{cm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {have.size > 0 && <p className="mt-3 text-[11px] text-tj-muted">سایزهای پررنگ در نتایج همین صفحه فروشنده دارند.</p>}
            <p className="mt-2 rounded-lg bg-tj-soft p-2 text-[11px] leading-5 text-tj">
              خرید حضوری یعنی می‌توانی بپوشی و امتحان کنی؛ موقع پرسیدن از فروشنده، سایزت را هم بنویس تا موجودی همان سایز را بگوید.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
