# Desktop App (Electron) の使い方

このプロジェクトは **Next.js のUIをElectronで包んだデスクトップアプリ**です。

## まず結論：サーバー起動は必要？

- **配布物（dmg/zip）を使う人**: **サーバーを別で起動する必要はありません**  
  アプリ自身が内部でNextサーバを立てて、`127.0.0.1` のローカルURLを開きます。
- **開発中（dev）**: **Next devサーバを起動します（自動）**  
  `npm run dev:electron` が `next dev` を起動してからElectronを立ち上げます。

この挙動は `electron/main.ts` に実装されています。

```126:176:/Users/kihhi/gitrepos/home/electron/main.ts
  if (!app.isPackaged) {
    await mainWindow.loadURL(NEXT_DEV_URL);
    return;
  }

  // 本番: Nextサーバを立てて開く
  const proc = spawn(
    process.execPath,
    [nextBin, "start", "-p", String(PROD_NEXT_PORT)],
    { /* ... */ },
  );
  await waitPort();
  await mainWindow.loadURL(`http://127.0.0.1:${PROD_NEXT_PORT}`);
```

## 開発（Electronで起動）

依存を入れてから起動します。

```bash
npm install
npm run dev:electron
```

- `dev:electron` は内部で `next dev` を起動して、`http://localhost:3000` をElectronで表示します。
- URLを変えたい場合は `NEXT_DEV_URL` を使います。

```bash
NEXT_DEV_URL="http://localhost:3001" npm run dev:electron
```

## ビルド（配布物を作る）

```bash
npm run build:electron
```

生成物は `dist/` に出ます（dmg / zip）。

> 注意: `package.json` の `build:electron` は現在 `bun run` を使っています。  
> bunを入れてないなら、`npm run build:web && npm run electron:build && npx electron-builder --publish=never` でもOKです。

## macOS: OS Now Playing（いま聴いてる曲）を出す

### 何を使ってる？

macOS 15.4+ の制約を避けるため、`/usr/bin/perl`（`com.apple.perl`）の entitlement を利用して
MediaRemote(private framework)を叩く **mediaremote-adapter** 方式です。

UI側は Electron のとき `window.nowPlaying`（preload経由）を見て表示します。

### 置く場所（重要）

以下が存在する必要があります：

- `electron/now-playing/mediaremote-adapter/MediaRemoteAdapter.framework/`（フォルダ丸ごと）
- `electron/now-playing/mediaremote-adapter/MediaRemoteAdapterTestClient`（任意だけどおすすめ）
- `electron/now-playing/mediaremote-adapter/mediaremote-adapter.pl`（同梱済み）

### 配布ビルドが落ちるとき（macOS）

`MediaRemoteAdapter.framework` はシンボリックリンクを含むので、electron-builder のパッケージングで壊れてコケることがあります。

まずこれを一度実行してから、`build:electron` を再実行してください：

```bash
./electron/now-playing/mediaremote-adapter/normalize-framework.sh
```

### 動作確認（最短）

```bash
/usr/bin/perl "./electron/now-playing/mediaremote-adapter/mediaremote-adapter.pl" \
  "$(pwd)/electron/now-playing/mediaremote-adapter/MediaRemoteAdapter.framework" \
  get
```

何か再生中なら JSON、なければ `null` が返ります。
