import BackgroundImage from "@/components/background-image";
import BottomDock from "@/components/bottom-dock/index";
import Pomodoro from "@/components/bottom-dock/pomodoro";
import Time from "@/components/bottom-dock/time";
import NowPlaying from "@/components/bottom-dock/now-playing";

export default function Home() {
  return (
    <BackgroundImage>
      <BottomDock
        left={<Pomodoro />}
        center={<Time />}
        right={<NowPlaying />}
      />
    </BackgroundImage>
  );
}
