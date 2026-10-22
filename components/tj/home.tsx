"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Send, MapPin, Store, RefreshCw } from "lucide-react";
import Shell from "@/components/tj/shell";
import ProductCard, { CardSkeleton, km } from "@/components/tj/product-card";
import { useApp } from "@/components/tj/app-context";
import { ICONS, useTaxonomy } from "@/components/tj/taxonomy";
import { categoryHref } from "@/components/tj/header";
import { distance, num, type Row } from "@/lib/shopping";

const ShopMap = dynamic(() => import("@/components/shopping-map"), { ssr: false, loading: () => <div className="h-full animate-pulse bg-tj-page" /> });

function Row_({ title, href, items, loading }: { title: string; href: string; items: Row[]; loading: boolean }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href={href} className="flex items-center gap-1 text-sm text-tj">
          مشاهدهٔ همه <ArrowLeft size={15} />
        </Link>
      </div>
      <div className="tj-scroll -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {(loading ? Array.from({ length: 6 }, () => null) : items).map((p, i) => (
          <div key={p?.product_id ?? i} className="w-[180px] shrink-0 snap-start sm:w-[200px]">
            {p ? <ProductCard p={p} compact /> : <CardSkeleton compact />}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { user, origin, incognito, ready } = useApp();
  const router = useRouter();
  const tops = useTaxonomy();
  const [ask, setAsk] = useState(""),
    [recs, setRecs] = useState<{ items: Row[]; personalized: boolean } | null>(null),
    [rows, setRows] = useState<Record<string, Row[]>>({}),
    [hubs, setHubs] = useState<Row[]>([]);
  const at = `lat=${origin.lat}&lon=${origin.lon}`;
  const loadRecs = () => {
    setRecs(null);
    fetch(`/api/recs?${at}&limit=18`, { headers: incognito ? { "x-incognito": "1" } : {} })
      .then((r) => r.json())
      .then(setRecs)
      .catch(() => setRecs({ items: [], personalized: false }));
  };
  useEffect(() => {
    if (!ready) return;
    loadRecs();
    for (const g of ["mobile", "fashion", "appliance"])
      fetch(`/api/search?group=${g}&radius=8&${at}&limit=12`)
        .then((r) => r.json())
        .then((j) => setRows((x) => ({ ...x, [g]: j.items || [] })))
        .catch(() => {});
    fetch("/api/hubs")
      .then((r) => r.json())
      .then(setHubs)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, origin.lat, origin.lon, incognito]);
  const nearHubs = useMemo(
    () =>
      hubs
        .filter((h) => h.kind === "building" && h.shop_count >= 15)
        .map((h): Row => ({ ...h, km: distance(origin, h) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 6),
    [hubs, origin],
  );
  const hour = new Date().getHours();
  const hello = hour < 12 ? "صبح بخیر" : hour < 17 ? "روز بخیر" : "عصر بخیر";
  return (
    <Shell>
      <main className="mx-auto max-w-[1440px] px-3 lg:px-8">
        <section className="mt-5 overflow-hidden rounded-2xl border border-tj-line bg-white">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_1fr] lg:p-10">
            <div>
              <p className="text-sm text-tj-muted">
                {user ? `${hello} ${user.name} 👋` : hello}
              </p>
              <h1 className="mt-2 text-2xl font-black leading-[1.6] sm:text-[34px]">
                ارزان‌ترین قیمت، <span className="text-tj">نزدیک‌ترین فروشگاه</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-tj-muted">
                قیمت {num(225000)}+ کالا را در {num(6400)}+ فروشگاه حضوری تهران مقایسه کن. هر چی می‌خوای به دستیار بگو؛ با بودجه و سایزت، از نزدیک‌ترین مغازه پیدا می‌کند.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  router.push(ask.trim() ? `/chat?q=${encodeURIComponent(ask.trim())}` : "/chat");
                }}
                className="mt-6 flex items-center gap-2 rounded-2xl border-2 border-tj/20 bg-white p-2 focus-within:border-tj"
              >
                <Sparkles size={20} className="mr-2 shrink-0 text-tj" />
                <input
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                  placeholder="به دستیار بگو… «کفش اسپرت مردانه سایز ۴۴ تا ۵ میلیون»"
                  aria-label="پرسش از دستیار خرید"
                />
                <button className="grid size-10 shrink-0 place-items-center rounded-xl bg-tj text-white hover:bg-tj-dark" aria-label="ارسال">
                  <Send size={17} className="-scale-x-100" />
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {["🌙 ساعت ۱ شب شارژر گوشیم خراب شده", "گوشی تا ۸۰ میلیون", "کفش مردانه سایز ۴۵", "هدفون QCY نزدیک من"].map((q) => (
                  <Link key={q} href={`/chat?q=${encodeURIComponent(q)}`} className="rounded-full border border-tj-line px-3 py-1.5 text-tj-muted hover:border-tj hover:text-tj">
                    {q}
                  </Link>
                ))}
              </div>
            </div>
            <div className="hidden grid-cols-2 gap-3 lg:grid">
              {[
                ["مقایسهٔ قیمت", "همهٔ فروشگاه‌ها کنار هم، ارزان‌ترین اول"],
                ["نزدیک‌ترین مغازه", "بر اساس موقعیت تو، با ساعت کاری"],
                ["پرسش از فروشنده", "قیمت و موجودی را قبل از رفتن بپرس"],
                ["پیشنهاد مخصوص تو", "از روی چیزهایی که دوست داری"],
              ].map(([t, s], i) => (
                <div key={t} className={`rounded-xl p-4 ${i === 0 ? "bg-tj text-white" : "bg-tj-page"}`}>
                  <p className="font-bold">{t}</p>
                  <p className={`mt-1 text-xs leading-6 ${i === 0 ? "text-white/80" : "text-tj-muted"}`}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-14">
          {(tops.length ? tops : Array.from({ length: 14 }, () => null)).map((t, i) =>
            t ? (
              <Link key={t.id} href={categoryHref(t.id)} className="group flex flex-col items-center gap-2 rounded-xl p-2 text-center">
                <span className="grid size-14 place-items-center rounded-2xl border border-tj-line bg-white text-tj-ink transition group-hover:border-tj group-hover:text-tj">
                  {(() => {
                    const Icon = ICONS[t.id] || Sparkles;
                    return <Icon size={24} strokeWidth={1.6} />;
                  })()}
                </span>
                <span className="text-[11.5px] leading-5">{t.name}</span>
              </Link>
            ) : (
              <div key={i} className="mx-auto size-14 animate-pulse rounded-2xl bg-white" />
            ),
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{recs?.personalized ? "پیشنهاد مخصوص تو" : "پرطرفدارهای نزدیک تو"}</h2>
              <p className="mt-0.5 text-xs text-tj-muted">
                {incognito
                  ? "در حالت ناشناس پیشنهادها شخصی‌سازی نمی‌شوند."
                  : recs?.personalized
                    ? "بر اساس چیزهایی که دیدی، جست‌وجو کردی و از دستیار پرسیدی"
                    : "هر چه بیشتر بگردی، پیشنهادها دقیق‌تر می‌شوند"}
              </p>
            </div>
            <button onClick={loadRecs} className="flex items-center gap-1 text-sm text-tj-muted hover:text-tj" aria-label="پیشنهادهای تازه">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(recs ? recs.items : Array.from({ length: 12 }, () => null)).map((p, i) => (p ? <ProductCard key={p.product_id} p={p} compact /> : <CardSkeleton key={i} compact />))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-lg font-bold">مراکز خرید نزدیک تو</h2>
            <p className="mb-3 mt-0.5 text-xs text-tj-muted">از {origin.label}</p>
            <div className="space-y-2">
              {nearHubs.map((h) => (
                <Link key={h.hub_id} href={`/search?hub=${h.hub_id}`} className="flex items-center gap-3 rounded-xl border border-tj-line bg-white p-3 hover:border-tj/40">
                  <span className="grid size-10 place-items-center rounded-xl bg-tj-soft text-tj">
                    <Store size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{h.name}</p>
                    <p className="text-xs text-tj-muted">
                      {num(h.shop_count)} فروشگاه · {h.top_categories?.slice(0, 2).join("، ")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-tj-green">
                    <MapPin size={13} />
                    {km(h.km)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <div className="h-80 overflow-hidden rounded-2xl border border-tj-line lg:h-auto lg:min-h-96">
            <ShopMap hubs={nearHubs} origin={origin} onSelect={(h) => router.push(`/search?hub=${h.hub_id}`)} />
          </div>
        </section>

        <Row_ title="موبایل و تبلت" href={categoryHref("mobile")} items={rows.mobile || []} loading={!rows.mobile} />
        <Row_ title="مد و پوشاک" href={categoryHref("fashion")} items={rows.fashion || []} loading={!rows.fashion} />
        <Row_ title="لوازم خانگی برقی" href={categoryHref("appliance")} items={rows.appliance || []} loading={!rows.appliance} />
      </main>
    </Shell>
  );
}
