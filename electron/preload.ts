import { contextBridge, ipcRenderer } from "electron";

type NowPlayingPayload = {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  playing?: boolean | null;
  bundleIdentifier?: string | null;
  duration?: number | null;
  elapsedTime?: number | null;
  artworkUrl?: string | null;
};

contextBridge.exposeInMainWorld("nowPlaying", {
  subscribe: (cb: (payload: NowPlayingPayload | null) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: NowPlayingPayload | null,
    ) => {
      cb(payload);
    };

    ipcRenderer.on("nowPlaying:update", listener);
    ipcRenderer.send("nowPlaying:subscribe");

    return () => {
      ipcRenderer.removeListener("nowPlaying:update", listener);
    };
  },

  pause: () => ipcRenderer.invoke("nowPlaying:pause"),
  togglePlayPause: () => ipcRenderer.invoke("nowPlaying:togglePlayPause"),
});
