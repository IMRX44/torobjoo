"use client";
import dynamic from "next/dynamic";
import { Moon, Clock, MapPin, Navigation, Store, Truck, HelpCircle } from "lucide-react";
import { toman, km } from "@/components/tj/product-card";
import type { Row } from "@/lib/shopping";

const ShopMap = dynamic(() => import("@/components/shopping-map"), { ssr: false, loading: () => <div className="h-full animate-pulse bg-tj-page" /> });

const route = (p: Row) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
const chanceTone: Record<string, string> = {
  زیاد: "bg-[#e9f7ee] text-tj-green",
  متوسط: "bg-amber-50 text-amber-800",
  کم: "bg-tj-page text-tj-muted",
};

/**
 * "Night mode" answer: no registered shop open at the visit time → likely places not on Torob
 * (OpenStreetMap; stock unknown), the earliest-opening Torob shops, and fast-delivery shops.
 */
export default function NightCard({ b }: { b: Row }) {
  const { torob, likely } = b;
  const when = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(b.at));
  const points = [
    ...likely.map((l: Row) => ({ ...l, label: "احتمالی" })),
    ...torob.openNow.map((o: Row) => ({ ...o, name: o.shop_name, label: "ترب · باز" })),
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#2b2f45] bg-[#151827] text-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-white/10">
          <Moon size={18} className="text-amber-300" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">ساعت {when} {b.late ? "· حالت شب" : ""}</p>
          <p className="text-[11px] text-white/60">{b.product?.persian_title || b.leaf}</p>
        </div>
      </div>
      {points.length > 0 && (
        <div className="h-44 border-y border-white/10">
          <ShopMap hubs={points} origin={b.origin} />
        </div>
      )}
      <div className="space-y-3 bg-white p-3 text-tj-ink">
        {torob.openNow.length > 0 ? (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-tj-green">
              <Store size={14} /> فروشگاه‌های ترب که آن ساعت بازند
            </p>
            {torob.openNow.map((o: Row) => (
              <div key={o.offer_id} className="flex items-center gap-2 border-t border-tj-line py-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-bold">{o.shop_name}</span>
                <span className="text-tj-muted">{km(o.km)}</span>
                <b>{toman(o.price_toman)}</b>
              </div>
            ))}
          </section>
        ) : (
          <p className="rounded-xl bg-tj-soft px-3 py-2 text-xs leading-6 text-tj-dark">
            هیچ فروشگاه ثبت‌شده در ترب نزدیک تو آن ساعت باز نیست. این‌ها جاهایی‌اند که احتمالاً دارند:
          </p>
        )}
        {likely.length > 0 && (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
              <HelpCircle size={14} className="text-amber-600" /> جاهای احتمالی (خارج از ترب، موجودی نامعلوم)
            </p>
            {likely.map((l: Row) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-tj-line py-2 text-xs">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${chanceTone[l.chance]}`}>احتمال {l.chance}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{l.name}</span>
                <span className="text-tj-muted">{l.kind_fa}</span>
                <span className="flex items-center gap-1 text-tj-muted">
                  <MapPin size={11} /> {km(l.km)}
                </span>
                <span className={`flex items-center gap-1 ${l.open ? "text-tj-green" : "text-amber-700"}`}>
                  <Clock size={11} /> {l.hours}
                </span>
                <a href={route(l)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md border border-tj-line px-2 py-0.5 hover:border-tj hover:text-tj">
                  <Navigation size={11} /> مسیر
                </a>
              </div>
            ))}
          </section>
        )}
        {torob.soonest.length > 0 && (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold">
              <Clock size={14} className="text-tj" /> گزینهٔ مطمئن: زودترین فروشگاه‌های ترب که باز می‌شوند
            </p>
            {torob.soonest.map((o: Row) => (
              <div key={o.offer_id} className="flex flex-wrap items-center gap-2 border-t border-tj-line py-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-bold">{o.shop_name}</span>
                <span className="text-tj-muted">{o.hours.replace("بسته · ", "")}</span>
                <span className="text-tj-muted">{km(o.km)}</span>
                <b>{toman(o.price_toman)}</b>
              </div>
            ))}
          </section>
        )}
        {torob.express.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-tj-muted">
            <Truck size={13} /> ارسال سریع دارند: {torob.express.map((o: Row) => o.shop_name).join("، ")}
          </p>
        )}
        <p className="text-[10px] text-tj-muted">جاهای خارج از ترب از OpenStreetMap آمده‌اند؛ قبل از رفتن تماس بگیر.</p>
      </div>
    </div>
  );
}
