import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useRef, useState } from "react";
import { Search, Mic2, Play, Pause, ExternalLink, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/podcasts")({
  head: () => ({ meta: [
    { title: "پادکست — نگارش" },
    { name: "description", content: "جستجو و پخش پادکست‌ها از کاتالوگ عمومی (سازگار با Castbox / Apple Podcasts)." },
  ]}),
  component: PodcastsPage,
});

type Show = {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  feedUrl?: string;
  collectionViewUrl: string;
  primaryGenreName: string;
};
type Episode = { title: string; audio: string; pubDate: string; duration?: string; description?: string };

function itunesSearch(q: string): Promise<Show[]> {
  const url = `https://itunes.apple.com/search?media=podcast&limit=40&term=${encodeURIComponent(q)}`;
  return fetch(url).then((r) => r.json()).then((d: { results: Show[] }) => d.results);
}

async function fetchFeed(feedUrl: string): Promise<Episode[]> {
  // Try several public CORS-friendly proxies. allorigins.win often 5xx's; we
  // fall back to corsproxy.io and codetabs. Podcasts are public read-only.
  const proxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  ];
  let text = "";
  for (const build of proxies) {
    try {
      const res = await fetch(build(feedUrl), { headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" } });
      if (!res.ok) continue;
      const body = await res.text();
      if (body && body.length > 200 && (body.includes("<item") || body.includes("<entry"))) {
        text = body;
        break;
      }
    } catch { /* try next */ }
  }
  if (!text) throw new Error("no-feed");
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("bad-xml");
  const items = Array.from(doc.querySelectorAll("item, entry")).slice(0, 50);
  return items.map((it) => {
    const enc = it.querySelector("enclosure");
    let audio = enc?.getAttribute("url") || "";
    if (!audio) {
      // Atom style <link rel="enclosure" href="..."/>
      const linkEl = Array.from(it.querySelectorAll("link")).find((l) => l.getAttribute("rel") === "enclosure" || (l.getAttribute("type") || "").startsWith("audio"));
      audio = linkEl?.getAttribute("href") || "";
    }
    const title = it.querySelector("title")?.textContent?.trim() || "بدون عنوان";
    const pubDate = (it.querySelector("pubDate")?.textContent || it.querySelector("published")?.textContent || "").trim();
    const duration = it.getElementsByTagNameNS("*", "duration")[0]?.textContent?.trim();
    const description = (it.querySelector("description")?.textContent || it.querySelector("summary")?.textContent || "").trim();
    return { title, audio, pubDate, duration, description };
  }).filter((e) => e.audio);
}

function PodcastsPage() {
  const [q, setQ] = useState("");
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Show | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEps, setLoadingEps] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    itunesSearch(q || "trending").then((r) => { if (!cancel) setShows(r); }).finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [q]);

  useEffect(() => {
    if (!selected?.feedUrl) { setEpisodes([]); return; }
    let cancel = false;
    setLoadingEps(true);
    fetchFeed(selected.feedUrl)
      .then((eps) => !cancel && setEpisodes(eps))
      .catch(() => !cancel && setEpisodes([]))
      .finally(() => !cancel && setLoadingEps(false));
    return () => { cancel = true; };
  }, [selected]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = new Audio();
    audioRef.current = a;
    return () => { a.pause(); a.src = ""; };
  }, []);
  const playEp = (url: string) => {
    const a = audioRef.current;
    if (!a) return;
    if (current === url && playing) { a.pause(); setPlaying(false); return; }
    a.src = url;
    setCurrent(url);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader authed={false} />
      <div className="bg-gradient-to-b from-purple-950 via-slate-950 to-black min-h-screen">
        <div className="max-w-7xl mx-auto p-6 pb-32">
          <div className="flex items-center gap-3 mb-6 text-white">
            <Mic2 className="h-7 w-7 text-purple-400" />
            <h1 className="text-3xl font-bold">پادکست</h1>
            <span className="text-xs text-white/50 mr-auto">داده از Apple Podcasts (سازگار با Castbox)</span>
          </div>

          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی پادکست…"
              className="bg-black/40 border-white/10 text-white placeholder:text-white/40 pr-9 h-11 rounded-full"
            />
          </div>

          {selected ? (
            <div>
              <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white text-sm mb-4 flex items-center gap-1">
                <ChevronRight className="h-4 w-4" /> بازگشت به نتایج
              </button>
              <div className="rounded-3xl bg-white/5 backdrop-blur border border-white/10 p-6 flex flex-col md:flex-row gap-6 mb-6">
                <img src={selected.artworkUrl600} alt="" className="h-40 w-40 rounded-2xl shadow-2xl" />
                <div className="flex-1 text-white">
                  <h2 className="text-2xl font-bold">{selected.collectionName}</h2>
                  <div className="text-white/70">{selected.artistName}</div>
                  <div className="text-white/50 text-xs mt-1">{selected.primaryGenreName}</div>
                  <a href={selected.collectionViewUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-purple-300 hover:text-white text-sm">
                    باز کردن در Apple Podcasts <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              {loadingEps && <div className="text-white/60 text-center py-10">در حال بارگذاری اپیزودها…</div>}
              <div className="space-y-2">
                {episodes.map((ep) => {
                  const active = current === ep.audio;
                  return (
                    <div key={ep.audio} className={`flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition ${active ? "ring-1 ring-purple-400" : ""}`}>
                      <button onClick={() => playEp(ep.audio)} className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center shrink-0">
                        {active && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-white truncate text-sm font-medium">{ep.title}</div>
                        <div className="text-white/50 text-xs">{new Date(ep.pubDate).toLocaleDateString("fa-IR")} {ep.duration ? `· ${ep.duration}` : ""}</div>
                      </div>
                      <a href={ep.audio} target="_blank" rel="noreferrer" className="text-white/50 hover:text-white text-xs flex items-center gap-1">
                        باز کردن فایل <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  );
                })}
                {!loadingEps && episodes.length === 0 && <div className="text-white/50 text-center py-10">اپیزودی پیدا نشد.</div>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {loading && <div className="col-span-full text-white/60 text-center py-10">در حال جستجو…</div>}
              {shows.map((s) => (
                <button
                  key={s.collectionId}
                  onClick={() => setSelected(s)}
                  className="text-right group"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden bg-black/40 shadow-lg group-hover:shadow-2xl group-hover:scale-[1.03] transition">
                    <img src={s.artworkUrl600} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="text-white text-sm mt-2 truncate">{s.collectionName}</div>
                  <div className="text-white/50 text-xs truncate">{s.artistName}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}