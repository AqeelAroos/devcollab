"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../../../../lib/store/auth";
import { apiFetch } from "../../../../../../lib/api/client";
import { io, Socket } from "socket.io-client";
import {
  ArrowLeft,
  GitBranch,
  GitFork,
  GitMerge,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ---------- Interfaces ----------

interface PRFile {
  filename: string;
  additions: number;
  deletions: number;
  patch: string;
}

interface PullRequest {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  author: string;
  headBranch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  createdAt: string;
  files: PRFile[];
}

interface AISuggestion {
  id: string;
  filename?: string | null;
  text: string;
  createdAt: string;
}

interface Comment {
  id: string;
  body: string;
  filePath: string | null;
  isAi: boolean;
  createdAt: string;
  user: { username: string; avatarUrl: string | null };
}

// ---------- Helpers ----------

const STATE_BADGE = {
  open:   "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
  merged: "text-violet-400 bg-violet-500/10 border border-violet-500/20",
  closed: "text-slate-400 bg-slate-700/40 border border-slate-600/20",
};

function lineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "text-slate-500 bg-transparent";
  if (line.startsWith("+")) return "bg-emerald-500/10 text-emerald-300";
  if (line.startsWith("-")) return "bg-red-500/10 text-red-400";
  if (line.startsWith("@@")) return "bg-indigo-500/10 text-indigo-400";
  return "text-slate-400";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------- Sub-components ----------

function Avatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className="w-7 h-7 rounded-full shrink-0 object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-indigo-500/20 shrink-0 flex items-center justify-center text-xs font-bold text-indigo-300 uppercase select-none">
      {username[0]}
    </div>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3">
      <Avatar username={comment.user.username} avatarUrl={comment.user.avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-200">{comment.user.username}</span>
            <span className="text-xs text-slate-500">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
            {comment.body}
          </p>
        </div>
      </div>
    </div>
  );
}

interface DiffFileProps {
  file: PRFile;
  comments: Comment[];
  draft: string;
  posting: boolean;
  onDraftChange: (v: string) => void;
  onPost: () => void;
}

function DiffFile({ file, comments, draft, posting, onDraftChange, onPost }: DiffFileProps) {
  return (
    <div className="border border-slate-700/60 rounded-2xl overflow-hidden mb-4 bg-slate-900">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700/60">
        <span className="text-xs font-medium text-slate-300 font-mono truncate">{file.filename}</span>
        <div className="flex items-center gap-3 text-xs font-semibold shrink-0 ml-4">
          <span className="text-emerald-400">+{file.additions}</span>
          <span className="text-red-400">−{file.deletions}</span>
        </div>
      </div>

      {/* Diff */}
      {file.patch ? (
        <pre className="text-xs overflow-x-auto leading-[1.65] bg-slate-950/50">
          {file.patch.split("\n").map((line, i) => (
            <div key={i} className={`px-4 py-px ${lineClass(line)}`}>
              {line || " "}
            </div>
          ))}
        </pre>
      ) : (
        <div className="px-4 py-4 text-xs text-slate-600 italic bg-slate-950/30">
          Binary file or no patch available.
        </div>
      )}

      {/* Existing comments */}
      {comments.length > 0 && (
        <div className="border-t border-slate-800 bg-slate-900/80 px-4 py-4 space-y-3">
          <div className="flex items-center gap-1.5 mb-3">
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-500">
              {comments.length} comment{comments.length !== 1 ? "s" : ""}
            </span>
          </div>
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
        </div>
      )}

      {/* Comment form */}
      <div className="border-t border-slate-800 bg-slate-900/50 px-4 py-3">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim()) onPost();
          }}
          placeholder="Leave a comment… (Ctrl+Enter to submit)"
          className="w-full text-sm border border-slate-700 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-slate-600 focus:border-slate-600 bg-slate-800 text-slate-200 placeholder:text-slate-600 transition-colors"
          rows={2}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={onPost}
            disabled={posting || !draft.trim()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {posting && <Loader2 className="w-3 h-3 animate-spin" />}
            Post comment
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------

export default function PullRequestPage({
  params,
}: {
  params: { owner: string; repo: string; number: string };
}) {
  const { token, user, logout } = useAuthStore();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [pr, setPr] = useState<PullRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI review
  const [reviewing, setReviewing] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const streamPanelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);

  // Comments
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const socketRef = useRef<Socket | null>(null);

  const { owner, repo, number } = params;
  const fullName = `${owner}/${repo}`;

  // Fetch PR
  useEffect(() => {
    if (!mounted) return;
    if (!token) { router.replace("/"); return; }

    apiFetch<PullRequest>(`/api/prs/${owner}/${repo}/${number}`, { token })
      .then(setPr)
      .catch((err: Error) => {
        if (err.message.includes("401")) logout();
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [mounted, token, owner, repo, number, router, logout]);

  // Fetch existing AI suggestions once we have the PR id
  useEffect(() => {
    if (!pr?.id || !token) return;
    apiFetch<AISuggestion[]>(`/api/ai/suggestions/${pr.id}`, { token })
      .then(setSuggestions)
      .catch(() => {});
  }, [pr?.id, token]);

  // Fetch comments
  useEffect(() => {
    if (!pr?.id || !token) return;
    apiFetch<Comment[]>(`/api/comments/pr/${pr.id}`, { token })
      .then((data) => {
        const grouped: Record<string, Comment[]> = {};
        for (const c of data) {
          const key = c.filePath ?? "";
          (grouped[key] ??= []).push(c);
        }
        setComments(grouped);
      })
      .catch(() => {});
  }, [pr?.id, token]);

  // WebSocket for real-time comments
  useEffect(() => {
    if (!token || !pr?.id) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join:pr", pr.id));

    socket.on("comment:new", (comment: Comment) => {
      setComments((prev) => {
        const key = comment.filePath ?? "";
        const existing = prev[key] ?? [];
        if (existing.some((c) => c.id === comment.id)) return prev;
        return { ...prev, [key]: [...existing, comment] };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, pr?.id]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  async function postComment(filePath: string) {
    const body = (drafts[filePath] ?? "").trim();
    if (!pr || !token || !body) return;

    setPosting((prev) => ({ ...prev, [filePath]: true }));
    try {
      const res = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pullRequestId: pr.id,
          body,
          ...(filePath ? { filePath } : {}),
        }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "Failed to post comment");
        throw new Error(msg);
      }
      const comment: Comment = await res.json();
      setComments((prev) => {
        const key = comment.filePath ?? "";
        const existing = prev[key] ?? [];
        if (existing.some((c) => c.id === comment.id)) return prev;
        return { ...prev, [key]: [...existing, comment] };
      });
      setDrafts((prev) => ({ ...prev, [filePath]: "" }));
    } catch (err) {
      console.error("Post comment error:", err);
    } finally {
      setPosting((prev) => ({ ...prev, [filePath]: false }));
    }
  }

  async function runAIReview() {
    if (!token || !pr || reviewing) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setReviewing(true);
    setStreamedText("");

    const diff = pr.files
      .filter((f) => f.patch)
      .map((f) => `--- ${f.filename}\n${f.patch}`)
      .join("\n\n");

    try {
      const res = await fetch(`${API_URL}/api/ai/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pullRequestId: pr.id, diff }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "Review request failed");
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break outer;
          try {
            const json = JSON.parse(raw);
            if (typeof json.text === "string") {
              setStreamedText((prev) => prev + json.text);
              streamPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            } else if (typeof json.error === "string") {
              setStreamedText((prev) =>
                prev ? `${prev}\n\n⚠ ${json.error}` : `⚠ ${json.error}`
              );
            } else if (json.done) {
              apiFetch<AISuggestion[]>(`/api/ai/suggestions/${pr.id}`, { token })
                .then(setSuggestions)
                .catch(() => {});
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setStreamedText(`⚠ Review failed: ${(err as Error).message}`);
      }
    } finally {
      setReviewing(false);
    }
  }

  const suggestionsByFile = suggestions.reduce<Record<string, AISuggestion[]>>((acc, s) => {
    const key = s.filename ?? "General";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const isLoading = !mounted || loading;

  return (
    <div className="min-h-screen bg-slate-950">

      {/* ─── Navbar ─────────────────────────────────── */}
      <nav className="sticky top-0 z-20 h-14 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
              <GitFork className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white hidden sm:block">DevCollab</span>
          </div>
          <span className="text-slate-700 hidden sm:block">/</span>
          <Link
            href={`/repo/${fullName}`}
            className="hidden sm:flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {fullName}
          </Link>
          {pr && (
            <>
              <span className="text-slate-700 hidden sm:block">/</span>
              <span className="text-sm text-slate-500 font-mono hidden sm:block">#{pr.number}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.username} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20" />
          ) : user ? (
            <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] font-bold uppercase">{user.username[0]}</div>
          ) : null}
          <button onClick={logout} className="text-sm text-slate-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* ─── Loading skeleton ────────────────────── */}
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 w-2/3 bg-slate-800 rounded-xl" />
            <div className="h-4 w-1/3 bg-slate-800/60 rounded-lg" />
            <div className="h-28 bg-slate-800/60 rounded-2xl mt-6" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-slate-800/40 rounded-2xl" />
            ))}
          </div>

        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 text-sm text-red-400">
            {error}
          </div>

        ) : pr ? (
          <>
            {/* ─── PR header ───────────────────────── */}
            <div className="mb-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`mt-1 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATE_BADGE[pr.state]}`}>
                    {pr.state}
                  </span>
                  <h1 className="text-xl font-bold text-white leading-snug">{pr.title}</h1>
                </div>
                <button
                  onClick={runAIReview}
                  disabled={reviewing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-colors shrink-0"
                >
                  {reviewing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {reviewing ? "Reviewing…" : "AI Review"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 mb-4">
                <span>
                  <span className="font-semibold text-slate-300">@{pr.author}</span>
                  {" "}opened on{" "}
                  {new Date(pr.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-slate-600" />
                  <code className="text-xs bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md text-slate-300">{pr.headBranch}</code>
                  <span className="text-slate-600">→</span>
                  <code className="text-xs bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md text-slate-300">{pr.baseBranch}</code>
                </span>
                <span className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-emerald-400">+{pr.additions}</span>
                  <span className="text-red-400">−{pr.deletions}</span>
                </span>
              </div>

              {pr.body && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {pr.body}
                </div>
              )}
            </div>

            {/* ─── Files changed ───────────────────── */}
            <div className="flex items-center gap-2 mb-4">
              <GitMerge className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-200">
                Files changed{" "}
                <span className="text-slate-600 font-normal text-sm">({pr.files.length})</span>
              </h2>
            </div>

            {pr.files.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-8 text-center text-slate-500 text-sm">
                No changed files.
              </div>
            ) : (
              pr.files.map((file) => (
                <DiffFile
                  key={file.filename}
                  file={file}
                  comments={comments[file.filename] ?? []}
                  draft={drafts[file.filename] ?? ""}
                  posting={!!posting[file.filename]}
                  onDraftChange={(v) => setDrafts((prev) => ({ ...prev, [file.filename]: v }))}
                  onPost={() => postComment(file.filename)}
                />
              ))
            )}

            {/* ─── Live AI review stream ───────────── */}
            {(reviewing || streamedText) && (
              <div className="mt-8" ref={streamPanelRef}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-semibold text-slate-200">AI Review</h2>
                  {reviewing && (
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      streaming…
                    </span>
                  )}
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {streamedText}
                  {reviewing && <span className="animate-pulse text-indigo-400">▌</span>}
                </div>
              </div>
            )}

            {/* ─── Previous AI suggestions ─────────── */}
            {suggestions.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-semibold text-slate-200">
                    Previous suggestions{" "}
                    <span className="text-slate-600 font-normal text-sm">({suggestions.length})</span>
                  </h2>
                </div>
                {Object.entries(suggestionsByFile).map(([filename, fileSuggestions]) => (
                  <div key={filename} className="mb-6">
                    <p className="text-xs font-medium text-slate-500 font-mono mb-2.5 px-1">
                      {filename}
                    </p>
                    {fileSuggestions.map((s) => (
                      <div key={s.id} className="mb-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                          {s.text}
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5 px-1">
                          {new Date(s.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
