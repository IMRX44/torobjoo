// Category-aware filters: the attributes that matter for each kind of product
// (RAM/storage for phones, CPU/RAM/SSD for laptops, screen size for TVs, watts and port for
// chargers, audience and material for shoes and clothes, …).
// Values come from the title first (titles carry them reliably: «حافظه ۲۵۶ رم ۸ گیگابایت»),
// then from specs for categories no rule covers. A filter is kept for a category only when it
// covers enough of it and actually splits it into groups.
// Input: data/products.json + data/details.ndjson   Output: data/facets.json
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("data");
const { cols, rows } = JSON.parse(fs.readFileSync(path.join(dir, "products.json"), "utf8"));
const col = Object.fromEntries(cols.map((c, i) => [c, i]));
const fd = fs.openSync(path.join(dir, "details.ndjson"), "r");
const specsOf = (r) => {
  if (r[col.detail_offset] == null) return [];
  const b = Buffer.alloc(r[col.detail_length]);
  fs.readSync(fd, b, 0, b.length, r[col.detail_offset]);
  try { return JSON.parse(b.toString("utf8")).specs || []; } catch { return []; }
};

const latin = (s) =>
  String(s ?? "")
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c))
    .replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c))
    .replace(/‌/g, " ").replace(/\s+/g, " ").trim();
const fa = (s) => (/[A-Za-z]/.test(s) ? String(s) : String(s).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]));
const gb = (n, unit) => (/t/i.test(unit) || /ترا/.test(unit) ? `${n} ترابایت` : `${n} گیگ`);
const pick = (t, list) => { for (const [re, v] of list) if (re.test(t)) return v; return null; };

// [category test, filter name, extractor(title) → value | null]
const RULES = [
  [/^گوشی موبایل$|^تبلت/, "حافظه", (t) => { const m = t.match(/(?:حافظه|ظرفیت)\s*(\d+)\s*(?:رم\s*\d+\s*)?(گیگ|ترا|مگ)/); return m && m[2] !== "مگ" ? gb(m[1], m[2]) : /(\d+)\s*مگابایت/.test(t) && /^گوشی/.test(t) ? "زیر ۱ گیگ (ساده)" : null; }],
  [/^گوشی موبایل$|^تبلت/, "رم", (t) => { const m = t.match(/رم\s*(\d+)\s*(گیگ|مگ)?/); return m && (m[2] || "گیگ") === "گیگ" && +m[1] <= 24 ? `${m[1]} گیگ` : null; }],
  [/^گوشی موبایل$|^تبلت/, "شبکه", (t) => pick(t, [[/5g/i, "5G"], [/4g|lte/i, "4G"]])],
  [/^گوشی موبایل$/, "نوع", (t) => (/مگابایت/.test(t) || /دکمه/.test(t) ? "ساده (دکمه‌ای)" : /گیگ/.test(t) ? "هوشمند" : null)],
  [/^گوشی موبایل$|^تبلت/, "اصالت", (t) => (/(^|\s)(طرح|کپی|های کپی)\s/.test(t) ? "طرح/کپی" : "اصلی")],
  [/لپ ?تاپ|نوت ?بوک/, "پردازنده", (t) => pick(t, [[/ultra\s*9|core\s*9|i9/i, "Core i9 / Ultra 9"], [/ultra\s*7|core\s*7\b|i7/i, "Core i7 / Ultra 7"], [/ultra\s*5|core\s*5\b|i5/i, "Core i5 / Ultra 5"], [/i3|core\s*3\b/i, "Core i3"], [/ryzen\s*9/i, "Ryzen 9"], [/ryzen\s*7/i, "Ryzen 7"], [/ryzen\s*5/i, "Ryzen 5"], [/ryzen\s*3/i, "Ryzen 3"], [/celeron|pentium|n100|n4500|n4020/i, "Celeron / N"], [/\bm[1-4]\b/i, "Apple M"]])],
  [/لپ ?تاپ|نوت ?بوک/, "رم", (t) => { const m = t.match(/(\d+)\s*GB\s*(?:RAM|DDR|رم|LPDDR)/i) || t.match(/رم\s*(\d+)/) || t.match(/\b(4|8|12|16|24|32|36|48|64)\s*GB\b(?!\s*SSD)/i); return m ? `${m[1]} گیگ` : null; }],
  [/لپ ?تاپ|نوت ?بوک/, "حافظه", (t) => { const m = t.match(/(\d+)\s*(GB|TB)\s*(?:SSD|HDD|NVMe|M\.2)/i) || t.match(/(?:SSD|HDD)\s*(\d+)\s*(GB|TB)/i) || t.match(/\b(256|512|1|2)\s*(GB|TB)\b(?!\s*(?:RAM|DDR))/i); return m && !(m[2].toUpperCase() === "GB" && +m[1] < 128) ? gb(m[1], m[2]) : null; }],
  [/لپ ?تاپ|نوت ?بوک/, "گرافیک", (t) => pick(t, [[/rtx\s*\d{4}|gtx|rx\s*\d{4}|vga|\d+\s*GB\s*(?:VGA|گرافیک)/i, "گرافیک مجزا"]]) || "گرافیک داخلی"],
  [/لپ ?تاپ|نوت ?بوک|مانیتور|تلویزیون|تبلت/, "اندازه صفحه", (t) => { const m = t.match(/(?<![\d.])(\d{2,3}(?:\.\d)?)\s*(?:اینچ|inch|")/i) || t.match(/سایز\s*(\d{2,3})\s*اینچ/); return m ? `${m[1]} اینچ` : null; }],
  [/تلویزیون|مانیتور|پروژکتور|دوربین/, "کیفیت تصویر", (t) => pick(t, [[/8k/i, "8K"], [/4k|ultra hd|uhd|۴k/i, "4K"], [/full ?hd|fhd|1080/i, "Full HD"], [/\bhd\b|720/i, "HD"]])],
  [/تلویزیون/, "فناوری پنل", (t) => pick(t, [[/oled|اولد/i, "OLED"], [/qled|کیو ال ای دی|neo/i, "QLED"], [/qned|nanocell|نانو/i, "QNED / Nano"], [/led|ال ای دی/i, "LED"]])],
  [/تلویزیون|اسپیکر/, "هوشمند", (t) => (/هوشمند|smart|اندروید|android|webos|tizen/i.test(t) ? "هوشمند" : null)],
  [/شارژر|آداپتور|پاور ?بانک|کابل شارژ|کابل و مبدل/, "توان", (t) => { const m = t.match(/(\d+(?:\.\d)?)\s*(?:وات|w\b)/i); if (!m) return null; const w = +m[1]; return w < 15 ? "زیر ۱۵ وات" : w < 25 ? "۱۵ تا ۲۴ وات" : w < 45 ? "۲۵ تا ۴۴ وات (فست)" : w < 65 ? "۴۵ تا ۶۴ وات" : "۶۵ وات و بیشتر (لپ‌تاپ)"; }],
  [/شارژر|آداپتور|پاور ?بانک|کابل|هاب|مبدل/, "درگاه", (t) => pick(t, [[/لایتنینگ|lightning|آیفون|iphone/i, "لایتنینگ (آیفون)"], [/type ?-?c|usb ?-?c|تایپ ?سی|pd\b|\bc\b/i, "USB-C"], [/میکرو|micro/i, "میکرو USB"]])],
  [/شارژر|پاور ?بانک/, "تعداد پورت", (t) => { const m = t.match(/(\d|دو|سه|چهار|تک)\s*(?:پورت|خروجی)/); if (!m) return null; const n = { تک: 1, دو: 2, سه: 3, چهار: 4 }[m[1]] ?? +m[1]; return n >= 3 ? "۳ پورت و بیشتر" : n === 2 ? "۲ پورت" : "تک پورت"; }],
  [/پاور ?بانک|باتری/, "ظرفیت", (t) => { const m = t.match(/(\d{4,5})\s*(?:میلی ?آمپر|mah)/i); if (!m) return null; const v = +m[1]; return v < 10000 ? "زیر ۱۰ هزار" : v < 20000 ? "۱۰ تا ۲۰ هزار" : "۲۰ هزار و بیشتر"; }],
  [/هدفون|هدست|هندزفری|اسپیکر|ماوس|موس|کیبورد/, "اتصال", (t) => pick(t, [[/بی ?سیم|بیسیم|بلوتوث|wireless|bluetooth|ایرپاد|ایربادز/i, "بی‌سیم"], [/با ?سیم|سیمی|wired|جک/i, "باسیم"]])],
  [/هدفون|هدست|هندزفری/, "نوع", (t) => pick(t, [[/ایرپاد|ایربادز|airpods|buds|tws|داخل گوش|توگوشی/i, "توگوشی (ایربادز)"], [/گردنی|neck/i, "گردنی"], [/گیمینگ|gaming/i, "گیمینگ"], [/روگوشی|دورگوشی|هدبند|over|on-ear|wh-|solo|studio/i, "روگوشی"]])],
  [/هدفون|هدست|هندزفری/, "حذف نویز", (t) => (/حذف (فعال )?نویز|anc|noise/i.test(t) ? "دارد" : null)],
  [/دوربین مدار|ضبط کننده/, "رزولوشن", (t) => { const m = t.match(/(\d+(?:\.\d)?)\s*(?:مگاپیکسل|مگا پیکسل|mp\b)/i); return m ? `${m[1]} مگاپیکسل` : null; }],
  [/دوربین مدار/, "نوع", (t) => pick(t, [[/بولت|bullet/i, "بولت"], [/دام|dome/i, "دام"], [/چرخشی|ptz|اسپید/i, "چرخشی (PTZ)"], [/وای ?فای|wifi|بی ?سیم/i, "بی‌سیم (وای‌فای)"]])],
  [/دوربین مدار/, "فناوری", (t) => pick(t, [[/تحت شبکه|\bip\b|شبکه/i, "تحت شبکه (IP)"], [/ahd|tvi|cvi|آنالوگ/i, "آنالوگ HD"]])],
  [/عطر|ادکلن|ادو/, "حجم", (t) => { const m = t.match(/(\d+)\s*(?:میل|ml)/i); return m ? `${m[1]} میل` : null; }],
  [/عطر|ادکلن/, "نوع", (t) => pick(t, [[/ادو ?پرفیوم|edp|eau de parfum/i, "ادوپرفیوم"], [/ادو ?تویلت|edt|toilette/i, "ادوتویلت"], [/اکستریت|extrait|پرفیوم/i, "پرفیوم"], [/بادی|اسپلش|mist/i, "بادی اسپلش"]])],
  [/لامپ|چراغ|پروژکتور|ریسه|لوستر/, "توان", (t) => { const m = t.match(/(\d+)\s*(?:وات|w\b)/i); if (!m) return null; const w = +m[1]; return w <= 10 ? "تا ۱۰ وات" : w <= 30 ? "۱۱ تا ۳۰ وات" : w <= 100 ? "۳۱ تا ۱۰۰ وات" : "بیش از ۱۰۰ وات"; }],
  [/لامپ|چراغ|پروژکتور|ریسه/, "رنگ نور", (t) => pick(t, [[/آفتابی|گرم|warm/i, "آفتابی (گرم)"], [/مهتابی|سفید|سرد|cool/i, "مهتابی (سرد)"], [/rgb|رنگی|هفت ?رنگ/i, "رنگی (RGB)"], [/یخی|طبیعی|natural/i, "یخی (طبیعی)"]])],
  [/ساعت مچی|ساعت هوشمند|مچ ?بند/, "نوع", (t) => pick(t, [[/هوشمند|smart|مچ ?بند/i, "هوشمند"], [/دیجیتال/i, "دیجیتال"], [/عقربه/i, "عقربه‌ای"]])],
  [/ساعت|عینک|کفش|کتانی|صندل|دمپایی|بوت|کیف|کوله|لباس|تی ?شرت|شلوار|مانتو|پیراهن|کت|ژاکت|سویشرت|هودی|کاپشن|جوراب|شال|روسری|کلاه|عطر|ادکلن|زیورآلات|دستبند|گردنبند/, "مخاطب", (t) => pick(t, [[/بچگانه|کودک|نوزاد|پسرانه|دخترانه/, "بچگانه"], [/مردانه|آقایان/, "مردانه"], [/زنانه|بانوان/, "زنانه"], [/یونیسکس|اسپرت دو جنسه|unisex/i, "یونیسکس"]])],
  [/کفش|کتانی|صندل|دمپایی|بوت|کیف|کوله|کمربند|کاپشن|کت/, "جنس", (t) => pick(t, [[/چرم مصنوعی|چرم (?:pu|صنعتی)|pu\b/i, "چرم مصنوعی"], [/چرم|leather/i, "چرم طبیعی"], [/جیر/, "جیر"], [/پارچه|برزنت|کتان|نخی|مش|بافت/, "پارچه / بافت"], [/پلاستیک|ژله|eva|pvc/i, "پلاستیکی / ژله‌ای"]])],
  [/کفش|کتانی/, "کاربرد", (t) => pick(t, [[/طبی|راحتی/, "طبی / راحتی"], [/رانینگ|دویدن|پیاده ?روی|running/i, "پیاده‌روی و دویدن"], [/فوتبال|استوک|سالنی|فوتسال/, "فوتبال / سالنی"], [/مجلسی|رسمی/, "رسمی / مجلسی"], [/کوه|کوهنوردی|هایکینگ/, "کوهنوردی"], [/اسپرت|کتانی|اسنیکر/, "اسپرت روزمره"]])],
  [/سیم و کابل|کابل/, "سطح مقطع", (t) => { const m = t.match(/(\d+)\s*[×x\*]\s*(\d+(?:\.\d+)?)/); return m ? `${m[1]}×${m[2]}` : null; }],
  [/کلید|فیوز|کنتاکتور|رله|بیمتال|کلید اتوماتیک/, "جریان", (t) => { const m = t.match(/(\d+(?:\.\d+)?)\s*(?:آمپر|a\b)/i); return m ? `${m[1]} آمپر` : null; }],
  [/کلید|فیوز|کلید اتوماتیک/, "تعداد پل", (t) => pick(t, [[/تک ?پل|1p\b|یک ?پل/i, "تک‌پل"], [/دو ?پل|2p\b/i, "دوپل"], [/سه ?پل|3p\b/i, "سه‌پل"], [/چهار ?پل|4p\b/i, "چهارپل"]])],
  [/ژنراتور|موتور برق|پمپ|الکتروموتور|درایو|اینورتر/, "توان", (t) => { const m = t.match(/(\d+(?:\.\d+)?)\s*(کیلو ?وات|kw|اسب|hp|کاوا|kva)/i); if (!m) return null; return `${m[1]} ${/اسب|hp/i.test(m[2]) ? "اسب" : /kva|کاوا/i.test(m[2]) ? "کاوا" : "کیلووات"}`; }],
  [/ژنراتور|موتور برق|پمپ|کف ?کش|الکتروموتور/, "برق", (t) => pick(t, [[/سه ?فاز|380|۳۸۰/, "سه‌فاز"], [/تک ?فاز|220|۲۲۰/, "تک‌فاز"], [/بنزینی|بنزین/, "بنزینی"], [/دیزل|گازوئیل/, "دیزلی"]])],
  [/کیف و کاور گوشی|محافظ صفحه|تاچ و ال سی دی/, "مدل گوشی", (t) => pick(t, [[/آیفون|iphone/i, "آیفون"], [/سامسونگ|samsung|گلکسی/i, "سامسونگ"], [/شیائومی|xiaomi|ردمی|redmi|پوکو|poco/i, "شیائومی"], [/هواوی|huawei|آنر|honor/i, "هواوی / آنر"], [/نوکیا|nokia/i, "نوکیا"]])],
  [/کیف و کاور گوشی/, "جنس", (t) => pick(t, [[/سیلیکون|ژله/, "سیلیکونی / ژله‌ای"], [/چرم/, "چرمی"], [/کریستال|شفاف|clear/i, "شفاف"], [/مگ ?سیف|magsafe/i, "مگ‌سیف"], [/کیفی|فلیپ|کلاسوری/, "کیفی (فلیپ)"]])],
  [/محافظ صفحه/, "نوع", (t) => pick(t, [[/سرامیک/, "سرامیکی"], [/حریم شخصی|پرایوسی|privacy/i, "حریم شخصی"], [/مات/, "مات"], [/فول|تمام صفحه|full/i, "تمام صفحه"], [/شیشه|گلس|glass/i, "شیشه‌ای"]])],
];

const MIN_PRODUCTS = 20, MIN_COVERAGE = 0.2, MIN_VALUE = 3, MAX_VALUES = 12, MAX_FILTERS = 5;
const byCat = new Map();
rows.forEach((r, idx) => {
  const c = r[col.category_name];
  if (!c) return;
  if (!byCat.has(c)) byCat.set(c, []);
  byCat.get(c).push(idx);
});

/** Group products by value; keep the filter only if it is common and actually splits the category. */
function finalize(key, groups, total) {
  const kept = [...groups].filter(([, l]) => l.length >= MIN_VALUE).sort((a, b) => b[1].length - a[1].length).slice(0, MAX_VALUES);
  const covered = kept.reduce((n, [, l]) => n + l.length, 0);
  if (kept.length < 2 || covered / total < MIN_COVERAGE || kept[0][1].length / covered > 0.93) return null;
  const num = (v) => { const m = latin(v).match(/\d+(\.\d+)?/); return m ? Number(m[0]) * (/ترا/.test(v) ? 1024 : 1) : NaN; };
  const numeric = kept.every(([v]) => !isNaN(num(v)));
  const vals = numeric ? kept.sort((a, b) => num(a[0]) - num(b[0])) : kept;
  return { key, values: vals.map(([v, l]) => ({ v: fa(v), n: l.length, l })), coverage: covered / total };
}

// Spec fallback: merge spelling variants («بی سیم» / «بی‌سیم» / «بیسیم») under one display value.
const SKIP = /^(نام|نام محصول|مدل|کد|شناسه|برند|شرکت سازنده|سازنده|رنگ|سایز|توضیحات|ویژگی|سایر|تاریخ|ابعاد|وزن|بارکد|گارانتی|کشور|محتویات|لوازم همراه|اقلام همراه|طول|عرض|ارتفاع|قطر)/;
const canon = (v) => latin(v).toLowerCase().replace(/[\s\-_,،.()]/g, "").replace(/^(بله|دارد)$/, "دارد").replace(/^(خیر|ندارد|عدمپشتیبانی)$/, "ندارد");
function specFilters(idxs) {
  const keys = new Map();
  for (const idx of idxs) {
    const seen = new Set();
    for (const s of specsOf(rows[idx])) {
      const key = latin(s.key), raw = latin(s.value).replace(/,\s*$/, "");
      if (!key || !raw || raw.length > 24 || SKIP.test(key) || seen.has(key)) continue;
      seen.add(key);
      if (!keys.has(key)) keys.set(key, new Map());
      const m = keys.get(key), c = canon(raw);
      if (!m.has(c)) m.set(c, { names: new Map(), l: [] });
      const g = m.get(c);
      g.l.push(idx);
      g.names.set(raw, (g.names.get(raw) || 0) + 1);
    }
  }
  const out = [];
  for (const [key, m] of keys) {
    const groups = new Map([...m.values()].map((g) => [[...g.names].sort((a, b) => b[1] - a[1])[0][0], g.l]));
    const f = finalize(key, groups, idxs.length);
    if (f) out.push(f);
  }
  return out.sort((a, b) => b.coverage - a.coverage).slice(0, 3);
}

const cats = {}, attrs = {};
for (const [cat, idxs] of byCat) {
  if (idxs.length < MIN_PRODUCTS) continue;
  const filters = [];
  for (const [test, key, extract] of RULES) {
    if (!test.test(cat) || filters.some((f) => f.key === key)) continue;
    const groups = new Map();
    for (const idx of idxs) {
      const v = extract(latin(rows[idx][col.persian_title]));
      if (!v) continue;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(idx);
    }
    const f = finalize(key, groups, idxs.length);
    if (f) filters.push(f);
  }
  if (filters.length < 2) for (const f of specFilters(idxs)) if (!filters.some((x) => x.key === f.key)) filters.push(f);
  const chosen = filters.slice(0, MAX_FILTERS);
  if (!chosen.length) continue;
  cats[cat] = chosen.map((f, ki) => {
    f.values.forEach(({ l }, vi) => {
      for (const idx of l) {
        const id = rows[idx][col.product_id];
        attrs[id] = (attrs[id] || "|") + `${ki}.${vi}|`;
      }
    });
    return { key: f.key, values: f.values.map(({ v, n }) => ({ v, n })) };
  });
}
fs.closeSync(fd);
fs.writeFileSync(path.join(dir, "facets.json"), JSON.stringify({ products: rows.length, cats, attrs }));
console.log(`facets: ${Object.keys(cats).length} categories, ${Object.keys(attrs).length} of ${rows.length} products tagged`);
for (const c of ["گوشی موبایل", "لپ تاپ و نوت بوک", "تلویزیون", "شارژر گوشی", "هدفون، هدست و هندزفری", "کتانی و کفش اسپرت", "دوربین مدار بسته", "عطر و ادکلن", "کیف و کاور گوشی", "سیم و کابل برق ساختمان", "ساعت مچی عقربه‌ ای و دیجیتالی", "چراغ پنلی و سقفی", "عینک آفتابی"])
  if (cats[c]) console.log("•", c, "→", cats[c].map((f) => `${f.key} (${f.values.slice(0, 6).map((x) => x.v + ":" + x.n).join("، ")})`).join(" | "));
  else console.log("•", c, "→ —");
