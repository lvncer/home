import TimeClient from "@/components/bottom-dock/time-client";

export default function Time() {
  const initialTimestamp = Date.now();

  return <TimeClient initialTimestamp={initialTimestamp} />;
}
