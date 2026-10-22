"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Row } from "@/lib/shopping";

/**
 * Live seller answers: while any watched offer has a pending question, poll its status every
 * few seconds and announce new answers. Returns the latest status per offer id.
 */
export function useInquiryWatch(offerIds: string[], names: Record<string, string> = {}) {
  const [status, setStatus] = useState<Record<string, Row>>({});
  const prev = useRef<Record<string, Row>>({});
  const key = [...new Set(offerIds)].sort().join(",");
  const namesRef = useRef(names);
  namesRef.current = names;
  useEffect(() => {
    if (!key) return;
    let stop = false,
      timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next: Record<string, Row> = await (await fetch(`/api/inquiries?ids=${key}`)).json();
        for (const [id, s] of Object.entries(next)) {
          const before = prev.current[id];
          if (before?.inquiry?.status === "pending" && s.inquiry?.status === "answered") {
            const a = s.inquiry.answer || {};
            const who = namesRef.current[id] || "فروشنده";
            toast(
              a.available === false
                ? `${who}: این کالا را ندارد${a.simulated ? " (پاسخ نمایشی)" : ""}. جایگزین را ببین.`
                : `${who} جواب داد: دارد${a.price ? ` · ${a.price.toLocaleString("fa-IR")} تومان` : ""}${a.simulated ? " (پاسخ نمایشی)" : ""}`,
              { duration: 6000 },
            );
          }
        }
        prev.current = next;
        if (!stop) setStatus(next);
        const pending = Object.values(next).some((s) => s.inquiry?.status === "pending");
        if (!stop && pending) timer = setTimeout(tick, 8000);
      } catch {
        if (!stop) timer = setTimeout(tick, 15000);
      }
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [key]);
  return status;
}
