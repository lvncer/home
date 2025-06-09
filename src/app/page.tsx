"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "1.5rem",
          marginBottom: "1.5rem",
          letterSpacing: "0.1em",
          fontWeight: "300",
          fontVariantNumeric: "tabular-nums",
          minWidth: "200px",
          textAlign: "center",
        }}
      >
        {formatDate(currentTime)}
      </div>
      <div
        style={{
          fontSize: "6rem",
          fontWeight: "500",
          letterSpacing: "0.05em",
          fontVariantNumeric: "tabular-nums",
          minWidth: "400px",
          textAlign: "center",
        }}
      >
        {formatTime(currentTime)}
      </div>
    </div>
  );
}
