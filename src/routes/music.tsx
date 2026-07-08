import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Volume2, Search, Home, Library, ListMusic, Radio, Mic2, PlusCircle, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ElasticSlider } from "@/components/ui/elastic-slider";
import { usePlayer, fmt, type Track } from "@/components/player/PlayerContext";

export const Route = createFileRoute("/music")({
  head: () => ({ meta: [
    { title: "پخش‌کننده موزیک — نگارش" },
    { name: "description", content: "پخش‌کننده موزیک زیبا با ظاهری الهام گرفته از Spotify و Deezer." },
  ]}),
  component: MusicPage,
});

type SearchResult = {
  id: string;
  source: "SoundCloud" | "Audius";
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  stream: string;                 // for Audius: playable URL. For SoundCloud: permalink.
  scId?: number;                  // SoundCloud track id (for iframe widget).
  links: { spotify?: string; youtube?: string; apple?: string; deezer?: string; amazon?: string };
};

// Audius = free, legal, full-length streaming (no DRM). We resolve a
// discovery node once and reuse it for both search + stream URLs.
let AUDIUS_HOST: string | null = null;
async function audiusHost(): Promise<string> {
  if (AUDIUS_HOST) return AUDIUS_HOST;
  try {
    const r = await fetch("https://api.audius.co").then((x) => x.json());
    const hosts: string[] = r?.data || [];
    AUDIUS_HOST = hosts[Math.floor(Math.random() * hosts.length)] || "https://discoveryprovider.audius.co";
  } catch {
    AUDIUS_HOST = "https://discoveryprovider.audius.co";
  }
  return AUDIUS_HOST;
}

// Public widget client_id — no server needed. If SoundCloud rotates it,
// searchSoundCloud() throws and we transparently fall back to Audius.
const SC_CLIENT_ID = "iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX";

async function searchSoundCloud(q: string): Promise<SearchResult[]> {
  const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${SC_CLIENT_ID}&limit=25`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("soundcloud");
  const json = await res.json();
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const t of (json?.collection || []) as Array<Record<string, unknown>>) {
    const id = Number(t.id || 0);
    if (!id) continue;
    const title = String(t.title || "").trim();
    const user = (t.user as Record<string, unknown>) || {};
    const artist = String(user.username || "").trim();
    if (!title || !artist) continue;
    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const artworkRaw = String(t.artwork_url || user.avatar_url || "");
    const cover = artworkRaw.replace("-large.", "-t500x500.");
    const duration = Math.round(Number(t.duration || 0) / 1000);
    const permalink = String(t.permalink_url || "");
    const query = encodeURIComponent(`${artist} ${title}`);
    out.push({
      id: `sc-${id}`,
      source: "SoundCloud",
      title,
      artist,
      album: String((t.genre as string) || ""),
      duration,
      cover,
      stream: permalink,
      scId: id,
      links: {
        spotify: `https://open.spotify.com/search/${query}`,
        youtube: `https://music.youtube.com/search?q=${query}`,
        apple: `https://music.apple.com/search?term=${query}`,
        deezer: `https://www.deezer.com/search/${query}`,
        amazon: `https://music.amazon.com/search/${query}`,
      },
    });
  }
  return out;
}

async function searchAudius(q: string): Promise<SearchResult[]> {
  const host = await audiusHost();
  const term = encodeURIComponent(q);
  const app = "app_name=negaresh";
  let json: { data?: Array<Record<string, unknown>> } | null = null;
  try {
    json = await fetch(`${host}/v1/tracks/search?query=${term}&${app}`).then((r) => r.json());
  } catch {
    return [];
  }
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const t of json?.data || []) {
    const id = String(t.id || "");
    if (!id) continue;
    const title = String(t.title || "").trim();
    const user = (t.user as Record<string, unknown>) || {};
    const artist = String(user.name || user.handle || "").trim();
    if (!title || !artist) continue;
    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const artwork = (t.artwork as Record<string, string>) || {};
    const cover = artwork["480x480"] || artwork["150x150"] || artwork["1000x1000"] || "";
    const duration = Number(t.duration || 0);
    const query = encodeURIComponent(`${artist} ${title}`);
    out.push({
      id: `au-${id}`,
      source: "Audius",
      title,
      artist,
      album: "",
      duration,
      cover,
      stream: `${host}/v1/tracks/${id}/stream?${app}`,
      links: {
        spotify: `https://open.spotify.com/search/${query}`,
        youtube: `https://music.youtube.com/search?q=${query}`,
        apple: `https://music.apple.com/search?term=${query}`,
        deezer: `https://www.deezer.com/search/${query}`,
        amazon: `https://music.amazon.com/search/${query}`,
      },
    });
  }
  return out;
}

async function searchTracks(q: string): Promise<SearchResult[]> {
  try {
    const sc = await searchSoundCloud(q);
    if (sc.length) return sc;
  } catch { /* fall through */ }
  return searchAudius(q);
}

const PLAYLISTS = [
  { name: "لیبرال دیسکو", count: 42, hue: 300 },
  { name: "برای تمرکز عمیق", count: 28, hue: 190 },
  { name: "شب بارونی", count: 17, hue: 240 },
  { name: "صبح آفتابی", count: 33, hue: 40 },
  { name: "کلاسیک مدرن", count: 21, hue: 20 },
];

function MusicPage() {
  const {
    tracks: TRACKS, track, playing, progress, duration, volume,
    shuffle, repeat, toggle, next, prev, pickIndex, seek, setVolume, setShuffle, setRepeat, playExternal,
  } = usePlayer();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [scPlaying, setScPlaying] = useState<number | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    let cancel = false;
    setSearching(true);
    searchTracks(term)
      .then((r) => { if (!cancel) setResults(r); })
      .catch(() => { if (!cancel) setResults([]); })
      .finally(() => { if (!cancel) setSearching(false); });
    return () => { cancel = true; };
  }, [q]);

  const list = TRACKS;

  const pick = (t: Track) => {
    const i = TRACKS.findIndex((x) => x.id === t.id);
    if (i >= 0) pickIndex(i);
  };

  const playResult = (r: SearchResult) => {
    if (r.source === "SoundCloud" && r.scId) {
      setScPlaying(r.scId);
      return;
    }
    playExternal({
      id: `ext-${r.id}`,
      title: r.title,
      artist: r.artist,
      album: r.album,
      duration: r.duration,
      cover: r.cover,
      src: r.stream,
      hue: Math.floor(Math.random() * 360),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader authed={false} />
      <div
        className="relative"
        style={{
          background: `radial-gradient(1200px 500px at 20% 0%, hsl(${track.hue} 80% 22%) 0%, transparent 60%), radial-gradient(900px 400px at 90% 10%, hsl(${(track.hue + 60) % 360} 70% 20%) 0%, transparent 60%), #0a0a0f`,
        }}
      >
        <div className="ferrofluid-bg" aria-hidden />
        <div className="relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 p-4 pb-40">
          {/* Sidebar */}
          <aside className="rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 p-3 space-y-4 h-fit md:sticky md:top-16">
            <nav className="space-y-1 text-white/80 text-sm">
              <a className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10"><Home className="h-4 w-4" />خانه</a>
              <a className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10"><Search className="h-4 w-4" />جستجو</a>
              <a className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10"><Library className="h-4 w-4" />کتابخانه</a>
              <a className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10"><Radio className="h-4 w-4" />رادیو</a>
              <a className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/10"><Mic2 className="h-4 w-4" />پادکست</a>
            </nav>
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-white/60 text-xs">پلی‌لیست‌ها</span>
                <button className="text-white/60 hover:text-white"><PlusCircle className="h-4 w-4" /></button>
              </div>
              <ul className="space-y-1">
                {PLAYLISTS.map((p) => (
                  <li key={p.name} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 cursor-pointer">
                    <div className="h-9 w-9 rounded-md shadow-inner" style={{ background: `linear-gradient(135deg, hsl(${p.hue} 80% 55%), hsl(${(p.hue + 40) % 360} 70% 35%))` }} />
                    <div className="min-w-0">
                      <div className="text-white text-sm truncate">{p.name}</div>
                      <div className="text-white/50 text-xs">{p.count} قطعه</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main */}
          <main className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="جستجوی موزیک (SoundCloud با فالبک Audius)…"
                  className="bg-black/40 border-white/10 text-white placeholder:text-white/40 pr-9 h-11 rounded-full"
                />
              </div>
            </div>

            {q.trim() && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white font-bold text-xl">نتایج جستجو</h2>
                  <span className="text-white/50 text-xs">{searching ? "…" : `${results.length} مورد`}</span>
                </div>
                <div className="rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 divide-y divide-white/5">
                  {results.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5">
                      <img src={r.cover} alt="" className="h-10 w-10 rounded-md object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white truncate">{r.title}</div>
                        <div className="text-white/50 text-xs truncate">{r.artist} · {r.album}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">{r.source}</span>
                      <div className="flex items-center gap-1">
                        {r.links.spotify && <a href={r.links.spotify} target="_blank" rel="noreferrer" className="text-white/60 hover:text-emerald-400 p-1.5" title="Spotify"><ExternalLink className="h-3.5 w-3.5" /></a>}
                        {r.links.youtube && <a href={r.links.youtube} target="_blank" rel="noreferrer" className="text-white/60 hover:text-red-400 p-1.5" title="YouTube Music"><ExternalLink className="h-3.5 w-3.5" /></a>}
                        {r.links.apple && <a href={r.links.apple} target="_blank" rel="noreferrer" className="text-white/60 hover:text-pink-400 p-1.5" title="Apple Music"><ExternalLink className="h-3.5 w-3.5" /></a>}
                        {r.links.deezer && <a href={r.links.deezer} target="_blank" rel="noreferrer" className="text-white/60 hover:text-orange-400 p-1.5" title="Deezer"><ExternalLink className="h-3.5 w-3.5" /></a>}
                        {r.links.amazon && <a href={r.links.amazon} target="_blank" rel="noreferrer" className="text-white/60 hover:text-sky-400 p-1.5" title="Amazon Music"><ExternalLink className="h-3.5 w-3.5" /></a>}
                      </div>
                      <button
                        onClick={() => playResult(r)}
                        className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
                        aria-label="پخش پیش‌نمایش"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <div className="text-white/50 text-sm tabular-nums w-12 text-left">{fmt(r.duration)}</div>
                    </div>
                  ))}
                  {!searching && results.length === 0 && <div className="p-6 text-center text-white/50">نتیجه‌ای پیدا نشد.</div>}
                </div>
                <p className="text-white/40 text-xs mt-2">جستجو ابتدا از SoundCloud انجام می‌شود؛ در صورت خطا، Audius جایگزین می‌شود.</p>
                {scPlaying && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-white/10 bg-black/60 relative">
                    <button onClick={() => setScPlaying(null)} className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center" title="بستن"><X className="h-4 w-4" /></button>
                    <iframe
                      title="SoundCloud Player"
                      width="100%"
                      height="166"
                      allow="autoplay"
                      src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://api.soundcloud.com/tracks/${scPlaying}`)}&auto_play=true&color=%23c9a94a&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Featured hero */}
            <section className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6 flex flex-col md:flex-row items-center gap-6">
              <img src={track.cover} alt="cover" className="h-40 w-40 rounded-2xl shadow-2xl shadow-black/50 object-cover" />
              <div className="flex-1 text-white">
                <div className="text-xs uppercase tracking-widest text-white/60">در حال پخش</div>
                <h1 className="text-3xl md:text-5xl font-black mt-1">{track.title}</h1>
                <div className="text-white/70 mt-1">{track.artist} · {track.album}</div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={toggle}
                    className="flex items-center gap-2 rounded-full px-6 py-2 font-semibold text-black transition hover:scale-105"
                    style={{ background: `linear-gradient(135deg, hsl(${track.hue} 90% 65%), hsl(${(track.hue + 40) % 360} 90% 60%))` }}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? "توقف" : "پخش"}
                  </button>
                  <button
                    onClick={() => setLiked((l) => ({ ...l, [track.id]: !l[track.id] }))}
                    className={`rounded-full p-2 border border-white/10 hover:bg-white/10 ${liked[track.id] ? "text-pink-400" : "text-white/70"}`}
                  >
                    <Heart className="h-4 w-4" fill={liked[track.id] ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            </section>

            {/* Track list */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-bold text-xl flex items-center gap-2"><ListMusic className="h-5 w-5" />قطعه‌های پیشنهادی</h2>
                <span className="text-white/50 text-xs">{list.length} مورد</span>
              </div>
              <div className="rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 divide-y divide-white/5">
                {list.map((t, i) => {
                  const active = t.id === track.id;
                  return (
                    <div
                      key={t.id}
                      onDoubleClick={() => pick(t)}
                      className={`group flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition cursor-pointer ${active ? "bg-white/10" : ""}`}
                    >
                      <div className="w-6 text-center text-white/40 text-sm tabular-nums group-hover:hidden">{i + 1}</div>
                      <button className="w-6 h-6 hidden group-hover:flex items-center justify-center text-white" onClick={() => pick(t)}>
                        {active && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <img src={t.cover} alt="" className="h-10 w-10 rounded-md object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${active ? "text-emerald-300" : "text-white"}`}>{t.title}</div>
                        <div className="text-white/50 text-xs truncate">{t.artist}</div>
                      </div>
                      <div className="hidden md:block text-white/50 text-sm truncate max-w-[200px]">{t.album}</div>
                      <button
                        onClick={() => setLiked((l) => ({ ...l, [t.id]: !l[t.id] }))}
                        className={`p-1.5 rounded-full ${liked[t.id] ? "text-pink-400" : "text-white/40 hover:text-white"}`}
                      >
                        <Heart className="h-4 w-4" fill={liked[t.id] ? "currentColor" : "none"} />
                      </button>
                      <div className="text-white/50 text-sm tabular-nums w-12 text-left">{fmt(t.duration)}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        </div>
        </div>
      </div>

      {/* Bottom player bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto grid grid-cols-3 items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={track.cover} alt="" className="h-12 w-12 rounded-md object-cover shadow" />
            <div className="min-w-0">
              <div className="text-white text-sm truncate">{track.title}</div>
              <div className="text-white/50 text-xs truncate">{track.artist}</div>
            </div>
            <button
              onClick={() => setLiked((l) => ({ ...l, [track.id]: !l[track.id] }))}
              className={`p-1.5 ${liked[track.id] ? "text-pink-400" : "text-white/50 hover:text-white"}`}
            >
              <Heart className="h-4 w-4" fill={liked[track.id] ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-4 text-white">
              <button onClick={() => setShuffle(!shuffle)} className={shuffle ? "text-emerald-400" : "text-white/60 hover:text-white"}><Shuffle className="h-4 w-4" /></button>
              <button onClick={prev} className="text-white/80 hover:text-white"><SkipBack className="h-5 w-5" /></button>
              <button
                onClick={toggle}
                className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button onClick={next} className="text-white/80 hover:text-white"><SkipForward className="h-5 w-5" /></button>
              <button onClick={() => setRepeat(!repeat)} className={repeat ? "text-emerald-400" : "text-white/60 hover:text-white"}><Repeat className="h-4 w-4" /></button>
            </div>
            <div className="w-full flex items-center gap-2 text-[10px] text-white/50 tabular-nums">
              <span className="w-8 text-right">{fmt(progress)}</span>
              <ElasticSlider
                ariaLabel="پیشرفت"
                value={duration ? (progress / duration) * 100 : 0}
                max={100}
                step={0.1}
                onChange={(v) => { if (duration) seek((v / 100) * duration); }}
                className="flex-1"
              />
              <span className="w-8">{fmt(duration || track.duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end text-white/60">
            <Volume2 className="h-4 w-4" />
            <ElasticSlider
              ariaLabel="صدا"
              value={volume * 100}
              max={100}
              step={1}
              onChange={(v) => setVolume(v / 100)}
              className="w-32"
            />
          </div>
        </div>
      </div>
    </div>
  );
}