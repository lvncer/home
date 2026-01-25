"use client";

import { Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type NowPlayingState =
  | { kind: "idle" }
  | {
      kind: "playing";
      title: string;
      subtitle?: string;
      stop: () => void;
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

function getActiveMediaElement(): HTMLMediaElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLMediaElement>("audio, video"),
  );
  return nodes.find((m) => !m.paused && !m.ended) ?? null;
}

export default function NowPlayingClient() {
  const [state, setState] = useState<NowPlayingState>({ kind: "idle" });

  const refresh = useCallback(() => {
    const media = getActiveMediaElement();
    if (!media) {
      setState({ kind: "idle" });
      return;
    }

    const stop = () => {
      try {
        media.pause();
        if (Number.isFinite(media.duration)) {
          media.currentTime = 0;
        }
      } catch {
        // no-op
      }
      setState({ kind: "idle" });
    };

    const fromSession = buildTitleFromMediaSession();
    const fallbackTitle =
      media.getAttribute("title")?.trim() ||
      getFilename(media.currentSrc || media.src || "Playing");

    setState({
      kind: "playing",
      title: fromSession.title || fallbackTitle,
      subtitle: fromSession.subtitle,
      stop,
    });
  }, []);

  useEffect(() => {
    refresh();

    const onChange = () => refresh();
    document.addEventListener("play", onChange, true);
    document.addEventListener("pause", onChange, true);
    document.addEventListener("ended", onChange, true);

    return () => {
      document.removeEventListener("play", onChange, true);
      document.removeEventListener("pause", onChange, true);
      document.removeEventListener("ended", onChange, true);
    };
  }, [refresh]);

  const content = useMemo(() => {
    if (state.kind === "idle") {
      return (
        <div className="text-sm text-black/50">
          Now Playing: <span className="text-black/40">—</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-black/70">
            Now Playing
          </div>
          <div className="truncate text-base font-semibold">{state.title}</div>
          {state.subtitle ? (
            <div className="truncate text-sm text-black/60">
              {state.subtitle}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={state.stop}
          className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-black/10 bg-white shadow-sm transition hover:bg-black/5 active:scale-[0.98]"
          aria-label="停止"
          title="停止"
        >
          <Square className="h-5 w-5" />
        </button>
      </div>
    );
  }, [state]);

  return (
    <div className="w-[320px] max-w-[80vw] rounded-2xl border border-black/10 bg-white/50 p-4 text-left backdrop-blur">
      {content}
    </div>
  );
}
