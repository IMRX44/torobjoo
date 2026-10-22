"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GitCompareArrows, Sparkles, X, LoaderCircle, Trophy, Store } from "lucide-react";
import Shell from "@/components/tj/shell";
import ProductImage from "@/components/product-image";
import { toman } from "@/components/tj/product-card";
import { removeCompare, clearCompare } from "@/components/tj/compare";
import { num, type Row } from "@/lib/shopping";

export default function ComparePage() {
  const params = useSearchParams(),
    router = useRouter();
  const ids = (params.get("ids") || "").split(",").filter(Boolean);
  const [products, setProducts] = useState<Row[] | null>(null),
    [verdict, setVerdict] = useState<Row | null | undefined>(undefined),
    [onlyDiff, setOnlyDiff] = useState(true);
  const key = ids.join(",");
  useEffect(() => {
    if (ids.length < 2) return setProducts([]);
    setProducts(null);
    setVerdict(undefined);
    fetch(`/api/compare?ids=${key}`)
      .then((r) => r.json())
      .then((j) => setProducts(j.products || []))
      .catch(() => setProducts([]));
    fetch(`/api/compare?ids=${key}&verdict=1`)
      .then((r) => r.json())
      .then((j) => setVerdict(j.verdict))
      .catch(() => setVerdict(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Rows = every spec key any product has, grouped by section, in first-seen order.
  const rows = useMemo(() => {
    if (!products?.length) return [];
    const seen = new Map<string, { section: string; key: string }>();
    for (const p of products) for (const s of p.specs || []) if (!seen.has(s.key)) seen.set(s.key, { section: s.section || "مشخصات", key: s.key });
    return [...seen.values()].map((r) => {
      const values = products.map((p) => {
        const v = (p.specs || []).find((s: Row) => s.key === r.key)?.value;
        return v == null || v === "" ? "—" : String(v);
      });
      return { ...r, values, differs: new Set(values).size > 1 };
    });
  }, [products]);
  const cheapest = products?.length ? Math.min(...products.map((p) => p.min_price ?? Infinity)) : null;
  const shown = rows.filter((r) => !onlyDiff || r.differs);
  const drop = (id: string) => {
    removeCompare(id);
    const rest = ids.filter((x) => x !== id);
    router.replace(rest.length ? `/compare?ids=${rest.join(",")}` : "/search");
  };
  return (
    <Shell>
      <main className="mx-auto max-w-[1440px] px-3 pt-5 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-black">
            <GitCompareArrows className="text-tj" /> مقایسهٔ کالاها
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="accent-[#d73948]" />
              فقط تفاوت‌ها
            </label>
            <button
              onClick={() => {
                clearCompare();
                router.push("/search");
              }}
              className="text-tj"
            >
              پاک کردن مقایسه
            </button>
          </div>
        </div>
        {products && products.length < 2 ? (
          <div className="rounded-2xl border border-tj-line bg-white p-10 text-center text-sm">
            برای مقایسه حداقل دو کالا انتخاب کن (دکمهٔ <GitCompareArrows size={14} className="inline" /> روی کارت هر کالا).
            <Link href="/search" className="mt-3 block text-tj">
              رفتن به کالاها
            </Link>
          </div>
        ) : (
          <>
            <section className="mb-4 rounded-2xl border border-tj/20 bg-gradient-to-l from-tj-soft to-white p-5">
              <h2 className="mb-2 flex items-center gap-2 font-bold">
                <Sparkles size={18} className="text-tj" /> جمع‌بندی دستیار: کدام برای تو؟
              </h2>
              {verdict === undefined ? (
                <p className="flex items-center gap-2 text-sm text-tj-muted">
                  <LoaderCircle size={15} className="animate-spin" /> در حال مقایسهٔ مشخصات و قیمت‌ها…
                </p>
              ) : !verdict ? (
                <p className="text-sm text-tj-muted">جمع‌بندی الان آماده نشد؛ جدول زیر همهٔ تفاوت‌ها را نشان می‌دهد.</p>
              ) : (
                <div className="space-y-3 text-sm leading-7">
                  <p>{verdict.summary}</p>
                  {verdict.differences?.length > 0 && (
                    <ul className="list-disc space-y-1 pr-5 marker:text-tj">
                      {verdict.differences.map((d: string, i: number) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-tj-muted">فقط از روی مشخصات و قیمت‌های ثبت‌شده نوشته شده است.</p>
                </div>
              )}
            </section>
            <div className="tj-scroll overflow-x-auto rounded-2xl border border-tj-line bg-white">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky right-0 z-10 w-44 bg-white p-3" />
                    {(products || Array.from({ length: ids.length }, () => null)).map((p, i) => (
                      <th key={p?.product_id ?? i} className="min-w-52 border-r border-tj-line p-3 align-top font-normal">
                        {p ? (
                          <div className="relative">
                            <button onClick={() => drop(p.product_id)} className="absolute left-0 top-0 text-tj-muted hover:text-tj" aria-label="حذف">
                              <X size={16} />
                            </button>
                            <ProductImage src={p.image_url} alt="" className="mx-auto h-32 w-32" />
                            <Link href={`/p/${p.product_id}`} className="mt-2 line-clamp-2 text-[13px] font-bold leading-6 hover:text-tj">
                              {p.persian_title}
                            </Link>
                            <p className="mt-2 text-base font-black">
                              {toman(p.min_price)}
                              {p.min_price === cheapest && (
                                <span className="mr-1 rounded bg-tj-green/10 px-1.5 text-[11px] font-normal text-tj-green">ارزان‌ترین</span>
                              )}
                            </p>
                            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-tj-muted">
                              <Store size={12} /> در {num(p.offer_count)} فروشگاه
                            </p>
                            {verdict?.picks?.find((x: Row) => x.product_id === p.product_id) && (
                              <p className="mt-2 flex items-start justify-center gap-1 rounded-lg bg-tj-soft px-2 py-1.5 text-xs text-tj">
                                <Trophy size={13} className="mt-0.5 shrink-0" />
                                {verdict.picks.find((x: Row) => x.product_id === p.product_id).best_for}
                              </p>
                            )}
                            <Link href={`/p/${p.product_id}#sellers`} className="mt-3 block rounded-lg bg-tj py-2 text-xs text-white hover:bg-tj-dark">
                              دیدن فروشنده‌های نزدیک
                            </Link>
                          </div>
                        ) : (
                          <div className="h-56 animate-pulse rounded-xl bg-tj-page" />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <Fragment key={r.key}>
                      {(i === 0 || shown[i - 1].section !== r.section) && (
                        <tr key={"s" + r.section + i}>
                          <td colSpan={ids.length + 1} className="bg-tj-page px-3 py-2 text-xs font-bold text-tj">
                            {r.section}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-tj-line">
                        <td className="sticky right-0 bg-white p-3 text-tj-muted">{r.key}</td>
                        {r.values.map((v, j) => (
                          <td key={j} className={`border-r border-tj-line p-3 ${r.differs ? "bg-amber-50/40" : ""}`}>
                            <bdi>{v}</bdi>
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
                  {products && !shown.length && (
                    <tr>
                      <td colSpan={ids.length + 1} className="p-6 text-center text-tj-muted">
                        {onlyDiff ? "در مشخصات ثبت‌شده تفاوتی نیست؛ «فقط تفاوت‌ها» را بردار." : "مشخصاتی ثبت نشده."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}
