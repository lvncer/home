"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  initialTimestamp: number;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function format(timestamp: number) {
  const date = new Date(timestamp);
  return {
    dateText: dateFormatter.format(date),
    timeText: timeFormatter.format(date),
  };
}

export default function TimeClient({ initialTimestamp }: Props) {
  const initial = useMemo(() => format(initialTimestamp), [initialTimestamp]);
  const [value, setValue] = useState(() => initial);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const now = Date.now();
      setValue(format(now));

      const msToNextSecond = 1000 - (now % 1000);
      timer = setTimeout(tick, msToNextSecond);
    };

    const now = Date.now();
    timer = setTimeout(tick, 1000 - (now % 1000));

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <div className="pb-2 min-w-[280px] text-5xl font-medium tabular-nums sm:min-w-[360px] sm:text-6xl md:min-w-[420px] md:text-7xl">
        {value.timeText}
      </div>
      <div className="min-w-[200px] text-xl font-light tabular-nums">
        {value.dateText}
      </div>
    </>
  );
}
