"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { Sparkles, X, Send, Square, Maximize2, Store, CheckCircle2 } from "lucide-react";
import { parseSSE } from "@/lib/agent/sse";
import { useApp } from "@/components/tj/app-context";
import { toman, km } from "@/components/tj/product-card";
import MicButton from "@/components/tj/mic-button";
import type { Row } from "@/lib/shopping";

type Msg = { id: string; role: "user" | "assistant"; text: string; note?: string; offers?: Row[]; error?: boolean };

/**
 * Small assistant docked to the bottom corner of search and product pages. Its searches are
 * applied to the page behind it (onIntent) as soon as they happen, without a reload.
 */
export default function AssistantDock({
  page,
  intent,
  resultIds = [],
  onIntent,
  greeting,
}: {
  page: { kind: "search" | "product" | "home"; filters?: Row; productId?: string };
  intent: Row;
  resultIds?: string[];
  onIntent?: (intent: Row) => void;
  greeting?: string;
}) {
  const { api, origin, incognito } = useApp();
  const [open, setOpen] = useState(false),
    [msgs, setMsgs] = useState<Msg[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [activity, setActivity] = useState("");
  const abort = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, activity]);
  async function send(value: string) {
    if (!value.trim() || busy) return;
    const id = crypto.randomUUID();
    const history = msgs.filter((m) => m.text && !m.error).slice(-8).map((m) => ({ role: m.role, content: m.text.slice(0, 2000) }));
    setMsgs((m) => [...m, { id: id + "u", role: "user", text: value }, { id, role: "assistant", text: "" }]);
    setText("");
    setBusy(true);
    const update = (fn: (m: Msg) => Msg) => setMsgs((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
    const controller = new AbortController();
    abort.current = controller;
    let latest: Row | null = null;
    try {
      const r = await api("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          requestId: id,
          text: value,
          history,
          intent: { ...Object.fromEntries(Object.entries(intent).filter(([, v]) => v != null && v !== "")), lat: origin.lat, lon: origin.lon, locationLabel: origin.label },
          resultIds: resultIds.slice(0, 8),
          selectedIds: page.productId ? [page.productId] : [],
          page,
        }),
      });
      if (!r.ok || !r.body) throw Error();
      for await (const ev of parseSSE(r.body)) {
        const v = JSON.parse(ev.data);
        if (ev.event === "activity") setActivity(v.text);
        if (ev.event === "intent") latest = v;
        if (ev.event === "draft") update((m) => ({ ...m, text: m.text + v.text }));
        if (ev.event === "draft_clear") update((m) => ({ ...m, text: "" }));
        if (ev.event === "text_delta") update((m) => ({ ...m, text: v.text }));
        if (ev.event === "ui_block" && v.kind === "products" && latest) {
          onIntent?.(latest);
          update((m) => ({ ...m, note: onIntent ? `نتایج صفحه به‌روز شد · ${v.total ?? v.products.length} کالا` : undefined }));
        }
        if (ev.event === "ui_block" && v.kind === "offers") update((m) => ({ ...m, offers: v.offers.slice(0, 4) }));
        if (ev.event === "error") update((m) => ({ ...m, text: "این درخواست انجام نشد؛ دوباره امتحان کن.", error: true }));
      }
    } catch {
      if (!controller.signal.aborted) update((m) => ({ ...m, text: m.text || "ارتباط قطع شد؛ دوباره امتحان کن.", error: true }));
    } finally {
      setBusy(false);
      setActivity("");
    }
  }
  const suggestions =
    page.kind === "product"
      ? ["کدوم فروشنده نزدیک‌تره؟", "مدل مشابه ارزون‌تر", "قیمتش معقوله؟"]
      : ["فقط زیر ۱۰ میلیون", "نزدیک‌ترین‌ها رو بیار", "برند معروف‌تر"];
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-tj py-3 pl-5 pr-4 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(215,57,72,.7)] transition hover:bg-tj-dark lg:bottom-6 lg:left-6"
          aria-label="گفت‌وگو با دستیار خرید"
        >
          <Sparkles size={19} />
          از دستیار بپرس
        </button>
      )}
      {open && (
        <div
          dir="rtl"
          role="dialog"
          aria-label="دستیار خرید"
          className="fixed inset-x-2 bottom-2 z-50 flex h-[70dvh] flex-col overflow-hidden rounded-2xl border border-tj-line bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:h-[560px] sm:w-[390px]"
        >
          <div className="flex items-center gap-2 border-b border-tj-line bg-tj px-4 py-3 text-white">
            <Sparkles size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold">دستیار ترب‌جو</p>
              <p className="text-[11px] text-white/80">{page.kind === "product" ? "دربارهٔ همین کالا بپرس" : "فیلترها را با حرف زدن عوض کن"}</p>
            </div>
            <Link href="/chat" title="باز کردن در صفحهٔ کامل" className="grid size-8 place-items-center rounded-lg hover:bg-white/15">
              <Maximize2 size={16} />
            </Link>
            <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-white/15" aria-label="بستن">
              <X size={18} />
            </button>
          </div>
          <div className="tj-scroll flex-1 space-y-3 overflow-y-auto bg-tj-page/50 p-3 text-sm">
            {!msgs.length && (
              <div className="rounded-xl bg-white p-3 leading-7 text-tj-muted">
                {greeting || "بگو دنبال چی هستی تا نتایج همین صفحه را برایت فیلتر کنم؛ مثلاً «فقط سایز ۴۴» یا «تا ۵ میلیون نزدیک من»."}
                {incognito && <p className="mt-1 text-xs">حالت ناشناس: این گفت‌وگو ذخیره نمی‌شود.</p>}
              </div>
            )}
            {msgs.map((m) =>
              m.role === "user" ? (
                <p key={m.id} className="mr-auto w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-tj px-3 py-2 text-white">
                  {m.text}
                </p>
              ) : (
                <div key={m.id} className="max-w-[92%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 leading-7 shadow-sm">
                  {m.text ? (
                    <div className="[&_p]:my-0.5">
                      <Markdown skipHtml allowedElements={["p", "strong", "em", "ul", "ol", "li", "br"]}>
                        {m.text}
                      </Markdown>
                    </div>
                  ) : (
                    <span className="inline-flex gap-1 py-2">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-1.5 animate-bounce rounded-full bg-tj-muted" style={{ animationDelay: `${i * 120}ms` }} />
                      ))}
                    </span>
                  )}
                  {m.note && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-tj-green">
                      <CheckCircle2 size={13} />
                      {m.note}
                    </p>
                  )}
                  {m.offers?.map((o) => (
                    <div key={o.offer_id} className="mt-2 flex items-center gap-2 rounded-lg border border-tj-line p-2 text-xs">
                      <Store size={14} className="shrink-0 text-tj" />
                      <span className="min-w-0 flex-1 truncate">{o.shop_name}</span>
                      <span className="shrink-0 text-tj-muted">{km(o.distance)}</span>
                      <b className="shrink-0">{toman(o.price_toman)}</b>
                    </div>
                  ))}
                </div>
              ),
            )}
            {activity && <p className="animate-pulse text-xs text-tj">{activity}</p>}
            <div ref={end} />
          </div>
          {!busy && (
            <div className="tj-no-scrollbar flex gap-1.5 overflow-x-auto border-t border-tj-line px-3 pt-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-tj-line px-3 py-1 text-xs text-tj-muted hover:border-tj hover:text-tj">
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex items-center gap-2 p-3"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              placeholder="بنویس…"
              aria-label="پیام به دستیار"
              className="min-w-0 flex-1 rounded-xl border border-tj-line px-3 py-2.5 text-sm outline-none focus:border-tj"
            />
            {!busy && <MicButton onText={setText} onFinal={(t) => send(t)} />}
            {busy ? (
              <button type="button" onClick={() => abort.current?.abort()} className="grid size-10 place-items-center rounded-xl bg-tj-ink text-white" aria-label="توقف">
                <Square size={15} />
              </button>
            ) : (
              <button disabled={!text.trim()} className="grid size-10 place-items-center rounded-xl bg-tj text-white disabled:opacity-40" aria-label="ارسال">
                <Send size={16} className="-scale-x-100" />
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
