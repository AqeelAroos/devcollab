"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/store/auth";
import { apiFetch } from "../../lib/api/client";
import { ArrowRight, GitFork, Lock, Search, X } from "lucide-react";
import Link from "next/link";

// ---------- Types ----------

interface Repo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  updatedAt: string;
  openIssues: number;
}

// ---------- Language dot colours ----------

const LANG_DOT: Record<string, string> = {
  JavaScript:  "bg-yellow-400",
  TypeScript:  "bg-blue-500",
  Python:      "bg-emerald-500",
  Java:        "bg-orange-500",
  Ruby:        "bg-red-500",
  Go:          "bg-cyan-400",
  Rust:        "bg-orange-600",
  "C#":        "bg-purple-500",
  "C++":       "bg-blue-400",
  PHP:         "bg-indigo-400",
  Swift:       "bg-orange-400",
  Kotlin:      "bg-violet-500",
  HTML:        "bg-red-400",
  CSS:         "bg-sky-400",
  Shell:       "bg-gray-400",
  Dart:        "bg-sky-500",
  Vue:         "bg-emerald-400",
  Svelte:      "bg-red-600",
  Elixir:      "bg-violet-400",
  R:           "bg-blue-300",
};

function langDot(lang: string | null) {
  if (!lang) return "bg-slate-600";
  return LANG_DOT[lang] ?? "bg-slate-500";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ---------- Sub-components ----------

function NavAvatar({ user }: { user: { username: string; avatarUrl: string | null } | null }) {
  if (!user) return null;
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        className="w-7 h-7 rounded-full object-cover ring-2 ring-white/10"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold uppercase select-none">
      {user.username[0]}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-slate-900 border border-slate-700/40 rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3.5 h-3.5 bg-slate-700 rounded" />
        <div className="h-3.5 w-36 bg-slate-700 rounded" />
      </div>
      <div className="h-3 w-full bg-slate-800 rounded mb-2" />
      <div className="h-3 w-3/4 bg-slate-800 rounded mb-6" />
      <div className="flex items-center justify-between">
        <div className="h-5 w-20 bg-slate-800 rounded-full" />
        <div className="h-3 w-14 bg-slate-800 rounded" />
      </div>
    </div>
  );
}

function RepoCard({ repo }: { repo: Repo }) {
  return (
    <Link
      href={`/repo/${repo.fullName}`}
      className="group flex flex-col bg-slate-900 border border-slate-700/40 rounded-2xl p-5
                 hover:bg-slate-800/90 hover:border-slate-600/60
                 hover:shadow-2xl hover:shadow-black/40
                 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <GitFork className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-sm font-semibold text-white truncate">{repo.fullName}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {repo.isPrivate && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700">
              <Lock className="w-2.5 h-2.5" />
              Private
            </span>
          )}
          <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
        </div>
      </div>

      <p className="text-[13px] text-slate-400 leading-relaxed line-clamp-2 mb-5 flex-1 min-h-[2.4rem]">
        {repo.description || (
          <span className="text-slate-600 italic">No description</span>
        )}
      </p>

      <div className="flex items-center justify-between gap-2">
        {repo.language ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700/60">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${langDot(repo.language)}`} />
            {repo.language}
          </span>
        ) : <span />}
        <span className="text-[11px] text-slate-500 tabular-nums">
          {repo.updatedAt ? timeAgo(repo.updatedAt) : ""}
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ query, filter, onClear }: { query: string; filter: "all" | "private"; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/50 flex items-center justify-center mb-4">
        <Search className="w-5 h-5 text-slate-500" />
      </div>
      <p className="text-sm font-semibold text-slate-200 mb-1">No repositories found</p>
      <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
        {query ? `Nothing matches "${query}"` : "No repositories match the current filter"}
      </p>
      {(query || filter !== "all") && (
        <button onClick={onClear} className="mt-5 text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-200 transition-colors">
          Clear filters
        </button>
      )}
    </div>
  );
}

// ---------- Page ----------

export default function DashboardPage() {
  const { token, user, logout } = useAuthStore();
  const router = useRouter();

  // Wait for zustand to rehydrate from localStorage before checking auth.
  // Without this, the server/initial render sees token=null and redirects immediately.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "private">("all");

  useEffect(() => {
    if (!mounted) return;
    if (!token) { router.replace("/"); return; }

    apiFetch<Repo[]>("/api/repos", { token })
      .then(setRepos)
      .catch((err: Error) => {
        // Only clear auth on explicit 401 — never logout on network/server errors
        if (err.message.includes("401")) logout();
        else setFetchError(err.message);
      })
      .finally(() => setLoading(false));
  }, [mounted, token, router, logout]);

  const filtered = useMemo(() => {
    let list = repos;
    if (filter === "private") list = list.filter((r) => r.isPrivate);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) => r.fullName.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [repos, query, filter]);

  const clearFilters = () => { setQuery(""); setFilter("all"); };
  const isLoading = !mounted || loading;

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav className="sticky top-0 z-20 h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-white/10 rounded-[9px] flex items-center justify-center">
            <GitFork className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">DevCollab</span>
        </div>
        <div className="flex items-center gap-2.5">
          <NavAvatar user={user} />
          {user && (
            <span className="text-sm font-medium text-slate-300 hidden sm:block">{user.username}</span>
          )}
          <div className="w-px h-4 bg-slate-700 mx-1 hidden sm:block" />
          <button onClick={logout} className="text-sm text-slate-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      {/* ─── Content ─────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
            Welcome back,{" "}
            <span className="text-slate-400 font-semibold">@{user?.username ?? "…"}</span>
          </h1>
          <p className="text-sm text-slate-500">Select a repository to start reviewing pull requests.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search repositories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-800 rounded-xl bg-slate-900 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600 focus:border-slate-600 transition-colors"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 shrink-0 self-start sm:self-auto">
            {(["all", "private"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-[9px] text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                  filter === f ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {f === "all" ? "All repos" : "Private only"}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {!isLoading && (
          <p className="text-xs text-slate-500 mb-4 pl-0.5">
            {filtered.length === 0 ? "No repositories" : `${filtered.length} ${filtered.length === 1 ? "repository" : "repositories"}`}
            {query ? ` matching "${query}"` : ""}
          </p>
        )}

        {/* Error */}
        {fetchError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            Could not load repositories: {fetchError}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState query={query} filter={filter} onClear={clearFilters} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((repo) => <RepoCard key={repo.id} repo={repo} />)}
          </div>
        )}
      </div>
    </div>
  );
}
