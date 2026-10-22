// ترب‌جو mark: a radish («ترب») with a search lens, in the Torob-style red.
export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M24 13c-3-6-8-8-12-7 1 5 5 8 10 9M24 13c2-7 7-10 12-9-1 5-5 9-11 10" fill="#3aa45b" />
      <path d="M24 12c1-4 1-7 0-9" stroke="#2f8a4b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M24 14c8.5 0 13 6 13 13.5S31 42 24 46c-7-4-13-11-13-18.5S15.5 14 24 14Z" fill="#d73948" />
      <circle cx="24" cy="27" r="7" fill="#fff" />
      <circle cx="24" cy="27" r="4.4" fill="none" stroke="#d73948" strokeWidth="2.4" />
      <path d="m27.2 30.2 3.4 3.4" stroke="#d73948" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
export function Wordmark({ size = 36, sub = true }: { size?: number; sub?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={size} />
      <span className="leading-none">
        <span className="block font-black text-tj" style={{ fontSize: size * 0.62 }}>
          ترب‌جو
        </span>
        {sub && <span className="mt-1 block text-[11px] text-tj-muted">خرید حضوری، هوشمند</span>}
      </span>
    </span>
  );
}
