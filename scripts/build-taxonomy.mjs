// Groups the dataset's 3,400+ flat category names into a Torob-style two-level menu.
// Run once after build-data (uses LLM_* from .env); writes data/taxonomy.json.
//   node scripts/build-taxonomy.mjs [--only-missing]
import fs from "node:fs";
import { fetch, ProxyAgent } from "undici";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const proxy = env.LLM_PROXY && env.LLM_PROXY !== "off" && !env.LLM_BASE_URL.startsWith("http://") ? new ProxyAgent(env.LLM_PROXY) : undefined;

export const TOP = [
  { id: "mobile", name: "موبایل و تبلت", subs: ["گوشی موبایل", "تبلت و کتاب‌خوان", "ساعت و مچ‌بند هوشمند", "لوازم جانبی موبایل", "قطعات موبایل و تبلت"] },
  { id: "computer", name: "لپ‌تاپ و کامپیوتر", subs: ["لپ‌تاپ", "کامپیوتر و مانیتور", "قطعات کامپیوتر", "حافظه و ذخیره‌سازی", "شبکه و اینترنت", "ماشین‌های اداری", "لوازم جانبی کامپیوتر"] },
  { id: "av", name: "صوتی و تصویری", subs: ["هدفون و هندزفری", "اسپیکر و سیستم صوتی", "تلویزیون و پروژکتور", "دوربین و عکاسی", "کنسول و بازی", "دوربین مداربسته و امنیتی", "تجهیزات صوتی حرفه‌ای"] },
  { id: "appliance", name: "لوازم خانگی برقی", subs: ["یخچال و فریزر", "لباسشویی و ظرفشویی", "جارو برقی", "لوازم برقی آشپزخانه", "سرمایش و گرمایش", "اتو و لوازم برقی شخصی", "قطعات لوازم خانگی"] },
  { id: "home", name: "خانه و آشپزخانه", subs: ["ظروف و لوازم آشپزخانه", "مبلمان", "دکوراسیون", "روشنایی", "فرش و منسوجات", "شستشو و نظافت", "حمام و سرویس بهداشتی"] },
  { id: "fashion", name: "مد و پوشاک", subs: ["پوشاک مردانه", "پوشاک زنانه", "کفش", "کیف و چمدان", "ساعت و زیورآلات", "اکسسوری"] },
  { id: "beauty", name: "زیبایی و سلامت", subs: ["آرایشی", "بهداشتی و مراقبت پوست و مو", "عطر و ادکلن", "لوازم برقی آرایشی", "تجهیزات پزشکی", "مکمل و دارو"] },
  { id: "tools", name: "ابزار و ساختمان", subs: ["ابزار برقی", "ابزار دستی", "تجهیزات ایمنی و کار", "برق و الکترونیک", "تاسیسات و لوله‌کشی", "مصالح ساختمانی", "باغبانی"] },
  { id: "car", name: "خودرو و موتور", subs: ["لوازم جانبی خودرو", "قطعات یدکی خودرو", "صوتی و تصویری خودرو", "موتورسیکلت", "لاستیک، روغن و نگهداری"] },
  { id: "sport", name: "ورزش و سفر", subs: ["پوشاک و کفش ورزشی", "تجهیزات ورزشی", "بدنسازی و تناسب اندام", "دوچرخه و اسکوتر", "کوهنوردی و کمپینگ", "مکمل ورزشی"] },
  { id: "kids", name: "کودک و نوزاد", subs: ["اسباب‌بازی", "لوازم نوزاد و سیسمونی", "پوشاک و کفش کودک", "بهداشت کودک"] },
  { id: "culture", name: "کتاب، تحریر و هنر", subs: ["کتاب", "لوازم تحریر و اداری", "ابزار هنری", "آلات موسیقی"] },
  { id: "market", name: "سوپرمارکت و حیوانات", subs: ["خوراکی و نوشیدنی", "حیوانات خانگی"] },
  { id: "industry", name: "صنعتی و تخصصی", subs: ["تجهیزات صنعتی", "تجهیزات فروشگاهی و رستورانی", "تجهیزات آزمایشگاهی", "کشاورزی و دامپروری", "سایر"] },
];

const categories = JSON.parse(fs.readFileSync("data/categories.json", "utf8"));
const file = "data/taxonomy.json";
const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).map || {} : {};
const todo = categories.map((c) => c.name).filter((n) => !process.argv.includes("--only-missing") || !existing[n]);
const menu = TOP.map((t, i) => `${i}. ${t.name}: ${t.subs.map((s, j) => `${j}=${s}`).join("، ")}`).join("\n");

async function classify(batch, attempt = 0) {
  const prompt = `Assign each Persian product category to ONE top category and ONE subcategory from this menu (numbers are indexes):
${menu}

Answer ONLY with JSON: {"<category name exactly as given>": [topIndex, subIndex], ...}
Categories:
${batch.map((n) => "- " + n).join("\n")}`;
  try {
    const r = await fetch(env.LLM_BASE_URL.replace(/\/$/, "") + "/chat/completions", {
      dispatcher: proxy,
      method: "POST",
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.LLM_MODEL, messages: [{ role: "user", content: prompt }], max_tokens: 8000 }),
      signal: AbortSignal.timeout(90000),
    });
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return json;
  } catch (e) {
    console.error(`batch retry ${attempt + 1}:`, e.message);
    if (attempt < 2) return classify(batch, attempt + 1);
    return {};
  }
}

const map = { ...existing };
const size = 50;
const batches = [];
for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
let done = 0;
for (let i = 0; i < batches.length; i += 8) {
  const results = await Promise.all(batches.slice(i, i + 8).map((b) => classify(b)));
  for (const res of results)
    for (const [name, v] of Object.entries(res)) {
      const [t, s] = Array.isArray(v) ? v.map(Number) : [];
      if (TOP[t] && TOP[t].subs[s] && categories.some((c) => c.name === name)) map[name] = [TOP[t].id, TOP[t].subs[s]];
    }
  done += results.length;
  console.log(`batches ${done}/${batches.length}, mapped ${Object.keys(map).length}/${categories.length}`);
  fs.writeFileSync(file, JSON.stringify({ top: TOP, map }));
}
const missing = categories.filter((c) => !map[c.name]).map((c) => c.name);
fs.writeFileSync(file, JSON.stringify({ top: TOP, map }, null, 0));
console.log("unmapped:", missing.length, missing.slice(0, 20).join(" | "));
