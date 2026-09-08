import Link from "next/link";

export default function Home() {
  return (
    <div className="workshop-bg flex min-h-svh flex-1 flex-col">
      <header className="safe-top safe-x flex items-center justify-between border-b border-[#2c3d35] px-5 py-3">
        <div>
          <div className="ws-title text-2xl">
            小火車<span className="text-[#e63b2e]">工坊</span>
          </div>
          <div className="ws-label">Steam Workshop</div>
        </div>
        <span className="ws-label hidden sm:inline">Unofficial Fan Project</span>
      </header>

      <main className="safe-x flex flex-1 flex-col justify-center gap-8 px-6 py-10 sm:px-12">
        <div>
          <div className="ws-label mb-3">Build it. Then drive it.</div>
          <h1 className="ws-title text-5xl sm:text-7xl">
            組一台
            <br />
            <span className="text-[#e63b2e]">你的小火車</span>
          </h1>
          <p className="mt-4 max-w-md text-[#8fa39a]">
            車身、表情、煙囪、車輪、後車廂 —— 零件拖上去就裝好。
            組完開上 8 字形路線,穿過隧道、從橋上跨過自己。
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/garage"
            className="ws-btn-red rounded-md px-10 py-5 text-center text-2xl active:scale-[0.98]"
          >
            🔧 進車庫組裝
          </Link>
          <Link
            href="/track"
            className="ws-btn rounded-md px-10 py-5 text-center text-2xl font-bold active:scale-[0.98]"
          >
            🛤️ 直接開火車
          </Link>
        </div>

        <dl className="grid max-w-lg grid-cols-3 gap-3">
          {[
            { k: "零件分類", v: "8" },
            { k: "捏臉參數", v: "15" },
            { k: "鏡頭視角", v: "3" },
          ].map((s) => (
            <div key={s.k} className="ws-panel rounded-md px-3 py-3">
              <div className="text-2xl font-black tabular-nums text-[#3b8bff]">{s.v}</div>
              <div className="ws-label mt-1">{s.k}</div>
            </div>
          ))}
        </dl>
      </main>

      <footer className="safe-x safe-bottom ws-label border-t border-[#2c3d35] px-5 py-3">
        跟著跑 / 駕駛座 / 從天上看
      </footer>
    </div>
  );
}
