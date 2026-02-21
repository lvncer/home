"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type NowPlayingState =
  | { kind: "idle" }
  | {
      kind: "ready";
      title: string;
      subtitle?: string;
      isPlaying: boolean;
      durationSec: number | null;
      elapsedSec: number | null;
      artworkUrl?: string;
      elapsedUpdatedAtMs: number;
      toggle: () => void;
    };

function getFilename(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : url;
  } catch {
    const parts = url.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? url;
  }
}

function buildTitleFromMediaSession() {
  const md = navigator.mediaSession?.metadata ?? null;
  const title = md?.title?.trim();
  const artist = md?.artist?.trim();
  const album = md?.album?.trim();

  const subtitle = [artist, album].filter(Boolean).join(" • ");
  return {
    title: title || "",
    subtitle: subtitle || undefined,
  };
}

function getArtworkFromMediaSession() {
  const md = navigator.mediaSession?.metadata ?? null;
  const artwork = md?.artwork;
  if (!artwork || artwork.length <= 0) return undefined;
  return artwork[artwork.length - 1]?.src || artwork[0]?.src;
}

function getPreferredMediaElement(): HTMLMediaElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLMediaElement>("audio, video"),
  );
  return (
    nodes.find((m) => !m.paused && !m.ended) ??
    nodes.find((m) => !m.ended && (m.currentSrc || m.src)) ??
    null
  );
}

function formatTime(seconds: number | null) {
  if (!Number.isFinite(seconds) || seconds === null || seconds < 0) {
    return "--:--";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainSeconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

export default function NowPlaying() {
  const [state, setState] = useState<NowPlayingState>({ kind: "idle" });
  const [tickMs, setTickMs] = useState(() => Date.now());

  const isDesktop = typeof window !== "undefined" && !!window.nowPlaying;

  const refreshFromBrowser = useCallback(() => {
    const media = getPreferredMediaElement();
    if (!media) {
      setState({ kind: "idle" });
      return;
    }

    const toggle = () => {
      try {
        if (media.paused) void media.play();
        else media.pause();
      } catch {
        // no-op
      }
    };

    const fromSession = buildTitleFromMediaSession();
    const fallbackTitle =
      media.getAttribute("title")?.trim() ||
      getFilename(media.currentSrc || media.src || "Playing");

    setState({
      kind: "ready",
      title: fromSession.title || fallbackTitle,
      subtitle: fromSession.subtitle,
      isPlaying: !media.paused && !media.ended,
      durationSec: Number.isFinite(media.duration) ? media.duration : null,
      elapsedSec: Number.isFinite(media.currentTime) ? media.currentTime : null,
      artworkUrl: getArtworkFromMediaSession(),
      elapsedUpdatedAtMs: Date.now(),
      toggle,
    });
  }, []);

  useEffect(() => {
    if (isDesktop && window.nowPlaying) {
      const unsubscribe = window.nowPlaying.subscribe((payload) => {
        const title = payload?.title?.trim();
        const artist = payload?.artist?.trim();
        const album = payload?.album?.trim();
        const subtitle = [artist, album].filter(Boolean).join(" • ");
        const playing = payload?.playing ?? false;

        if (!title) {
          setState({ kind: "idle" });
          return;
        }

        const toggle = () => {
          void window.nowPlaying?.togglePlayPause();
        };

        setState({
          kind: "ready",
          title,
          subtitle: subtitle || undefined,
          isPlaying: !!playing,
          durationSec:
            typeof payload?.duration === "number" ? payload.duration : null,
          elapsedSec:
            typeof payload?.elapsedTime === "number"
              ? payload.elapsedTime
              : null,
          artworkUrl: payload?.artworkUrl ?? undefined,
          elapsedUpdatedAtMs: Date.now(),
          toggle,
        });
      });

      return () => unsubscribe();
    }

    refreshFromBrowser();

    const onChange = () => refreshFromBrowser();
    document.addEventListener("play", onChange, true);
    document.addEventListener("pause", onChange, true);
    document.addEventListener("ended", onChange, true);
    document.addEventListener("timeupdate", onChange, true);
    document.addEventListener("loadedmetadata", onChange, true);

    return () => {
      document.removeEventListener("play", onChange, true);
      document.removeEventListener("pause", onChange, true);
      document.removeEventListener("ended", onChange, true);
      document.removeEventListener("timeupdate", onChange, true);
      document.removeEventListener("loadedmetadata", onChange, true);
    };
  }, [isDesktop, refreshFromBrowser]);

  useEffect(() => {
    if (state.kind !== "ready" || !state.isPlaying) return;
    const id = window.setInterval(() => setTickMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const content = useMemo(() => {
    if (state.kind === "idle") {
      return null;
    }

    const elapsedDriftSec = state.isPlaying
      ? Math.max(0, (tickMs - state.elapsedUpdatedAtMs) / 1000)
      : 0;
    const elapsedSec =
      state.elapsedSec === null ? null : state.elapsedSec + elapsedDriftSec;
    const durationSec = state.durationSec;
    const progress =
      durationSec && durationSec > 0 && elapsedSec !== null
        ? Math.max(0, Math.min(1, elapsedSec / durationSec))
        : 0;
    const elapsedText = formatTime(elapsedSec);
    const durationText = formatTime(durationSec);

    return (
      <div className="w-[300px] max-w-[82vw] rounded-3xl border border-white/20 bg-black/35 p-4 text-left text-white backdrop-blur">
        <div className="space-y-3">
          <div className="h-44 w-full overflow-hidden rounded-2xl bg-white/10">
            {state.artworkUrl ? (
              <img
                src={state.artworkUrl}
                alt="artwork"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                No Artwork
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{state.title}</div>
            {state.subtitle ? (
              <div className="truncate text-sm text-white/70">
                {state.subtitle}
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs tabular-nums text-white/70">
              <span>{elapsedText}</span>
              <span>{durationText}</span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={state.toggle}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 active:scale-[0.98]"
              aria-label={state.isPlaying ? "一時停止" : "再生"}
              title={state.isPlaying ? "一時停止" : "再生"}
            >
              {state.isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }, [state, tickMs]);

  return content;
}
