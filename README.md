# 小火車工坊 (Little Train Builder)

給小朋友玩的小火車組裝 + 開火車遊戲網站。

## 玩法

1. **車庫 (`/garage`)** — 3D 小火車模型,可拖曳旋轉、滾輪縮放。下方 8 種零件可自由搭配:
   車身顏色、表情、煙囪、緩衝器、車輪、後車廂、號碼牌、汽笛聲。
2. **軌道 (`/track`)** — 全螢幕 3D 場景。⬅️ ➡️ 開動、📯 鳴笛,可切換
   **跟著跑 / 駕駛座 / 從天上看** 三種鏡頭。路線是立體 8 字形(約 424 單位,
   全速一圈約 22 秒),會爬坡、從橋上跨過自己走過的下層軌道。
3. **`/track2d`** — 平面版軌道,裝置跑不動 3D 時的備援。

組裝好的火車會存在瀏覽器 localStorage,到軌道頁會自動帶入。

## 在 iPhone / iPad 上玩

部署後用 Safari 開啟 → 分享 → **加入主畫面**,就會全螢幕執行、沒有網址列。
橫向操作為主(手機直向會提示轉橫)。

## 開發

```bash
npm run dev     # http://localhost:3000
npm run build
```

## 密碼保護

網站有簡單的密碼保護(適合私人使用,非高安全等級)。密碼設定在 `.env.local`:

```
SITE_PASSWORD=你的密碼
```

`.env.local` 不會進版控。若沒有設定 `SITE_PASSWORD`,網站會直接開放不需密碼。
部署到 Vercel 時,要在專案的 Environment Variables 設定 `SITE_PASSWORD`。

## 美術說明

所有小火車造型、臉孔、零件都是本專案的**原創設計**,沒有使用任何既有卡通角色的
官方圖像、臉孔設計、名稱或商標。

## 技術

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Three.js / React Three Fiber (3D 車庫) · SVG (軌道畫面) · Web Audio API (音效,無外部音檔)
