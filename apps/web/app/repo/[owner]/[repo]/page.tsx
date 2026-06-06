"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../../lib/store/auth";
import { apiFetch } from "../../../../lib/api/client";
import {
  ArrowRight,
  ChevronLeft,
  GitFork,
  GitMerge,
  GitPullRequest,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";

// ---------- Types ----------

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  additions: number;
  deletions: number;
  createdAt: string;
}

type StateFilter = "all" | "open" | "closed";

// ---------- Helpers ----------

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

// ---------- State config ----------

const STATE_CFG = {
  open:   { icon: GitPullRequest, iconColor: "text-emerald-500", dot: "bg-emerald-500", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", bar: "border-l-emerald-500", label: "Open" },
  merged: { icon: GitMerge,       iconColor: "text-violet-500",  dot: "bg-violet-500",  badge: "text-violet-400 bg-violet-500/10 border-violet-500/20",   bar: "border-l-violet-500",  label: "Merged" },
  closed: { icon: XCircle,        iconColor: "text-slate-500",   dot: "bg-slate-500",   badge: "text-slate-400 bg-slate-700/40 border-slate-600/20",       bar: "border-l-slate-600",   label: "Closed" },
};

// ---------- Sub-components ----------

function SkeletonPR() {
  return (
    <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-slate-700 rounded-2xl px-5 py-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-4 h-4 bg-slate-700 rounded-full mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-4 w-3/4 bg-slate-700 rounded mb-3" />
          <div className="h-3 w-48 bg-slate-800 rounded" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-5 w-10 bg-slate-800 rounded" />
          <div className="h-5 w-10 bg-slate-800 rounded" />
          <div className="h-5 w-16 bg-slate-800 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function PRCard({ pr, fullName }: { pr: PullRequest; fullName: string }) {
  const cfg = STATE_CFG[pr.state];
  const Icon = cfg.icon;

  return (
    <Link
      href={`/repo/${fullName}/pull/${pr.number}`}
      className={`group flex items-start gap-4 bg-slate-900 border border-slate-800 border-l-4 ${cfg.bar}
                  rounded-2xl px-5 py-4
                  hover:bg-slate-800/70 hover:border-slate-700
                  hover:shadow-xl hover:shadow-black/30
                  transition-all duration-200`}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug mb-1.5">
          {pr.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
          <span className="font-mono text-slate-600">#{pr.number}</span>
          <span className="text-slate-700">·</span>
          <span>@{pr.author}</span>
          <span className="text-slate-700">·</span>
          <span>{timeAgo(pr.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-xs font-semibold text-emerald-500 tabular-nums hidden sm:inline">+{pr.additions}</span>
        <span className="text-xs font-semibold text-red-400 tabular-nums hidden sm:inline">−{pr.deletions}</span>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${cfg.badge} hidden sm:inline-flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all duration-150" />
      </div>
    </Link>
  );
}

function EmptyPRs({ filter }: { filter: StateFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
        <GitPullRequest className="w-5 h-5 text-slate-500" />
      </div>
      <p className="text-sm font-semibold text-slate-300 mb-1">No pull requests</p>
      <p className="text-xs text-slate-500">
        {filter === "all" ? "This repository has no pull requests yet." : `No ${filter} pull requests found.`}
      </p>
    </div>
  );
}

// ---------- Page ----------

export default function RepoPage({ params }: { params: { owner: string; repo: string } }) {
  const { token, user, logout } = useAuthStore();
  const router = useRouter();

  // Guard: wait for zustand to rehydrate from localStorage
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [query, setQuery] = useState("");

  const { owner, repo } = params;
  const fullName = `${owner}/${repo}`;

  useEffect(() => {
    if (!mounted) return;
    if (!token) { router.replace("/"); return; }

    apiFetch<PullRequest[]>(`/api/prs/${owner}/${repo}?state=all`, { token })
      .then(setPrs)
      .catch((err: Error) => {
        if (err.message.includes("401")) logout();
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [mounted, token, owner, repo, router, logout]);

  const filtered = useMemo(() => {
    let list = prs;
    if (stateFilter !== "all") {
      list = list.filter((pr) =>
        stateFilter === "closed"
          ? pr.state === "closed" || pr.state === "merged"
          : pr.state === stateFilter
      );
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((pr) => pr.title.toLowerCase().includes(q) || pr.author.toLowerCase().includes(q));
    }
    return list;
  }, [prs, stateFilter, query]);

  const counts = useMemo(() => ({
    all:    prs.length,
    open:   prs.filter((p) => p.state === "open").length,
    closed: prs.filter((p) => p.state === "closed" || p.state === "merged").length,
  }), [prs]);

  const tabs: { key: StateFilter; label: string }[] = [
    { key: "open",   label: "Open" },
    { key: "closed", label: "Closed" },
    { key: "all",    label: "All" },
  ];

  const isLoading = !mounted || loading;

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ─── Navbar ──────────────────────────────────────── */}
      <nav className="sticky top-0 z-20 h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
              <GitFork className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white hidden sm:block">DevCollab</span>
          </div>
          <span className="text-slate-700 hidden sm:block">/</span>
          <Link href="/dashboard" className="hidden sm:flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <span className="text-slate-700 hidden sm:block">/</span>
          <span className="text-sm font-medium text-slate-200 truncate max-w-[180px] sm:max-w-xs">{fullName}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20" />
          ) : user ? (
            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold uppercase">{user.username[0]}</div>
          ) : null}
          <button onClick={logout} className="text-sm text-slate-500 hover:text-white transition-colors">Sign out</button>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors mb-4">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
                  <GitFork className="w-4 h-4 text-slate-400" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">{fullName}</h1>
              </div>
              <p className="text-sm text-slate-500 ml-10">Pull request review dashboard</p>
            </div>
            {!isLoading && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-center px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
                  <p className="text-lg font-bold text-white tabular-nums">{counts.open}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Open</p>
                </div>
                <div className="text-center px-4 py-2 bg-slate-800 rounded-xl border border-slate-700">
                  <p className="text-lg font-bold text-white tabular-nums">{counts.closed}</p>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Closed</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-7">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStateFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-[9px] text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                  stateFilter === tab.key ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md font-mono ${
                  stateFilter === tab.key ? "bg-white/10 text-slate-300" : "bg-slate-800 text-slate-600"
                }`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search pull requests…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600 focus:border-slate-600 transition-colors"
            />
          </div>
        </div>

        {/* PR list */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400">{error}</div>
        ) : isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <SkeletonPR key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyPRs filter={stateFilter} />
        ) : (
          <div className="space-y-3">
            {filtered.map((pr) => <PRCard key={pr.id} pr={pr} fullName={fullName} />)}
          </div>
        )}
      </div>
    </div>
  );
}
