"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Check,
  Clock,
  Footprints,
  MapPin,
  Navigation,
  Phone,
  Route,
  Store,
  LoaderCircle,
  Map as MapIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Row, num, price } from "@/lib/shopping";
import ProductImage from "@/components/product-image";
const Map = dynamic(() => import("@/components/shopping-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-64 place-items-center text-sm text-stone-400">نقشه آماده می‌شود…</div>
  ),
});
export function HoursBadge({ hours }: { hours?: string }) {
  const tone =
    hours === "باز"
      ? "bg-emerald-50 text-emerald-700"
      : hours === "بسته"
        ? "bg-stone-100 text-stone-500"
        : "bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${tone}`}>
      <Clock size={11} />
      {hours === "باز" ? "الان باز است" : hours === "بسته" ? "الان بسته است" : "ساعت کاری نامشخص"}
    </span>
  );
}
export default function JourneyBoard({
  productId,
  intent,
  inquiries,
  plans,
  onReply,
  onSave,
  onUnavailable,
}: {
  productId?: string;
  intent: Row;
  inquiries: Row[];
  plans: Row[];
  onReply: (r: Row) => void;
  onSave: (r: Row) => void;
  onUnavailable: (offerId: string) => void;
}) {
  const [excluded, setExcluded] = useState<string[]>([]),
    [anchor, setAnchor] = useState(""),
    [visitProduct, setVisitProduct] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [journey, setJourney] = useState<Row | null>(null),
    [notice, setNotice] = useState(""),
    [mapOpen, setMapOpen] = useState(false),
    [mapShop, setMapShop] = useState<Row | null>(null);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("torobgard-journey-v1") || "{}");
      setExcluded(s.excluded || []);
      setAnchor(s.anchor || "");
      setVisitProduct(s.visitProduct || "");
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("torobgard-journey-v1", JSON.stringify({ excluded, anchor, visitProduct }));
      } catch {}
  }, [ready, excluded, anchor, visitProduct]);
  const relevant = inquiries.filter((r) => r.productId === productId);
  // Only settled replies change the ranking; avoids refetching on every "contacting" tick.
  const settled = JSON.stringify(
    relevant.filter((r) => r.state !== "contacting").map((r) => [r.offerId, r.availability, r.isSimulated]),
  );
  useEffect(() => {
    if (!productId || !ready) {
      setJourney(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/journey/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        intent,
        excluded,
        anchorId: anchor || undefined,
        inquiries: relevant
          .filter((r) => r.state !== "contacting")
          .map((r) => ({ offerId: r.offerId, productId: r.productId, availability: r.availability, isSimulated: r.isSimulated })),
      }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setJourney(j))
      .catch(() => {})
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, ready, JSON.stringify(intent), excluded, anchor, settled]);
  const current = journey?.primary;
  const points = useMemo(
    () => (current ? [current, ...(journey?.backups || [])].map((o: Row) => ({ ...o.shop, name: o.shop.name })) : []),
    [journey, current],
  );
  const onMarker = useCallback((shop: Row) => setMapShop(shop), []);
  async function replacement(retry = false) {
    if (busy || !productId) return;
    const oldId = retry ? anchor : current?.offer_id;
    if (!oldId) return;
    const blocked = Array.from(
      new Set([
        ...excluded,
        oldId,
        ...relevant.filter((x) => x.availability === "unavailable").map((x) => x.offerId),
      ]),
    );
    setExcluded(blocked);
    if (!retry) onUnavailable(oldId);
    setAnchor(oldId);
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, anchorId: oldId, excluded: blocked, intent }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "بررسی انجام نشد");
      if (result.empty) setNotice(result.message);
      else {
        onReply({ ...result.reply, sameHub: result.sameHub, replacedOfferId: oldId, offer: result.offer });
        setNotice(
          result.sameHub
            ? "جایگزین در همان مرکز پیدا شد و از فروشنده‌اش پرسیدیم؛ جوابش همین‌جا نشان داده می‌شود."
            : "در همان مرکز گزینه‌ای نمانده بود؛ نزدیک‌ترین فروشندهٔ بعدی را پیشنهاد دادیم و از او پرسیدیم.",
        );
      }
    } catch {
      setNotice("بررسی جایگزین انجام نشد. دوباره تلاش کن؛ محدودیت‌های خریدت حفظ شده‌اند.");
    } finally {
      setBusy(false);
    }
  }
  const saved = (id?: string) => plans.some((p) => p.offer_id === id);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-stone-500">از انتخاب تا رسیدن</p>
          <h2 className="mt-1 text-lg font-bold">سفر خریدت</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl border bg-white text-[#d73948]">
          <Route size={20} />
        </span>
      </div>
      {!productId && (
        <div className="overflow-hidden rounded-3xl border border-[#ebe7df] bg-white">
          <div className="bg-gradient-to-bl from-[#fff3f1] to-[#f3f5ee] p-5">
            <p className="font-bold leading-8">مدلت را انتخاب کن؛ بقیهٔ مسیر را با هم می‌چینیم.</p>
          </div>
          <ol className="space-y-4 p-5">
            {[
              ["مدلت را پیدا می‌کنیم", "بر اساس نیاز و بودجهٔ تو"],
              ["پیش از رفتن بررسی می‌کنیم", "قیمت ثبت‌شده، فاصله و ساعت کاری"],
              ["یک جایگزین همراهت می‌ماند", "اول همان مرکز خرید، بعد نزدیک‌ترین"],
            ].map(([title, sub], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">
                  {num(i + 1)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {productId && !journey && loading && (
        <div className="space-y-3" aria-busy>
          <div className="h-16 animate-pulse rounded-2xl bg-white" />
          <div className="h-72 animate-pulse rounded-3xl bg-white" />
        </div>
      )}
      {journey && (
        <>
          <div className="flex items-center gap-3 rounded-2xl border bg-white p-3">
            <ProductImage src={journey.product.image_url} alt="" className="size-12 shrink-0" iconSize={20} />
            <div className="min-w-0">
              <span className="text-[11px] text-stone-500">انتخاب این سفر</span>
              <p className="line-clamp-2 text-sm leading-6">
                <bdi>{journey.product.persian_title}</bdi>
              </p>
            </div>
          </div>
          {busy && (
            <div role="status" className="flex gap-2 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-700">
              <LoaderCircle className="shrink-0 animate-spin" size={18} />
              دارم جایگزین نزدیک را بررسی می‌کنم…
            </div>
          )}
          {notice && (
            <p role="status" className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-7 text-emerald-800">
              {notice}
              {notice.includes("دوباره") && (
                <button className="mr-2 underline" onClick={() => replacement(true)}>
                  تلاش دوباره
                </button>
              )}
            </p>
          )}
          {current ? (
            <>
              <article className="overflow-hidden rounded-3xl border border-[#dbdfd4] bg-white shadow-[0_6px_30px_#292c2c0a]">
                <div className="flex items-center justify-between bg-[#f0f5ef] px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#39644a]">
                    <Navigation size={15} />
                    پیشنهاد اول برای تو
                  </span>
                  <span className="text-[11px] text-[#557060]">
                    {current.positive ? "فروشنده گفته دارد" : "موجودی تأیید نشده"}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-bold">{current.shop.name}</h3>
                  <p className="mt-2 flex items-start gap-1 text-sm leading-6 text-stone-600">
                    <MapPin size={15} className="mt-1 shrink-0 text-stone-400" />
                    <span>
                      {current.shop.address || current.hub?.name || current.shop.location_label}
                    </span>
                  </p>
                  <div className="mt-2">
                    <HoursBadge hours={current.hours} />
                  </div>
                  <div className="my-5 grid grid-cols-2 divide-x divide-x-reverse rounded-2xl bg-[#faf9f6] py-3 text-center">
                    <div>
                      <strong>{num(current.distance.toFixed(1))}</strong>
                      <span className="mr-1 text-xs text-stone-500">کیلومتر</span>
                      <p className="mt-1 text-[11px] text-stone-500">فاصلهٔ مستقیم</p>
                    </div>
                    <div>
                      <strong>{num(current.options)}</strong>
                      <span className="mr-1 text-xs text-stone-500">جایگزین</span>
                      <p className="mt-1 text-[11px] text-stone-500">در همین مرکز</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500">قیمت ثبت‌شده (قطعی نیست)</p>
                  <p className="mt-1 text-xl font-black tracking-tight">{price(current.price_toman)}</p>
                  {current.warranty && <p className="mt-1 text-xs text-stone-500">گارانتی: {current.warranty}</p>}
                  <button
                    disabled={saved(current.offer_id) || busy}
                    onClick={() => onSave(current)}
                    className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#d73948] px-3 text-sm font-semibold text-white transition hover:bg-[#b82c3c] disabled:bg-emerald-700"
                  >
                    {saved(current.offer_id) ? (
                      <>
                        <Check size={16} />
                        در برنامه‌ات ذخیره شد
                      </>
                    ) : (
                      <>
                        ذخیرهٔ این مقصد
                        <ArrowLeft size={16} />
                      </>
                    )}
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMapOpen(true)}
                      className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-sm hover:bg-stone-50"
                    >
                      <MapIcon size={15} />
                      نقشه
                    </button>
                    {current.phone ? (
                      <a
                        href={`tel:${current.phone}`}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-sm hover:bg-stone-50"
                      >
                        <Phone size={15} />
                        تماس
                      </a>
                    ) : (
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${current.shop.lat},${current.shop.lon}`}
                        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-sm hover:bg-stone-50"
                      >
                        <Navigation size={15} />
                        مسیریابی
                      </a>
                    )}
                  </div>
                </div>
              </article>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold">اگر اینجا نشد…</h3>
                  <span className="text-[11px] text-stone-500">از قبل آماده است</span>
                </div>
                {journey.backups.length ? (
                  journey.backups.map((o: Row) => (
                    <div key={o.offer_id} className="mb-2 flex gap-3 rounded-2xl border bg-white p-4">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-50 text-stone-500">
                        <Store size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{o.shop.name}</p>
                          <p className="shrink-0 text-sm font-bold">{price(o.price_toman)}</p>
                        </div>
                        <p className="mt-1 text-xs text-stone-500">
                          {o.sameHub ? "در همین مرکز خرید" : `${num(o.fromPrimary.toFixed(1))} کیلومتر از مقصد اول`}
                        </p>
                        <p className="mt-2 text-xs text-amber-700">
                          {o.positive ? "فروشنده گفته دارد" : "پیشنهاد ثبت‌شده؛ موجودی تأیید نشده"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed p-4 text-sm leading-7 text-stone-500">
                    در شرایط فعلی جایگزین دیگری نداریم. برای گزینهٔ بیشتر، بودجه یا شعاع را بیشتر کن.
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-dashed border-stone-300 p-4">
                {visitProduct === productId ? (
                  <>
                    <p className="mb-3 text-sm font-semibold">داخل مرکز خریدی؛ همراهت هستم.</p>
                    <button
                      disabled={busy}
                      onClick={() => replacement()}
                      className="min-h-11 w-full rounded-xl bg-stone-800 px-3 text-sm text-white disabled:opacity-50"
                    >
                      اینجا تمام شده؛ جایگزین را بررسی کن
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setVisitProduct(productId || "")}
                    className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold"
                  >
                    <Footprints size={17} />
                    به مقصد رسیدم
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border bg-white p-5 text-sm leading-8">
              در این بودجه و شعاع فروشندهٔ دیگری باقی نمانده. بودجه یا شعاع را تغییر بده تا دوباره بررسی کنیم.
            </div>
          )}
          {relevant.length > 0 && (
            <details className="rounded-2xl border bg-white p-4">
              <summary className="cursor-pointer text-sm text-stone-600">
                پرسش از فروشنده‌ها ({num(relevant.length)})
              </summary>
              {relevant.map((r) => (
                <div key={r.id} className="mt-4 border-t pt-3 text-sm leading-7">
                  <b>{r.shopName}</b>
                  <p className="text-[11px] text-stone-500">
                    {r.state === "replied" ? "جواب فروشنده" : r.state === "rate_limited" ? "بعداً پرسیده می‌شود" : "پیام فرستاده شد"} ·{" "}
                    {new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(r.timestamp))}
                  </p>
                  <p className="text-stone-600">{r.question}</p>
                  <p className="mt-2 rounded-lg bg-stone-50 p-2">
                    {r.state === "replied" ? (r.availability === "available" ? `دارد${r.price ? ` · ${num(r.price)} تومان` : ""}` : r.availability === "unavailable" ? "ندارد" : "جواب نامشخص") : r.state === "rate_limited" ? "این فروشنده امروز پیام زیادی گرفته" : "منتظر جواب فروشنده…"}
                  </p>
                </div>
              ))}
            </details>
          )}
        </>
      )}
      <Link
        href="/catalog?view=plan"
        className="flex min-h-12 items-center justify-between rounded-2xl bg-[#e9e8e2] px-4 text-sm transition hover:bg-[#e2e0d8]"
      >
        <span>برنامهٔ من · {num(plans.length)} توقف</span>
        <ArrowLeft size={15} />
      </Link>
      <p className="px-1 text-[11px] leading-6 text-stone-500">
        برنامه روی همین دستگاه ذخیره می‌شود · جواب فروشنده‌ها از پنل خودشان می‌آید؛ اگر جواب نیامده، قبل از رفتن تماس بگیر.
      </p>
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent dir="rtl" className="max-h-[85dvh] overflow-auto rounded-3xl sm:max-w-2xl">
          <DialogTitle>یک مقصد، چند انتخاب نزدیک</DialogTitle>
          <p className="text-sm leading-6 text-stone-500">
            نشانگرها موقعیت ثبت‌شدهٔ فروشگاه‌ها هستند؛ خط مسیر نمایش داده نمی‌شود.
          </p>
          <div className="h-72 overflow-hidden rounded-2xl">
            <Map hubs={points} onSelect={onMarker} />
          </div>
          {mapShop && (
            <p className="text-sm">
              {mapShop.name} · {mapShop.address}
            </p>
          )}
          {current && (
            <a
              className="block rounded-xl bg-[#d73948] p-3 text-center text-sm text-white"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${current.shop.lat},${current.shop.lon}`}
            >
              مسیریابی تا {current.shop.name}
            </a>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
