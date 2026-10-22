"use client";
import Link from "next/link";
import { MapPin, Store } from "lucide-react";
import ProductImage from "@/components/product-image";
import { num, type Row } from "@/lib/shopping";
import { useApp } from "@/components/tj/app-context";
import { CompareToggle } from "@/components/tj/compare";

export const toman = (n?: number | null) => (n == null ? "قیمت ثبت نشده" : `${num(n)} تومان`);
export const km = (d?: number | null) => (d == null || !isFinite(d) ? "" : d < 1 ? `${num(Math.round(d * 1000 / 50) * 50)} متر` : `${num(d.toFixed(1))} کیلومتر`);

export default function ProductCard({ p, compact = false, onOpen }: { p: Row; compact?: boolean; onOpen?: () => void }) {
  const { track } = useApp();
  const price = p.matching_min_price ?? p.min_price;
  return (
    <Link
      href={`/p/${p.product_id}`}
      onClick={() => {
        track({ type: "click", productId: p.product_id, category: p.category_name, brand: p.brand_name || undefined, price: price ?? undefined });
        onOpen?.();
      }}
      className={`group flex h-full flex-col rounded-xl border border-tj-line bg-white transition hover:border-tj/40 hover:shadow-[0_6px_24px_-12px_rgba(0,0,0,.25)] ${compact ? "p-2.5" : "p-3"}`}
    >
      <div className={`relative mb-2.5 flex items-center justify-center overflow-hidden rounded-lg bg-white ${compact ? "h-32" : "h-44"}`}>
        <ProductImage src={p.image_url} alt={p.persian_title} className="h-full w-full transition duration-300 group-hover:scale-[1.04] motion-reduce:transform-none" />
        {/* Hover-only on desktop to keep the grid calm; always visible on touch screens. */}
        <CompareToggle p={p} className="absolute left-0 top-0 transition lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 lg:aria-pressed:opacity-100" />
      </div>
      <h3 className={`line-clamp-2 font-medium leading-6 text-tj-ink ${compact ? "min-h-12 text-[12.5px]" : "min-h-12 text-[13.5px]"}`}>
        <bdi>{p.persian_title}</bdi>
      </h3>
      <div className="mt-auto pt-2">
        <p className={`font-bold text-tj-ink ${compact ? "text-[13px]" : "text-[15px]"}`}>
          {price != null ? (
            <>
              <span className="ml-1 text-[11px] font-normal text-tj-muted">از</span>
              {toman(price)}
            </>
          ) : (
            <span className="text-sm font-normal text-tj-muted">ناموجود در محدوده</span>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-tj-muted">
          <span className="flex items-center gap-1">
            <Store size={12} />
            در {num(p.matching_count ?? p.offer_count)} فروشگاه
          </span>
          {p.nearest_distance != null && isFinite(p.nearest_distance) && (
            <span className="flex items-center gap-1 text-tj-green">
              <MapPin size={12} />
              {km(p.nearest_distance)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function CardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-xl border border-tj-line bg-white p-3">
      <div className={`mb-3 animate-pulse rounded-lg bg-tj-page ${compact ? "h-32" : "h-44"}`} />
      <div className="mb-2 h-3 animate-pulse rounded bg-tj-page" />
      <div className="mb-4 h-3 w-2/3 animate-pulse rounded bg-tj-page" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-tj-page" />
    </div>
  );
}
