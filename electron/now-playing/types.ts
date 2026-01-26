export type NowPlayingInfo = {
  bundleIdentifier?: string | null;
  parentApplicationBundleIdentifier?: string | null;
  playing?: boolean | null;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  duration?: number | null;
  elapsedTime?: number | null;
  timestamp?: number | null;
  artworkMimeType?: string | null;
  artworkData?: string | null; // base64 (when present)
};

export type NowPlayingStreamEvent = {
  type: "data";
  diff: boolean;
  payload: NowPlayingInfo;
};
