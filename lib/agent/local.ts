import { Row, norm, num } from "../shopping";
import {
  fallbackIntent,
  ordinal,
  productResults,
  validOffers,
  matches,
} from "./contracts";
import { createTools } from "./tools";
import type { Catalog } from "../catalog";
type Emit = (event: string, data: any) => void;
export async function runLocal(
  d: Catalog,
  b: {
    text: string;
    intent: Row;
    history?: Row[];
    selectedIds: string[];
    resultIds?: string[];
  },
  signal: AbortSignal,
  emit: Emit,
) {
  const say = (text: string, suggestions: string[] = []) => {
    emit("text_delta", { text });
    if (suggestions.length) emit("suggestions", suggestions);
  };
  const n = norm(b.text);
  let prior = { ...b.intent };
  if (!prior.query && !prior.category) {
    for (const m of b.history || [])
      if (m.role === "user")
        prior = fallbackIntent(m.content, prior, d.products);
    prior = { ...prior, ...b.intent };
  }
  let intent = fallbackIntent(b.text, prior, d.products);
  const execute = createTools(d, intent, signal, emit);
  await execute("update_intent", intent);
  if (/^(سلام|درود|سلام خوبی|سلام چطوری|سلام علیکم)[!؟.\s]*$/.test(n)) {
    say(
      "سلام! بگو چه محصولی می‌خوای و حدود بودجه‌ات چقدره؛ گزینه‌های واقعی رو پیدا می‌کنم.",
      ["هدفون QCY تا ۴ میلیون", "گوشی سامسونگ", "PS5"],
    );
    return;
  }
  const fresh = fallbackIntent(b.text, {}, d.products);
  if (
    /می\s*خوام|می\s*خواهم|دنبال|بخرم/.test(n) &&
    !fresh.query &&
    !fresh.category &&
    fresh.max == null &&
    !/همون|همان|اولی|دومی|ارزون|ارزان|نزدیک|مقایسه/.test(n)
  ) {
    await execute("update_intent", { query: "", category: "" });
    say(
      "دسته یا مدل این درخواست را تشخیص ندادم؛ چه محصولی مدنظرت است؟",
      ["هدفون QCY تا ۴ میلیون", "گوشی سامسونگ", "PS5"],
    );
    return;
  }
  const reference = ordinal(n);
  let chosen =
    reference !== null
      ? d.product(b.resultIds?.[reference])
      : d.product(b.selectedIds[0]);
  if (reference !== null && !chosen) {
    say("این شماره هنوز به محصولی اشاره نمی‌کند؛ اول یک جست‌وجو انجام بده.", [
      "هدفون QCY تا ۴ میلیون",
      "گوشی سامسونگ",
    ]);
    return;
  }
  if (chosen && !intent.category && !intent.query) {
    intent = {
      ...intent,
      category: chosen.category_name,
      query: chosen.model || "",
    };
    await execute("update_intent", intent);
  }
  if (!intent.query && !intent.category) {
    say(
      /هدیه|کادو/.test(n)
        ? "برای هدیه چه دسته‌ای مدنظرت است؛ هدفون، ساعت هوشمند یا گوشی؟"
        : "چه محصولی مدنظرت است؟ نام مدل یا دسته را بگو تا نتیجهٔ نامرتبط نشان ندهم.",
      ["هدفون QCY تا ۴ میلیون", "ساعت هوشمند", "گوشی سامسونگ"],
    );
    return;
  }
  const asking = /بپرس|استعلام|موجودی|پیام بده|پیگیری کن/.test(n),
    comparing = /مقایسه|فرق/.test(n),
    locating = /کجا|مسیر|کدوم فروشنده/.test(n);
  const ps = productResults(d, intent);
  if (chosen && reference === null && !matches(chosen, intent))
    chosen = undefined;
  if (chosen && !validOffers(chosen, d, intent).length) {
    chosen = undefined;
    emit("selection", { ids: [] });
  }
  if (asking || locating || reference !== null) {
    chosen ??= ps[0];
    if (!chosen) {
      emit("ui_block", { kind: "products", products: [] });
      say(
        "با این بودجه و محدوده فروشندهٔ مطابق نداریم. کدام محدودیت را تغییر بدهیم؟",
        ["شعاع ۸ کیلومتر", "بودجه آزاد"],
      );
      return;
    }
    emit("selection", { ids: [chosen.product_id] });
    if (asking) {
      emit("activity", {
        text: "انتخاب فروشنده‌های همین مدل با حفظ بودجه و محدوده",
      });
      const replies = (await execute("start_seller_inquiries", {
        id: chosen.product_id,
      })) as Row[];
      const winner = replies.find(
        (r) => r.availability === "available" && r.isSimulated === true,
      );
      emit("ui_block", { kind: "inquiry_summary", replies, product: chosen });
      if (winner) await execute("plan_trip", { offer_ids: [winner.offerId] });
      say(
        winner
          ? `برای ${chosen.persian_title}، ${num(replies.length)} فروشنده بررسی شد؛ ${winner.shopName} در سناریوی نمایشی پاسخ مثبت داد. می‌توانی این فروشنده را به برنامه اضافه کنی.`
          : "استعلام نمایشی تمام شد؛ در این سناریو پاسخ مثبت نداشتیم. محدودیت‌های خریدت را تغییر نداده‌ام.",
        ["کجا برم؟", "ارزون‌تر"],
      );
      return;
    }
    if (locating) {
      await execute("find_offers", { id: chosen.product_id });
      await execute("find_hubs", { id: chosen.product_id });
      say(
        "این‌ها پیشنهادهای ثبت‌شدهٔ همین محصول در محدودهٔ انتخابی هستند. برای هماهنگی، استعلام نمایشی را اجرا کن.",
        ["خودت از فروشنده‌ها بپرس"],
      );
      return;
    }
    await execute("get_product", { id: chosen.product_id });
    say(`${chosen.persian_title} انتخاب شد؛ از فروشنده‌ها بپرسم؟`, [
      "خودت از فروشنده‌ها بپرس",
      "کجا برم؟",
    ]);
    return;
  }
  if (comparing) {
    let compare = ps.slice(0, 2);
    if (/دیگه|دیگر/.test(n) && ps[0]) {
      const p = ps[0];
      const alternatives = productResults(d, {
        ...intent,
        query: "",
        category: p.category_name,
      }).filter(
        (x) => x.product_id !== p.product_id && x.brand_name === p.brand_name,
      );
      compare = [p, ...alternatives.slice(0, 1)];
    }
    if (compare.length < 2) {
      say("برای مقایسه دو مدل مطابق این شرایط پیدا نکردم؛ نام مدل دوم را بگو.");
      return;
    }
    await execute("compare_products", {
      ids: compare.map((p) => p.product_id),
    });
    say(
      "قیمت ثبت‌شده و مشخصات واقعی این دو مدل کنار هم آمده‌اند؛ خانهٔ خالی یعنی مشخصات در منبع ثبت نشده.",
      ["اولی رو انتخاب کن", "دومی رو انتخاب کن"],
    );
    return;
  }
  await execute("search_products", {});
  if (!ps.length)
    say(
      "محصولی با این شرایط و پیشنهاد فروشنده در محدوده پیدا نشد. بودجه یا شعاع را تغییر بده.",
      ["شعاع ۸ کیلومتر", "بودجه آزاد"],
    );
  else
    say(
      `${num(ps.length)} مدل مطابق پیدا کردم. یکی را انتخاب کن یا بگو «از فروشنده‌های اولی بپرس».`,
      ["از فروشنده‌های اولی بپرس", "فرق این دو چیه؟", "ارزون‌تر"],
    );
}
