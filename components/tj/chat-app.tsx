"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Markdown from "react-markdown";
import { toast } from "sonner";
import {
  Plus,
  Send,
  Square,
  Trash2,
  MessageSquare,
  Route,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Store,
  Check,
  MapPin,
  BadgeCheck,
  LoaderCircle,
  Clock,
  EyeOff,
  X,
  SlidersHorizontal,
} from "lucide-react";
import Header from "@/components/tj/header";
import { BottomNav } from "@/components/tj/shell";
import { Logo } from "@/components/tj/brand";
import ProductCard, { toman, km } from "@/components/tj/product-card";
import JourneyBoard from "@/components/journey-board";
import { useApp } from "@/components/tj/app-context";
import { addToPlan, getPlan, savePlan } from "@/components/tj/plan";
import { useInquiryWatch } from "@/components/tj/use-inquiry-watch";
import MicButton from "@/components/tj/mic-button";
import NightCard from "@/components/tj/night-card";
import { groupLabel, listChats, loadChat, removeChat, storeChat, type ChatMeta } from "@/components/tj/chat-store";
import { parseSSE } from "@/lib/agent/sse";
import { arrivalLabel, json, num, type Row } from "@/lib/shopping";

const newId = () => crypto.randomUUID();
const STARTERS = [
  ["گوشی با بودجهٔ ۸۰ میلیون", "بهترین‌ها نزدیک بودجه‌ات"],
  ["کفش مردانه سایز ۴۵", "فقط کالاهایی که سایزت را دارند"],
  ["هدفون QCY نزدیک جمهوری", "نزدیک‌ترین فروشنده‌ها"],
  ["ساعت ۱ شبه، شارژر گوشیم خراب شده", "حالت شب: نزدیک‌ترین جای باز"],
];
function budgetLabel(min?: number | null, max?: number | null) {
  const m = (v: number) => (v >= 1e6 ? `${num(Math.round((v / 1e6) * 10) / 10)} میلیون` : `${num(v / 1000)} هزار`);
  if (min != null && max != null) return `${m(min)} تا ${m(max)}`;
  if (max != null) return `تا ${m(max)}`;
  if (min != null) return `از ${m(min)}`;
  return null;
}

function Blocks({ t, selected, onSelect, onAsk, plans, onPlan }: { t: Row; selected?: string; onSelect: (p: Row) => void; onAsk: (p: Row) => void; plans: string[]; onPlan: (o: Row) => void }) {
  return (
    <>
      {t.blocks?.map((b: Row, i: number) => (
        <div key={i} className="mt-3">
          {b.kind === "products" && b.products?.length > 0 && (
            <>
              {b.preview && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-tj-muted">
                  <span className="size-1.5 animate-pulse rounded-full bg-tj" /> نتایج سریع؛ دستیار دارد دقیق‌ترش می‌کند…
                </p>
              )}
              <div className={`tj-scroll -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 transition ${b.preview ? "opacity-80" : ""}`}>
                {b.products.map((p: Row, j: number) => (
                  <div key={p.product_id} className="relative w-[190px] shrink-0 snap-start">
                    <span className="absolute right-2 top-2 z-10 grid size-6 place-items-center rounded-full bg-white text-[11px] font-bold shadow">{num(j + 1)}</span>
                    <ProductCard p={p} compact />
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      <button onClick={() => onSelect(p)} className={`rounded-lg py-1.5 text-xs ${selected === p.product_id ? "bg-tj-green text-white" : "bg-tj-soft text-tj hover:bg-tj hover:text-white"}`}>
                        {selected === p.product_id ? "انتخاب شد" : "همین را می‌خواهم"}
                      </button>
                      <button onClick={() => onAsk(p)} className="rounded-lg border border-tj-line bg-white py-1.5 text-xs hover:border-tj hover:text-tj">
                        فروشنده‌ها
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {b.total > b.products.length && <p className="text-xs text-tj-muted">{num(b.total)} کالا پیدا شد؛ بهترین‌ها را آوردم.</p>}
            </>
          )}
          {b.kind === "night" && <NightCard b={b} />}
          {b.kind === "products" && !b.products?.length && <p className="rounded-xl bg-tj-page p-3 text-sm">کالایی با این شرایط پیدا نشد.</p>}
          {b.kind === "offers" && (
            <div className="space-y-2">
              {b.offers.map((o: Row) => (
                <div key={o.offer_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-tj-line bg-white p-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-tj-soft text-tj">
                    <Store size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{o.shop_name}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-tj-muted">
                      <span className="flex items-center gap-1 text-tj-green">
                        <MapPin size={11} />
                        {km(o.distance)}
                      </span>
                      <span>{[o.building || o.hub_name, o.floor && `طبقهٔ ${o.floor}`, o.unit && `واحد ${o.unit}`].filter(Boolean).join(" · ")}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {o.hours_at_arrival
                          ? `زمان مراجعه: ${o.hours_at_arrival === "باز" ? "باز" : o.hours_at_arrival === "بسته" ? "بسته" : "نامشخص"}`
                          : o.hours === "باز" ? "باز است" : o.hours === "بسته" ? "بسته است" : "ساعت نامشخص"}
                      </span>
                    </p>
                    {o.confirmed && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-tj-green">
                        <BadgeCheck size={12} /> {o.confirmed.available === false ? "فروشنده گفت ندارد" : "تأیید فروشنده"}
                      </p>
                    )}
                  </div>
                  <b className="text-sm">{toman(o.price_toman)}</b>
                  <button disabled={plans.includes(o.offer_id)} onClick={() => onPlan(o)} className="rounded-lg border border-tj-line px-2.5 py-1 text-xs hover:border-tj hover:text-tj disabled:border-tj-green disabled:text-tj-green">
                    {plans.includes(o.offer_id) ? "در برنامه" : "+ برنامه"}
                  </button>
                </div>
              ))}
              {b.product && (
                <Link href={`/p/${b.product.product_id}#sellers`} className="inline-block text-xs text-tj">
                  همهٔ {num(b.total)} فروشنده و نقشه ←
                </Link>
              )}
            </div>
          )}
          {b.kind === "hubs" && (
            <div className="flex flex-wrap gap-2">
              {b.hubs.slice(0, 6).map((h: Row) => (
                <Link key={h.hub_id} href={`/search?hub=${h.hub_id}`} className="rounded-full border border-tj-line bg-white px-3 py-1.5 text-xs hover:border-tj">
                  {h.name} · {num(h.matching)} فروشنده
                </Link>
              ))}
            </div>
          )}
          {b.kind === "compare" && (
            <div className="tj-scroll overflow-x-auto rounded-xl border border-tj-line bg-white">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-tj-page">
                    <th className="p-2" />
                    {b.products.map((p: Row) => (
                      <th key={p.product_id} className="min-w-40 p-2 text-right font-bold">
                        <Link href={`/p/${p.product_id}`} className="line-clamp-2 hover:text-tj">
                          {p.persian_title}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["کمترین قیمت", ...Array.from(new Set(b.products.flatMap((p: Row) => (Array.isArray(p.specs) ? p.specs : json(p.specs)).map((s: Row) => s.key)))).slice(0, 10)].map((k: any) => (
                    <tr key={k} className="border-t border-tj-line">
                      <td className="p-2 text-tj-muted">{k}</td>
                      {b.products.map((p: Row) => (
                        <td key={p.product_id} className="p-2">
                          {k === "کمترین قیمت" ? toman(p.matching_min_price ?? p.min_price) : String((Array.isArray(p.specs) ? p.specs : json(p.specs)).find((s: Row) => s.key === k)?.value ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {b.kind === "inquiry_summary" && (
            <div className="rounded-xl border border-tj-line bg-white p-3">
              <p className="mb-2 text-sm font-bold">پرسش از فروشنده‌ها · {b.product?.persian_title}</p>
              {b.replies.map((r: Row) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-t border-tj-line py-2 text-xs">
                  <span>{r.shopName}</span>
                  <span className={r.state === "replied" ? (r.availability === "available" ? "text-tj-green" : "text-tj") : r.state === "rate_limited" ? "text-tj-muted" : "text-amber-700"}>
                    {r.state === "replied"
                      ? r.availability === "available"
                        ? `دارد${r.price ? ` · ${toman(r.price)}` : ""}${r.isSimulated ? " (نمایشی)" : ""}`
                        : r.availability === "unavailable"
                          ? `ندارد${r.isSimulated ? " (نمایشی)" : ""}`
                          : "جواب نامشخص"
                      : r.state === "rate_limited"
                        ? "امروز پیام زیادی گرفته"
                        : "پیام رفت؛ منتظر جواب"}
                  </span>
                </div>
              ))}
              <p className="mt-1 text-[11px] text-tj-muted">جواب فروشنده‌ها در پنلشان ثبت می‌شود و اینجا و در صفحهٔ کالا نشان داده می‌شود.</p>
            </div>
          )}
          {b.kind === "plan" && (
            <div className="flex flex-wrap gap-2">
              {b.offers.map((o: Row) => (
                <button key={o.offer_id} disabled={plans.includes(o.offer_id)} onClick={() => onPlan(o)} className="rounded-xl bg-tj px-3 py-2 text-xs text-white disabled:bg-tj-green">
                  {plans.includes(o.offer_id) ? `${o.shop_name} در برنامه است` : `افزودن ${o.shop_name || "فروشنده"} به برنامه`}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default function ChatApp() {
  const { user, incognito, origin, ready, api } = useApp();
  const signedIn = !!user;
  const params = useSearchParams(),
    router = useRouter();
  const [chatId, setChatId] = useState(newId),
    [turns, setTurns] = useState<Row[]>([]),
    [intent, setIntent] = useState<Row>({ radius: 5 }),
    [selected, setSelected] = useState<string[]>([]),
    [resultIds, setResultIds] = useState<string[]>([]),
    [inquiries, setInquiries] = useState<Row[]>([]),
    [history, setHistory] = useState<ChatMeta[]>([]),
    [plans, setPlans] = useState<Row[]>([]),
    [text, setText] = useState(""),
    [pending, setPending] = useState(false),
    [activity, setActivity] = useState(""),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [sidebar, setSidebar] = useState(false),
    [journey, setJourney] = useState(false),
    [modelDown, setModelDown] = useState(false);
  const abort = useRef<AbortController | null>(null),
    scroller = useRef<HTMLDivElement>(null),
    follow = useRef(true),
    started = useRef(false);

  // Seller answers arrive while the buyer keeps chatting: update the cards in place.
  const pendingInquiries = inquiries.filter((x) => x.state === "pending" && x.offerId);
  const live = useInquiryWatch(
    pendingInquiries.map((x) => x.offerId),
    Object.fromEntries(pendingInquiries.map((x) => [x.offerId, x.shopName])),
  );
  useEffect(() => {
    const answered = Object.entries(live).filter(([, s]) => s.inquiry?.status === "answered");
    if (!answered.length) return;
    const patch = (r: Row) => {
      const s = live[r.offerId];
      if (!s || s.inquiry?.status !== "answered" || r.state === "replied") return r;
      const a = s.inquiry.answer || {};
      return { ...r, state: "replied", availability: a.available === false ? "unavailable" : a.available ? "available" : "no_response", price: a.price ?? null, note: a.note, isSimulated: !!a.simulated };
    };
    setInquiries((xs) => xs.map(patch));
    setTurns((ts) => ts.map((t) => (t.blocks?.some((b: Row) => b.kind === "inquiry_summary") ? { ...t, blocks: t.blocks.map((b: Row) => (b.kind === "inquiry_summary" ? { ...b, replies: b.replies.map(patch) } : b)) } : t)));
    if (answered.some(([, s]) => s.inquiry?.answer?.available === false)) setSuggestions(["یه فروشندهٔ جایگزین نزدیک پیدا کن", "مسیر خریدم رو بچین"]);
    else setSuggestions(["مسیر خریدم رو بچین", "نزدیک‌ترین کدومه؟"]);
  }, [live]);

  useEffect(() => {
    setPlans(getPlan());
    const sync = () => setPlans(getPlan());
    window.addEventListener("tj-plan", sync);
    return () => window.removeEventListener("tj-plan", sync);
  }, []);
  useEffect(() => {
    if (turns.length && follow.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [turns, activity]);
  // Keep the buyer's location in the constraints the assistant uses.
  useEffect(() => {
    setIntent((i) => ({ ...i, lat: origin.lat, lon: origin.lon, locationLabel: origin.label }));
  }, [origin.lat, origin.lon, origin.label]);


  function reset() {
    abort.current?.abort();
    setChatId(newId());
    setTurns([]);
    setSelected([]);
    setResultIds([]);
    setInquiries([]);
    setSuggestions([]);
    setIntent({ radius: 5, lat: origin.lat, lon: origin.lon, locationLabel: origin.label });
    setSidebar(false);
  }
  async function open(id: string) {
    const state = await loadChat(signedIn, id);
    if (!state) return toast("این گفت‌وگو پیدا نشد.");
    abort.current?.abort();
    setChatId(id);
    setTurns((state.turns || []).map((t: Row) => (t.mode === "pending" ? { ...t, mode: "cancelled" } : t)));
    setIntent({ ...(state.intent || {}), lat: origin.lat, lon: origin.lon, locationLabel: origin.label });
    setSelected(state.selected || []);
    setResultIds(state.resultIds || []);
    setInquiries(state.inquiries || []);
    setSuggestions([]);
    setSidebar(false);
  }

  async function send(value: string, choice?: string) {
    if (pending || !value.trim()) return;
    setText("");
    setPending(true);
    setSuggestions([]);
    follow.current = true;
    const id = newId(),
      controller = new AbortController();
    abort.current = controller;
    const prior = turns.filter((t) => t.text && ["user", "assistant"].includes(t.role)).slice(-12).map((t) => ({ role: t.role, content: String(t.text).slice(0, 3000) }));
    const createdAt = turns[0]?.createdAt || new Date().toISOString();
    let next: Row[] = [...turns, { id: id + "u", role: "user", text: value, createdAt }, { id, role: "assistant", text: "", draft: "", blocks: [], mode: "pending" }];
    let live = { intent, selected: choice ? [choice] : selected, resultIds, inquiries };
    setTurns(next);
    const update = (fn: (t: Row) => Row) => {
      next = next.map((t) => (t.id === id ? fn(t) : t));
      setTurns(next);
    };
    try {
      const r = await api("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          requestId: id,
          text: value,
          history: prior,
          intent,
          selectedIds: live.selected,
          resultIds,
          inquiries: inquiries.filter((x) => x.offerId && x.availability).slice(-60).map((x) => ({ offerId: x.offerId, availability: x.availability })),
        }),
      });
      if (!r.ok || !r.body) throw Error("HTTP_" + r.status);
      for await (const ev of parseSSE(r.body)) {
        const v = JSON.parse(ev.data);
        if (ev.event === "activity") setActivity(v.text);
        if (ev.event === "intent") {
          live = { ...live, intent: v };
          setIntent(v);
        }
        if (ev.event === "selection") setSelected((live.selected = v.ids.slice(0, 1)));
        if (ev.event === "suggestions") setSuggestions(v);
        if (ev.event === "mode") update((t) => ({ ...t, mode: v.mode }));
        if (ev.event === "connection") setModelDown(true);
        if (ev.event === "draft") update((t) => ({ ...t, draft: (t.draft || "") + v.text }));
        if (ev.event === "draft_clear") update((t) => ({ ...t, draft: "" }));
        if (ev.event === "text_delta") update((t) => ({ ...t, draft: "", text: t.text + v.text }));
        if (ev.event === "ui_block") {
          update((t) => ({ ...t, blocks: v.kind === "products" ? [...t.blocks.filter((b: Row) => b.kind !== "products"), v] : [...t.blocks, v] }));
          if (v.kind === "products" && v.products?.length) {
            const ids = v.products.map((p: Row) => p.product_id).slice(0, 8);
            live = { ...live, resultIds: ids, selected: live.selected.filter((x) => ids.includes(x)) };
            setResultIds(ids);
            setSelected(live.selected);
          }
        }
        if (ev.event === "inquiry_update") {
          live = { ...live, inquiries: [...live.inquiries.filter((x) => x.id !== v.id), v] };
          setInquiries(live.inquiries);
        }
        if (ev.event === "error") update((t) => ({ ...t, mode: "error", text: t.text || "این درخواست انجام نشد؛ دوباره امتحان کن." }));
        if (ev.event === "done") {
          update((t) => ({ ...t, mode: v.mode }));
          if (v.mode === "model") setModelDown(false);
        }
      }
    } catch {
      const cancelled = controller.signal.aborted;
      update((t) => ({ ...t, mode: cancelled ? "cancelled" : "error", text: t.text || t.draft || (cancelled ? "متوقف شد." : "ارتباط قطع شد؛ دوباره امتحان کن.") }));
    } finally {
      setPending(false);
      setActivity("");
      abort.current = null;
    }
  }

  // /chat?q=… from the home page or search box starts a fresh conversation with that question.
  useEffect(() => {
    const q = params.get("q");
    if (!ready || started.current || !q) return;
    started.current = true;
    router.replace("/chat");
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, params]);

  const selectedTitle = turns
    .flatMap((t) => t.blocks || [])
    .flatMap((b: Row) => b.products || [])
    .find((p: Row) => p.product_id === selected[0])?.persian_title;
  const budget = budgetLabel(intent.min, intent.max);
  const planIds = plans.map((p) => p.offer_id);

  return (
    <div className="flex h-dvh flex-col bg-tj-page pb-[calc(56px+env(safe-area-inset-bottom))] text-tj-ink lg:pb-0" dir="rtl">
      <Header minimal />
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          {turns.length > 0 && (() => {
            const blocksAll = turns.flatMap((t) => t.blocks || []);
            const step = plans.length || blocksAll.some((b: Row) => b.kind === "offers" || b.kind === "night" || b.kind === "plan") ? 3 : selected.length || blocksAll.some((b: Row) => b.kind === "compare") ? 2 : 1;
            const steps = ["پیدا کن", "مقایسه و انتخاب", "برو و بخر"];
            return (
              <div className="flex items-center justify-center gap-2 border-b border-tj-line bg-white px-3 py-2 text-xs sm:gap-3" aria-label="مراحل خرید">
                {steps.map((label, i) => (
                  <span key={label} className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 ${i + 1 === step ? "font-bold text-tj" : i + 1 < step ? "text-tj-green" : "text-tj-muted"}`}>
                      <span className={`grid size-5 place-items-center rounded-full text-[10px] ${i + 1 === step ? "bg-tj text-white" : i + 1 < step ? "bg-tj-green text-white" : "bg-tj-page"}`}>
                        {i + 1 < step ? <Check size={11} /> : num(i + 1)}
                      </span>
                      {label}
                    </span>
                    {i < 2 && <span className={`h-px w-6 sm:w-10 ${i + 1 < step ? "bg-tj-green" : "bg-tj-line"}`} />}
                  </span>
                ))}
              </div>
            );
          })()}
          <div className="flex items-center gap-2 border-b border-tj-line bg-white px-3 py-2">
            <Sparkles size={17} className="shrink-0 text-tj" />
            <p className="min-w-0 flex-1 truncate text-sm font-bold">{turns.find((t) => t.role === "user")?.text || "دستیار خرید ترب‌جو"}</p>
            {modelDown && <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700">راهنمای ساده؛ هوش مصنوعی در دسترس نیست</span>}
            <button onClick={() => setJourney(!journey)} className="flex items-center gap-1.5 rounded-lg border border-tj-line px-2.5 py-1.5 text-xs hover:border-tj">
              {journey ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              <Route size={14} /> مسیر خرید
              {plans.length > 0 && <span className="rounded-full bg-tj px-1.5 text-[10px] text-white">{num(plans.length)}</span>}
            </button>
          </div>
          <div
            ref={scroller}
            onScroll={() => {
              const e = scroller.current!;
              follow.current = e.scrollHeight - e.scrollTop - e.clientHeight < 120;
            }}
            className="tj-scroll min-h-0 flex-1 overflow-y-auto px-3 py-5 lg:px-8"
          >
            <div className="mx-auto max-w-3xl">
              {!turns.length && (
                <div className="flex flex-col items-center pt-6 text-center lg:pt-14">
                  <Logo size={52} />
                  <h1 className="mt-4 text-2xl font-black">{user ? `سلام ${user.name}، چی لازم داری؟` : "سلام! چی می‌خوای بخری؟"}</h1>
                  <p className="mt-2 max-w-sm text-sm leading-7 text-tj-muted">بودجه و سایزت را هم بگو؛ از نزدیک‌ترین مغازه‌ها پیدا می‌کنم.</p>
                  <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
                    {STARTERS.map(([q]) => (
                      <button key={q} onClick={() => send(q)} className="rounded-full bg-white px-4 py-2 text-sm ring-1 ring-tj-line hover:text-tj hover:ring-tj">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map((t) =>
                t.role === "user" ? (
                  <div key={t.id} className="mb-5 flex justify-start">
                    <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-tj px-4 py-2.5 text-sm leading-7 text-white">{t.text}</p>
                  </div>
                ) : (
                  <article key={t.id} className="mb-7">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs text-tj-muted">
                      <Sparkles size={14} className="text-tj" /> ترب‌جو
                      {t.mode === "fallback" && " · راهنمای ساده"}
                    </div>
                    <div className="text-[15px] leading-8 [&_p]:my-1">
                      {t.text || t.draft ? (
                        <Markdown skipHtml allowedElements={["p", "strong", "em", "ul", "ol", "li", "br"]}>
                          {t.text || t.draft}
                        </Markdown>
                      ) : t.mode === "pending" ? (
                        <span className="inline-flex gap-1 py-2">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="size-2 animate-bounce rounded-full bg-tj/60" style={{ animationDelay: `${i * 120}ms` }} />
                          ))}
                        </span>
                      ) : null}
                    </div>
                    <Blocks
                      t={t}
                      selected={selected[0]}
                      plans={planIds}
                      onSelect={(p) => {
                        setSelected([p.product_id]);
                        setJourney(true);
                        toast(`«${p.persian_title.slice(0, 40)}» انتخاب شد؛ مسیر خرید آماده می‌شود.`);
                      }}
                      onAsk={(p) => {
                        setSelected([p.product_id]);
                        send("فروشنده‌های نزدیکش رو نشون بده", p.product_id);
                      }}
                      onPlan={(o) => {
                        if (addToPlan(o)) toast.success("به برنامهٔ خرید اضافه شد.");
                      }}
                    />
                  </article>
                ),
              )}
              {activity && (
                <p role="status" className="mb-4 flex items-center gap-2 text-xs text-tj">
                  <LoaderCircle size={13} className="animate-spin" />
                  {activity}
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-tj-line bg-white px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 lg:px-8">
            <div className="mx-auto max-w-3xl">
              {(selectedTitle || budget || intent.size || intent.category || intent.cheap || intent.phone_type || turns.length > 0) && (
                <div className="tj-no-scrollbar mb-2 flex gap-1.5 overflow-x-auto text-xs">
                  <SlidersHorizontal size={14} className="mt-1 shrink-0 text-tj-muted" />
                  {intent.category && <span className="shrink-0 rounded-full bg-tj-page px-2.5 py-1">{intent.category}</span>}
                  {budget && <span className="shrink-0 rounded-full bg-tj-page px-2.5 py-1">{budget}</span>}
                  {intent.size && <span className="shrink-0 rounded-full bg-tj-page px-2.5 py-1">سایز {intent.size}</span>}
                  {intent.cheap && intent.max == null && (
                    <button onClick={() => setIntent((i) => ({ ...i, cheap: false }))} className="flex shrink-0 items-center gap-1 rounded-full bg-tj-page px-2.5 py-1" title="برداشتن">
                      اقتصادی <X size={11} />
                    </button>
                  )}
                  {intent.phone_type && <span className="shrink-0 rounded-full bg-tj-page px-2.5 py-1">{intent.phone_type === "smart" ? "گوشی هوشمند" : "گوشی ساده"}</span>}
                  <label className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 ${intent.arrival ? "bg-tj-soft text-tj" : "bg-tj-page text-tj-muted"}`}>
                    <Clock size={12} />
                    <select
                      value={intent.arrival || ""}
                      onChange={(e) => setIntent((i) => ({ ...i, arrival: e.target.value || undefined }))}
                      className="bg-transparent outline-none"
                      aria-label="زمان مراجعه"
                    >
                      <option value="">کی می‌ری؟ الان</option>
                      {["18:00", "20:00", "tomorrow 10:00", "tomorrow 17:00", "fri 11:00"].map((v) => (
                        <option key={v} value={v}>
                          {arrivalLabel(v)}
                        </option>
                      ))}
                      {intent.arrival && !["18:00", "20:00", "tomorrow 10:00", "tomorrow 17:00", "fri 11:00"].includes(intent.arrival) && <option value={intent.arrival}>{arrivalLabel(intent.arrival)}</option>}
                    </select>
                  </label>
                  {selectedTitle && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-tj-soft px-2.5 py-1 text-tj">
                      <Check size={12} /> {selectedTitle.slice(0, 32)}
                      <button onClick={() => setSelected([])} aria-label="لغو انتخاب">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </div>
              )}
              {!pending && suggestions.length > 0 && (
                <div className="tj-no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-tj-line px-3 py-1.5 text-xs hover:border-tj hover:text-tj">
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
                className="flex items-end gap-2 rounded-2xl border border-tj-line bg-white p-2 focus-within:border-tj"
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(text);
                    }
                  }}
                  rows={1}
                  placeholder="چی می‌خوای بخری؟ بودجه و سایزت را هم بگو…"
                  aria-label="پیام به ترب‌جو"
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none"
                />
                {!pending && <MicButton onText={setText} onFinal={(t) => send(t)} />}
                {pending ? (
                  <button type="button" onClick={() => abort.current?.abort()} className="grid size-10 place-items-center rounded-xl bg-tj-ink text-white" aria-label="توقف">
                    <Square size={15} />
                  </button>
                ) : (
                  <button disabled={!text.trim()} className="grid size-10 place-items-center rounded-xl bg-tj text-white disabled:opacity-40" aria-label="ارسال">
                    <Send size={16} className="-scale-x-100" />
                  </button>
                )}
              </form>
              <p className="mt-1.5 text-center text-[11px] text-tj-muted">
                قیمت‌ها ثبت‌شده‌اند؛ موجودی را از فروشنده بپرس.
              </p>
            </div>
          </div>
        </section>
        {journey && (
          <aside className="fixed inset-y-0 left-0 z-40 w-[min(94vw,400px)] overflow-y-auto border-r border-tj-line bg-[#f7f7f7] p-5 shadow-2xl xl:static xl:z-auto xl:shadow-none">
            <button onClick={() => setJourney(false)} className="mb-2 grid size-8 place-items-center rounded-lg hover:bg-white xl:hidden" aria-label="بستن">
              <X size={18} />
            </button>
            <JourneyBoard
              productId={selected[0] || inquiries.at(-1)?.productId}
              intent={intent}
              inquiries={inquiries}
              plans={plans}
              onReply={(r) => setInquiries((xs) => [...xs.filter((x) => x.id !== r.id), r])}
              onSave={(o) => {
                if (addToPlan(o)) toast.success("به برنامهٔ خرید اضافه شد.");
              }}
              onUnavailable={(offerId) => savePlan(getPlan().map((p) => (p.offer_id === offerId ? { ...p, status: "unavailable" } : p)))}
            />
          </aside>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
