"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Store, MapPin, Search } from "lucide-react";
import Shell from "@/components/tj/shell";
import { km } from "@/components/tj/product-card";
import { useApp } from "@/components/tj/app-context";
import { distance, norm, num, type Row } from "@/lib/shopping";

const ShopMap = dynamic(() => import("@/components/shopping-map"), { ssr: false, loading: () => <div className="h-full animate-pulse bg-tj-page" /> });

export default function MapPage() {
  const { origin, locate } = useApp();
  const router = useRouter();
  const [hubs, setHubs] = useState<Row[]>([]),
    [q, setQ] = useState(""),
    [kind, setKind] = useState<"building" | "all">("building"),
    [active, setActive] = useState<string>();
  useEffect(() => {
    fetch("/api/hubs")
      .then((r) => r.json())
      .then(setHubs)
      .catch(() => {});
  }, []);
  const list = useMemo(
    () =>
      hubs
        .filter((h) => (kind === "all" || h.kind === "building") && (!q || norm(h.name + " " + (h.top_categories || []).join(" ")).includes(norm(q))))
        .map((h): Row => ({ ...h, km: distance(origin, h) }))
        .sort((a, b) => a.km - b.km),
    [hubs, q, kind, origin],
  );
  return (
    <Shell footer={false}>
      <main className="mx-auto grid max-w-[1440px] gap-4 px-3 py-4 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[380px_1fr] lg:px-8">
        <div className="flex min-h-0 flex-col rounded-2xl border border-tj-line bg-white">
          <div className="border-b border-tj-line p-4">
            <h1 className="font-black">مراکز خرید نزدیک تو</h1>
            <p className="mt-1 text-xs text-tj-muted">
              {num(list.length)} مرکز، مرتب از {origin.label}
              {origin.source !== "gps" && (
                <button onClick={() => locate()} className="mr-2 text-tj underline">
                  موقعیت دقیق من
                </button>
              )}
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-tj-page px-3">
              <Search size={16} className="text-tj-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام پاساژ یا دسته (مثلاً موبایل)" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" />
            </div>
            <div className="mt-2 flex gap-1 text-xs">
              {(
                [
                  ["building", "پاساژها"],
                  ["all", "همه، با راسته‌ها"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} onClick={() => setKind(k)} className={`rounded-lg px-3 py-1.5 ${kind === k ? "bg-tj-soft font-bold text-tj" : "text-tj-muted"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <ul className="tj-scroll max-h-[50dvh] flex-1 divide-y divide-tj-line overflow-y-auto lg:max-h-none">
            {list.slice(0, 120).map((h) => (
              <li key={h.hub_id} onMouseEnter={() => setActive(h.hub_id)}>
                <Link href={`/search?hub=${h.hub_id}`} className="flex items-center gap-3 p-3 hover:bg-tj-page">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tj-soft text-tj">
                    <Store size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{h.name}</p>
                    <p className="truncate text-xs text-tj-muted">
                      {num(h.shop_count)} فروشگاه · {(h.top_categories || []).slice(0, 2).join("، ")}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-tj-green">
                    <MapPin size={12} /> {km(h.km)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="h-[60dvh] overflow-hidden rounded-2xl border border-tj-line lg:h-auto">
          <ShopMap hubs={list.slice(0, 80)} origin={origin} activeId={active} onSelect={(h) => router.push(`/search?hub=${h.hub_id}`)} />
        </div>
      </main>
    </Shell>
  );
}
