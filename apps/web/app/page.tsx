import { GitPullRequest, Zap, MessageSquare, BarChart3, GitFork } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950">

      {/* ─── Navbar ───────────────────────────────────── */}
      <nav className="h-14 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/10 rounded-[9px] flex items-center justify-center">
            <GitFork className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">DevCollab</span>
        </div>
        <a
          href={`${API_URL}/api/auth/github`}
          className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors"
        >
          Sign in with GitHub
        </a>
      </nav>

      {/* ─── Hero ─────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full mb-8">
          <Zap className="w-3 h-3" />
          AI-powered code review
        </div>
        <h1 className="text-5xl font-bold text-white leading-tight tracking-tight mb-6">
          Better code reviews,{" "}
          <span className="text-indigo-400">shipped faster</span>
        </h1>
        <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
          Real-time collaborative pull request reviews with AI-assisted
          suggestions, inline comments, and analytics.
        </p>
        <a
          href={`${API_URL}/api/auth/github`}
          className="inline-flex items-center gap-2.5 bg-white text-slate-900 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-colors"
        >
          <GitPullRequest className="w-4 h-4" />
          Get started with GitHub
        </a>
      </section>

      {/* ─── Feature cards ────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-28 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: MessageSquare,
            title: "Live comments",
            desc: "Comment on specific files. All reviewers see updates in real time via WebSocket.",
          },
          {
            icon: Zap,
            title: "AI review",
            desc: "Get instant AI-powered suggestions on security, performance, and code quality.",
          },
          {
            icon: BarChart3,
            title: "Analytics",
            desc: "Track review velocity, time-to-merge, and reviewer activity across your repos.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 hover:bg-slate-800/60 transition-all duration-200"
          >
            <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
              <Icon className="w-4.5 h-4.5 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
