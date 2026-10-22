"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Send, Store, RefreshCw } from "lucide-react";
import Shell from "@/components/tj/shell";
import ProductCard, { CardSkeleton, km } from "@/components/tj/product-card";
import { useApp } from "@/components/tj/app-context";
import { ICONS, useTaxonomy } from "@/components/tj/taxonomy";
import { categoryHref } from "@/components/tj/header";
import { distance, num, type Row } from "@/lib/shopping";

const ShopMap = dynamic(() => import("@/components/shopping-map"), { ssr: false, loading: () => <div className="h-full animate-pulse bg-tj-page" /> });


export default function Home() {
  const { user, origin, incognito, ready } = useApp();
  const router = useRouter();
  const tops = useTaxonomy();
  const [ask, setAsk] = useState(""),
    [recs, setRecs] = useState<{ items: Row[]; personalized: boolean } | null>(null),
    [hubs, setHubs] = useState<Row[]>([]),
    [hubActive, setHubActive] = useState<string | undefined>();
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
  const hello = hour < 5 ? "شب بخیر" : hour < 12 ? "صبح بخیر" : hour < 17 ? "روز بخیر" : hour < 21 ? "عصر بخیر" : "شب بخیر";
  return (
    <Shell>
      <main className="mx-auto max-w-[1200px] px-4 lg:px-8">
        {/* One job above the fold: say what you need. */}
        <section className="mx-auto max-w-2xl pb-6 pt-10 text-center sm:pt-16">
          <p className="text-sm text-tj-muted">{user ? `${hello} ${user.name} 👋` : hello}</p>
          <h1 className="mt-2 text-[26px] font-black leading-[1.5] sm:text-4xl sm:leading-[1.5]">
            چی می‌خوای بخری؟ <span className="text-tj">نزدیک‌ترینش</span> را پیدا می‌کنیم
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              router.push(ask.trim() ? `/chat?q=${encodeURIComponent(ask.trim())}` : "/chat");
            }}
            className="mt-7 flex items-center gap-2 rounded-2xl border border-tj-line bg-white p-2 shadow-[0_8px_30px_-12px_#d7394840] focus-within:border-tj"
          >
            <Sparkles size={20} className="mr-2 shrink-0 text-tj" />
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none"
              placeholder="مثلاً «کفش مردانه سایز ۴۴ تا ۵ میلیون»"
              aria-label="پرسش از دستیار خرید"
            />
            <button className="grid size-11 shrink-0 place-items-center rounded-xl bg-tj text-white hover:bg-tj-dark" aria-label="ارسال">
              <Send size={17} className="-scale-x-100" />
            </button>
          </form>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            {["🌙 ساعت ۱ شب شارژر گوشیم خراب شده", "گوشی تا ۸۰ میلیون", "کفش مردانه سایز ۴۵"].map((q) => (
              <Link key={q} href={`/chat?q=${encodeURIComponent(q)}`} className="rounded-full bg-white px-3 py-1.5 text-tj-muted ring-1 ring-tj-line hover:text-tj hover:ring-tj">
                {q}
              </Link>
            ))}
          </div>
          <p className="mt-5 text-[11px] text-tj-muted">
            {num(225901)} کالا · {num(6476)} فروشگاه حضوری · {num(410)} پاساژ تهران
          </p>
        </section>

        <section className="tj-no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:justify-center">
          {(tops.length ? tops : Array.from({ length: 10 }, () => null)).map((t, i) =>
            t ? (
              <Link key={t.id} href={categoryHref(t.id)} className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl p-1.5 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-white text-tj-ink ring-1 ring-tj-line transition group-hover:text-tj group-hover:ring-tj">
                  {(() => {
                    const Icon = ICONS[t.id] || Sparkles;
                    return <Icon size={21} strokeWidth={1.6} />;
                  })()}
                </span>
                <span className="line-clamp-2 text-[11px] leading-4 text-tj-muted group-hover:text-tj-ink">{t.name}</span>
              </Link>
            ) : (
              <div key={i} className="size-12 shrink-0 animate-pulse rounded-2xl bg-white" />
            ),
          )}
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold">{recs?.personalized ? "پیشنهاد مخصوص تو" : "پرطرفدارهای نزدیک تو"}</h2>
              <p className="mt-0.5 text-xs text-tj-muted">
                {incognito ? "حالت ناشناس: بدون شخصی‌سازی" : recs?.personalized ? "از روی چیزهایی که دیدی و پرسیدی" : "هر چه بیشتر بگردی، دقیق‌تر می‌شود"}
              </p>
            </div>
            <button onClick={loadRecs} className="grid size-8 place-items-center rounded-lg text-tj-muted hover:bg-white hover:text-tj" aria-label="پیشنهادهای تازه">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="tj-scroll -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {(recs ? recs.items.slice(0, 12) : Array.from({ length: 6 }, () => null)).map((p, i) => (
              <div key={p?.product_id ?? i} className="w-[170px] shrink-0 snap-start sm:w-[190px]">
                {p ? <ProductCard p={p} compact /> : <CardSkeleton compact />}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 mt-10 overflow-hidden rounded-3xl border border-tj-line bg-white lg:grid lg:grid-cols-[360px_1fr]">
          <div className="p-5">
            <h2 className="text-lg font-bold">پاساژهای نزدیک تو</h2>
            <p className="mt-0.5 text-xs text-tj-muted">از {origin.label} · روی هر کدام بزن تا مسیرش را ببینی</p>
            <div className="mt-4 space-y-1">
              {nearHubs.map((h) => (
                <div key={h.hub_id} onMouseEnter={() => setHubActive(h.hub_id)} onClick={() => setHubActive(h.hub_id)} className={`flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition ${hubActive === h.hub_id ? "bg-tj-page" : "hover:bg-tj-page"}`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tj-soft text-tj">
                    <Store size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{h.name}</p>
                    <p className="truncate text-[11px] text-tj-muted">{num(h.shop_count)} فروشگاه · {h.top_categories?.[0]}</p>
                  </div>
                  <Link href={`/search?hub=${h.hub_id}`} onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-tj hover:bg-white">
                    {km(h.km)} <ArrowLeft size={13} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <div className="h-80 lg:h-auto lg:min-h-[420px]">
            <ShopMap hubs={nearHubs} origin={origin} activeId={hubActive} onSelect={(h) => setHubActive(h.hub_id)} />
          </div>
        </section>
      </main>
    </Shell>
  );
}
