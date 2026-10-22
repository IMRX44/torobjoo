"use client";
import { useEffect, useRef } from "react";
import type { Row } from "@/lib/shopping";
import "leaflet/dist/leaflet.css";

// Leaflet map of shops or shopping centres, with the buyer's position as a blue dot.
// Points need lat/lon and a name; an optional label (e.g. a price) is shown on the pin.
export default function Map({
  hubs,
  origin,
  onSelect,
  activeId,
}: {
  hubs: Row[];
  origin?: { lat: number; lon: number } | null;
  onSelect?: (h: Row) => void;
  activeId?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const key = JSON.stringify([hubs.map((h) => [h.lat, h.lon, h.name, h.label, h.hub_id, h.shop_id]), origin?.lat, origin?.lon, activeId]);
  useEffect(() => {
    let map: any,
      disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !el.current) return;
      map = L.map(el.current, { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, attributionControl: false }).setView(
        [origin?.lat ?? 35.695, origin?.lon ?? 51.408],
        14,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
      const points: [number, number][] = [];
      if (origin) {
        points.push([origin.lat, origin.lon]);
        L.marker([origin.lat, origin.lon], {
          icon: L.divIcon({
            html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#2f80ed;border:3px solid #fff;box-shadow:0 0 0 6px #2f80ed33"></span>',
            className: "",
            iconSize: [18, 18],
          }),
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindTooltip("موقعیت تو");
      }
      hubs.forEach((h) => {
        if (!h.lat || !h.lon) return;
        points.push([h.lat, h.lon]);
        const active = activeId && (h.shop_id === activeId || h.hub_id === activeId || h.offer_id === activeId);
        const label = h.label
          ? `<span style="position:absolute;bottom:34px;right:50%;transform:translateX(50%);white-space:nowrap;background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:1px 6px;font:600 11px Vazirmatn;color:#212121;box-shadow:0 2px 6px #0002">${h.label}</span>`
          : "";
        L.marker([h.lat, h.lon], {
          icon: L.divIcon({
            html: `<span style="position:relative;display:block">${label}<svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 37s13-12.4 13-22A13 13 0 0 0 2 15c0 9.6 13 22 13 22Z" fill="${active ? "#212121" : "#d73948"}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg></span>`,
            className: "",
            iconSize: [30, 38],
            iconAnchor: [15, 37],
          }),
        })
          .addTo(map)
          .bindTooltip(String(h.name || ""))
          .on("click", () => select.current?.(h));
      });
      if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
    });
    return () => {
      disposed = true;
      map?.stop();
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={el} className="z-0 h-full min-h-64 w-full" aria-label="نقشهٔ فروشگاه‌ها" />;
}
