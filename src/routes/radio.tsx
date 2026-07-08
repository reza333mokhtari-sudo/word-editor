import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Radio as RadioIcon, Play, Pause, Volume2, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/radio")({
  head: () => ({ meta: [
    { title: "رادیو زنده — نگارش" },
    { name: "description", content: "جستجو و پخش هزاران ایستگاه رادیویی زنده از سراسر جهان." },
  ]}),
  component: RadioPage,
});

type Station = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  country: string;
  tags: string;
  bitrate: number;
  codec: string;
  homepage: string;
};

const API = "https://de1.api.radio-browser.info/json";

function RadioPage() {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    audioRef.current = a;
    return () => { a.pause(); a.src = ""; };
  }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "60", hidebroken: "true", order: "clickcount", reverse: "true" });
    if (q) params.set("name", q);
    if (country) params.set("country", country);
    const url = q || country
      ? `${API}/stations/search?${params}`
      : `${API}/stations/topclick/60`;
    fetch(url)
      .then((r) => r.json())
      .then((d: Station[]) => { if (!cancel) setStations(d); })
      .catch(() => { if (!cancel) setStations([]); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [q, country]);

  const play = (s: Station) => {
    const a = audioRef.current;
    if (!a) return;
    if (current?.stationuuid === s.stationuuid && playing) { a.pause(); setPlaying(false); return; }
    a.src = s.url_resolved;
    setCurrent(s);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const countries = useMemo(() => ["", "Iran", "United States", "Germany", "United Kingdom", "France", "Turkey", "Spain", "Italy", "Japan"], []);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader authed={false} />
      <div className="bg-gradient-to-b from-emerald-950 via-slate-950 to-black min-h-screen">
        <div className="max-w-6xl mx-auto p-6 pb-32">
          <div className="flex items-center gap-3 mb-6 text-white">
            <RadioIcon className="h-7 w-7 text-emerald-400" />
            <h1 className="text-3xl font-bold">رادیو زنده</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="جستجوی ایستگاه (نام، شهر، ژانر)…"
                className="bg-black/40 border-white/10 text-white placeholder:text-white/40 pr-9 h-11 rounded-full"
              />
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-black/40 border border-white/10 text-white rounded-full h-11 px-4 text-sm"
            >
              {countries.map((c) => <option key={c} value={c}>{c || "همه کشورها"}</option>)}
            </select>
          </div>

          {loading && <div className="text-white/60 text-center py-10">در حال بارگذاری…</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stations.map((s) => {
              const active = current?.stationuuid === s.stationuuid;
              return (
                <div
                  key={s.stationuuid}
                  className={`group rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 flex items-center gap-3 hover:bg-white/10 transition ${active ? "ring-2 ring-emerald-400" : ""}`}
                >
                  <div className="h-14 w-14 rounded-xl bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                    {s.favicon ? <img src={s.favicon} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} /> : <RadioIcon className="h-6 w-6 text-white/40" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white truncate font-medium">{s.name.trim()}</div>
                    <div className="text-white/50 text-xs truncate flex items-center gap-1">
                      <Globe className="h-3 w-3" />{s.country || "?"} · {s.codec} {s.bitrate ? `${s.bitrate}kb` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => play(s)}
                    className="h-10 w-10 rounded-full bg-emerald-400 text-black flex items-center justify-center hover:scale-105 transition"
                    aria-label="پخش"
                  >
                    {active && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
          {!loading && stations.length === 0 && <div className="text-white/50 text-center py-10">نتیجه‌ای پیدا نشد.</div>}
        </div>
      </div>

      {current && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-black/90 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 py-3">
            <div className="h-12 w-12 rounded-md bg-emerald-500/20 flex items-center justify-center">
              <RadioIcon className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white truncate text-sm font-medium">{current.name.trim()}</div>
              <div className="text-white/50 text-xs truncate">{current.country} · زنده</div>
            </div>
            <button onClick={() => play(current)} className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="hidden md:flex items-center gap-2 text-white/60 w-40">
              <Volume2 className="h-4 w-4" />
              <Slider value={[volume * 100]} max={100} step={1} onValueChange={(v) => setVolume(v[0] / 100)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}