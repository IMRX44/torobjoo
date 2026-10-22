"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

// Persian dictation through the browser's speech recognition (Chrome/Edge). Hidden where unsupported.
export default function MicButton({ onText, onFinal, className = "" }: { onText: (t: string) => void; onFinal?: (t: string) => void; className?: string }) {
  const [supported, setSupported] = useState(false),
    [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  useEffect(() => {
    setSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);
  if (!supported) return null;
  function start() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = "fa-IR";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e: any) => {
      let text = "";
      for (const res of e.results) text += res[0].transcript;
      finalText = text;
      onText(text);
    };
    r.onerror = (e: any) => {
      setListening(false);
      if (e.error === "not-allowed") toast("اجازهٔ میکروفون داده نشد.");
      else if (e.error !== "aborted" && e.error !== "no-speech") toast("صدا تشخیص داده نشد؛ دوباره امتحان کن.");
    };
    r.onend = () => {
      setListening(false);
      if (finalText.trim()) onFinal?.(finalText.trim());
    };
    rec.current = r;
    setListening(true);
    r.start();
  }
  return (
    <button
      type="button"
      onClick={() => (listening ? rec.current?.stop() : start())}
      aria-label={listening ? "توقف ضبط صدا" : "گفتن با صدا"}
      title={listening ? "توقف" : "با صدا بگو"}
      className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${listening ? "animate-pulse bg-tj text-white" : "text-tj-muted hover:bg-tj-page hover:text-tj"} ${className}`}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
