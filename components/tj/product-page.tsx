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
import SizeGuide from "@/components/tj/size-guide";
import { useApp, useDwell } from "@/components/tj/app-context";
import { categoryHref } from "@/components/tj/header";
import { addToPlan, getPlan } from "@/components/tj/plan";
import { useInquiryWatch } from "@/components/tj/use-inquiry-watch";
import { CompareToggle } from "@/components/tj/compare";
import { useRouter } from "next/navigation";
import { intentToFilters, filtersToParams } from "@/components/tj/search-page";
import { ageDays, ago, arrivalDate, dateLabel, hours, num, type Row } from "@/lib/shopping";

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
    <div>
      <div className="relative h-2 rounded-full bg-gradient-to-l from-tj/60 via-amber-200 to-tj-green/70" dir="ltr" title={`ارزان‌ترین ${num(m.min)} · گران‌ترین ${num(m.max)}`}>
        <span className="absolute inset-y-0 rounded-full border-2 border-white/90" style={{ left: at(m.p25), width: `calc(${at(m.p75)} - ${at(m.p25)})` }} />
        {mark != null && (
          <span className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-white bg-tj-ink shadow" style={{ left: at(Math.min(m.max, Math.max(m.min, mark))) }} />
        )}
      </div>
      <p className="mt-2 text-xs text-tj-muted">
        قیمت منصفانه بین <b className="text-tj-ink">{toman(m.p25)}</b> و <b className="text-tj-ink">{toman(m.p75)}</b> · {num(m.n)} فروشنده
      </p>
    </div>
  );
}

const TONE = { good: "bg-[#eaf7ef] text-tj-green", warn: "bg-amber-50 text-amber-800", bad: "bg-tj-soft text-tj", none: "bg-tj-page text-tj-muted" } as const;
/**
 * Price · stock · hours, each tagged fresh / stale / unknown. A recent seller answer is shared with
 * everyone (no need to ask again); old or missing data invites a question instead.
 */
function freshness(o: Row, open: string | undefined, when: string) {
  const c = o.confirmed,
    q = o.inquiry;
  const priceAge = ageDays(o.last_price_changed_at);
  const price: [keyof typeof TONE, string] = c && c.available !== false
    ? ["good", `قیمت تأییدشده · ${ago(c.at)}`]
    : o.price_flagged
      ? ["warn", "قیمت غیرعادی؛ احتمالاً به‌روز نیست"]
      : priceAge <= 7
        ? ["good", `قیمت تازه · ${ago(o.last_price_changed_at)}`]
        : priceAge <= 30
          ? ["none", `قیمت · ${ago(o.last_price_changed_at)}`]
          : ["warn", `قیمت قدیمی · ${ago(o.last_price_changed_at)}`];
  const stock: [keyof typeof TONE, string] = c
    ? c.available === false
      ? ["bad", `ناموجود · ${ago(c.at)}`]
      : ["good", `موجود · تأیید ${ago(c.at)}`]
    : q?.status === "pending"
      ? ["warn", q.reason === "price_check" ? "قیمت را از فروشنده پرسیده‌ایم" : "منتظر جواب فروشنده"]
      : ["none", "موجودی نامعلوم"];
  const hoursTag: [keyof typeof TONE, string] =
    open === "باز" ? ["good", `${when} باز است`] : open === "بسته" ? ["bad", `${when} بسته است`] : ["warn", "ساعت کاری ثبت نشده"];
  const recent = c && ageDays(c.at) < 1;
  const stale = !c && q?.status !== "pending" && (priceAge > 30 || open === "نامشخص");
  return { tags: [price, stock, hoursTag], recent, stale };
}
function Freshness({ o, open, when }: { o: Row; open?: string; when: string }) {
  const { tags, recent } = freshness(o, open, when);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(([tone, text]) => (
          <span key={text} className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${TONE[tone]}`}>
            {tone === "good" ? <BadgeCheck size={12} /> : tone === "warn" ? <AlertTriangle size={12} /> : <Clock size={12} />}
            {text}
          </span>
        ))}
        {o.confirmed?.simulated && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">پاسخ نمایشی</span>}
      </div>
      {recent && <p className="mt-1.5 text-[11px] text-tj-green">کسی {ago(o.confirmed.at)} از این فروشنده پرسید و جواب گرفت؛ لازم نیست دوباره بپرسی.</p>}
      {o.confirmed?.note && <p className="mt-1 text-[11px] text-tj-muted">«{o.confirmed.note}»</p>}
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
    [allSpecs, setAllSpecs] = useState(false),
    [allSellers, setAllSellers] = useState(false);

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
                <div className="mt-4 rounded-2xl bg-tj-page p-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-tj-muted">از</p>
                      <p className="text-2xl font-black">{p.min_price != null ? toman(p.min_price) : "قیمت ثبت نشده"}</p>
                      <p className="mt-0.5 text-[11px] text-tj-muted">
                        قیمت ثبت‌شده در {num(p.offer_count)} فروشگاه · {dateLabel(p.latest_price_at)}
                      </p>
                    </div>
                    {offers === null ? (
                      <div className="h-10 w-40 animate-pulse rounded-xl bg-white" />
                    ) : (
                      cheapestNear && (
                        <button onClick={() => { setActive(cheapestNear.offer_id); document.getElementById("sellers")?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-xl bg-white px-3 py-2 text-right shadow-sm hover:ring-1 hover:ring-tj-green">
                          <p className="text-[11px] text-tj-green">ارزان‌ترین نزدیک تو</p>
                          <p className="text-sm font-bold">
                            {toman(cheapestNear.price_toman)} <span className="font-normal text-tj-muted">· {km(cheapestNear.distance)}</span>
                          </p>
                        </button>
                      )
                    )}
                  </div>
                  {market && <div className="mt-4"><PriceMeter m={market} mark={cheapestNear?.price_toman} /></div>}
                </div>
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
                {p.top && (
                  <Link href={`/map?group=${p.top.id}`} className="mt-3 flex items-center justify-between rounded-xl border border-tj-line px-3 py-2 text-xs hover:border-tj">
                    <span>
                      <b className="text-tj">بورس {p.top.name}</b> کجاست؟ محله‌ها و پاساژهای پرفروشنده روی نقشه
                    </span>
                    <ChevronLeft size={15} className="text-tj" />
                  </Link>
                )}
                {p.features?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.features.map((x: Row) => (
                      <Link
                        key={x.key}
                        href={`/search?category=${encodeURIComponent(p.category_name)}&f=${encodeURIComponent(x.key + ":" + x.value)}&radius=10`}
                        className="rounded-full border border-tj-line px-3 py-1 text-xs hover:border-tj hover:text-tj"
                        title={`${num(x.count)} کالای دیگر با همین ویژگی`}
                      >
                        <span className="text-tj-muted">{x.key}</span> <bdi className="font-bold">{x.value}</bdi>
                      </Link>
                    ))}
                  </div>
                )}
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
                    <SizeGuide kind={/کفش|کتانی|صندل|دمپایی|بوت/.test(p.category_name + p.persian_title) ? "shoes" : "clothes"} sizes={String(p.sizes).split("|").filter(Boolean)} />
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
                {(allSellers ? sorted : sorted.slice(0, 6)).map((o, i) => {
                  const gone = o.confirmed?.available === false;
                  return (
                    <li key={o.offer_id} id={"o-" + o.offer_id} onMouseEnter={() => setActive(o.offer_id)} onClick={() => setActive(o.offer_id)} className={`scroll-mt-40 p-4 transition-colors ${(active ?? nearest?.offer_id) === o.offer_id ? "bg-tj-page/70" : ""} ${gone ? "opacity-55" : ""}`}>
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
                            {o.warranty && (
                              <span className="flex max-w-56 items-center gap-1 truncate text-tj-muted" title={o.warranty}>
                                <ShieldCheck size={12} className="shrink-0" />
                                <span className="truncate">{o.warranty}</span>
                              </span>
                            )}
                          </div>
                          <Freshness o={o} open={openAt(o)} when={visitLabel} />
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
                            <button disabled={asking === o.offer_id} onClick={() => askSeller(o)} className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 disabled:opacity-50 ${freshness(o, openAt(o), visitLabel).stale ? "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500" : "border-tj-line hover:border-tj hover:text-tj"}`}>
                              {asking === o.offer_id ? <LoaderCircle size={15} className="animate-spin" /> : <MessageCircleQuestion size={15} />}
                              بپرس موجود است؟
                            </button>
                          )}
                          {o.phone && (
                            <a href={`tel:${o.phone}`} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5 hover:border-tj hover:text-tj">
                              <Phone size={15} /> <span className="sr-only">تماس</span>
                            </a>
                          )}
                          <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lon}`} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5 hover:border-tj hover:text-tj">
                            <Navigation size={15} /> <span className="sr-only">مسیریابی</span>
                          </a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {sorted.length > 6 && (
              <button onClick={() => setAllSellers(!allSellers)} className="w-full border-t border-tj-line py-3 text-sm font-bold text-tj hover:bg-tj-page">
                {allSellers ? "نمایش کمتر" : `نمایش همهٔ ${num(sorted.length)} فروشنده`}
              </button>
            )}
          </div>
          <div className="sticky top-[104px] z-10 order-first h-52 overflow-hidden rounded-2xl border border-tj-line shadow-sm lg:order-none lg:sticky lg:top-36 lg:h-[520px] lg:shadow-none">
            {offers && (
              <ShopMap
                hubs={sorted.slice(0, 30).map((o) => ({ ...o, name: o.shop_name, label: o.price_toman ? `${num(Math.round(o.price_toman / 1000))}هزار` : undefined }))}
                origin={origin}
                activeId={active ?? nearest?.offer_id}
                onSelect={(o) => {
                  setActive(o.offer_id);
                  if (sorted.findIndex((x) => x.offer_id === o.offer_id) >= 6) setAllSellers(true);
                  setTimeout(() => document.getElementById("o-" + o.offer_id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                }}
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
