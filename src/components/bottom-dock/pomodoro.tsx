"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_POMODORO_MS = 25 * 60 * 1000;
const DEFAULT_BREAK_MS = 5 * 60 * 1000;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

type TimerCardProps = {
  title: string;
  defaultDurationMs: number;
};

function TimerCard({ title, defaultDurationMs }: TimerCardProps) {
  const [remainingMs, setRemainingMs] = useState(defaultDurationMs);
  const [isRunning, setIsRunning] = useState(false);

  const endAtRef = useRef<number | null>(null);

  const remainingText = useMemo(
    () => formatRemaining(remainingMs),
    [remainingMs],
  );

  useEffect(() => {
    if (!isRunning) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const endAt = endAtRef.current;
      if (!endAt) return;

      const now = Date.now();
      const nextRemaining = Math.max(0, endAt - now);
      setRemainingMs(nextRemaining);

      if (nextRemaining <= 0) {
        endAtRef.current = null;
        setIsRunning(false);
        return;
      }

      // 次の秒境界に寄せる
      timer = setTimeout(tick, 1000 - (now % 1000));
    };

    tick();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isRunning]);

  const onPlay = () => {
    if (isRunning) return;
    if (remainingMs <= 0) return;
    endAtRef.current = Date.now() + remainingMs;
    setIsRunning(true);
  };

  const onPause = () => {
    if (!isRunning) return;
    const endAt = endAtRef.current;
    const now = Date.now();
    if (endAt) setRemainingMs(Math.max(0, endAt - now));
    endAtRef.current = null;
    setIsRunning(false);
  };

  const onReset = () => {
    endAtRef.current = null;
    setIsRunning(false);
    setRemainingMs(defaultDurationMs);
  };

  const onToggle = () => {
    if (isRunning) onPause();
    else onPlay();
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-black/10 bg-white/50 p-5 backdrop-blur">
        <div className="text-sm font-medium tracking-wide text-black/70">
          {title}
        </div>

        <div className="mt-2 text-5xl font-medium tabular-nums">
          {remainingText}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            disabled={!isRunning && remainingMs <= 0}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white shadow-sm transition hover:bg-black/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isRunning ? "一時停止" : "開始"}
          >
            {isRunning ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white shadow-sm transition hover:bg-black/5 active:scale-[0.98]"
            aria-label="リセット"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pomodoro() {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <TimerCard title="Pomodoro" defaultDurationMs={DEFAULT_POMODORO_MS} />
        <TimerCard title="Break" defaultDurationMs={DEFAULT_BREAK_MS} />
      </div>
    </div>
  );
}
