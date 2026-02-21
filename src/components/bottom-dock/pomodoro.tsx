"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const FOCUS_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const RING_RADIUS = 92;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type Phase = "focus" | "break";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function getDurationMs(phase: Phase) {
  return phase === "focus" ? FOCUS_MS : BREAK_MS;
}

function getPhaseLabel(phase: Phase) {
  return phase === "focus" ? "作業" : "休憩";
}

export default function Pomodoro() {
  const [phase, setPhase] = useState<Phase>("focus");
  const [remainingMs, setRemainingMs] = useState(FOCUS_MS);
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(0);

  const endAtRef = useRef<number | null>(null);

  const remainingText = useMemo(
    () => formatRemaining(remainingMs),
    [remainingMs],
  );
  const phaseDurationMs = useMemo(() => getDurationMs(phase), [phase]);
  const remainingRatio = Math.max(
    0,
    Math.min(1, remainingMs / phaseDurationMs),
  );
  const strokeOffset = RING_CIRCUMFERENCE * (1 - remainingRatio);
  const isFocus = phase === "focus";

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
        const nextPhase: Phase = phase === "focus" ? "break" : "focus";
        const nextDuration = getDurationMs(nextPhase);
        if (phase === "focus") {
          setCompletedFocusCount((prev) => prev + 1);
        }
        setPhase(nextPhase);
        setRemainingMs(nextDuration);
        endAtRef.current = Date.now() + nextDuration;
        return;
      }

      timer = setTimeout(tick, 1000 - (now % 1000));
    };

    tick();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isRunning, phase]);

  const onStart = () => {
    if (isRunning) return;
    endAtRef.current = Date.now() + remainingMs;
    setIsRunning(true);
  };

  const onPause = useCallback(() => {
    if (!isRunning) return;
    const endAt = endAtRef.current;
    const now = Date.now();
    if (endAt) setRemainingMs(Math.max(0, endAt - now));
    endAtRef.current = null;
    setIsRunning(false);
  }, [isRunning]);

  const onToggle = () => {
    if (isRunning) onPause();
    else onStart();
  };

  return (
    <div className="w-[260px] max-w-[82vw]">
      <div className="rounded-3xl border border-white/20 bg-black/35 p-4 text-white backdrop-blur">
        <div className="mb-3 flex items-center justify-between text-xs text-white/75">
          <span>{getPhaseLabel(phase)}</span>
          <span className="tabular-nums">ループ {completedFocusCount}</span>
        </div>

        <div className="relative mx-auto h-[220px] w-[220px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 220 220">
            <circle
              cx="110"
              cy="110"
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="12"
            />
            <circle
              cx="110"
              cy="110"
              r={RING_RADIUS}
              fill="none"
              stroke={
                isFocus ? "rgba(34,197,94,0.95)" : "rgba(59,130,246,0.95)"
              }
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[42px] font-medium tabular-nums tracking-tight">
              {remainingText}
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="mt-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 active:scale-[0.98]"
              aria-label={isRunning ? "一時停止" : "開始"}
              title={isRunning ? "一時停止" : "開始"}
            >
              {isRunning ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-2 text-center text-xs text-white/65">
          {isFocus ? "25分集中" : "5分休憩"} を自動で切り替え
        </div>
      </div>
    </div>
  );
}
