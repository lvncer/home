import { BrowserWindow, app, ipcMain } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";
import * as net from "node:net";
import * as http from "node:http";

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

const FALLBACK_LOG_PATH = "/tmp/home-electron-main.log";

// 最初の一撃（app.whenReady前でも確認できるように）
try {
  fs.appendFileSync(
    FALLBACK_LOG_PATH,
    `${new Date().toISOString()} moduleLoaded\n`,
  );
} catch {
  // ignore
}

function appendLog(line: string) {
  try {
    const logPath = path.join(app.getPath("userData"), "main.log");
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore
  }

  // app.getPath が使えない/失敗した場合でも追えるように /tmp へも書く
  try {
    fs.appendFileSync(
      FALLBACK_LOG_PATH,
      `${new Date().toISOString()} ${line}\n`,
    );
  } catch {
    // ignore
  }
}

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

function canConnect(
  host: string,
  port: number,
  timeoutMs = 800,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, host);
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
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

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    appendLog(`did-fail-load code=${code} desc=${desc} url=${url}`);
  });

  // 「dev serverが生きている時だけdev URLを開く」。
  // packagedなのに isPackaged/defaultApp 判定がブレても白画面にならないようにする。
  const allowDevUrl =
    process.defaultApp || process.env.ELECTRON_FORCE_DEV === "1";
  let devUrlReachable = false;
  if (allowDevUrl) {
    try {
      const u = new URL(NEXT_DEV_URL);
      const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
      devUrlReachable = await canConnect(u.hostname, port);
    } catch {
      devUrlReachable = false;
    }
  }

  appendLog(
    `startup allowDevUrl=${allowDevUrl} devUrlReachable=${devUrlReachable} NEXT_DEV_URL=${NEXT_DEV_URL}`,
  );

  if (allowDevUrl && devUrlReachable) {
    await mainWindow.loadURL(NEXT_DEV_URL);
    return;
  }

  const appRoot = getAppRoot();
  appendLog(
    `starting in-process Next server dir=${appRoot} port=${PROD_NEXT_PORT}`,
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

  // 本番: Electron内のNodeでNextサーバを同一プロセスで起動する。
  // Electronの fuses 設定等で ELECTRON_RUN_AS_NODE が使えない環境でも動く。
  try {
    const mod = (await import("next")) as unknown as {
      default?: (opts: Record<string, unknown>) => {
        prepare: () => Promise<void>;
        getRequestHandler: () => (
          req: http.IncomingMessage,
          res: http.ServerResponse,
        ) => void;
      };
    };
    const nextFactory = mod.default;
    if (!nextFactory) throw new Error("Failed to import next()");

    const nextApp = nextFactory({
      dev: false,
      dir: appRoot,
      hostname: "127.0.0.1",
      port: PROD_NEXT_PORT,
    });
    await nextApp.prepare();

    const handle = nextApp.getRequestHandler();
    http
      .createServer((req, res) => handle(req, res))
      .listen(PROD_NEXT_PORT, "127.0.0.1");
  } catch (e) {
    appendLog(`failed to start Next server: ${String(e)}`);
    const logPath = path.join(app.getPath("userData"), "main.log");
    await mainWindow?.loadURL(
      `data:text/plain,Failed to start Next server.%0A%0A${encodeURIComponent(
        String(e),
      )}%0A%0ASee log:%0A${encodeURIComponent(logPath)}`,
    );
    throw e;
  }

  // 10秒待っても開かないなら、ログ場所を表示して止める
  await Promise.race([
    waitPort(),
    new Promise<void>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error("Next server did not open port in time")),
        10_000,
      ),
    ),
  ]).catch(async (e) => {
    const logPath = path.join(app.getPath("userData"), "main.log");
    await mainWindow?.loadURL(
      `data:text/plain,Failed to open port.%0A%0A${encodeURIComponent(
        String(e),
      )}%0A%0ASee log:%0A${encodeURIComponent(logPath)}`,
    );
    throw e;
  });

  await mainWindow.loadURL(`http://127.0.0.1:${PROD_NEXT_PORT}`);
}

app.whenReady().then(async () => {
  appendLog(`whenReady packaged=${app.isPackaged} appPath=${app.getAppPath()}`);
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
