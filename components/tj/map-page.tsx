"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Store, Navigation, ArrowLeft, Crosshair, Flame } from "lucide-react";
import Shell from "@/components/tj/shell";
import { km, toman } from "@/components/tj/product-card";
import { useApp } from "@/components/tj/app-context";
import { ICONS, useTaxonomy } from "@/components/tj/taxonomy";
import { distance, num, type Row } from "@/lib/shopping";

const ShopMap = dynamic(() => import("@/components/shopping-map"), { ssr: false, loading: () => <div className="h-full animate-pulse bg-tj-page" /> });

/**
 * The main map. Two views on one full-screen map:
 * - «پاساژهای نزدیک»: shopping centres around the buyer.
 * - «بورسِ» a category: the neighbourhoods where most of its sellers are, as ranked areas.
 * Swiping the cards (or tapping a pin) flies the map there and draws the way from the buyer.
 */
export default function MapPage() {
  const { origin, locate } = useApp();
  const params = useSearchParams();
  const tops = useTaxonomy();
  const [group, setGroup] = useState<string>(params.get("group") || ""),
    [hubs, setHubs] = useState<Row[]>([]),
    [bazaar, setBazaar] = useState<{ title: string; areas: Row[] } | null>(null),
    [active, setActive] = useState<string>(),
    [height, setHeight] = useState<number>();
  const box = useRef<HTMLDivElement>(null),
    rail = useRef<HTMLDivElement>(null);

  // Fill the screen between the header and the bottom bar.
  useLayoutEffect(() => {
    const fit = () => {
      const top = box.current?.getBoundingClientRect().top ?? 0;
      setHeight(innerHeight - top - (innerWidth < 1024 ? 56 : 0));
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    fetch("/api/hubs")
      .then((r) => r.json())
      .then(setHubs)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setActive(undefined);
    setBazaar(null);
    if (!group) return;
    fetch(`/api/bazaar?group=${encodeURIComponent(group)}&lat=${origin.lat}&lon=${origin.lon}`)
      .then((r) => r.json())
      .then((j) => setBazaar(j.areas ? j : { title: "", areas: [] }))
      .catch(() => setBazaar({ title: "", areas: [] }));
    rail.current?.scrollTo({ left: 0 });
  }, [group, origin.lat, origin.lon]);

  const near = useMemo(
    () =>
      hubs
        .filter((h) => h.kind === "building" && h.shop_count >= 8)
        .map((h): Row => ({ ...h, km: distance(origin, h) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 12),
    [hubs, origin],
  );
  const zones = useMemo(
    () =>
      (bazaar?.areas || []).map((a, i): Row => ({
        ...a,
        zone_id: "z" + i,
        rank: num(i + 1),
        sub: `${num(a.shops)} فروشگاه`,
      })),
    [bazaar],
  );
  const cards = group ? zones : near;
  const idOf = (c: Row) => c.zone_id || c.hub_id;

  // The card that is centred in the rail is the active one, so swiping moves the map.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        const e = es.filter((x) => x.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (e) setActive((e.target as HTMLElement).dataset.id);
      },
      { root: el, threshold: [0.75] },
    );
    el.querySelectorAll("[data-id]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [cards]);
  const focus = (id: string) => {
    setActive(id);
    rail.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };
  const topName = tops.find((t) => t.id === group)?.name;

  return (
    <Shell footer={false}>
      <main ref={box} className="relative overflow-hidden" style={{ height: height ?? "70dvh" }}>
        <div className="absolute inset-0">
          <ShopMap hubs={cards} origin={origin} activeId={active} onSelect={(c) => focus(idOf(c))} insets={{ top: 70, bottom: 270 }} />
        </div>

        {/* Category chips: switch between nearby centres and each category's «بورس». */}
        <div className="tj-no-scrollbar absolute inset-x-0 top-0 z-[500] flex gap-2 overflow-x-auto px-3 pb-6 pt-3" style={{ background: "linear-gradient(#f5f5f5ee, #f5f5f500)" }}>
          <button onClick={() => setGroup("")} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-sm ${!group ? "bg-tj-ink text-white" : "bg-white text-tj-ink"}`}>
            <Store size={14} /> پاساژهای نزدیک
          </button>
          {tops.map((t) => {
            const Icon = ICONS[t.id] || Flame;
            return (
              <button key={t.id} onClick={() => setGroup(t.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-sm ${group === t.id ? "bg-tj text-white" : "bg-white text-tj-ink"}`}>
                <Icon size={14} /> {t.name}
              </button>
            );
          })}
        </div>

        <button onClick={() => locate()} className="absolute left-3 top-16 z-[500] grid size-10 place-items-center rounded-xl bg-white shadow-md" aria-label="موقعیت من">
          <Crosshair size={18} className="text-[#2f80ed]" />
        </button>

        {/* Bottom sheet: what you are looking at, then swipeable cards. */}
        <div className="absolute inset-x-0 bottom-0 z-[500] pb-3" style={{ background: "linear-gradient(#f5f5f500, #f5f5f5f0 40%)" }}>
          <div className="mx-4 mb-2 mt-6 inline-block max-w-[calc(100%-2rem)] rounded-2xl bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <p className="flex items-center gap-1.5 text-sm font-black">
              {group ? (
                <>
                  <Flame size={16} className="text-tj" /> بورس {topName || bazaar?.title} در تهران
                </>
              ) : (
                <>پاساژهای نزدیک {origin.label}</>
              )}
            </p>
            <p className="text-[11px] text-tj-muted">
              {group ? "محله‌هایی که بیشترین فروشندهٔ حضوری این دسته را دارند؛ ورق بزن تا روی نقشه ببینی" : "ورق بزن یا روی پین بزن؛ مسیر از جای تو کشیده می‌شود"}
            </p>
          </div>
          <div ref={rail} className="tj-no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1">
            {group && !bazaar
              ? [0, 1].map((i) => <div key={i} className="h-36 w-[82%] max-w-sm shrink-0 animate-pulse rounded-2xl bg-white" />)
              : cards.map((c, i) => {
                  const id = idOf(c);
                  const on = id === active;
                  return (
                    <div
                      key={id}
                      data-id={id}
                      onClick={() => focus(id)}
                      className={`w-[82%] max-w-sm shrink-0 snap-center rounded-2xl bg-white p-4 shadow-lg transition ${on ? "ring-2 ring-tj" : "ring-1 ring-black/5"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black ${group ? "bg-tj text-white" : "bg-tj-soft text-tj"}`}>
                          {group ? num(i + 1) : <Store size={18} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{group ? `محلهٔ ${c.name}` : c.name}</p>
                          <p className="truncate text-xs text-tj-muted">
                            {group ? `${num(c.shops)} فروشگاه${c.min_price ? ` · از ${toman(c.min_price)}` : ""}` : `${num(c.shop_count)} فروشگاه · ${(c.top_categories || []).slice(0, 2).join("، ")}`}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-tj-green">{km(group ? c.km : c.km)}</span>
                      </div>
                      {group && c.hubs?.length > 0 && (
                        <div className="tj-no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                          {c.hubs.map((h: Row) => (
                            <Link key={h.hub_id} href={`/search?hub=${h.hub_id}&group=${group}`} onClick={(e) => e.stopPropagation()} className="shrink-0 rounded-full bg-tj-page px-2.5 py-1 text-[11px] hover:text-tj">
                              {h.name} · {num(h.shops)}
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex gap-2 text-xs">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-tj-line py-2 hover:border-tj"
                        >
                          <Navigation size={14} /> مسیریابی
                        </a>
                        <Link
                          href={group ? `/search?hub=${c.hubs?.[0]?.hub_id || ""}&group=${group}` : `/search?hub=${c.hub_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-tj py-2 font-bold text-white hover:bg-tj-dark"
                        >
                          {group ? "کالاهای این بورس" : "فروشگاه‌ها و کالاها"} <ArrowLeft size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
            {group && bazaar && !cards.length && <p className="rounded-2xl bg-white p-4 text-sm text-tj-muted shadow">برای این دسته فروشندهٔ حضوری کافی ثبت نشده.</p>}
          </div>
        </div>
      </main>
    </Shell>
  );
}
