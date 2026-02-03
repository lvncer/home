"use client";

import { ImageOff, Settings2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearBackgroundImage,
  loadBackgroundImage,
  saveBackgroundImage,
} from "@/lib/background-image-store";

const BACKGROUND_CHANGED_EVENT = "home:background-image-changed";

function dispatchBackgroundChanged() {
  window.dispatchEvent(new Event(BACKGROUND_CHANGED_EVENT));
}

type Props = {
  children: React.ReactNode;
};

function useBackgroundImageUrl() {
  const [url, setUrl] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const cleanupUrl = useCallback(() => {
    const current = currentUrlRef.current;
    if (current) {
      URL.revokeObjectURL(current);
      currentUrlRef.current = null;
    }
  }, []);

  const reload = useCallback(async () => {
    const record = await loadBackgroundImage();
    cleanupUrl();
    if (!record) {
      setUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(record.blob);
    currentUrlRef.current = nextUrl;
    setUrl(nextUrl);
  }, [cleanupUrl]);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener(BACKGROUND_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(BACKGROUND_CHANGED_EVENT, onChange);
      cleanupUrl();
    };
  }, [cleanupUrl, reload]);

  return { url, reload };
}

export default function BackgroundImage({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { url: backgroundUrl } = useBackgroundImageUrl();

  const backgroundStyle = useMemo<React.CSSProperties>(() => {
    if (!backgroundUrl) return {};
    return {
      backgroundImage: `url("${backgroundUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }, [backgroundUrl]);

  useEffect(() => {
    if (!selectedFile) return;
    const u = URL.createObjectURL(selectedFile);
    return () => URL.revokeObjectURL(u);
  }, [selectedFile]);

  const close = useCallback(() => {
    setOpen(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const onPickFile = useCallback((file: File | null) => {
    setSelectedFile(file);
  }, []);

  const onSave = useCallback(async () => {
    if (!selectedFile) return;
    setBusy(true);
    try {
      await saveBackgroundImage(selectedFile);
      dispatchBackgroundChanged();
      close();
    } finally {
      setBusy(false);
    }
  }, [close, selectedFile]);

  const onClear = useCallback(async () => {
    setBusy(true);
    try {
      await clearBackgroundImage();
      dispatchBackgroundChanged();
      close();
    } finally {
      setBusy(false);
    }
  }, [close]);

  return (
    <>
      <div className="relative min-h-screen">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0" style={backgroundStyle} />
          <div className="absolute inset-0 bg-white/10" />
        </div>

        <div className="absolute right-0 top-0 z-20 p-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/70 shadow-sm transition hover:bg-black/5 active:scale-[0.98] backdrop-blur"
            aria-label="背景設定"
            title="背景設定"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>

        <div className="relative z-10">{children}</div>

        {open ? (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="閉じる"
              className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
              onClick={close}
            />
            <div className="absolute left-1/2 top-1/2 w-[520px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-white/70 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-black/70">設定</div>

                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white shadow-sm transition hover:bg-black/5 active:scale-[0.98]"
                  aria-label="閉じる"
                  title="閉じる"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3">
                <div className="grid gap-1">
                  <div className="text-sm font-semibold text-black/70">
                    背景画像
                  </div>

                  <div className="pb-1" />

                  <div className="text-sm text-black/60">
                    画像を選んで、画面全面の背景として表示します。
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-black/5 disabled:opacity-60">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm"
                      disabled={busy}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onClear}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-black/5 disabled:opacity-60"
                    >
                      <ImageOff className="h-4 w-4" />
                      背景を削除
                    </button>
                    <button
                      type="button"
                      onClick={onSave}
                      disabled={busy || !selectedFile}
                      className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm transition hover:bg-black/5 disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4" />
                      保存して適用
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
