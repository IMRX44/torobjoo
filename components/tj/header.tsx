"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  MapPin,
  ChevronDown,
  User as UserIcon,
  LogOut,
  EyeOff,
  Sparkles,
  Route,
  Store,
  Menu,
  X,
  LocateFixed,
  LoaderCircle,
  MessageSquare,
} from "lucide-react";
import { Wordmark } from "@/components/tj/brand";
import { useApp } from "@/components/tj/app-context";
import { ICONS, useTaxonomy, type Top } from "@/components/tj/taxonomy";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const PLACES = [
  { label: "جمهوری", lat: 35.695, lon: 51.407 },
  { label: "پاساژ علاالدین", lat: 35.6949, lon: 51.4071 },
  { label: "پاساژ چارسو", lat: 35.6933, lon: 51.4108 },
  { label: "فردوسی", lat: 35.6957, lon: 51.4205 },
  { label: "شیخ هادی", lat: 35.6957, lon: 51.4005 },
  { label: "بهارستان", lat: 35.6922, lon: 51.4317 },
  { label: "ونک", lat: 35.7579, lon: 51.4097 },
  { label: "تجریش", lat: 35.8036, lon: 51.4338 },
];

export function LocationPicker({ compact = false }: { compact?: boolean }) {
  const { origin, setOrigin, locate, locating } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm text-tj-ink transition hover:bg-tj-page" aria-label="محدودهٔ خرید">
          <MapPin size={18} className="text-tj" />
          <span className={compact ? "hidden xl:inline" : ""}>{origin.label}</span>
          <ChevronDown size={14} className="text-tj-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="end" className="w-72 rounded-2xl p-3">
        <p className="mb-2 text-xs text-tj-muted">پیشنهادها بر اساس نزدیک‌ترین فروشگاه‌ها به این نقطه مرتب می‌شوند.</p>
        <button
          onClick={() => {
            locate();
            setOpen(false);
          }}
          className="mb-2 flex w-full items-center gap-2 rounded-xl bg-tj-soft px-3 py-2.5 text-sm font-bold text-tj"
        >
          {locating ? <LoaderCircle size={16} className="animate-spin" /> : <LocateFixed size={16} />}
          استفاده از موقعیت فعلی من
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          {PLACES.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setOrigin({ ...p, source: "manual" });
                setOpen(false);
              }}
              className={`rounded-lg border px-2 py-2 text-sm ${origin.label === p.label ? "border-tj bg-tj-soft text-tj" : "border-tj-line hover:bg-tj-page"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const { user, incognito, openAuth, logout, setIncognito } = useApp();
  if (incognito)
    return (
      <button
        onClick={() => setIncognito(false)}
        title="خروج از حالت ناشناس"
        className="flex h-11 items-center gap-1.5 rounded-xl bg-tj-ink px-3 text-sm text-white"
      >
        <EyeOff size={16} />
        <span className="hidden sm:inline">ناشناس</span>
      </button>
    );
  if (!user)
    return (
      <button onClick={() => openAuth("login")} className="flex h-11 items-center gap-1.5 rounded-xl border border-tj-line px-3 text-sm hover:bg-tj-page">
        <UserIcon size={17} />
        <span className="hidden sm:inline">ورود / ثبت‌نام</span>
      </button>
    );
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <button className="flex h-11 items-center gap-2 rounded-xl border border-tj-line px-2.5 text-sm hover:bg-tj-page">
          <span className="grid size-7 place-items-center rounded-full bg-tj text-xs font-bold text-white">{user.name.slice(0, 1)}</span>
          <span className="hidden max-w-24 truncate sm:inline">{user.name}</span>
          <ChevronDown size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href="/chat">
            <MessageSquare size={15} /> گفت‌وگوهای من
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/plan">
            <Route size={15} /> برنامهٔ خرید
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIncognito(true)}>
          <EyeOff size={15} /> حالت ناشناس
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-tj">
          <LogOut size={15} /> خروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter(),
    params = useSearchParams(),
    pathname = usePathname();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (pathname === "/search") setQ(params.get("q") || "");
  }, [pathname, params]);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/search");
      }}
      className="flex h-11 min-w-0 flex-1 items-center rounded-xl bg-tj-page px-3 ring-tj/30 focus-within:bg-white focus-within:ring-2"
    >
      <Search size={19} className="shrink-0 text-tj-muted" />
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="جست‌وجو"
        placeholder="جست‌وجو در ترب‌جو… مثلاً «کفش مردانه سایز ۴۵»"
        className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-tj-muted"
      />
      {q && (
        <button type="button" onClick={() => setQ("")} aria-label="پاک کردن" className="text-tj-muted">
          <X size={16} />
        </button>
      )}
    </form>
  );
}

export function categoryHref(top: string, sub?: string, leaf?: string) {
  if (leaf) return `/search?category=${encodeURIComponent(leaf)}`;
  return `/search?group=${encodeURIComponent(sub ? top + "/" + sub : top)}`;
}

function MegaMenu({ tops }: { tops: Top[] }) {
  const [active, setActive] = useState<string | null>(null);
  const close = useRef<ReturnType<typeof setTimeout> | null>(null);
  const top = tops.find((t) => t.id === active);
  const enter = (id: string) => {
    if (close.current) clearTimeout(close.current);
    setActive(id);
  };
  const leave = () => (close.current = setTimeout(() => setActive(null), 150));
  return (
    <div className="relative hidden border-t border-tj-line lg:block" onMouseLeave={leave}>
      <nav className="tj-no-scrollbar mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-4 lg:px-8">
        {tops.map((t) => {
          const Icon = ICONS[t.id] || Sparkles;
          return (
            <Link
              key={t.id}
              href={categoryHref(t.id)}
              onMouseEnter={() => enter(t.id)}
              className={`flex shrink-0 items-center gap-1 border-b-2 px-2 py-2.5 text-[12.5px] transition ${active === t.id ? "border-tj text-tj" : "border-transparent text-tj-ink hover:text-tj"}`}
            >
              <Icon size={16} strokeWidth={1.7} />
              {t.name}
            </Link>
          );
        })}
      </nav>
      {top && (
        <div onMouseEnter={() => enter(top.id)} className="absolute inset-x-0 top-full z-40 border-t border-tj-line bg-white shadow-xl">
          <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-x-8 gap-y-5 px-8 py-6 xl:grid-cols-5">
            {top.subs
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.name}>
                  <Link href={categoryHref(top.id, s.name)} onClick={() => setActive(null)} className="mb-2 flex items-center gap-1 border-r-2 border-tj pr-2 text-sm font-bold hover:text-tj">
                    {s.name}
                  </Link>
                  <ul className="space-y-1.5">
                    {s.leaves.slice(0, 7).map((leaf) => (
                      <li key={leaf}>
                        <Link href={categoryHref(top.id, s.name, leaf)} onClick={() => setActive(null)} className="block truncate text-[13px] text-tj-muted hover:text-tj">
                          {leaf}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({ minimal = false }: { minimal?: boolean }) {
  const tops = useTaxonomy();
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-tj-line bg-white">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-3 py-2.5 sm:gap-3 lg:px-8">
        <button onClick={() => setMenu(true)} className="grid size-11 place-items-center rounded-xl hover:bg-tj-page lg:hidden" aria-label="دسته‌بندی‌ها">
          <Menu size={21} />
        </button>
        <Link href="/" className="shrink-0" aria-label="ترب‌جو، صفحهٔ اصلی">
          <span className="hidden sm:block">
            <Wordmark size={34} />
          </span>
          <span className="sm:hidden">
            <Wordmark size={30} sub={false} />
          </span>
        </Link>
        <div className="mx-1 hidden min-w-0 flex-1 md:flex lg:mx-6">
          <SearchBox />
        </div>
        <div className="mr-auto flex items-center gap-1 md:mr-0">
          <LocationPicker compact />
          <Link href="/chat" className="hidden h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-tj-ink hover:bg-tj-page lg:flex">
            <Sparkles size={17} className="text-tj" />
            دستیار خرید
          </Link>
          <Link href="/plan" className="hidden h-11 items-center gap-1.5 rounded-xl px-3 text-sm hover:bg-tj-page xl:flex">
            <Route size={17} />
            برنامهٔ من
          </Link>
          <UserMenu />
        </div>
      </div>
      <div className="px-3 pb-2.5 md:hidden">
        <SearchBox />
      </div>
      {!minimal && <MegaMenu tops={tops} />}
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="right" dir="rtl" className="w-[86vw] max-w-sm overflow-y-auto p-0">
          <SheetTitle className="border-b border-tj-line p-4">
            <Wordmark size={30} />
          </SheetTitle>
          <div className="space-y-1 p-3">
            <Link onClick={() => setMenu(false)} href="/chat" className="flex items-center gap-2 rounded-xl bg-tj-soft px-3 py-3 font-bold text-tj">
              <Sparkles size={18} /> دستیار خرید هوشمند
            </Link>
            <Link onClick={() => setMenu(false)} href="/plan" className="flex items-center gap-2 rounded-xl px-3 py-3">
              <Route size={18} /> برنامهٔ خرید من
            </Link>
            <Link onClick={() => setMenu(false)} href="/seller" className="flex items-center gap-2 rounded-xl px-3 py-3">
              <Store size={18} /> پنل فروشندگان
            </Link>
          </div>
          <p className="px-6 pb-2 pt-3 text-xs text-tj-muted">دسته‌بندی‌ها</p>
          {tops.map((t) => {
            const Icon = ICONS[t.id] || Sparkles;
            return (
              <details key={t.id} className="group border-t border-tj-line">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-3 text-sm">
                  <Icon size={17} className="text-tj" />
                  {t.name}
                  <ChevronDown size={15} className="mr-auto transition group-open:rotate-180" />
                </summary>
                <div className="bg-tj-page/60 pb-2">
                  <Link onClick={() => setMenu(false)} href={categoryHref(t.id)} className="block px-12 py-2 text-sm font-bold text-tj">
                    همهٔ {t.name}
                  </Link>
                  {t.subs
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <Link key={s.name} onClick={() => setMenu(false)} href={categoryHref(t.id, s.name)} className="block px-12 py-2 text-sm">
                        {s.name}
                      </Link>
                    ))}
                </div>
              </details>
            );
          })}
        </SheetContent>
      </Sheet>
    </header>
  );
}
