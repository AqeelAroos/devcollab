"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "../../../lib/store/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { setToken, setUser } = useAuthStore();

  useEffect(() => {
    const token = params.get("token");
    if (!token) { router.replace("/auth/error"); return; }

    setToken(token);

    // Fetch and store the user profile so the dashboard can show name/avatar
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((user) => { if (user) setUser(user); })
      .catch(() => {})
      .finally(() => router.replace("/dashboard"));
  }, [params, router, setToken, setUser]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400">Signing you in…</p>
      </div>
    </div>
  );
}
