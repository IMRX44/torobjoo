// Shared deterministic shopping logic; no model or external inference.
export type Row=Record<string, any>;
export function norm(s:string){return s.toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[\u064b-\u065f\u200c]/g,' ').replace(/سامسونگ/g,'samsung').replace(/شیائومی/g,'xiaomi').replace(/کیو\s*سی\s*وای/g,'qcy').replace(/آیفون|اپل|iphone/g,'apple').replace(/گوشی/g,'موبایل').trim();}
/** Toman amount from «۷۰ میلیون», «۷۰ ملیون», «۲ میلیون و ۵۰۰ هزار» or a bare «۷۰» (read as millions). */
export function budget(s:string){const t=norm(s).replace(/,/g,'');const m=t.match(/(\d+(?:\.\d+)?)\s*(میلیون|ملیون|هزار)?/);if(!m)return null;let v=Number(m[1]);if(/^م/.test(m[2]||''))v*=1e6;else if(m[2]==='هزار')v*=1000;else if(v<1000)v*=1e6;const k=m[2]&&/^م/.test(m[2])&&t.slice((m.index||0)+m[0].length).match(/و\s*(\d+)\s*هزار/);if(k)v+=Number(k[1])*1000;return v;}
export function json(v:any, fallback:any=[]){try{return typeof v==='string'?JSON.parse(v):v??fallback}catch{return fallback}}
export function distance(a:Row,b:Row){const rad=Math.PI/180;const x=(Number(b.lat)-Number(a.lat))*rad,y=(Number(b.lon)-Number(a.lon))*rad;return 6371*2*Math.asin(Math.sqrt(Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2));}
export function hours(shop:Row,date=new Date()){const h=json(shop.weekly_hours,{});const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const get=(t:string)=>p.find(x=>x.type===t)?.value||'';const day=get('weekday').toLowerCase();const time=Number(get('hour'))*60+Number(get('minute'));const days=['sun','mon','tue','wed','thu','fri','sat'];const prev=h[days[(days.indexOf(day)+6)%7]];const mins=(s:string)=>Number(s?.slice(0,2))*60+Number(s?.slice(3,5));if(prev?.shifts?.some((s:Row)=>mins(s.end_time)<mins(s.start_time)&&time<mins(s.end_time)))return 'باز';const today=h[day];if(!today)return 'نامشخص';if(today.status==='closed')return 'بسته';const shifts=today.shifts||[];if(!shifts.length||shifts.every((s:Row)=>s.start_time===s.end_time))return 'نامشخص';return shifts.some((s:Row)=>{const a=mins(s.start_time),b=mins(s.end_time);return b<a?time>=a:time>=a&&time<b})?'باز':'بسته';}
export const num=(n:any)=>n==null?'—':new Intl.NumberFormat('fa-IR').format(Number(n));
export const price=(n:any)=>n==null?'قیمت ثبت نشده':num(n)+' تومان';
export const dateLabel=(v:any)=>v&&!Number.isNaN(Date.parse(v))?new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium'}).format(new Date(v)):'تاریخ نامشخص';
export function search(products:Row[],q:string){const tokens=norm(q).split(/\s+/).filter(t=>!['نزدیک','جمهوری','می','خوام','خرید'].includes(t));return products.filter(p=>tokens.every(t=>norm(p.persian_title+' '+p.brand_name+' '+p.category_name+' '+p.model).includes(t)));}
/**
 * Planned visit time → Date. Accepts "19:00" (today, Tehran time), "tomorrow 11:00",
 * or a weekday "fri 18:30". Tehran is UTC+3:30 all year.
 */
export function arrivalDate(arrival?: string | null, now = new Date()): Date | null {
  const m = String(arrival || "").trim().toLowerCase().match(/^(?:(tomorrow|sat|sun|mon|tue|wed|thu|fri)\s+)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[2]), mi = Number(m[3]);
  if (h > 23 || mi > 59) return null;
  const offset = 210 * 60000;
  const local = new Date(now.getTime() + offset); // Tehran wall clock, read through UTC getters
  let days = 0;
  if (m[1] === "tomorrow") days = 1;
  else if (m[1]) {
    const target = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(m[1]);
    days = (target - local.getUTCDay() + 7) % 7;
  }
  const at = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, h, mi) - offset);
  // «ساعت ۱ شب» said at 23:00 means the coming 1 a.m., not the one 22 hours ago.
  if (!m[1] && at.getTime() < now.getTime() - 2 * 3600000) return new Date(at.getTime() + 86400000);
  return at;
}
export const arrivalLabel = (arrival?: string | null) => {
  const m = String(arrival || "").match(/^(?:(\w+)\s+)?(\d{1,2}:\d{2})$/);
  if (!m) return "";
  const h = Number(m[2].split(":")[0]);
  // «امشب ساعت ۱» reads better than «امروز ساعت ۱» for after-midnight visits.
  const day = { tomorrow: "فردا", sat: "شنبه", sun: "یکشنبه", mon: "دوشنبه", tue: "سه‌شنبه", wed: "چهارشنبه", thu: "پنجشنبه", fri: "جمعه" }[m[1] as string] || (h < 5 || h >= 21 ? "امشب" : "امروز");
  return `${day} ساعت ${m[2].replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d])}`;
};
/** «۵ دقیقه پیش» / «۳ روز پیش»: how fresh a price, answer or hours entry is. */
export function ago(v: any, now = Date.now()): string {
  const t = Date.parse(v);
  if (!v || Number.isNaN(t)) return "نامشخص";
  const m = Math.max(0, (now - t) / 60000), n = (x: number) => Math.round(x).toLocaleString("fa-IR");
  if (m < 2) return "همین الان";
  if (m < 60) return `${n(m)} دقیقه پیش`;
  if (m < 60 * 24) return `${n(m / 60)} ساعت پیش`;
  if (m < 60 * 24 * 14) return `${n(m / 1440)} روز پیش`;
  if (m < 60 * 24 * 60) return `${n(m / 10080)} هفته پیش`;
  return `${n(m / 43200)} ماه پیش`;
}
/** Age of a timestamp in days (Infinity when unknown). */
export const ageDays = (v: any, now = Date.now()) => (v && !Number.isNaN(Date.parse(v)) ? (now - Date.parse(v)) / 864e5 : Infinity);
