"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { toast } from "sonner";
import {
  Store,
  LogOut,
  Inbox,
  Package,
  LayoutDashboard,
  Sparkles,
  Search,
  LoaderCircle,
  Check,
  X,
  Pencil,
  TrendingDown,
  TrendingUp,
  Trophy,
  Eye,
  Clock,
  MessageCircleQuestion,
  Send,
  AlertTriangle,
} from "lucide-react";
import { Wordmark } from "@/components/tj/brand";
import ProductImage from "@/components/product-image";
import { toman } from "@/components/tj/product-card";
import { dateLabel, num, type Row } from "@/lib/shopping";

const get = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "انجام نشد");
  return j;
};
const parseMillion = (v: string) => {
  const n = Number(v.replace(/[,٬]/g, "").replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

function Login({ onDone }: { onDone: (shop: Row) => void }) {
  const [q, setQ] = useState(""),
    [shops, setShops] = useState<Row[]>([]),
    [pick, setPick] = useState<Row | null>(null),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return setShops([]);
    const t = setTimeout(() => get(`/api/seller/shops?q=${encodeURIComponent(q)}`).then(setShops).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-tj-line bg-white p-6">
        <h1 className="text-xl font-black">ورود فروشنده</h1>
        <p className="mt-2 text-sm leading-7 text-tj-muted">فروشگاهت را پیدا کن. اولین ورود، رمز همان فروشگاه را تعیین می‌کند (در نسخهٔ نهایی مالکیت با پیامک تأیید می‌شود).</p>
        {!pick ? (
          <>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-tj-line px-3 focus-within:border-tj">
              <Search size={17} className="text-tj-muted" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="نام فروشگاه یا آدرس…" className="min-w-0 flex-1 py-3 text-sm outline-none" />
            </div>
            <ul className="mt-2 divide-y divide-tj-line">
              {shops.map((s) => (
                <li key={s.shop_id}>
                  <button onClick={() => setPick(s)} className="flex w-full items-center gap-3 py-3 text-right hover:bg-tj-page">
                    <Store size={18} className="shrink-0 text-tj" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{s.name}</span>
                      <span className="block truncate text-xs text-tj-muted">{s.address}</span>
                    </span>
                    {s.claimed && <span className="text-[11px] text-tj-green">ثبت‌شده</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const j = await post("/api/seller/login", { shopId: pick.shop_id, password });
                onDone(j.shop);
              } catch (err) {
                toast(err instanceof Error ? err.message : "ورود انجام نشد");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="flex items-center gap-3 rounded-xl bg-tj-page p-3">
              <Store size={18} className="text-tj" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{pick.name}</p>
                <p className="truncate text-xs text-tj-muted">{pick.address}</p>
              </div>
              <button type="button" onClick={() => setPick(null)} className="text-xs text-tj">
                تغییر
              </button>
            </div>
            <input autoFocus type="password" required minLength={4} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={pick.claimed ? "رمز فروشگاه" : "یک رمز برای فروشگاهت بساز"} className="w-full rounded-xl border border-tj-line px-3 py-3 text-sm outline-none focus:border-tj" />
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-tj py-3 font-bold text-white disabled:opacity-60">
              {busy && <LoaderCircle size={16} className="animate-spin" />}
              {pick.claimed ? "ورود به پنل" : "ثبت و ورود به پنل"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function InboxTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Row[] | null>(null),
    [filter, setFilter] = useState<"pending" | "answered">("pending"),
    [priceFor, setPriceFor] = useState<string | null>(null),
    [price, setPrice] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => get("/api/seller/inbox").then(setItems).catch(() => setItems([])), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);
  async function reply(q: Row, available: boolean | null, newPrice?: number | null) {
    setBusy(q.id);
    try {
      await post("/api/seller/answer", { inquiryId: q.id, available, price: newPrice ?? (available ? q.recordedPrice : null) });
      toast.success("جوابت برای همهٔ خریدارهایی که پرسیده بودند نشان داده می‌شود.");
      setPriceFor(null);
      setPrice("");
      load();
      onChange();
    } catch (e) {
      toast(e instanceof Error ? e.message : "ثبت نشد");
    } finally {
      setBusy(null);
    }
  }
  const list = (items || []).filter((q) => q.status === filter);
  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl bg-white p-1 text-sm">
        {(
          [
            ["pending", "منتظر جواب"],
            ["answered", "جواب داده‌شده"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`flex-1 rounded-lg py-2 ${filter === k ? "bg-tj-soft font-bold text-tj" : "text-tj-muted"}`}>
            {l} ({num((items || []).filter((q) => q.status === k).length)})
          </button>
        ))}
      </div>
      {items === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      ) : !list.length ? (
        <div className="rounded-2xl border border-tj-line bg-white p-10 text-center text-sm text-tj-muted">
          <Inbox className="mx-auto mb-3" />
          {filter === "pending" ? "پیامی منتظر جواب نیست. 👌" : "هنوز به پیامی جواب نداده‌ای."}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((q) => (
            <li key={q.id} className="rounded-2xl border border-tj-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-md px-2 py-0.5 ${q.reason === "price_check" ? "bg-amber-50 text-amber-800" : "bg-tj-soft text-tj"}`}>
                  {q.reason === "price_check" ? "بررسی خودکار قیمت" : q.reason === "stock" ? "خریدار سر زده بود" : "سؤال خریدار"}
                </span>
                <span className="text-tj-muted">{dateLabel(q.createdAt)}</span>
                {q.askers > 1 && <span className="text-tj-muted">· {num(q.askers)} خریدار همین را پرسیده‌اند</span>}
              </div>
              <Link href={`/p/${q.productId}`} target="_blank" className="mt-2 block text-sm font-bold hover:text-tj">
                {q.title}
              </Link>
              <p className="mt-2 rounded-xl bg-tj-page p-3 text-sm leading-7">{q.question}</p>
              <p className="mt-2 text-xs text-tj-muted">قیمت ثبت‌شدهٔ تو: {toman(q.recordedPrice)}</p>
              {q.status === "answered" ? (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-tj-green">
                  <Check size={16} />
                  {q.answer?.available === false ? "گفتی نداری" : `گفتی داری${q.answer?.price ? ` · ${toman(q.answer.price)}` : ""}`} · {dateLabel(q.answeredAt)}
                </p>
              ) : priceFor === q.id ? (
                <form
                  className="mt-3 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = parseMillion(price);
                    if (!v) return toast("قیمت را به تومان وارد کن.");
                    reply(q, true, v);
                  }}
                >
                  <input autoFocus value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="قیمت جدید به تومان" className="min-w-0 flex-1 rounded-lg border border-tj-line px-3 py-2 text-sm outline-none focus:border-tj" />
                  <button disabled={busy === q.id} className="rounded-lg bg-tj px-4 py-2 text-sm text-white">
                    ثبت
                  </button>
                  <button type="button" onClick={() => setPriceFor(null)} className="px-2 text-sm text-tj-muted">
                    انصراف
                  </button>
                </form>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <button disabled={busy === q.id} onClick={() => reply(q, true)} className="flex items-center gap-1 rounded-lg bg-tj-green px-3 py-2 text-white disabled:opacity-60">
                    <Check size={15} /> دارم، با همین قیمت
                  </button>
                  <button disabled={busy === q.id} onClick={() => setPriceFor(q.id)} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-2 hover:border-tj">
                    <Pencil size={14} /> دارم، با قیمت دیگر
                  </button>
                  <button disabled={busy === q.id} onClick={() => reply(q, false)} className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-2 text-tj hover:border-tj">
                    <X size={15} /> ندارم
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OffersTab() {
  const [data, setData] = useState<{ total: number; items: Row[] } | null>(null),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState(""),
    [edit, setEdit] = useState<string | null>(null),
    [value, setValue] = useState("");
  const load = useCallback(() => {
    setData(null);
    get(`/api/seller/offers?q=${encodeURIComponent(q)}&filter=${filter}`)
      .then(setData)
      .catch(() => setData({ total: 0, items: [] }));
  }, [q, filter]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);
  async function save(o: Row, available: boolean | null, price: number | null) {
    try {
      const updated = await post("/api/seller/price", { offerId: o.offer_id, price, available });
      setData((d) => d && { ...d, items: d.items.map((x) => (x.offer_id === o.offer_id ? updated : x)) });
      setEdit(null);
      toast.success("قیمت به‌روز شد و به خریدارها نشان داده می‌شود.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "ذخیره نشد");
    }
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-tj-line bg-white px-3">
          <Search size={16} className="text-tj-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو در محصولاتم" className="min-w-0 flex-1 py-2.5 text-sm outline-none" />
        </div>
        {(
          [
            ["", "همه"],
            ["too_low", "خیلی ارزان‌تر از بازار"],
            ["high", "گران‌تر از بازار"],
            ["cheapest", "ارزان‌ترین بازار"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-xl px-3 text-sm ${filter === k ? "bg-tj text-white" : "border border-tj-line bg-white"}`}>
            {l}
          </button>
        ))}
      </div>
      {!data ? (
        <div className="h-60 animate-pulse rounded-2xl bg-white" />
      ) : !data.items.length ? (
        <p className="rounded-2xl border border-tj-line bg-white p-8 text-center text-sm text-tj-muted">محصولی با این فیلتر نیست.</p>
      ) : (
        <ul className="space-y-2">
          {data.items.map((o) => (
            <li key={o.offer_id} className="rounded-2xl border border-tj-line bg-white p-4">
              <div className="flex gap-3">
                <ProductImage src={o.image_url} alt="" className="size-16 shrink-0 rounded-lg border border-tj-line p-1" iconSize={18} />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${o.product_id}`} target="_blank" className="line-clamp-2 text-sm font-bold hover:text-tj">
                    {o.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tj-muted">
                    <span>
                      قیمت تو: <b className="text-sm text-tj-ink">{toman(o.my_price)}</b>
                    </span>
                    {o.competitors > 0 ? (
                      <>
                        <span>کمترین رقیب: {toman(o.min)}</span>
                        <span>میانهٔ بازار: {toman(o.median)}</span>
                        <span>
                          رتبهٔ تو: {num(o.rank)} از {num(o.competitors + 1)}
                        </span>
                      </>
                    ) : (
                      <span>رقیبی برای این کالا ثبت نشده</span>
                    )}
                  </div>
                  {o.flag && (
                    <p className={`mt-2 flex items-center gap-1 text-xs ${o.flag === "too_low" ? "text-amber-700" : o.flag === "high" ? "text-tj" : "text-tj-green"}`}>
                      {o.flag === "too_low" ? <AlertTriangle size={13} /> : o.flag === "high" ? <TrendingUp size={13} /> : <Trophy size={13} />}
                      {o.flag === "too_low"
                        ? "قیمتت خیلی کمتر از بقیه است؛ خریدارها برای بررسی خودکار از تو می‌پرسند. اگر به‌روز نیست اصلاحش کن."
                        : o.flag === "high"
                          ? "بیش از ۲۵٪ گران‌تر از میانهٔ بازار هستی."
                          : "ارزان‌ترین فروشندهٔ این کالا هستی."}
                    </p>
                  )}
                  {o.nearby?.length > 0 && (
                    <p className="mt-1 text-[11px] text-tj-muted">
                      رقبای همین حوالی: {o.nearby.map((n: Row) => `${n.shop} ${num(n.price)}`).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              {edit === o.offer_id ? (
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = parseMillion(value);
                    if (!v) return toast("قیمت را به تومان وارد کن.");
                    save(o, true, v);
                  }}
                >
                  <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" placeholder="قیمت جدید به تومان" className="min-w-0 flex-1 rounded-lg border border-tj-line px-3 py-2 text-sm outline-none focus:border-tj" />
                  <button className="rounded-lg bg-tj px-4 py-2 text-sm text-white">ذخیره</button>
                  <button type="button" onClick={() => save(o, false, o.my_price)} className="rounded-lg border border-tj-line px-3 py-2 text-sm text-tj">
                    ناموجود شد
                  </button>
                  <button type="button" onClick={() => setEdit(null)} className="px-2 text-sm text-tj-muted">
                    انصراف
                  </button>
                </form>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => {
                      setEdit(o.offer_id);
                      setValue(String(o.my_price || ""));
                    }}
                    className="flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5 hover:border-tj"
                  >
                    <Pencil size={13} /> ویرایش قیمت
                  </button>
                  {o.median && o.my_price && o.my_price > o.median && (
                    <button onClick={() => save(o, true, Math.round(o.median / 1000) * 1000)} className="flex items-center gap-1 rounded-lg bg-tj-soft px-3 py-1.5 text-tj">
                      <TrendingDown size={13} /> هم‌قیمت میانهٔ بازار ({num(Math.round(o.median / 1000) * 1000)})
                    </button>
                  )}
                  <span className="mr-auto self-center text-tj-muted">آخرین تغییر: {dateLabel(o.updated_at)}</span>
                </div>
              )}
            </li>
          ))}
          {data.total > data.items.length && <p className="text-center text-xs text-tj-muted">{num(data.total - data.items.length)} محصول دیگر؛ با جست‌وجو پیدایش کن.</p>}
        </ul>
      )}
    </div>
  );
}

function AssistantTab() {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);
  async function send(v: string) {
    if (!v.trim() || busy) return;
    const history = msgs.slice(-10);
    setMsgs((m) => [...m, { role: "user", content: v }]);
    setText("");
    setBusy(true);
    try {
      const j = await post("/api/seller/assistant", { text: v, history });
      setMsgs((m) => [...m, { role: "assistant", content: j.text }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "جواب نیامد؛ دوباره امتحان کن." }]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex h-[70dvh] flex-col rounded-2xl border border-tj-line bg-white">
      <div className="tj-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {!msgs.length && (
          <div className="text-center">
            <Sparkles className="mx-auto text-tj" size={30} />
            <p className="mt-2 font-bold">دستیار فروشنده</p>
            <p className="mt-1 text-sm text-tj-muted">قیمت رقبا، محصولات کم‌فروش، پیشنهاد قیمت و پیام‌های بی‌جواب را بپرس.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {["کدوم محصولاتم از بازار گرون‌ترن؟", "وضعیت فروشگاهم این هفته چطور بود؟", "به کدوم پیام‌ها هنوز جواب ندادم؟", "قیمت‌های خیلی پایینم رو پیدا کن"].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-tj-line px-3 py-1.5 text-xs hover:border-tj hover:text-tj">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="mr-auto w-fit max-w-[80%] rounded-2xl rounded-tl-sm bg-tj px-3 py-2 text-sm text-white">
              {m.content}
            </p>
          ) : (
            <div key={i} className="max-w-[90%] rounded-2xl rounded-tr-sm bg-tj-page px-3 py-2 text-sm leading-7 [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pr-5">
              <Markdown skipHtml allowedElements={["p", "strong", "em", "ul", "ol", "li", "br"]}>
                {m.content}
              </Markdown>
            </div>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-tj">
            <LoaderCircle size={13} className="animate-spin" /> در حال بررسی داده‌های فروشگاه…
          </p>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex gap-2 border-t border-tj-line p-3"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="از دستیار فروشنده بپرس…" className="min-w-0 flex-1 rounded-xl border border-tj-line px-3 py-2.5 text-sm outline-none focus:border-tj" />
        <button disabled={busy || !text.trim()} className="grid size-11 place-items-center rounded-xl bg-tj text-white disabled:opacity-40" aria-label="ارسال">
          <Send size={16} className="-scale-x-100" />
        </button>
      </form>
    </div>
  );
}

function Dashboard({ shop, go }: { shop: Row; go: (t: string) => void }) {
  const [stats, setStats] = useState<Row | null>(null),
    [warn, setWarn] = useState<number | null>(null);
  useEffect(() => {
    get("/api/seller/stats").then(setStats).catch(() => {});
    get("/api/seller/offers?filter=too_low").then((j) => setWarn(j.total)).catch(() => {});
  }, []);
  const cards = [
    { icon: MessageCircleQuestion, label: "پیام منتظر جواب", value: shop.pending, tone: shop.pending ? "text-tj" : "", onClick: () => go("inbox") },
    { icon: Eye, label: "بازدید محصولات (۷ روز)", value: stats?.views_7d },
    { icon: Clock, label: "میانگین زمان پاسخ", value: stats?.response_minutes != null ? `${num(stats.response_minutes)} دقیقه` : "—" },
    { icon: Package, label: "محصولات فعال", value: shop.offer_count, onClick: () => go("offers") },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, tone, onClick }) => (
          <button key={label} onClick={onClick} disabled={!onClick} className="rounded-2xl border border-tj-line bg-white p-4 text-right enabled:hover:border-tj">
            <Icon size={20} className="text-tj" />
            <p className={`mt-3 text-2xl font-black ${tone || ""}`}>{typeof value === "number" ? num(value) : (value ?? "…")}</p>
            <p className="mt-1 text-xs text-tj-muted">{label}</p>
          </button>
        ))}
      </div>
      {warn ? (
        <button onClick={() => go("offers")} className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-right text-sm">
          <AlertTriangle className="shrink-0 text-amber-700" />
          <span className="flex-1">
            <b>{num(warn)} محصول</b> با قیمتی خیلی کمتر از بقیهٔ بازار ثبت شده. خریدارها خودکار از تو می‌پرسند که این قیمت معتبر است؛ اگر قدیمی است، به‌روزش کن.
          </span>
        </button>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-tj-line bg-white p-4">
          <p className="mb-3 font-bold">پربازدیدترین محصولاتت این هفته</p>
          {!stats ? (
            <div className="h-24 animate-pulse rounded-xl bg-tj-page" />
          ) : !stats.top_products.length ? (
            <p className="text-sm text-tj-muted">هنوز بازدیدی ثبت نشده.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {stats.top_products.map((p: Row, i: number) => (
                <li key={p.product_id} className="flex gap-2">
                  <span className="text-tj">{num(i + 1)}.</span>
                  <Link href={`/p/${p.product_id}`} target="_blank" className="line-clamp-1 flex-1 hover:text-tj">
                    {p.title}
                  </Link>
                  <span className="text-xs text-tj-muted">{num(p.views)} بازدید</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-2xl border border-tj-line bg-white p-4 text-sm leading-7">
          <p className="mb-2 font-bold">فروشگاه</p>
          <p>{shop.name}</p>
          <p className="text-tj-muted">{shop.address}</p>
          <p className="text-tj-muted">
            {[shop.building, shop.floor && `طبقهٔ ${shop.floor}`, shop.unit && `واحد ${shop.unit}`].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-xs text-tj-muted">نرخ پاسخ: {stats?.answer_rate != null ? `${num(stats.answer_rate)}٪` : "—"} · کل پیام‌ها: {num(stats?.inquiries ?? 0)}</p>
        </div>
      </div>
    </div>
  );
}

export default function SellerPanel() {
  const [shop, setShop] = useState<Row | null | undefined>(undefined),
    [tab, setTab] = useState("dashboard");
  const refresh = useCallback(() => get("/api/seller/me").then((j) => setShop(j.shop)).catch(() => setShop(null)), []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const tabs = [
    { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
    { id: "inbox", label: "پیام‌ها", icon: Inbox, badge: shop?.pending },
    { id: "offers", label: "محصولات من", icon: Package },
    { id: "assistant", label: "دستیار فروشنده", icon: Sparkles },
  ];
  return (
    <div className="min-h-dvh bg-tj-page text-tj-ink" dir="rtl">
      <header className="border-b border-tj-line bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3">
          <Link href="/">
            <Wordmark size={32} sub={false} />
          </Link>
          <span className="rounded-md bg-tj-ink px-2 py-0.5 text-xs text-white">پنل فروشنده</span>
          {shop && (
            <>
              <span className="mr-auto hidden truncate text-sm sm:inline">{shop.name}</span>
              <button
                onClick={async () => {
                  await post("/api/seller/logout", {});
                  setShop(null);
                }}
                className="mr-auto flex items-center gap-1 rounded-lg border border-tj-line px-3 py-1.5 text-sm sm:mr-0"
              >
                <LogOut size={15} /> خروج
              </button>
            </>
          )}
        </div>
      </header>
      {shop === undefined ? (
        <div className="grid h-64 place-items-center">
          <LoaderCircle className="animate-spin text-tj" />
        </div>
      ) : !shop ? (
        <Login onDone={setShop} />
      ) : (
        <main className="mx-auto grid max-w-[1200px] gap-4 px-4 py-5 lg:grid-cols-[220px_1fr]">
          <nav className="tj-no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
            {tabs.map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${tab === id ? "bg-white font-bold text-tj shadow-sm" : "text-tj-muted hover:bg-white"}`}>
                <Icon size={17} />
                {label}
                {badge ? <span className="mr-auto rounded-full bg-tj px-1.5 text-[11px] text-white">{num(badge)}</span> : null}
              </button>
            ))}
          </nav>
          <section className="min-w-0">
            {tab === "dashboard" && <Dashboard shop={shop} go={setTab} />}
            {tab === "inbox" && <InboxTab onChange={refresh} />}
            {tab === "offers" && <OffersTab />}
            {tab === "assistant" && <AssistantTab />}
          </section>
        </main>
      )}
    </div>
  );
}
