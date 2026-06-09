export default function DashboardLoading() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar skeleton */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/5 bg-zinc-900/50 shrink-0">
        {/* Logo skeleton */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
            <div className="w-24 h-5 rounded bg-white/10 animate-pulse" />
          </div>
        </div>

        {/* Conversation list skeleton */}
        <div className="flex-1 px-3 py-4 space-y-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-9 rounded-lg bg-white/5 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>

        {/* Bottom nav + user skeleton */}
        <div className="border-t border-white/5 px-3 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            <div className="w-24 h-4 rounded bg-white/10 animate-pulse" />
          </div>
        </div>
      </aside>

      {/* Main area spinner */}
      <main className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <p className="text-sm text-zinc-500">
            Setting up your workspace…
          </p>
        </div>
      </main>
    </div>
  );
}
