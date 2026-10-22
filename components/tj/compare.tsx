"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GitCompareArrows, X } from "lucide-react";
import { toast } from "sonner";
import ProductImage from "@/components/product-image";
import type { Row } from "@/lib/shopping";

// Products picked for side-by-side comparison (max 4), kept on this device.
const KEY = "tj-compare";
export type CompareItem = { product_id: string; persian_title: string; image_url?: string; category_name?: string };
export const getCompare = (): CompareItem[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};
const setCompare = (items: CompareItem[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(KEY));
  } catch {}
};
export function toggleCompare(p: Row) {
  const items = getCompare();
  if (items.some((x) => x.product_id === p.product_id)) return setCompare(items.filter((x) => x.product_id !== p.product_id));
  if (items.length >= 4) return toast("حداکثر ۴ کالا را می‌توانی کنار هم مقایسه کنی.");
  setCompare([...items, { product_id: p.product_id, persian_title: p.persian_title, image_url: p.image_url, category_name: p.category_name }]);
}
export const removeCompare = (id: string) => setCompare(getCompare().filter((x) => x.product_id !== id));
export const clearCompare = () => setCompare([]);
export function useCompare() {
  const [items, setItems] = useState<CompareItem[]>([]);
  useEffect(() => {
    setItems(getCompare());
    const sync = () => setItems(getCompare());
    window.addEventListener(KEY, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(KEY, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return items;
}

/** Bottom tray, like Torob's: the picked products and a button to compare them. */
export function CompareBar() {
  const items = useCompare();
  if (!items.length) return null;
  return (
    <div className="fixed inset-x-2 bottom-[4.5rem] z-30 mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-tj-line bg-white p-2 shadow-2xl lg:bottom-4">
      <div className="tj-no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
        {items.map((p) => (
          <div key={p.product_id} className="relative flex w-40 shrink-0 items-center gap-2 rounded-xl border border-tj-line p-1.5 pl-6">
            <ProductImage src={p.image_url} alt="" className="size-9 shrink-0" iconSize={14} />
            <span className="line-clamp-2 text-[11px] leading-4">{p.persian_title}</span>
            <button onClick={() => removeCompare(p.product_id)} className="absolute left-1 top-1 text-tj-muted hover:text-tj" aria-label="حذف از مقایسه">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <Link
        href={`/compare?ids=${items.map((p) => p.product_id).join(",")}`}
        aria-disabled={items.length < 2}
        onClick={(e) => items.length < 2 && (e.preventDefault(), toast("یک کالای دیگر هم برای مقایسه انتخاب کن."))}
        className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold text-white ${items.length < 2 ? "bg-tj/50" : "bg-tj hover:bg-tj-dark"}`}
      >
        <GitCompareArrows size={17} />
        مقایسه {items.length > 1 ? `(${items.length.toLocaleString("fa-IR")})` : ""}
      </Link>
    </div>
  );
}

export function CompareToggle({ p, className = "" }: { p: Row; className?: string }) {
  const items = useCompare();
  const on = items.some((x) => x.product_id === p.product_id);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCompare(p);
      }}
      title={on ? "حذف از مقایسه" : "افزودن به مقایسه"}
      aria-pressed={on}
      className={`grid size-8 place-items-center rounded-lg border bg-white/95 transition ${on ? "border-tj bg-tj text-white" : "border-tj-line text-tj-muted hover:border-tj hover:text-tj"} ${className}`}
    >
      <GitCompareArrows size={15} />
    </button>
  );
}
