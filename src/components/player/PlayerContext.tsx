import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: string;
  src: string;
  hue: number;
};

export const TRACKS: Track[] = [
  { id: "1", title: "Midnight City Lights", artist: "Nova Wave", album: "Neon Dreams", duration: 232, cover: "https://picsum.photos/seed/nova1/400/400", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", hue: 280 },
  { id: "2", title: "Silk & Static", artist: "Kairo", album: "Velvet Rooms", duration: 289, cover: "https://picsum.photos/seed/kairo/400/400", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", hue: 340 },
  { id: "3", title: "Golden Hour", artist: "Mira Sun", album: "Bloom", duration: 201, cover: "https://picsum.photos/seed/mira/400/400", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", hue: 30 },
  { id: "4", title: "Ocean Static", artist: "Deep Field", album: "Below Zero", duration: 315, cover: "https://picsum.photos/seed/deep/400/400", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", hue: 200 },
  { id: "5", title: "Paperbacks", artist: "Lotte", album: "Small Rooms", duration: 178, cover: "https://picsum.photos/seed/lotte/400/400", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", hue: 150 },
  { id: "6", title: "After the Rain", artist: "Halcyon", album: "Long Days", duration: 244, cover: "https://picsum.photos/seed/halcyon/400/400", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", hue: 220 },
];

type Ctx = {
  tracks: Track[];
  track: Track;
  idx: number;
  playing: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: boolean;
  started: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  pickIndex: (i: number) => void;
  seek: (sec: number) => void;
  skip: (delta: number) => void;
  playExternal: (t: Track) => void;
  setVolume: (v: number) => void;
  setShuffle: (v: boolean) => void;
  setRepeat: (v: boolean) => void;
};

const PlayerCtx = createContext<Ctx | null>(null);

export function usePlayer() {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("usePlayer must be used within PlayerProvider");
  return c;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [idx, setIdx] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(TRACKS);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [started, setStarted] = useState(false);

  // Create a single, persistent audio element (not in React tree to avoid re-mount).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const a = new Audio();
    a.preload = "metadata";
    a.volume = volume;
    audioRef.current = a;
    a.src = TRACKS[0].src;

    const onTime = () => setProgress(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => {
      if (repeatRef.current) { a.currentTime = 0; a.play().catch(() => {}); }
      else nextRef.current();
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.pause();
      a.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep refs to callbacks used inside listeners.
  const repeatRef = useRef(repeat);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  const nextRef = useRef<() => void>(() => {});

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  // When idx or tracks list changes, swap the src.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = tracks[idx];
    if (!t) return;
    if (a.src !== t.src) {
      a.src = t.src;
      setProgress(0);
      setDuration(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, tracks]);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setStarted(true);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);
  const pause = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);
  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) play(); else pause();
  }, [play, pause]);
  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  const next = useCallback(() => {
    const len = tracksRef.current.length || 1;
    setIdx((i) => (shuffle ? Math.floor(Math.random() * len) : (i + 1) % len));
    setStarted(true);
  }, [shuffle]);
  const prev = useCallback(() => {
    const len = tracksRef.current.length || 1;
    setIdx((i) => (i - 1 + len) % len);
    setStarted(true);
  }, []);
  nextRef.current = next;

  const pickIndex = useCallback((i: number) => {
    setIdx(i);
    setStarted(true);
    // Ensure playback starts on new selection.
    setTimeout(() => {
      const a = audioRef.current;
      if (!a) return;
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }, 0);
  }, []);
  const playExternal = useCallback((t: Track) => {
    setTracks((cur) => {
      const existing = cur.findIndex((x) => x.id === t.id);
      if (existing >= 0) { setIdx(existing); return cur; }
      const nextArr = [...cur, t];
      setIdx(nextArr.length - 1);
      return nextArr;
    });
    setStarted(true);
    setTimeout(() => {
      const a = audioRef.current;
      if (!a) return;
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }, 50);
  }, []);
  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a || !isFinite(sec)) return;
    a.currentTime = Math.max(0, Math.min(sec, a.duration || sec));
    setProgress(a.currentTime);
  }, []);
  const skip = useCallback((delta: number) => {
    const a = audioRef.current;
    if (!a) return;
    seek((a.currentTime || 0) + delta);
  }, [seek]);
  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);

  const value = useMemo<Ctx>(() => ({
    tracks,
    track: tracks[idx] ?? tracks[0],
    idx,
    playing,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    started,
    play, pause, toggle, next, prev, pickIndex, seek, skip, playExternal,
    setVolume, setShuffle, setRepeat,
  }), [tracks, idx, playing, progress, duration, volume, shuffle, repeat, started, play, pause, toggle, next, prev, pickIndex, seek, skip, playExternal, setVolume]);

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}