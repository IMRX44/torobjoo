"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  MapPin,
  Phone,
  Navigation,
  Store,
  Clock,
  ShieldCheck,
  BadgeCheck,
  AlertTriangle,
  MessageCircleQuestion,
  Check,
  Plus,
  Share2,
  Sparkles,
  ListChecks,
  ThumbsUp,
  Info,
  LoaderCircle,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import Shell from "@/components/tj/shell";
import ProductCard, { CardSkeleton, toman, km } from "@/components/tj/product-card";
import ProductImage from "@/components/product-image";
import AssistantDock from "@/components/tj/assistant-dock";
import { useApp, useDwell } from "@/components/tj/app-context";
import { categoryHref } from "@/components/tj/header";
import { addToPlan, getPlan } from "@/components/tj/plan";
import { useInquiryWatch } from "@/components/tj/use-inquiry-watch";
import { CompareToggle } from "@/components/tj/compare";
import { useRouter } from "next/navigation";
import { intentToFilters, filtersToParams } from "@/components/tj/search-page";
import { arrivalDate, dateLabel, hours, num, type Row } from "@/lib/shopping";

const VISITS = [
  ["now", "الان"],
  ["18:00", "امروز ساعت ۱۸"],
  ["20:00", "امروز ساعت ۲۰"],
  ["tomorrow 10:00", "فردا ساعت ۱۰"],
  ["tomorrow 17:00", "فردا ساعت ۱۷"],
  ["fri 11:00", "جمعه ساعت ۱۱"],
] as const;

const ShopMap = dynamic(() => import("@/components/shopping-map"), { ssr: false, loading: () => <div className="h-full animate-pulse bg-tj-page" /> });

function Hours({ h, when = "الان" }: { h?: string; when?: string }) {
  const tone = h === "باز" ? "text-tj-green" : h === "بسته" ? "text-tj" : "text-amber-600";
  return (
    <span className={`flex items-center gap-1 ${tone}`}>
      <Clock size={12} />
      {h === "باز" ? `${when} باز است` : h === "بسته" ? `${when} بسته است` : "ساعت کاری نامشخص"}
    </span>
  );
}

/** Where prices sit in this product's market: min, typical range (25–75%), median, max. */
function marketOf(offers: Row[] | null) {
  const ps = (offers || [])
    .filter((o) => o.price_toman != null && !o.price_flagged && o.confirmed?.available !== false)
    .map((o) => o.price_toman as number)
    .sort((a, b) => a - b);
  if (ps.length < 3) return null;
  const q = (f: number) => ps[Math.min(ps.length - 1, Math.floor(f * ps.length))];
  return { min: ps[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: ps.at(-1)!, n: ps.length };
}
function priceTag(price: number | null | undefined, m: ReturnType<typeof marketOf>) {
  if (!m || price == null) return null;
  const pct = Math.round(((price - m.median) / m.median) * 100);
  if (price < m.median * 0.6) return { text: "خیلی ارزان‌تر از بازار؛ قبل از رفتن بپرس", tone: "bg-amber-50 text-amber-800" };
  if (price <= m.p25) return { text: `ارزان · ${num(Math.abs(pct))}٪ زیر میانه`, tone: "bg-[#f1faf4] text-tj-green" };
  if (price >= m.p75 && pct > 3) return { text: `گران · ${num(pct)}٪ بالای میانه`, tone: "bg-tj-soft text-tj" };
  return { text: "قیمت معمول بازار", tone: "bg-tj-page text-tj-muted" };
}
function PriceMeter({ m, mark }: { m: NonNullable<ReturnType<typeof marketOf>>; mark?: number | null }) {
  const span = m.max - m.min || 1;
  const at = (v: number) => `${((v - m.min) / span) * 100}%`;
  return (
    <div className="rounded-xl border border-tj-line p-4">
      <p className="mb-3 text-xs font-bold">سنجهٔ قیمت منصفانه · {num(m.n)} فروشنده</p>
      <div className="relative h-2.5 rounded-full bg-gradient-to-l from-tj/70 via-amber-300 to-tj-green/80" dir="ltr">
        <span className="absolute -top-1 h-4.5 w-0.5 bg-tj-ink" style={{ left: at(m.median) }} title="میانه" />
        <span className="absolute inset-y-0 rounded-full border-2 border-white/90" style={{ left: at(m.p25), width: `calc(${at(m.p75)} - ${at(m.p25)})` }} />
        {mark != null && (
          <span className="absolute -top-1.5 grid size-5 -translate-x-1/2 place-items-center rounded-full border-2 border-white bg-tj-ink text-[9px] text-white shadow" style={{ left: at(Math.min(m.max, Math.max(m.min, mark))) }}>
            ●
          </span>
        )}
      </div>
      {/* Same left-to-right order as the bar: cheapest on the left (green end). */}
      <div className="mt-2 flex justify-between text-[11px] text-tj-muted" dir="ltr">
        <span dir="rtl">ارزان‌ترین {num(Math.round(m.min / 1000))} هزار</span>
        <span dir="rtl">میانه {num(Math.round(m.median / 1000))} هزار</span>
        <span dir="rtl">گران‌ترین {num(Math.round(m.max / 1000))} هزار</span>
      </div>
      <p className="mt-2 text-xs leading-6">
        قیمت منصفانه معمولاً بین <b>{toman(m.p25)}</b> و <b>{toman(m.p75)}</b> است.
      </p>
    </div>
  );
}

function SellerStatus({ o }: { o: Row }) {
  const c = o.confirmed,
    q = o.inquiry;
  if (c)
    return (
      <span className={`flex flex-wrap items-center gap-1 text-xs ${c.available === false ? "text-tj" : "text-tj-green"}`}>
        <BadgeCheck size={14} />
        {c.available === false ? "فروشنده گفت ندارد" : "قیمت را فروشنده تأیید کرده"} · {dateLabel(c.at)}
        {c.simulated && <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-800">پاسخ نمایشی</span>}
        {c.note && <span className="text-tj-muted">«{c.note}»</span>}
      </span>
    );
  if (q?.status === "pending")
    return (
      <span className="flex items-center gap-1 text-xs text-amber-700">
        <LoaderCircle size={13} className="animate-spin" />
        {q.reason === "price_check" ? "قیمت غیرعادی کم است؛ از فروشنده پرسیده‌ایم" : "منتظر جواب فروشنده"}
      </span>
    );
  if (o.price_flagged)
    return (
      <span className="flex items-center gap-1 text-xs text-amber-700">
        <AlertTriangle size={13} />
        قیمت غیرعادی؛ احتمالاً به‌روز نیست
      </span>
    );
  return <span className="text-xs text-tj-muted">به‌روزرسانی قیمت: {dateLabel(o.last_price_changed_at)}</span>;
}

export default function ProductPage({ id }: { id: string }) {
  const { origin, track, api } = useApp();
  const router = useRouter();
  const [p, setP] = useState<Row | null>(null),
    [missing, setMissing] = useState(false),
    [offers, setOffers] = useState<Row[] | null>(null),
    [sort, setSort] = useState<"near" | "cheap">("near"),
    [visit, setVisit] = useState("now"),
    [image, setImage] = useState(0),
    [desc, setDesc] = useState<Row | null>(null),
    [similar, setSimilar] = useState<Row[] | null>(null),
    [asking, setAsking] = useState<string | null>(null),
    [planned, setPlanned] = useState<string[]>([]),
    [active, setActive] = useState<string | undefined>(),
    [allSpecs, setAllSpecs] = useState(false);

  useEffect(() => {
    setP(null);
    setOffers(null);
    setDesc(null);
    setSimilar(null);
    setImage(0);
    fetch(`/api/product?id=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        setP(j);
        track({ type: "view", productId: id, category: j.category_name, brand: j.brand_name || undefined, price: j.min_price ?? undefined });
        fetch(`/api/describe?id=${id}`)
          .then((r) => r.json())
          .then(setDesc)
          .catch(() => {});
        fetch(`/api/search?category=${encodeURIComponent(j.category_name)}&radius=10&lat=${origin.lat}&lon=${origin.lon}&limit=13${j.min_price ? `&min=${Math.round(j.min_price * 0.5)}&max=${Math.round(j.min_price * 1.8)}` : ""}`)
          .then((r) => r.json())
          .then((s) => setSimilar((s.items || []).filter((x: Row) => x.product_id !== id).slice(0, 12)))
          .catch(() => setSimilar([]));
      })
      .catch(() => setMissing(true));
    setPlanned(getPlan().map((s) => s.offer_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    fetch(`/api/offers?id=${id}&radius=30&sort=near&lat=${origin.lat}&lon=${origin.lon}`)
      .then((r) => r.json())
      .then((j) => setOffers(j.offers || []))
      .catch(() => setOffers([]));
  }, [id, origin.lat, origin.lon]);
  // Live seller answers for offers with a pending question (asked here or by anyone else).
  const pendingIds = useMemo(() => (offers || []).filter((o) => o.inquiry?.status === "pending").map((o) => o.offer_id), [offers]);
  const live = useInquiryWatch(pendingIds, Object.fromEntries((offers || []).map((o) => [o.offer_id, o.shop_name])));
  useEffect(() => {
    if (!Object.keys(live).length) return;
    setOffers((xs) =>
      xs?.map((o) => {
        const st = live[o.offer_id];
        if (!st || (st.inquiry?.status === o.inquiry?.status && !st.confirmed === !o.confirmed)) return o;
        return { ...o, inquiry: st.inquiry, confirmed: st.confirmed, price_toman: st.confirmed?.price ?? o.price_toman };
      }) ?? xs,
    );
  }, [live]);
  useDwell(p ? id : undefined, { category: p?.category_name, brand: p?.brand_name || undefined, price: p?.min_price ?? undefined });

  const visitAt = visit === "now" ? null : arrivalDate(visit);
  const visitLabel = VISITS.find(([k]) => k === visit)?.[1] || "الان";
  const openAt = (o: Row) => (visitAt ? hours({ weekly_hours: o.weekly_hours }, visitAt) : o.hours);
  const sorted = useMemo(() => {
    if (!offers) return [];
    const usable = offers.filter((o) => o.confirmed?.available !== false);
    const gone = offers.filter((o) => o.confirmed?.available === false);
    const by =
      sort === "near"
        ? (a: Row, b: Row) => a.distance - b.distance
        : (a: Row, b: Row) => (a.price_toman ?? Infinity) - (b.price_toman ?? Infinity);
    // With a planned visit time, shops closed at that time go after the open ones.
    const closed = (o: Row) => Number(visitAt != null && openAt(o) === "بسته");
    return [...usable.sort((a, b) => closed(a) - closed(b) || by(a, b)), ...gone];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, sort, visit]);
  const nearest = sorted[0];
  const cheapestNear = useMemo(
    () => (offers || []).filter((o) => o.distance <= 3 && o.price_toman != null && !o.price_flagged).sort((a, b) => a.price_toman - b.price_toman)[0],
    [offers],
  );
  const market = useMemo(() => marketOf(offers), [offers]);
  const images: string[] = p?.images?.length ? p.images : p?.image_url ? [p.image_url] : [];
  const sections = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const s of p?.specs || []) {
      const k = s.section || "مشخصات";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return [...m];
  }, [p]);

  async function askSeller(o: Row) {
    setAsking(o.offer_id);
    try {
      const r = await api("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerIds: [o.offer_id] }) });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      const res = j.results[0];
      setOffers((xs) => xs?.map((x) => (x.offer_id === o.offer_id ? { ...x, confirmed: res.confirmed, inquiry: res.inquiry } : x)) ?? xs);
      toast(
        res.outcome === "reused"
          ? res.confirmed
            ? "این فروشنده به تازگی جواب داده؛ جوابش را روی کارت می‌بینی."
            : "قبلاً از این فروشنده پرسیده شده؛ به‌محض جواب، همین‌جا نشان داده می‌شود."
          : res.outcome === "rate_limited"
            ? "این فروشنده امروز سؤال زیادی گرفته؛ فردا دوباره امتحان کن یا تماس بگیر."
            : "سؤالت برای فروشنده فرستاده شد؛ جوابش همین‌جا نشان داده می‌شود.",
      );
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "پرسش ارسال نشد.");
    } finally {
      setAsking(null);
    }
  }

  if (missing)
    return (
      <Shell>
        <main className="mx-auto max-w-xl px-4 py-20 text-center">
          <p className="text-lg font-bold">این کالا پیدا نشد</p>
          <Link href="/search" className="mt-4 inline-block text-tj">
            بازگشت به جست‌وجو
          </Link>
        </main>
      </Shell>
    );
  return (
    <Shell>
      <main className="mx-auto max-w-[1440px] px-3 pt-4 lg:px-8">
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-tj-muted" aria-label="مسیر">
          <Link href="/" className="hover:text-tj">ترب‌جو</Link>
          {p?.top && (
            <>
              <ChevronLeft size={13} />
              <Link href={categoryHref(p.top.id)} className="hover:text-tj">{p.top.name}</Link>
            </>
          )}
          {p?.sub && p?.top && (
            <>
              <ChevronLeft size={13} />
              <Link href={categoryHref(p.top.id, p.sub)} className="hover:text-tj">{p.sub}</Link>
            </>
          )}
          {p && (
            <>
              <ChevronLeft size={13} />
              <Link href={categoryHref("", "", p.category_name)} className="hover:text-tj">{p.category_name}</Link>
            </>
          )}
        </nav>

        <section className="grid gap-4 rounded-2xl border border-tj-line bg-white p-4 lg:grid-cols-[minmax(0,420px)_1fr] lg:p-6">
          <div>
            <div className="flex aspect-square items-center justify-center rounded-xl border border-tj-line bg-white p-4">
              {p ? <ProductImage src={images[image]} alt={p.persian_title} className="h-full w-full" iconSize={56} /> : <div className="size-full animate-pulse rounded-lg bg-tj-page" />}
            </div>
            {images.length > 1 && (
              <div className="tj-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((src, i) => (
                  <button key={src + i} onClick={() => setImage(i)} className={`size-16 shrink-0 rounded-lg border p-1 ${i === image ? "border-tj" : "border-tj-line"}`} aria-label={`تصویر ${i + 1}`}>
                    <ProductImage src={src} alt="" className="h-full w-full" iconSize={16} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0">
            {p ? (
              <>
                {p.brand_name && (
                  <Link href={`/search?brand=${encodeURIComponent(p.brand_name)}`} className="text-sm text-tj hover:underline">
                    {p.brand_name}
                  </Link>
                )}
                <h1 className="mt-1 text-xl font-bold leading-9 lg:text-2xl lg:leading-[1.7]">
                  <bdi>{p.persian_title}</bdi>
                </h1>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-tj-page p-4">
                    <p className="text-xs text-tj-muted">محدودهٔ قیمت در {num(p.offer_count)} فروشگاه</p>
                    <p className="mt-1 text-lg font-black">
                      {p.min_price != null ? toman(p.min_price) : "قیمت ثبت نشده"}
                      {p.max_price != null && p.max_price !== p.min_price && <span className="text-sm font-normal text-tj-muted"> تا {num(p.max_price)}</span>}
                    </p>
                    <p className="mt-1 text-[11px] text-tj-muted">آخرین به‌روزرسانی: {dateLabel(p.latest_price_at)}</p>
                  </div>
                  <div className="rounded-xl border border-tj-green/30 bg-[#f1faf4] p-4">
                    <p className="text-xs text-tj-green">ارزان‌ترین تا ۳ کیلومتری {origin.label}</p>
                    {offers === null ? (
                      <div className="mt-2 h-6 w-2/3 animate-pulse rounded bg-white" />
                    ) : cheapestNear ? (
                      <>
                        <p className="mt-1 text-lg font-black">{toman(cheapestNear.price_toman)}</p>
                        <p className="mt-1 truncate text-[11px] text-tj-muted">
                          {cheapestNear.shop_name} · {km(cheapestNear.distance)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-tj-muted">نزدیک تو فروشنده‌ای ثبت نشده؛ نزدیک‌ترین‌ها پایین هستند.</p>
                    )}
                  </div>
                </div>
                {market && <div className="mt-3"><PriceMeter m={market} mark={cheapestNear?.price_toman} /></div>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href="#sellers" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-tj px-5 py-3 font-bold text-white hover:bg-tj-dark sm:flex-none">
                    <Store size={18} />
                    مشاهدهٔ {num(offers?.length ?? p.offer_count)} فروشنده
                  </a>
                  <CompareToggle p={p} className="size-12 rounded-xl" />
                  <button
                    onClick={() => {
                      track({ type: "save", productId: id, category: p.category_name, brand: p.brand_name || undefined, price: p.min_price ?? undefined });
                      toast.success("به علاقه‌مندی‌هایت اضافه شد؛ پیشنهادهای مشابه بیشتری می‌بینی.");
                    }}
                    className="grid size-12 place-items-center rounded-xl border border-tj-line hover:border-tj hover:text-tj"
                    aria-label="پسندیدم"
                  >
                    <Heart size={19} />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(location.href);
                        toast.success("لینک کالا کپی شد.");
                      } catch {}
                    }}
                    className="grid size-12 place-items-center rounded-xl border border-tj-line hover:border-tj hover:text-tj"
                    aria-label="اشتراک‌گذاری"
                  >
                    <Share2 size={19} />
                  </button>
                </div>
                {p.sizes && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-bold">سایزهای ثبت‌شده</p>
                    <div className="flex flex-wrap gap-1.5">
                      {String(p.sizes)
                        .split("|")
                        .filter(Boolean)
                        .map((z) => (
                          <span key={z} className="min-w-9 rounded-lg border border-tj-line px-2 py-1 text-center text-sm">
                            {z === "FREE" ? "فری‌سایز" : z}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                {p.specs?.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-sm font-bold">ویژگی‌های اصلی</p>
                    <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      {p.specs
                        .filter((s: Row) => s.value != null && String(s.value).length < 60)
                        .slice(0, 8)
                        .map((s: Row, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-tj-muted">{s.key}:</span>
                            <bdi className="truncate">{String(s.value)}</bdi>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="h-6 w-3/4 animate-pulse rounded bg-tj-page" />
                <div className="h-24 animate-pulse rounded-xl bg-tj-page" />
                <div className="h-12 w-1/2 animate-pulse rounded-xl bg-tj-page" />
              </div>
            )}
          </div>
        </section>

        <section id="sellers" className="mt-5 scroll-mt-32 grid gap-4 lg:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border border-tj-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-tj-line p-4">
              <h2 className="font-bold">
                فروشندگان حضوری
                <span className="mr-2 text-xs font-normal text-tj-muted">تا ۳۰ کیلومتری {origin.label}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 rounded-lg bg-tj-page px-2 py-1 text-sm">
                <Clock size={14} className="text-tj" />
                <span className="text-tj-muted">زمان مراجعه:</span>
                <select value={visit} onChange={(e) => setVisit(e.target.value)} className="bg-transparent font-bold outline-none" aria-label="زمان مراجعه">
                  {VISITS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex rounded-lg bg-tj-page p-1 text-sm">
                {(
                  [
                    ["near", "نزدیک‌ترین"],
                    ["cheap", "ارزان‌ترین"],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} onClick={() => setSort(k)} className={`rounded-md px-3 py-1 ${sort === k ? "bg-white font-bold text-tj shadow-sm" : "text-tj-muted"}`}>
                    {label}
                  </button>
                ))}
              </div>
              </div>
            </div>
            {offers === null ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-tj-page" />
                ))}
              </div>
            ) : !sorted.length ? (
              <p className="p-6 text-sm text-tj-muted">فروشندهٔ حضوری‌ای برای این کالا در تهران ثبت نشده.</p>
            ) : (
              <ul className="divide-y divide-tj-line">
                {sorted.map((o, i) => {
                  const gone = o.confirmed?.available === false;
                  return (
                    <li key={o.offer_id} onMouseEnter={() => setActive(o.offer_id)} className={`p-4 ${gone ? "opacity-55" : ""}`}>
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold">{o.shop_name}</p>
                            {i === 0 && sort === "near" && !gone && <span className="rounded-md bg-tj-soft px-1.5 py-0.5 text-[11px] text-tj">نزدیک‌ترین</span>}
                            {o.torob_pay === "yes" && <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700">ترب‌پی</span>}
                          </div>
                          <p className="mt-1 text-xs leading-6 text-tj-muted">
                            {[o.building || o.hub_name, o.floor && `طبقهٔ ${o.floor}`, o.unit && `واحد ${o.unit}`].filter(Boolean).join(" · ") || o.address}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="flex items-center gap-1 text-tj-green">
                              <MapPin size={12} />
                              {km(o.distance)}
                            </span>
                            <Hours h={openAt(o)} when={visitLabel} />
                            {o.warranty && (
                              <span className="flex items-center gap-1 text-tj-muted">
                                <ShieldCheck size={12} />
                                {o.warranty}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-lg font-black">{toman(o.price_toman)}</p>
                          {o.confirmed && o.recorded_price != null && o.recorded_price !== o.price_toman && (
                            <p className="text-[11px] text-tj-muted line-through">{num(o.recorded_price)}</p>
                          )}
                          {(() => {
                            const tag = priceTag(o.price_toman, market);
                            return tag && <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] ${tag.tone}`}>{tag.text}</span>;
                          })()}
                        </div>
                      </div>
                      <div className="mt-2">
                        <SellerStatus o={o} />
                      </div>
                      {o.description && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-tj-muted">توضیحات فروشنده</summary>
                          <p className="mt-1 whitespace-pre-line rounded-lg bg-tj-page p-2 leading-6">{o.description}</p>
                        </details>
                      )}
                      {!gone && (
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          <button
                            disabled={planned.includes(o.offer_id)}
                            onClick={() => {
                              if (addToPlan({ ...o, title: p?.persian_title, image_url: p?.image_url })) {
                                setPlanned((x) => [...x, o.offer_id]);
                                track({ type: "save", productId: id });
                                toast.success("به برنامهٔ خریدت اضافه شد.");
                              }
                            }}
                            className="flex items-center gap-1 rounded-lg bg-tj px-3 py-1.5 text-white hover:bg-tj-dark disabled:bg-tj-green"
                          >
                            {planned.includes(o.offer_id) ? <Check size={15} /> : <Plus size={15} />}
                            {planned.includes(o.offer_id) ? "در برنامه" : "افزودن به برنامه"}
                          </button>
                          {!o.confirmed && o.inquiry?.status !== "pending" && (
                            <button disabled={asking === o.offer_id} onClick={() => askSeller(o)} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5 hover:border-tj hover:text-tj disabled:opacity-50">
                              {asking === o.offer_id ? <LoaderCircle size={15} className="animate-spin" /> : <MessageCircleQuestion size={15} />}
                              قیمت و موجودی را بپرس
                            </button>
                          )}
                          {o.phone && (
                            <a href={`tel:${o.phone}`} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5 hover:border-tj hover:text-tj">
                              <Phone size={15} /> تماس
                            </a>
                          )}
                          <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lon}`} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5 hover:border-tj hover:text-tj">
                            <Navigation size={15} /> مسیریابی
                          </a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="h-80 overflow-hidden rounded-2xl border border-tj-line lg:sticky lg:top-36 lg:h-[520px]">
            {offers && (
              <ShopMap
                hubs={sorted.slice(0, 30).map((o) => ({ ...o, name: o.shop_name, label: o.price_toman ? `${num(Math.round(o.price_toman / 1000))}هزار` : undefined }))}
                origin={origin}
                activeId={active ?? nearest?.offer_id}
                onSelect={(o) => document.getElementById("sellers")?.scrollIntoView({ behavior: "smooth" })}
              />
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-2xl border border-tj-line bg-white p-5 lg:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles size={18} className="text-tj" />
              معرفی و بررسی
            </h2>
            {!desc ? (
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-2 text-xs text-tj-muted">
                  <LoaderCircle size={13} className="animate-spin" /> در حال آماده‌سازی توضیحات از روی مشخصات کالا…
                </p>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-3 animate-pulse rounded bg-tj-page" style={{ width: `${95 - i * 12}%` }} />
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-5 text-[15px] leading-8">
                <p>{desc.intro}</p>
                {desc.highlights?.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-bold">نکات برجسته</h3>
                    <ul className="list-disc space-y-1 pr-5 marker:text-tj">
                      {desc.highlights.map((h: string, i: number) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {desc.good_for?.length > 0 && (
                    <div className="rounded-xl bg-[#f1faf4] p-4">
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-tj-green">
                        <ThumbsUp size={15} /> مناسب برای
                      </h3>
                      <ul className="space-y-1 text-sm leading-7">
                        {desc.good_for.map((h: string, i: number) => (
                          <li key={i}>• {h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {desc.consider?.length > 0 && (
                    <div className="rounded-xl bg-amber-50 p-4">
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-800">
                        <Info size={15} /> قبل از خرید در نظر بگیر
                      </h3>
                      <ul className="space-y-1 text-sm leading-7">
                        {desc.consider.map((h: string, i: number) => (
                          <li key={i}>• {h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {desc.checklist?.length > 0 && (
                  <div className="rounded-xl border border-tj-line p-4">
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
                      <ListChecks size={16} className="text-tj" /> چک‌لیست خرید حضوری
                    </h3>
                    <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                      {desc.checklist.map((h: string, i: number) => (
                        <li key={i} className="flex gap-2">
                          <Check size={15} className="mt-1 shrink-0 text-tj-green" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] text-tj-muted">
                  {desc.source === "ai" ? "این توضیحات را دستیار ترب‌جو فقط از روی مشخصات ثبت‌شدهٔ کالا نوشته است." : "خلاصه از روی مشخصات ثبت‌شده."}
                </p>
              </div>
            )}
          </div>
          <div className="self-start rounded-2xl border border-tj-line bg-white">
            <h2 className="border-b border-tj-line p-4 font-bold">مشخصات فنی</h2>
            {!p ? (
              <div className="h-40 animate-pulse" />
            ) : !sections.length ? (
              <p className="p-4 text-sm text-tj-muted">مشخصاتی برای این کالا ثبت نشده است.</p>
            ) : (
              <div className="p-4">
                {(allSpecs ? sections : sections.slice(0, 2)).map(([section, rows]) => (
                  <div key={section} className="mb-4 last:mb-0">
                    <p className="mb-1.5 text-sm font-bold text-tj">{section}</p>
                    <dl className="divide-y divide-tj-line text-sm">
                      {(allSpecs ? rows : rows.slice(0, 8)).map((s, i) => (
                        <div key={i} className="flex gap-3 py-2">
                          <dt className="w-2/5 shrink-0 text-tj-muted">{s.key}</dt>
                          <dd className="min-w-0 break-words">
                            <bdi>{s.value == null || s.value === "" ? "—" : String(s.value)}</bdi>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
                {(sections.length > 2 || sections.some(([, r]) => r.length > 8)) && (
                  <button onClick={() => setAllSpecs(!allSpecs)} className="mt-2 w-full rounded-lg bg-tj-page py-2 text-sm text-tj">
                    {allSpecs ? "نمایش کمتر" : `نمایش همهٔ ${num((p.specs || []).length)} مشخصه`}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">کالاهای مشابه نزدیک تو</h2>
          <div className="tj-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {(similar ?? Array.from({ length: 6 }, () => null)).map((s, i) => (
              <div key={s?.product_id ?? i} className="w-[180px] shrink-0 sm:w-[200px]">
                {s ? <ProductCard p={s} compact /> : <CardSkeleton compact />}
              </div>
            ))}
            {similar?.length === 0 && <p className="text-sm text-tj-muted">کالای مشابهی در نزدیکی پیدا نشد.</p>}
          </div>
        </section>
      </main>
      {p && (
        <AssistantDock
          page={{ kind: "product", productId: id }}
          intent={{ category: p.category_name, radius: 10 }}
          greeting={`دربارهٔ «${p.persian_title.slice(0, 50)}» بپرس: نزدیک‌ترین فروشنده، مقایسه با مدل‌های مشابه، یا اینکه قیمتش معقول است یا نه.`}
          onIntent={(intent) => router.push(`/search?${filtersToParams(intentToFilters(intent))}`)}
        />
      )}
    </Shell>
  );
}
