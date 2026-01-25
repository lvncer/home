import Time from "@/components/time";
import Pomodoro from "@/components/pomodoro";
import BottomDock from "@/components/bottom-dock";
import NowPlaying from "@/components/now-playing";

export default function Home() {
  return (
    <BottomDock left={<Pomodoro />} center={<Time />} right={<NowPlaying />} />
  );
}
