"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import AuthDialog from "@/components/tj/auth-dialog";

export type User = { id: string; name: string; createdAt: string };
export type Origin = { lat: number; lon: number; label: string; source: "gps" | "manual" | "default" };
type Signal = { type: string; productId?: string; category?: string; brand?: string; price?: number; query?: string; ms?: number };

const DEFAULT_ORIGIN: Origin = { lat: 35.695, lon: 51.407, label: "جمهوری", source: "default" };
const read = <T,>(store: Storage | undefined, key: string, fallback: T): T => {
  try {
    const v = store?.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (store: Storage | undefined, key: string, value: unknown) => {
  try {
    if (value === null) store?.removeItem(key);
    else store?.setItem(key, JSON.stringify(value));
  } catch {}
};

type Ctx = {
  ready: boolean;
  user: User | null;
  incognito: boolean;
  origin: Origin;
  locating: boolean;
  setOrigin: (o: Origin) => void;
  locate: (quiet?: boolean) => void;
  openAuth: (tab?: "login" | "signup") => void;
  logout: () => Promise<void>;
  setIncognito: (on: boolean) => void;
  refreshUser: () => Promise<void>;
  track: (s: Signal) => void;
  api: (url: string, init?: RequestInit) => Promise<Response>;
};
const AppContext = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppContext);
  if (!c) throw Error("useApp outside AppProvider");
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [incognito, setIncognitoState] = useState(false),
    [origin, setOriginState] = useState<Origin>(DEFAULT_ORIGIN),
    [locating, setLocating] = useState(false),
    [auth, setAuth] = useState<{ open: boolean; tab: "login" | "signup" }>({ open: false, tab: "signup" }),
    [nudge, setNudge] = useState(false);
  const queue = useRef<Signal[]>([]);
  const incognitoRef = useRef(false);

  const api = useCallback(
    (url: string, init: RequestInit = {}) =>
      fetch(url, { ...init, headers: { ...(init.headers || {}), ...(incognitoRef.current ? { "x-incognito": "1" } : {}) } }),
    [],
  );
  const refreshUser = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/me");
      setUser((await r.json()).user ?? null);
    } catch {}
  }, []);

  const setOrigin = useCallback((o: Origin) => {
    setOriginState(o);
    write(globalThis.localStorage, "tj-origin", o);
  }, []);
  const locate = useCallback(
    (quiet = false) => {
      if (!navigator.geolocation) {
        if (!quiet) toast("مرورگر دسترسی موقعیت را پشتیبانی نمی‌کند؛ محله را دستی انتخاب کن.");
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setLocating(false);
          // Outside greater Tehran the shop data does not apply; keep the default district.
          const inTehran = p.coords.latitude > 35.4 && p.coords.latitude < 36 && p.coords.longitude > 51 && p.coords.longitude < 51.8;
          if (!inTehran) {
            if (!quiet) toast("موقعیتت بیرون از تهران است؛ فعلاً فروشگاه‌های تهران را از جمهوری نشان می‌دهیم.");
            return;
          }
          setOrigin({ lat: p.coords.latitude, lon: p.coords.longitude, label: "موقعیت من", source: "gps" });
          if (!quiet) toast.success("پیشنهادها حالا بر اساس نزدیک‌ترین فروشگاه‌ها به تو مرتب می‌شوند.");
        },
        () => {
          setLocating(false);
          if (!quiet) toast("دسترسی موقعیت داده نشد؛ می‌توانی محله را دستی انتخاب کنی.");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      );
    },
    [setOrigin],
  );

  useEffect(() => {
    const inc = read(globalThis.sessionStorage, "tj-incognito", false);
    incognitoRef.current = inc;
    setIncognitoState(inc);
    const saved = read<Origin | null>(globalThis.localStorage, "tj-origin", null);
    if (saved) setOriginState(saved);
    refreshUser().finally(() => {
      setReady(true);
    });
  }, [refreshUser]);

  // First visit: offer sign-in / incognito, then ask for location so shops are sorted by distance.
  useEffect(() => {
    if (!ready) return;
    const decided = read(globalThis.localStorage, "tj-auth-choice", null);
    // A soft, dismissible card after a few seconds instead of a modal over the page on arrival.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!user && !incognito && !decided) t = setTimeout(() => setNudge(true), 6000);
    const asked = read(globalThis.localStorage, "tj-location-asked", false);
    if (!asked && origin.source === "default") {
      write(globalThis.localStorage, "tj-location-asked", true);
      locate(true);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const setIncognito = useCallback((on: boolean) => {
    incognitoRef.current = on;
    setIncognitoState(on);
    write(globalThis.sessionStorage, "tj-incognito", on || null);
    if (on) queue.current = [];
  }, []);
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    toast("از حسابت خارج شدی.");
  }, []);

  // Interest signals are batched and never sent in incognito.
  const flush = useCallback(() => {
    if (incognitoRef.current || !queue.current.length) return;
    const signals = queue.current.splice(0, 50);
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signals }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  const track = useCallback(
    (s: Signal) => {
      if (incognitoRef.current) return;
      queue.current.push(s);
      if (queue.current.length >= 20) flush();
    },
    [flush],
  );
  useEffect(() => {
    const t = setInterval(flush, 8000);
    const hide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [flush]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      user,
      incognito,
      origin,
      locating,
      setOrigin,
      locate,
      openAuth: (tab = "login") => setAuth({ open: true, tab }),
      logout,
      setIncognito,
      refreshUser,
      track,
      api,
    }),
    [ready, user, incognito, origin, locating, setOrigin, locate, logout, setIncognito, refreshUser, track, api],
  );
  return (
    <AppContext.Provider value={value}>
      {children}
      {nudge && !user && !incognito && !auth.open && (
        <div dir="rtl" role="dialog" aria-label="ورود به ترب‌جو" className="fixed bottom-20 right-3 z-40 w-[min(92vw,340px)] rounded-2xl border border-tj-line bg-white p-4 shadow-2xl lg:bottom-6 lg:right-6">
          <p className="text-sm font-bold">گفت‌وگوها و پیشنهادهایت را نگه دارم؟</p>
          <p className="mt-1 text-xs leading-6 text-tj-muted">با یک اسم و رمز، تاریخچه و پیشنهادهای مخصوصت روی هر دستگاهی همراهت است.</p>
          <div className="mt-3 flex gap-2 text-sm">
            <button
              onClick={() => {
                setNudge(false);
                setAuth({ open: true, tab: "signup" });
              }}
              className="flex-1 rounded-xl bg-tj py-2 font-bold text-white hover:bg-tj-dark"
            >
              ثبت‌نام / ورود
            </button>
            <button
              onClick={() => {
                setNudge(false);
                write(globalThis.localStorage, "tj-auth-choice", "guest");
              }}
              className="rounded-xl px-3 py-2 text-tj-muted hover:text-tj-ink"
            >
              بعداً
            </button>
          </div>
          <button
            onClick={() => {
              setNudge(false);
              setIncognito(true);
              write(globalThis.localStorage, "tj-auth-choice", "incognito");
            }}
            className="mt-2 text-[11px] text-tj-muted underline"
          >
            ادامه به‌صورت ناشناس
          </button>
        </div>
      )}
      <AuthDialog
        open={auth.open}
        tab={auth.tab}
        onTab={(tab) => setAuth({ open: true, tab })}
        onClose={() => {
          setAuth((a) => ({ ...a, open: false }));
          if (!read(globalThis.localStorage, "tj-auth-choice", null)) write(globalThis.localStorage, "tj-auth-choice", "guest");
        }}
        onSignedIn={(u) => {
          setUser(u);
          setIncognito(false);
          write(globalThis.localStorage, "tj-auth-choice", "user");
          setAuth((a) => ({ ...a, open: false }));
          toast.success(`خوش اومدی ${u.name}!`);
        }}
        onIncognito={() => {
          setIncognito(true);
          write(globalThis.localStorage, "tj-auth-choice", "incognito");
          setAuth((a) => ({ ...a, open: false }));
          toast("حالت ناشناس روشن شد: چیزی از جست‌وجوها و گفت‌وگوهایت ذخیره نمی‌شود.");
        }}
      />
    </AppContext.Provider>
  );
}

/**
 * Active reading time on a product page. Counts only while the tab is visible AND the person
 * interacted (scroll, pointer, key, touch) in the last 30s, so a page left open while AFK does
 * not count as interest. Sent as one "dwell" signal when leaving the page.
 */
export function useDwell(productId?: string, meta: { category?: string; brand?: string; price?: number } = {}) {
  const { track } = useApp();
  const metaRef = useRef(meta);
  metaRef.current = meta;
  useEffect(() => {
    if (!productId) return;
    let active = 0,
      lastTick = Date.now(),
      lastInput = Date.now();
    const input = () => (lastInput = Date.now());
    const tick = () => {
      const t = Date.now();
      if (document.visibilityState === "visible" && t - lastInput < 30000) active += t - lastTick;
      lastTick = t;
    };
    const events = ["scroll", "pointermove", "pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach((e) => window.addEventListener(e, input, { passive: true }));
    const timer = setInterval(tick, 1000);
    const send = () => {
      tick();
      if (active > 3000) track({ type: "dwell", productId, ms: Math.round(active), ...metaRef.current });
      active = 0;
    };
    const hide = () => document.visibilityState === "hidden" && send();
    document.addEventListener("visibilitychange", hide);
    return () => {
      send();
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, input));
      document.removeEventListener("visibilitychange", hide);
    };
  }, [productId, track]);
}
