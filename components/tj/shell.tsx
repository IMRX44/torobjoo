"use client";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Sparkles, Route, Store, Map as MapIcon } from "lucide-react";
import Header from "@/components/tj/header";
import { Wordmark } from "@/components/tj/brand";
import { useApp } from "@/components/tj/app-context";
import { EyeOff } from "lucide-react";
import { CompareBar } from "@/components/tj/compare";

function IncognitoBar() {
  const { incognito, setIncognito } = useApp();
  if (!incognito) return null;
  return (
    <div className="flex items-center justify-center gap-3 bg-tj-ink px-4 py-1.5 text-xs text-white">
      <EyeOff size={14} />
      حالت ناشناس: جست‌وجوها، گفت‌وگوها و بازدیدهایت ذخیره نمی‌شوند.
      <button onClick={() => setIncognito(false)} className="underline">
        خروج
      </button>
    </div>
  );
}

export function BottomNav() {
  const path = usePathname();
  const items = [
    { href: "/", label: "خانه", icon: Home },
    { href: "/search", label: "دسته‌ها", icon: LayoutGrid },
    { href: "/map", label: "نقشه", icon: MapIcon },
    { href: "/chat", label: "دستیار", icon: Sparkles },
    { href: "/plan", label: "برنامه", icon: Route },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-tj-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const on = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] ${on ? "text-tj" : "text-tj-muted"}`}>
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-14 hidden border-t border-tj-line bg-white lg:block">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-10 sm:grid-cols-3 lg:px-8">
        <div>
          <Wordmark size={34} />
          <p className="mt-4 max-w-sm text-sm leading-7 text-tj-muted">
            قیمت‌ها را مقایسه کن، نزدیک‌ترین فروشگاه را پیدا کن و حضوری با خیال راحت بخر. قیمت‌ها ثبت‌شده‌اند؛ پیش از مراجعه موجودی را بپرس.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-bold">ترب‌جو</p>
          <ul className="space-y-2 text-tj-muted">
            <li><Link href="/search" className="hover:text-tj">همهٔ دسته‌بندی‌ها</Link></li>
            <li><Link href="/chat" className="hover:text-tj">دستیار خرید هوشمند</Link></li>
            <li><Link href="/map" className="hover:text-tj">نقشهٔ مراکز خرید</Link></li>
            <li><Link href="/plan" className="hover:text-tj">برنامهٔ خرید من</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-bold">فروشندگان</p>
          <Link href="/seller" className="inline-flex items-center gap-2 rounded-xl border border-tj-line px-4 py-2.5 hover:border-tj hover:text-tj">
            <Store size={16} /> ورود به پنل فروشنده
          </Link>
          <p className="mt-3 text-xs leading-6 text-tj-muted">به سؤال خریدارها جواب بده، قیمت‌ها را به‌روز کن و بازار را با دستیار فروشنده ببین.</p>
        </div>
      </div>
    </footer>
  );
}

export default function Shell({ children, footer = true, minimal = false }: { children: React.ReactNode; footer?: boolean; minimal?: boolean }) {
  return (
    <div className="min-h-dvh bg-tj-page text-tj-ink" dir="rtl">
      <IncognitoBar />
      <Suspense>
        <Header minimal={minimal} />
      </Suspense>
      {children}
      {footer && <Footer />}
      {footer && <div className="h-20 lg:hidden" aria-hidden />}
      <CompareBar />
      <BottomNav />
    </div>
  );
}
