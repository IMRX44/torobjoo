"use client";
import { useState } from "react";
import { EyeOff, LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Logo } from "@/components/tj/brand";
import type { User } from "@/components/tj/app-context";

export default function AuthDialog({
  open,
  tab,
  onTab,
  onClose,
  onSignedIn,
  onIncognito,
}: {
  open: boolean;
  tab: "login" | "signup";
  onTab: (t: "login" | "signup") => void;
  onClose: () => void;
  onSignedIn: (u: User) => void;
  onIncognito: () => void;
}) {
  const [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/auth/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error || "ورود انجام نشد.");
      setPassword("");
      onSignedIn(j.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ورود انجام نشد.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-md rounded-2xl p-0">
        <div className="p-6">
          <div className="mb-5 flex flex-col items-center text-center">
            <Logo size={52} />
            <DialogTitle className="mt-3 text-xl font-black">به ترب‌جو خوش اومدی</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-7 text-tj-muted">
              با حساب، گفت‌وگوها و پیشنهادهای مخصوصت روی هر دستگاهی همراهت می‌مانند.
            </DialogDescription>
          </div>
          <div className="mb-4 grid grid-cols-2 rounded-xl bg-tj-page p-1 text-sm">
            {(["signup", "login"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onTab(t);
                  setError("");
                }}
                className={`rounded-lg py-2 transition ${tab === t ? "bg-white font-bold text-tj shadow-sm" : "text-tj-muted"}`}
              >
                {t === "signup" ? "ثبت‌نام" : "ورود"}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">
              اسمت
              <input
                autoFocus
                required
                minLength={2}
                maxLength={30}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border border-tj-line bg-white px-3 py-2.5 outline-none focus:border-tj"
                placeholder="مثلاً سارا"
              />
            </label>
            <label className="block text-sm">
              رمز
              <input
                required
                minLength={4}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                className="mt-1.5 w-full rounded-xl border border-tj-line bg-white px-3 py-2.5 outline-none focus:border-tj"
                placeholder="حداقل ۴ کاراکتر"
              />
            </label>
            {error && <p className="rounded-lg bg-tj-soft px-3 py-2 text-sm text-tj-dark">{error}</p>}
            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-tj py-3 font-bold text-white transition hover:bg-tj-dark disabled:opacity-60"
            >
              {busy && <LoaderCircle size={17} className="animate-spin" />}
              {tab === "signup" ? "ساخت حساب" : "ورود"}
            </button>
          </form>
        </div>
        <div className="flex flex-col gap-2 border-t border-tj-line bg-tj-page/60 p-4 sm:flex-row">
          <button onClick={onIncognito} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-tj-line bg-white py-2.5 text-sm hover:bg-white/70">
            <EyeOff size={16} />
            ادامه به‌صورت ناشناس
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm text-tj-muted hover:text-tj-ink">
            فعلاً بدون حساب
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
