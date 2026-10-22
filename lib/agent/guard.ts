import { norm } from "../shopping";
// Server-side scope guard. Runs before the model sees a message, so the obvious cases cost
// nothing and cannot be talked around; subtler off-topic requests are left to the model,
// which must call decline_off_topic (handled in the chat route) instead of answering.

export const REFUSAL =
  "من فقط برای خرید حضوری کالا کمکت می‌کنم: پیدا کردن محصول، مقایسه، قیمت و فروشگاه‌های نزدیک. بگو چی می‌خوای بخری تا برات پیدا کنم.";
export const REFUSAL_SUGGESTIONS = ["هدفون QCY تا ۴ میلیون", "گوشی سامسونگ A56", "PS5"];

// Attempts to change the assistant's role or extract its instructions.
const injection: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)/i,
  /(disregard|forget|override)\s+(all\s+|your\s+|the\s+)?(rules|instructions|prompt)/i,
  /(system|developer|hidden|initial)\s*(prompt|message|instruction)/i,
  /(reveal|show|print|repeat|output)\s+(your\s+|the\s+)?(prompt|instructions|rules)/i,
  /\b(jailbreak|dan mode|developer mode|god mode)\b/i,
  /you\s+are\s+now|from\s+now\s+on\s+you|act\s+as\s+(a|an)\b|pretend\s+(to\s+be|you)/i,
  /(دستور|دستورات|دستورالعمل|قوانین|قانون)(\s*های)?\s*(قبلی|بالا|سیستم|اصلی|خودت)/,
  /(نادیده|فراموش)\s*(بگیر|کن)/,
  /(پرامپت|پرامت|پرومپت|سیستم\s*پرامپت)/,
  /از\s+(این|الان)\s+به\s+بعد\s+(تو|شما)/,
  /(نقش|رل)\s+(یک|یه)\s+\S+\s+(رو|را)\s+(بازی|ایفا)/,
  /(تو|شما)\s+(دیگه|دیگر)\s+(ترب\s*گرد|دستیار)\s+نیستی/,
  /(حالت|مود)\s+(توسعه\s*دهنده|دولوپر|ادمین)/,
  /(من|بنده)\s+(ادمین|توسعه\s*دهنده|برنامه\s*نویس)\s+(این|ترب)/,
];

// Topics this assistant never discusses, even when a product is mentioned.
const forbidden: RegExp[] = [
  /(^|\s)(هک|هکر|هکینگ|نفوذ|بدافزار|باج\s*افزار|فیشینگ|کرک|کیلاگر|بات\s*نت|دیداس)(\s|$|ی|ر|ش|ها|کردن)/,
  /\b(hack|hacking|hacker|exploit|malware|ransomware|phishing|keylogger|botnet|ddos|sql\s*injection|xss|crack(ed|ing)?|bypass\s+(icloud|frp|lock))\b/i,
  /(رمز|پسورد|قفل)\s+(گوشی|آیکلود|icloud|وای\s*فای|wifi)?\s*(دیگران|کسی|بقیه|رو\s+باز|را\s+باز|بشکن|دور\s+بزن)/,
  /(?<![؀-ۿ])(سیاست|سیاسی|انتخابات|رهبر\s*انقلاب|رئیس\s*جمهور|مذهب|دین)(\s|$|ی\s)/,
  /\b(politic|election|religion)/i,
  /(بنویس|بساز|تولید\s+کن)\s*.{0,25}(کد|اسکریپت|برنامه|شعر|مقاله|انشا|داستان|ایمیل|نامه)/,
  /(کد|اسکریپت|شعر|مقاله|انشا|داستان)\s*.{0,25}(بنویس|بساز)/,
  /\bwrite\s+(me\s+)?(a\s+|an\s+|some\s+)?(code|script|program|poem|essay|story|email)/i,
  /(ترجمه\s+کن|ترجمش\s+کن|\btranslate\b)/i,
  /(مواد\s+مخدر|اسلحه\s+(گرم|واقعی)|ساخت\s+(بمب|مواد\s+منفجره)|قمار\s*آنلاین)/,
];

export type GuardResult = { blocked: false } | { blocked: true; reason: "injection" | "forbidden" };

export function checkMessage(text: string): GuardResult {
  const raw = text.toLowerCase(),
    n = norm(text).replace(/\s+/g, " ");
  if (injection.some((r) => r.test(raw) || r.test(n))) return { blocked: true, reason: "injection" };
  if (forbidden.some((r) => r.test(raw) || r.test(n))) return { blocked: true, reason: "forbidden" };
  return { blocked: false };
}

// Phrases from the system prompt; seeing them in an answer means the model is leaking it.
const leakMarkers = [/You are «ترب‌(گرد|جو)»/i, /How to work:/i, /SCOPE \(strict\)/i, /decline_off_topic/i, /Context \(JSON\)/i];
export const leaksInstructions = (text: string) => leakMarkers.some((r) => r.test(text));
