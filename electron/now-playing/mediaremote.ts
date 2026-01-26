import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import type { NowPlayingInfo, NowPlayingStreamEvent } from "./types";

const PERL = "/usr/bin/perl";

function resolveBundledAdapterPaths(appRoot: string) {
  const base = path.join(
    appRoot,
    "electron",
    "now-playing",
    "mediaremote-adapter",
  );
  return {
    base,
    scriptPath: path.join(base, "mediaremote-adapter.pl"),
    frameworkPath: path.join(base, "MediaRemoteAdapter.framework"),
    testClientPath: path.join(base, "MediaRemoteAdapterTestClient"),
  };
}

function assertExists(p: string, label: string) {
  if (!fs.existsSync(p)) {
    throw new Error(`${label} not found: ${p}`);
  }
}

export function getNowPlayingOnce(
  appRoot: string,
): Promise<NowPlayingInfo | null> {
  const { scriptPath, frameworkPath } = resolveBundledAdapterPaths(appRoot);
  assertExists(scriptPath, "mediaremote-adapter script");
  assertExists(frameworkPath, "MediaRemoteAdapter.framework");

  return new Promise((resolve, reject) => {
    const proc = spawn(PERL, [scriptPath, frameworkPath, "get"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += String(d)));
    proc.stderr.on("data", (d) => (err += String(d)));

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`mediaremote-adapter get failed (${code}): ${err}`));
        return;
      }
      try {
        // get は `null` または JSON object
        resolve(JSON.parse(out.trim()) as NowPlayingInfo | null);
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function startNowPlayingStream(
  appRoot: string,
  onUpdate: (event: NowPlayingStreamEvent) => void,
  opts?: { noDiff?: boolean; debounceMs?: number },
) {
  const { scriptPath, frameworkPath } = resolveBundledAdapterPaths(appRoot);
  assertExists(scriptPath, "mediaremote-adapter script");
  assertExists(frameworkPath, "MediaRemoteAdapter.framework");

  const args = [scriptPath, frameworkPath, "stream"];
  if (opts?.noDiff) args.push("--no-diff");
  if (typeof opts?.debounceMs === "number")
    args.push(`--debounce=${opts.debounceMs}`);

  const proc = spawn(PERL, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let buffer = "";
  proc.stdout.on("data", (d) => {
    buffer += String(d);
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        onUpdate(JSON.parse(line) as NowPlayingStreamEvent);
      } catch {
        // ignore parse errors (stderr may contain non-fatal errors)
      }
    }
  });

  // stderr は非fatalなこともあるので、ログ用途に留める
  proc.stderr.on("data", () => {});

  return {
    stop: () => {
      proc.kill("SIGTERM");
    },
    proc,
  };
}

export function sendMediaRemoteCommand(
  appRoot: string,
  commandId: number,
): Promise<void> {
  const { scriptPath, frameworkPath } = resolveBundledAdapterPaths(appRoot);
  assertExists(scriptPath, "mediaremote-adapter script");
  assertExists(frameworkPath, "MediaRemoteAdapter.framework");

  return new Promise((resolve, reject) => {
    const proc = spawn(
      PERL,
      [scriptPath, frameworkPath, "send", String(commandId)],
      {
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let err = "";
    proc.stderr.on("data", (d) => (err += String(d)));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`mediaremote-adapter send failed (${code}): ${err}`));
        return;
      }
      resolve();
    });
  });
}
