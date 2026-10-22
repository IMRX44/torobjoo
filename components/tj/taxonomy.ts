"use client";
import { useEffect, useState } from "react";
import {
  Smartphone,
  Laptop,
  Headphones,
  Refrigerator,
  Sofa,
  Shirt,
  Sparkles,
  Wrench,
  Car,
  Dumbbell,
  Baby,
  BookOpen,
  ShoppingBasket,
  Factory,
  type LucideIcon,
} from "lucide-react";

export type Top = { id: string; name: string; count: number; subs: { name: string; count: number; leaves: string[] }[] };
export const ICONS: Record<string, LucideIcon> = {
  mobile: Smartphone,
  computer: Laptop,
  av: Headphones,
  appliance: Refrigerator,
  home: Sofa,
  fashion: Shirt,
  beauty: Sparkles,
  tools: Wrench,
  car: Car,
  sport: Dumbbell,
  kids: Baby,
  culture: BookOpen,
  market: ShoppingBasket,
  industry: Factory,
};
let cache: Promise<Top[]> | null = null;
export function useTaxonomy() {
  const [tops, setTops] = useState<Top[]>([]);
  useEffect(() => {
    cache ??= fetch("/api/taxonomy")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => {
        cache = null;
        return [];
      });
    cache.then(setTops);
  }, []);
  return tops;
}
