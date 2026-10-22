"use client";
import { useEffect, useRef } from "react";
import type { Row } from "@/lib/shopping";
import "leaflet/dist/leaflet.css";

// Leaflet map of shops or shopping centres around the buyer.
// - Calm basemap: OSM tiles (Persian street names, reachable in Iran) softened with a CSS filter,
//   so the red pins and the blue "you are here" dot carry the attention.
// - The buyer is a pulsing blue dot; pins drop in one after another.
// - The view flies from the buyer's area to fit buyer + destinations, so both are always in frame.
// - The active point (chosen shop) gets an animated dashed route from the buyer and a distance label;
//   changing it re-flies the camera without rebuilding the map.
// Points need lat/lon and a name; an optional label (e.g. a price) is shown above the pin.
const OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const idOf = (h: Row) => h.zone_id || h.offer_id || h.shop_id || h.hub_id;
const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180,
    x = (b.lat - a.lat) * r,
    y = (b.lon - a.lon) * r;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2));
};
const fa = (n: number) => n.toLocaleString("fa-IR", { maximumFractionDigits: 1 });

function pin(h: Row, active: boolean, i: number) {
  const label = h.label ? `<span class="tj-pin-label${active ? " on" : ""}">${h.label}</span>` : "";
  return `<span class="tj-pin${active ? " on" : ""}" style="animation-delay:${Math.min(i, 14) * 45}ms">${label}<svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 37s13-12.4 13-22A13 13 0 0 0 2 15c0 9.6 13 22 13 22Z" fill="${active ? "#212121" : "#d73948"}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg></span>`;
}

/** Points with radius_m are areas («بورس»): a soft circle with a rank + name label instead of a pin. */
function iconFor(L: any, h: Row, on: boolean, i: number) {
  if (h.radius_m)
    return L.divIcon({
      html: `<span class="tj-zone${on ? " on" : ""}" style="animation-delay:${i * 90}ms"><span class="t">${h.rank ? `<b>${h.rank}</b>` : ""}${h.name}</span>${h.sub ? `<small>${h.sub}</small>` : ""}</span>`,
      className: "",
      iconSize: [240, 44],
      iconAnchor: [120, 22],
    });
  return L.divIcon({ html: pin(h, on, i), className: "", iconSize: [30, 38], iconAnchor: [15, 37] });
}

export default function Map({
  hubs,
  origin,
  onSelect,
  activeId,
  insets = { top: 40, bottom: 40 },
}: {
  hubs: Row[];
  origin?: { lat: number; lon: number } | null;
  onSelect?: (h: Row) => void;
  activeId?: string;
  /** Pixels covered by overlays (chips on top, cards at the bottom) that framing must avoid. */
  insets?: { top: number; bottom: number };
}) {
  const pad = { paddingTopLeft: [40, insets.top] as [number, number], paddingBottomRight: [40, insets.bottom] as [number, number] };
  const el = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const state = useRef<{ L?: any; map?: any; markers: Map<string, any>; route?: any; tag?: any; points: [number, number][] }>({
    markers: new globalThis.Map(),
    points: [],
  });
  const key = JSON.stringify([hubs.map((h) => [h.lat, h.lon, h.name, h.label, idOf(h)]), origin?.lat, origin?.lon]);

  // Build the map once per set of points.
  useEffect(() => {
    let disposed = false;
    const s = state.current;
    import("leaflet").then((L) => {
      if (disposed || !el.current) return;
      const center: [number, number] = [origin?.lat ?? 35.695, origin?.lon ?? 51.408];
      const map = L.map(el.current, { attributionControl: false, zoomControl: false }).setView(center, 12);
      L.control.zoom({ position: "topleft" }).addTo(map);
      L.tileLayer(OSM, { maxZoom: 19, className: "tj-tiles" }).addTo(map);
      L.control.attribution({ prefix: false }).addAttribution("© OpenStreetMap").addTo(map);
      s.L = L;
      s.map = map;
      s.markers = new globalThis.Map();
      s.points = [];
      if (origin) {
        s.points.push([origin.lat, origin.lon]);
        L.marker([origin.lat, origin.lon], {
          icon: L.divIcon({ html: '<span class="tj-me"><i></i></span>', className: "", iconSize: [22, 22] }),
          zIndexOffset: 1000,
          keyboard: false,
        })
          .addTo(map)
          .bindTooltip("تو اینجایی", { direction: "top", offset: [0, -10] });
      }
      hubs.forEach((h, i) => {
        if (!h.lat || !h.lon) return;
        s.points.push([h.lat, h.lon]);
        let circle: any;
        if (h.radius_m) {
          circle = L.circle([h.lat, h.lon], { radius: h.radius_m, color: "#d73948", weight: 1.5, fillColor: "#d73948", fillOpacity: 0.1, className: "tj-zone-c" })
            .addTo(map)
            .on("click", () => select.current?.(h));
          const b = circle.getBounds();
          s.points.push([b.getNorth(), b.getEast()], [b.getSouth(), b.getWest()]);
        }
        const m = L.marker([h.lat, h.lon], { icon: iconFor(L, h, false, i) }).addTo(map).on("click", () => select.current?.(h));
        if (!h.radius_m) m.bindTooltip(String(h.name || ""), { direction: "top", offset: [0, -34] });
        s.markers.set(String(idOf(h)), { m, h, i, circle });
      });
      // Start from the buyer's neighbourhood, then glide out to show everything.
      // With a chosen shop, frame the buyer and that shop; otherwise everything.
      highlight(activeIdRef.current, false);
      setTimeout(() => {
        if (disposed) return;
        if (s.route) highlight(activeIdRef.current, true);
        else if (s.points.length > 1) map.flyToBounds(s.points, { ...pad, maxZoom: 16, duration: 1.1 });
      }, 250);
    });
    return () => {
      disposed = true;
      s.map?.stop();
      s.map?.remove();
      s.map = undefined;
      s.route = s.tag = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  /** Mark the active pin, draw buyer → shop, and frame both. */
  function highlight(id: string | undefined, fly = true) {
    const s = state.current,
      { L, map } = s;
    if (!L || !map) return;
    s.markers.forEach(({ m, h, i, circle }, k) => {
      const on = k === String(id);
      m.setIcon(iconFor(L, h, on, on ? 0 : i));
      m.setZIndexOffset(on ? 900 : 0);
      circle?.setStyle({ fillOpacity: on ? 0.24 : 0.1, weight: on ? 2.5 : 1.5 });
    });
    s.route?.remove();
    s.tag?.remove();
    s.route = s.tag = undefined;
    const target = id ? s.markers.get(String(id))?.h : undefined;
    if (!target || !origin) return;
    const a: [number, number] = [origin.lat, origin.lon],
      b: [number, number] = [target.lat, target.lon];
    s.route = L.polyline([a, b], { color: "#212121", weight: 3, opacity: 0.75, dashArray: "6 8", className: "tj-route" }).addTo(map);
    const d = km(origin, target);
    s.tag = L.marker([a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35], {
      icon: L.divIcon({
        html: `<span class="tj-route-tag">${d < 1 ? `${fa(Math.round(d * 1000 / 50) * 50)} متر` : `${fa(Math.round(d * 10) / 10)} کیلومتر`} · ${fa(Math.max(1, Math.round((d / 4.5) * 60)))} دقیقه پیاده</span>`,
        className: "",
        iconSize: [190, 26],
        iconAnchor: [95, 13],
      }),
      interactive: false,
    }).addTo(map);
    // An area is framed whole (its circle + the buyer); a shop as buyer + pin.
    const circle = s.markers.get(String(id))?.circle;
    const frame: [number, number][] = circle ? [a, [circle.getBounds().getNorth(), circle.getBounds().getEast()], [circle.getBounds().getSouth(), circle.getBounds().getWest()]] : [a, b];
    if (fly) map.flyToBounds(frame, { ...pad, maxZoom: circle ? 15 : 16, duration: 0.9 });
  }
  useEffect(() => {
    highlight(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return <div ref={el} className="tj-map z-0 h-full min-h-64 w-full" aria-label="نقشهٔ فروشگاه‌ها" />;
}
