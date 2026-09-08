"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(params.get("next") ?? "/");
      router.refresh();
    } else {
      setError(true);
    }
  }

  return (
    <div className="workshop-bg flex min-h-svh flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="text-6xl">🚂</div>
      <h1 className="ws-title text-4xl">小火車<span className="text-[#e63b2e]">工坊</span></h1>
      <p className="ws-label">請輸入通關密碼才能進站</p>
      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密碼"
          className="w-56 rounded-md border border-[#2c3d35] bg-[#0e1512] px-5 py-3 text-center text-lg text-[#e8ede9] outline-none focus:border-[#3b8bff]"
        />
        <button
          type="submit"
          disabled={loading}
          className="ws-btn-red rounded-md px-8 py-3 text-lg transition active:scale-95 disabled:opacity-60"
        >
          {loading ? "檢查中…" : "出發 🚂"}
        </button>
        {error && <p className="text-[#e63b2e]">密碼不對喔,再試一次!</p>}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
