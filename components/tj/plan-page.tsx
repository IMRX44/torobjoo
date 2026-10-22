"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Building2, Route, Phone, Navigation, Trash2, ArrowUp, CheckCircle2, ShoppingBag, BadgeCheck, LoaderCircle } from "lucide-react";
import Shell from "@/components/tj/shell";
import ProductImage from "@/components/product-image";
import { toman, km } from "@/components/tj/product-card";
import { useApp } from "@/components/tj/app-context";
import { getPlan, savePlan } from "@/components/tj/plan";
import { useInquiryWatch } from "@/components/tj/use-inquiry-watch";
import { distance, dateLabel, num, type Row } from "@/lib/shopping";

const ShopMap = dynamic(() => import("@/components/shopping-map"), { ssr: false, loading: () => <div className="h-full animate-pulse bg-tj-page" /> });

export default function PlanPage() {
  const { origin } = useApp();
  const [plan, setPlan] = useState<Row[]>([]);
  useEffect(() => {
    setPlan(getPlan());
    const sync = () => setPlan(getPlan());
    window.addEventListener("tj-plan", sync);
    return () => window.removeEventListener("tj-plan", sync);
  }, []);
  // Latest seller answers for the planned stops, live while any question is pending.
  const status = useInquiryWatch(
    plan.map((s) => s.offer_id),
    Object.fromEntries(plan.map((s) => [s.offer_id, s.shop_name])),
  );
  // «یک‌جا بخر»: shopping centres where one visit covers most planned products.
  const productIds = [...new Set(plan.map((s) => s.product_id))];
  const [onestop, setOnestop] = useState<Row[] | null>(null);
  useEffect(() => {
    if (productIds.length < 2) return setOnestop(null);
    fetch(`/api/onestop?products=${productIds.join(",")}&lat=${origin.lat}&lon=${origin.lon}`)
      .then((r) => r.json())
      .then((j) => setOnestop(j.hubs || []))
      .catch(() => setOnestop([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIds.join(","), origin.lat, origin.lon]);
  function applyHub(h: Row) {
    const covered = new Set(h.offers.map((o: Row) => o.product_id));
    const keep = plan.filter((s) => !covered.has(s.product_id));
    update([
      ...h.offers.map((o: Row) => ({
        offer_id: o.offer_id,
        product_id: o.product_id,
        shop_id: o.shop_id,
        price_toman: o.price_toman,
        lat: o.lat,
        lon: o.lon,
        shop_name: o.shop_name,
        address: o.address,
        building: o.building,
        floor: o.floor,
        unit: o.unit,
        phone: o.phone,
        image_url: o.image_url,
        title: o.title,
        status: "planned",
        addedAt: new Date().toISOString(),
      })),
      ...keep,
    ]);
  }
  const currentTotal = plan.reduce((s, x) => s + (x.price_toman || 0), 0);
  const update = (next: Row[]) => {
    setPlan(next);
    savePlan(next);
  };
  // Visit order that walks outward from the buyer: nearest stop first, then nearest to it.
  function optimize() {
    const left = [...plan],
      out: Row[] = [];
    let at: Row = origin;
    while (left.length) {
      left.sort((a, b) => distance(at, a) - distance(at, b));
      at = left.shift()!;
      out.push(at);
    }
    update(out);
  }
  const route = useMemo(() => {
    if (!plan.length) return "";
    const pts = plan.filter((s) => s.lat).map((s) => `${s.lat},${s.lon}`);
    return `https://www.google.com/maps/dir/${origin.lat},${origin.lon}/${pts.join("/")}`;
  }, [plan, origin]);
  return (
    <Shell>
      <main className="mx-auto max-w-[1200px] px-3 pt-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black">
              <Route className="text-tj" /> برنامهٔ خرید من
            </h1>
            <p className="mt-1 text-sm text-tj-muted">{num(plan.length)} توقف · روی همین دستگاه ذخیره می‌شود</p>
          </div>
          {plan.length > 1 && (
            <div className="flex gap-2">
              <button onClick={optimize} className="rounded-xl border border-tj-line bg-white px-4 py-2 text-sm hover:border-tj">
                مرتب‌سازی از نزدیک‌ترین
              </button>
              <a href={route} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-tj px-4 py-2 text-sm text-white">
                <Navigation size={15} /> مسیر کامل روی نقشه
              </a>
            </div>
          )}
        </div>
        {!plan.length ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-tj-line bg-white p-12 text-center">
            <ShoppingBag size={48} className="text-tj-muted" />
            <p className="mt-4 font-bold">هنوز توقفی اضافه نکرده‌ای</p>
            <p className="mt-1 text-sm text-tj-muted">در صفحهٔ هر کالا، کنار فروشنده «افزودن به برنامه» را بزن.</p>
            <Link href="/search" className="mt-5 rounded-xl bg-tj px-5 py-2.5 text-sm text-white">
              گشتن در کالاها
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_420px]">
            <div className="space-y-3">
            {onestop && onestop.length > 0 && (
              <section className="rounded-2xl border border-tj/25 bg-gradient-to-l from-tj-soft to-white p-4">
                <h2 className="flex items-center gap-2 font-bold">
                  <Building2 size={18} className="text-tj" /> یک‌جا بخر
                </h2>
                <p className="mt-1 text-xs text-tj-muted">به‌جای چند مقصد، پاساژهایی که بیشترِ کالاهای برنامه‌ات را با هم دارند:</p>
                <ul className="mt-3 space-y-2">
                  {onestop.slice(0, 3).map((h) => (
                    <li key={h.hub_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{h.name}</p>
                        <p className="text-xs text-tj-muted">
                          {num(h.covered)} از {num(productIds.length)} کالا · مجموع {toman(h.total)} · {km(h.km)}
                          {h.missing?.length ? ` · ندارد: ${h.missing.slice(0, 2).join("، ")}` : ""}
                        </p>
                        {h.covered === productIds.length && currentTotal > 0 && (
                          <p className={`mt-0.5 text-xs ${h.total <= currentTotal ? "text-tj-green" : "text-amber-700"}`}>
                            {h.total <= currentTotal ? `${toman(currentTotal - h.total)} ارزان‌تر از برنامهٔ فعلی، با یک مقصد` : `${toman(h.total - currentTotal)} گران‌تر، ولی همه در یک‌جا`}
                          </p>
                        )}
                      </div>
                      <button onClick={() => applyHub(h)} className="rounded-lg bg-tj px-3 py-2 text-xs text-white hover:bg-tj-dark">
                        برنامه را به این پاساژ ببر
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <ol className="space-y-3">
              {plan.map((s, i) => {
                const st = status[s.offer_id];
                return (
                  <li key={s.offer_id} className={`rounded-2xl border bg-white p-4 ${s.status === "visited" ? "border-tj-green/40" : "border-tj-line"}`}>
                    <div className="flex gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tj text-sm font-bold text-white">{num(i + 1)}</span>
                      <ProductImage src={s.image_url} alt="" className="size-14 shrink-0 rounded-lg border border-tj-line p-1" iconSize={18} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/p/${s.product_id}`} className="line-clamp-1 text-sm font-bold hover:text-tj">
                          {s.title}
                        </Link>
                        <p className="mt-0.5 text-sm">{s.shop_name}</p>
                        <p className="text-xs text-tj-muted">
                          {[s.building, s.floor && `طبقهٔ ${s.floor}`, s.unit && `واحد ${s.unit}`].filter(Boolean).join(" · ") || s.address} · {km(distance(origin, s))}
                        </p>
                        <p className="mt-1 text-xs">
                          {st?.confirmed ? (
                            <span className={`flex items-center gap-1 ${st.confirmed.available === false ? "text-tj" : "text-tj-green"}`}>
                              <BadgeCheck size={13} />
                              {st.confirmed.available === false ? "فروشنده گفت ندارد؛ جایگزین پیدا کن" : `فروشنده تأیید کرد${st.confirmed.price ? ` · ${toman(st.confirmed.price)}` : ""}`}
                              {st.confirmed.simulated && <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-800">نمایشی</span>}
                            </span>
                          ) : st?.inquiry?.status === "pending" ? (
                            <span className="flex items-center gap-1 text-amber-700">
                              <LoaderCircle size={12} className="animate-spin" /> منتظر جواب فروشنده
                            </span>
                          ) : (
                            <span className="text-tj-muted">قیمت ثبت‌شده: {toman(s.price_toman)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5">
                          <Phone size={13} /> تماس
                        </a>
                      )}
                      <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5">
                        <Navigation size={13} /> مسیریابی
                      </a>
                      <button onClick={() => update(plan.map((x) => (x.offer_id === s.offer_id ? { ...x, status: x.status === "visited" ? "planned" : "visited" } : x)))} className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 ${s.status === "visited" ? "border-tj-green text-tj-green" : "border-tj-line"}`}>
                        <CheckCircle2 size={13} /> {s.status === "visited" ? "سر زدم" : "علامت: سر زدم"}
                      </button>
                      {i > 0 && (
                        <button
                          onClick={() => {
                            const a = [...plan];
                            [a[i - 1], a[i]] = [a[i], a[i - 1]];
                            update(a);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5"
                        >
                          <ArrowUp size={13} /> جلوتر
                        </button>
                      )}
                      <button onClick={() => update(plan.filter((x) => x.offer_id !== s.offer_id))} className="mr-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-tj-muted hover:text-tj">
                        <Trash2 size={13} /> حذف
                      </button>
                    </div>
                    {s.addedAt && <p className="mt-2 text-[11px] text-tj-muted">اضافه شده: {dateLabel(s.addedAt)}</p>}
                  </li>
                );
              })}
            </ol>
            </div>
            <div className="h-96 overflow-hidden rounded-2xl border border-tj-line lg:sticky lg:top-36 lg:h-[560px]">
              <ShopMap hubs={plan.map((s, i) => ({ ...s, name: `${i + 1}. ${s.shop_name}`, label: num(i + 1) }))} origin={origin} />
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}
