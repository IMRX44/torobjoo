"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, ChevronLeft, LoaderCircle, SearchX, Sparkles, Map as MapIcon } from "lucide-react";
import SizeGuide from "@/components/tj/size-guide";
import Shell from "@/components/tj/shell";
import ProductCard, { CardSkeleton, toman } from "@/components/tj/product-card";
import AssistantDock from "@/components/tj/assistant-dock";
import { useApp } from "@/components/tj/app-context";
import { useTaxonomy } from "@/components/tj/taxonomy";
import { categoryHref } from "@/components/tj/header";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { num, type Row } from "@/lib/shopping";

const KEYS = ["q", "category", "group", "hub", "brand", "size", "min", "max", "sort", "payment", "radius", "cheap", "phone_type", "f"] as const;
type Filters = Partial<Record<(typeof KEYS)[number], string>>;
const SORTS = [
  ["best", "مرتبط‌ترین"],
  ["cheap", "ارزان‌ترین"],
  ["expensive", "گران‌ترین"],
  ["near", "نزدیک‌ترین"],
] as const;
const RADII = [1, 3, 5, 10, 30];
const DEFAULT_RADIUS = "10";
const million = (v?: string) => (v ? `${num(Math.round((Number(v) / 1e6) * 10) / 10)} میلیون` : "");

export function filtersToParams(f: Filters) {
  const p = new URLSearchParams();
  for (const k of KEYS) if (f[k]) p.set(k, String(f[k]));
  return p;
}
/** The assistant's search constraints, as URL filters for this page. */
export function intentToFilters(intent: Row): Filters {
  return {
    q: intent.query || undefined,
    category: intent.category || undefined,
    brand: intent.brand || undefined,
    size: intent.size || undefined,
    min: intent.min != null ? String(intent.min) : undefined,
    max: intent.max != null ? String(intent.max) : undefined,
    sort: intent.sort && intent.sort !== "best" ? intent.sort : undefined,
    payment: intent.payment ? "1" : undefined,
    radius: intent.radius ? String(intent.radius) : undefined,
    cheap: intent.cheap && intent.max == null ? "1" : undefined,
    phone_type: intent.phone_type || undefined,
    f: intent.features || undefined,
  };
}
/** "رم:۸ گیگ|حافظه:۲۵۶ گیگ" ⇄ Map(name → value); one value per filter. */
const parseF = (v?: string) => new Map((v || "").split("|").map((x) => x.split(":")).filter((x) => x[0] && x[1]) as [string, string][]);
const joinF = (m: Map<string, string>) => [...m].map(([k, v]) => `${k}:${v}`).join("|") || undefined;
const SHOE = /کفش|کتانی|صندل|دمپایی|بوت/;

function PriceFilter({ f, set }: { f: Filters; set: (p: Filters) => void }) {
  const [lo, setLo] = useState(f.min ? String(Number(f.min) / 1e6) : ""),
    [hi, setHi] = useState(f.max ? String(Number(f.max) / 1e6) : "");
  useEffect(() => {
    setLo(f.min ? String(Number(f.min) / 1e6) : "");
    setHi(f.max ? String(Number(f.max) / 1e6) : "");
  }, [f.min, f.max]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        set({ min: lo ? String(Math.round(Number(lo) * 1e6)) : undefined, max: hi ? String(Math.round(Number(hi) * 1e6)) : undefined });
      }}
    >
      <div className="flex items-center gap-2">
        <input value={lo} onChange={(e) => setLo(e.target.value)} type="number" min={0} step="any" placeholder="از" aria-label="حداقل قیمت به میلیون" className="w-full min-w-0 rounded-lg border border-tj-line px-2 py-2 text-sm outline-none focus:border-tj" />
        <span className="text-tj-muted">–</span>
        <input value={hi} onChange={(e) => setHi(e.target.value)} type="number" min={0} step="any" placeholder="تا" aria-label="حداکثر قیمت به میلیون" className="w-full min-w-0 rounded-lg border border-tj-line px-2 py-2 text-sm outline-none focus:border-tj" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-tj-muted">
        <span>میلیون تومان</span>
        <button className="rounded-lg bg-tj-soft px-3 py-1.5 font-bold text-tj">اعمال</button>
      </div>
    </form>
  );
}

// Module-level on purpose: a component defined inside FilterPanel would be a new type on every
// render, remounting the filter buttons and swallowing clicks that land during a re-render.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-tj-line py-4 last:border-0">
      <p className="mb-3 text-sm font-bold">{title}</p>
      {children}
    </div>
  );
}

/** The category's own filters as one-tap chips above the results (no need to open the filter panel). */
function QuickSpecs({ f, set, specs }: { f: Filters; set: (p: Filters) => void; specs: Row }) {
  const chosen = parseF(f.f);
  return (
    <div className="mt-3 space-y-1.5 border-t border-tj-line pt-3 lg:hidden">
      {specs.groups.slice(0, 2).map((g: Row) => (
        <div key={g.key} className="tj-no-scrollbar flex items-center gap-1.5 overflow-x-auto">
          <span className="ml-1 flex shrink-0 items-center gap-1 text-xs font-bold text-tj">
            <Sparkles size={12} /> {g.key}:
          </span>
          {g.values.slice(0, 8).map((x: Row) => {
            const on = chosen.get(g.key) === x.v;
            return (
              <button
                key={x.v}
                onClick={() => {
                  const next = new Map(chosen);
                  if (on) next.delete(g.key);
                  else next.set(g.key, x.v);
                  set({ f: joinF(next), ...(f.category ? {} : { category: specs.category, group: undefined, brand: f.brand, size: f.size }) });
                }}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${on ? "border-tj bg-tj text-white" : "border-tj-line hover:border-tj hover:text-tj"}`}
              >
                {x.v}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FilterPanel({ f, set, facets }: { f: Filters; set: (p: Filters) => void; facets: Row | null }) {
  const tops = useTaxonomy();
  const groupTop = f.group?.split("/")[0];
  const top = tops.find((t) => t.id === groupTop);
  return (
    <div className="px-4">
      <Section title="دسته‌بندی">
        {top ? (
          <div className="space-y-1 text-sm">
            <Link href={categoryHref(top.id)} className={`block rounded-lg px-2 py-1.5 ${f.group === top.id ? "bg-tj-soft font-bold text-tj" : "hover:bg-tj-page"}`}>
              همهٔ {top.name}
            </Link>
            {top.subs
              .filter((s) => s.count > 0)
              .map((s) => (
                <Link key={s.name} href={categoryHref(top.id, s.name)} className={`block rounded-lg px-2 py-1.5 pr-4 ${f.group === top.id + "/" + s.name ? "bg-tj-soft font-bold text-tj" : "text-tj-muted hover:bg-tj-page"}`}>
                  {s.name}
                </Link>
              ))}
          </div>
        ) : facets?.categories?.length ? (
          <div className="space-y-1 text-sm">
            {facets.categories.slice(0, 10).map((c: Row) => (
              <button key={c.name} onClick={() => set({ category: f.category === c.name ? undefined : c.name, group: undefined })} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-right ${f.category === c.name ? "bg-tj-soft font-bold text-tj" : "hover:bg-tj-page"}`}>
                <span className="truncate">{c.name}</span>
                <span className="text-xs text-tj-muted">{num(c.count)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-tj-muted">—</p>
        )}
      </Section>
      <Section title="محدودهٔ قیمت">
        <PriceFilter f={f} set={set} />
        {facets?.price && (
          <p className="mt-2 text-[11px] text-tj-muted">
            از {toman(facets.price.min)} تا {toman(facets.price.max)}
          </p>
        )}
      </Section>
      {facets?.specs?.groups?.length > 0 && (
        <div className="-mx-4 border-b border-tj-line bg-gradient-to-b from-tj-soft/60 to-transparent px-4 pt-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-tj">
            <Sparkles size={15} /> فیلترهای مخصوص {facets.specs.category}
          </p>
          <p className="mt-1 text-[11px] text-tj-muted">از عنوان و مشخصات کالاها استخراج شده؛ عدد کنار هر گزینه تعداد کالای همین نتایج است.</p>
          {facets.specs.groups.map((g: Row) => {
            const chosen = parseF(f.f);
            return (
              <div key={g.key} className="py-3">
                <p className="mb-2 text-xs font-bold">{g.key}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.values.map((x: Row) => {
                    const on = chosen.get(g.key) === x.v;
                    return (
                      <button
                        key={x.v}
                        onClick={() => {
                          const next = new Map(chosen);
                          if (on) next.delete(g.key);
                          else next.set(g.key, x.v);
                          set({ f: joinF(next), ...(f.category ? {} : { category: facets.specs.category, group: undefined, brand: f.brand, size: f.size }) });
                        }}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition ${on ? "border-tj bg-tj text-white" : "border-tj-line bg-white hover:border-tj"}`}
                      >
                        {x.v}
                        <span className={on ? "text-white/80" : "text-tj-muted"}>{num(x.n)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(facets?.sizes?.length > 0 || f.size) && (
        <Section title="سایز">
          <div className="flex flex-wrap gap-1.5">
            {(facets?.sizes || [{ name: f.size }]).map((z: Row) => (
              <button key={z.name} onClick={() => set({ size: f.size === z.name ? undefined : z.name })} className={`min-w-10 rounded-lg border px-2 py-1.5 text-sm ${f.size === z.name ? "border-tj bg-tj text-white" : "border-tj-line hover:border-tj"}`}>
                {z.name === "FREE" ? "فری‌سایز" : z.name}
              </button>
            ))}
          </div>
          <SizeGuide kind={SHOE.test(f.category || f.q || facets?.categories?.[0]?.name || "") ? "shoes" : "clothes"} sizes={(facets?.sizes || []).map((z: Row) => z.name)} />
        </Section>
      )}
      {facets?.brands?.length > 0 && (
        <Section title="برند">
          <div className="tj-scroll max-h-56 space-y-1 overflow-y-auto text-sm">
            {facets.brands.map((b: Row) => (
              <label key={b.name} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-tj-page">
                <input type="checkbox" checked={f.brand === b.name} onChange={() => set({ brand: f.brand === b.name ? undefined : b.name })} className="accent-[#d73948]" />
                <span className="flex-1 truncate">{b.name}</span>
                <span className="text-xs text-tj-muted">{num(b.count)}</span>
              </label>
            ))}
          </div>
        </Section>
      )}
      <Section title="فاصله از تو">
        <div className="flex flex-wrap gap-1.5">
          {RADII.map((r) => (
            <button key={r} onClick={() => set({ radius: String(r) })} className={`rounded-lg border px-2.5 py-1.5 text-sm ${(f.radius || DEFAULT_RADIUS) === String(r) ? "border-tj bg-tj-soft text-tj" : "border-tj-line"}`}>
              {num(r)} کیلومتر
            </button>
          ))}
        </div>
      </Section>
      <Section title="پرداخت">
        <label className="flex cursor-pointer items-center justify-between text-sm">
          فقط فروشگاه‌های دارای ترب‌پی (اقساط)
          <input type="checkbox" checked={f.payment === "1"} onChange={(e) => set({ payment: e.target.checked ? "1" : undefined })} className="size-4 accent-[#d73948]" />
        </label>
      </Section>
    </div>
  );
}

export default function SearchPage() {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const { origin, track } = useApp();
  const tops = useTaxonomy();
  const f: Filters = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, params.get(k) || undefined])), [params]);
  const [items, setItems] = useState<Row[]>([]),
    [total, setTotal] = useState(0),
    [facets, setFacets] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [error, setError] = useState(false),
    [sheet, setSheet] = useState(false);
  const set = useCallback(
    (patch: Filters, replace = false) => {
      const next = { ...f, ...patch };
      // Changing the category scope invalidates brand/size choices from the old list.
      if ("category" in patch || "group" in patch) {
        if (!("brand" in patch)) next.brand = undefined;
        if (!("size" in patch)) next.size = undefined;
        if (!("f" in patch)) next.f = undefined;
      }
      const url = `${pathname}?${filtersToParams(next).toString()}`;
      // Filters live only in the query string: update it in place (Next syncs useSearchParams with
      // the History API) instead of a server round trip that can be slow or dropped.
      window.history[replace ? "replaceState" : "pushState"](null, "", url);
    },
    [f, pathname, router],
  );
  const query = useCallback(
    (offset: number) => {
      const p = filtersToParams({ ...f, radius: f.radius || DEFAULT_RADIUS });
      p.set("lat", String(origin.lat));
      p.set("lon", String(origin.lon));
      p.set("limit", "24");
      p.set("offset", String(offset));
      return fetch(`/api/search?${p}`).then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      });
    },
    [f, origin.lat, origin.lon],
  );
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(false);
    query(0)
      .then((j) => {
        if (!live) return;
        setItems(j.items);
        setTotal(j.total);
        setFacets(j.facets || null);
        if (f.q) track({ type: "search", query: f.q, category: j.items[0]?.category_name });
      })
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  const top = tops.find((t) => t.id === f.group?.split("/")[0]);
  const title = f.q ? `«${f.q}»` : f.category || (f.group?.includes("/") ? f.group.split("/")[1] : top?.name) || (f.hub ? "فروشگاه‌های این مرکز خرید" : "همهٔ کالاها");
  const chips: [keyof Filters, string][] = [
    ...(f.q ? [["q", `جست‌وجو: ${f.q}`] as [keyof Filters, string]] : []),
    ...(f.category ? [["category", f.category] as [keyof Filters, string]] : []),
    ...(f.brand ? [["brand", `برند: ${f.brand}`] as [keyof Filters, string]] : []),
    ...(f.size ? [["size", `سایز ${f.size}`] as [keyof Filters, string]] : []),
    ...(f.min ? [["min", `از ${million(f.min)}`] as [keyof Filters, string]] : []),
    ...(f.max ? [["max", `تا ${million(f.max)}`] as [keyof Filters, string]] : []),
    ...(f.payment ? [["payment", "ترب‌پی"] as [keyof Filters, string]] : []),
    ...(f.cheap ? [["cheap", "اقتصادی‌ها"] as [keyof Filters, string]] : []),
    ...(f.phone_type ? [["phone_type", f.phone_type === "smart" ? "گوشی هوشمند" : "گوشی ساده"] as [keyof Filters, string]] : []),
    ...(f.hub ? [["hub", "مرکز خرید انتخابی"] as [keyof Filters, string]] : []),
  ];
  const featureChips = [...parseF(f.f)];
  return (
    <Shell>
      <main className="mx-auto max-w-[1440px] px-3 pt-4 lg:px-8">
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-tj-muted" aria-label="مسیر">
          <Link href="/" className="hover:text-tj">ترب‌جو</Link>
          {top && (
            <>
              <ChevronLeft size={13} />
              <Link href={categoryHref(top.id)} className="hover:text-tj">{top.name}</Link>
            </>
          )}
          {f.group?.includes("/") && (
            <>
              <ChevronLeft size={13} />
              <span>{f.group.split("/")[1]}</span>
            </>
          )}
        </nav>
        <div className="flex gap-5">
          <aside className="sticky top-32 hidden max-h-[calc(100dvh-9rem)] w-64 shrink-0 self-start overflow-y-auto rounded-xl border border-tj-line bg-white lg:block tj-scroll">
            <FilterPanel f={f} set={set} facets={facets} />
          </aside>
          <section className="min-w-0 flex-1">
            <div className="rounded-xl border border-tj-line bg-white px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-base font-bold">
                  {title}
                  <span className="mr-2 text-xs font-normal text-tj-muted">{loading ? "…" : `${num(total)} کالا در ${num(f.radius || DEFAULT_RADIUS)} کیلومتری ${origin.label}`}</span>
                </h1>
                <button onClick={() => setSheet(true)} className="flex items-center gap-1.5 rounded-lg border border-tj-line px-3 py-1.5 text-sm lg:hidden">
                  <SlidersHorizontal size={15} /> فیلترها
                </button>
              </div>
              <div className="tj-no-scrollbar mt-3 flex items-center gap-1 overflow-x-auto text-sm">
                <span className="ml-1 shrink-0 text-xs text-tj-muted">مرتب‌سازی:</span>
                {SORTS.map(([id, label]) => (
                  <button key={id} onClick={() => set({ sort: id === "best" ? undefined : id })} className={`shrink-0 rounded-lg px-3 py-1.5 ${(f.sort || "best") === id ? "bg-tj-soft font-bold text-tj" : "text-tj-muted hover:text-tj-ink"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {facets?.specs?.groups?.length > 0 && <QuickSpecs f={f} set={set} specs={facets.specs} />}
              {(top || facets?.categories?.[0]?.top) && (
                <Link href={`/map?group=${top?.id || facets.categories[0].top}`} className="mt-3 flex items-center gap-1.5 text-xs text-tj-muted hover:text-tj">
                  <MapIcon size={14} className="text-tj" /> بورس {top?.name || "این دسته"} در تهران کجاست؟ <ChevronLeft size={13} />
                </Link>
              )}
              {chips.length + featureChips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map(([k, label]) => (
                    <button key={k} onClick={() => set({ [k]: undefined })} className="flex items-center gap-1 rounded-full bg-tj-page px-3 py-1 text-xs hover:bg-tj-soft hover:text-tj">
                      {label}
                      <X size={12} />
                    </button>
                  ))}
                  {featureChips.map(([k, v]) => (
                    <button
                      key={"f:" + k}
                      onClick={() => {
                        const m = parseF(f.f);
                        m.delete(k);
                        set({ f: joinF(m) });
                      }}
                      className="flex items-center gap-1 rounded-full bg-tj-soft px-3 py-1 text-xs text-tj hover:bg-tj hover:text-white"
                    >
                      {k}: {v}
                      <X size={12} />
                    </button>
                  ))}
                  <button onClick={() => router.push(pathname)} className="px-2 text-xs text-tj">
                    حذف همه
                  </button>
                </div>
              )}
            </div>
            {error ? (
              <div className="mt-4 rounded-xl border border-tj-line bg-white p-10 text-center text-sm">
                دریافت نتایج انجام نشد.
                <button onClick={() => router.refresh()} className="mr-2 text-tj underline">تلاش دوباره</button>
              </div>
            ) : !loading && !items.length ? (
              <div className="mt-4 flex flex-col items-center rounded-xl border border-tj-line bg-white p-10 text-center">
                <SearchX size={40} className="text-tj-muted" />
                <p className="mt-3 font-bold">کالایی با این فیلترها در این فاصله پیدا نشد</p>
                <p className="mt-1 text-sm text-tj-muted">
                  {f.size ? "برای خیلی از کالاها سایز ثبت نشده؛ " : ""}فاصله را بیشتر کن یا یک فیلتر را بردار.
                </p>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => set({ radius: "30" })} className="rounded-lg bg-tj px-4 py-2 text-sm text-white">جست‌وجو تا ۳۰ کیلومتر</button>
                  {f.size && <button onClick={() => set({ size: undefined })} className="rounded-lg border border-tj-line px-4 py-2 text-sm">بدون سایز</button>}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {loading ? Array.from({ length: 12 }, (_, i) => <CardSkeleton key={i} />) : items.map((p) => <ProductCard key={p.product_id} p={p} />)}
              </div>
            )}
            {!loading && items.length < total && (
              <button
                disabled={more}
                onClick={() => {
                  setMore(true);
                  query(items.length)
                    .then((j) => setItems((x) => [...x, ...j.items]))
                    .finally(() => setMore(false));
                }}
                className="mx-auto mt-6 flex items-center gap-2 rounded-xl border border-tj-line bg-white px-6 py-3 text-sm hover:border-tj hover:text-tj disabled:opacity-60"
              >
                {more && <LoaderCircle size={16} className="animate-spin" />}
                نمایش {num(Math.min(24, total - items.length))} کالای دیگر از {num(total - items.length)}
              </button>
            )}
          </section>
        </div>
      </main>
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" dir="rtl" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-0">
          <SheetTitle className="border-b border-tj-line p-4">فیلترها</SheetTitle>
          <FilterPanel
            f={f}
            set={(p) => {
              set(p);
              setSheet(false);
            }}
            facets={facets}
          />
        </SheetContent>
      </Sheet>
      <AssistantDock
        page={{ kind: "search", filters: f }}
        intent={{
          query: f.q,
          category: f.category,
          brand: f.brand,
          size: f.size,
          min: f.min ? Number(f.min) : null,
          max: f.max ? Number(f.max) : null,
          sort: f.sort,
          payment: f.payment === "1",
          radius: Number(f.radius || DEFAULT_RADIUS),
          cheap: f.cheap === "1",
          phone_type: f.phone_type || null,
          features: f.f || null,
        }}
        resultIds={items.slice(0, 8).map((p) => p.product_id)}
        onIntent={(intent) => set({ ...intentToFilters(intent), group: intent.category ? undefined : f.group, hub: f.hub }, true)}
      />
    </Shell>
  );
}
