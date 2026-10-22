"use client";
import type { Row } from "@/lib/shopping";

// Shopping plan (stops to visit), kept on this device. Shared by the chat, product and plan pages.
const KEY = "torobgard-v1";
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};
export const getPlan = (): Row[] => read().plan || [];
export function savePlan(plan: Row[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), plan }));
    window.dispatchEvent(new Event("tj-plan"));
  } catch {}
}
export function addToPlan(o: Row) {
  const plan = getPlan();
  if (plan.some((s) => s.offer_id === o.offer_id)) return false;
  savePlan([
    ...plan,
    {
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
    },
  ]);
  return true;
}
