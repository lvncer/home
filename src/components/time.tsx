import TimeClient from "./time-client";

export default function Time() {
  const initialTimestamp = Date.now();

  return <TimeClient initialTimestamp={initialTimestamp} />;
}
