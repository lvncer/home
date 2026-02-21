export {};

declare global {
  interface Window {
    nowPlaying?: {
      subscribe: (
        cb: (
          payload: {
            title?: string | null;
            artist?: string | null;
            album?: string | null;
            playing?: boolean | null;
            bundleIdentifier?: string | null;
            duration?: number | null;
            elapsedTime?: number | null;
            artworkUrl?: string | null;
          } | null,
        ) => void,
      ) => () => void;
      pause: () => Promise<void>;
      togglePlayPause: () => Promise<void>;
    };
  }
}
