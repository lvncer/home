import { BrowserWindow, app, ipcMain } from "electron";
import * as path from "node:path";

import {
  getNowPlayingOnce,
  sendMediaRemoteCommand,
  startNowPlayingStream,
} from "./now-playing/mediaremote";
import type {
  NowPlayingInfo,
  NowPlayingStreamEvent,
} from "./now-playing/types";

const NEXT_DEV_URL = process.env.NEXT_DEV_URL ?? "http://localhost:3000";
const PROD_NEXT_PORT = Number(process.env.NEXT_PORT ?? "37111");

function getAppRoot() {
  // dev: dist-electron/ -> repo root
  // prod(asar disabled): resources/app/ -> app root
  return path.join(__dirname, "..");
}

let mainWindow: BrowserWindow | null = null;

type SlimNowPlaying = Pick<
  NowPlayingInfo,
  "title" | "artist" | "album" | "playing" | "bundleIdentifier"
>;

let currentState: SlimNowPlaying | null = null;
let stopStream: null | (() => void) = null;
const subscribers = new Set<number>(); // webContents.id

function broadcast(payload: SlimNowPlaying | null) {
  for (const id of subscribers) {
    for (const wc of BrowserWindow.getAllWindows().map((w) => w.webContents)) {
      if (wc.id === id && !wc.isDestroyed()) {
        wc.send("nowPlaying:update", payload);
      }
    }
  }
}

function mergeDiff(prev: NowPlayingInfo, diff: NowPlayingInfo): NowPlayingInfo {
  const next: NowPlayingInfo = { ...prev };
  for (const [k, v] of Object.entries(diff)) {
    // diff=true で keyが消えた場合は null が来るので削除する
    if (v === null) {
      delete (next as Record<string, unknown>)[k];
    } else {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  return next;
}

function toSlim(info: NowPlayingInfo | null): SlimNowPlaying | null {
  if (!info) return null;
  return {
    title: info.title ?? null,
    artist: info.artist ?? null,
    album: info.album ?? null,
    playing: info.playing ?? null,
    bundleIdentifier: info.bundleIdentifier ?? null,
  };
}

async function ensureStreamRunning() {
  if (stopStream) return;

  const appRoot = getAppRoot();

  // 初期状態を一度流す（失敗したらstreamだけ試す）
  try {
    const once = await getNowPlayingOnce(appRoot);
    currentState = toSlim(once);
    broadcast(currentState);
  } catch {
    // ignore
  }

  try {
    let lastFull: NowPlayingInfo = {};
    const { stop } = startNowPlayingStream(
      appRoot,
      (event: NowPlayingStreamEvent) => {
        if (event.type !== "data") return;
        if (!event.payload) return;

        if (!event.diff) {
          lastFull = event.payload ?? {};
        } else {
          lastFull = mergeDiff(lastFull, event.payload ?? {});
        }
        currentState = toSlim(lastFull);
        broadcast(currentState);
      },
      { debounceMs: 100 },
    );

    stopStream = () => {
      stop();
      stopStream = null;
    };
  } catch (e) {
    // adapter未同梱など
    currentState = null;
    broadcast(null);
    stopStream = null;
  }
}

async function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    await mainWindow.loadURL(NEXT_DEV_URL);
    return;
  }

  // 本番: Nextサーバを立てて開く（.appに .next/ と node_modules が含まれる想定）
  // NOTE: 初期実装は「動くこと優先」。配布時に必要なら改善する。
  const { spawn } = await import("node:child_process");
  const net = await import("node:net");

  const appRoot = getAppRoot();
  const nextBin = path.join(
    appRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );

  const proc = spawn(
    process.execPath,
    [nextBin, "start", "-p", String(PROD_NEXT_PORT)],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
      },
      stdio: "pipe",
    },
  );

  // wait port open
  const waitPort = () =>
    new Promise<void>((resolve) => {
      const tryOnce = () => {
        const socket = net.createConnection(PROD_NEXT_PORT, "127.0.0.1");
        socket.on("connect", () => {
          socket.end();
          resolve();
        });
        socket.on("error", () => setTimeout(tryOnce, 200));
      };
      tryOnce();
    });

  await waitPort();

  await mainWindow.loadURL(`http://127.0.0.1:${PROD_NEXT_PORT}`);
}

app.whenReady().then(async () => {
  ipcMain.on("nowPlaying:subscribe", async (event) => {
    subscribers.add(event.sender.id);
    event.sender.send("nowPlaying:update", currentState);
    await ensureStreamRunning();
  });

  ipcMain.handle("nowPlaying:pause", async () => {
    await sendMediaRemoteCommand(getAppRoot(), 1); // kMRPause
  });

  ipcMain.handle("nowPlaying:togglePlayPause", async () => {
    await sendMediaRemoteCommand(getAppRoot(), 2); // kMRTogglePlayPause
  });

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
