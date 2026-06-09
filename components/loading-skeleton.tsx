import { cn } from "@/lib/utils";

/** A pulsing placeholder block */
function Bone({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "bg-white/5 rounded-lg animate-pulse",
        className
      )}
      style={style}
    />
  );
}

// ── Chat messages skeleton ──────────────────────────────────────────

export function ChatMessagesSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* User message skeleton */}
        <div className="flex justify-end gap-4">
          <div className="max-w-[70%] space-y-2">
            <Bone className="h-4 w-64" />
            <Bone className="h-4 w-48" />
            <Bone className="h-4 w-56" />
          </div>
          <Bone className="w-8 h-8 rounded-full shrink-0" />
        </div>

        {/* Assistant message skeleton */}
        <div className="flex gap-4">
          <Bone className="w-8 h-8 rounded-lg shrink-0" />
          <div className="max-w-[70%] space-y-2">
            <Bone className="h-4 w-72" />
            <Bone className="h-4 w-80" />
            <Bone className="h-4 w-60" />
            <Bone className="h-4 w-40" />
          </div>
        </div>

        {/* Another user message */}
        <div className="flex justify-end gap-4">
          <div className="max-w-[70%] space-y-2">
            <Bone className="h-4 w-36" />
          </div>
          <Bone className="w-8 h-8 rounded-full shrink-0" />
        </div>

        {/* Assistant reply skeleton */}
        <div className="flex gap-4">
          <Bone className="w-8 h-8 rounded-lg shrink-0" />
          <div className="max-w-[70%] space-y-2">
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-5/6" />
            <Bone className="h-4 w-3/4" />
            <Bone className="h-4 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar conversation list skeleton ───────────────────────────────

export function ConversationsSkeleton() {
  return (
    <div className="px-3 py-3 space-y-1">
      <Bone className="h-9 w-full rounded-lg" />
      <div className="pt-3 space-y-0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bone
            key={i}
            className="h-8 rounded-lg"
            style={{ width: `${65 + Math.random() * 30}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Admin table skeleton ─────────────────────────────────────────────

export function AdminTableSkeleton() {
  return (
    <div className="py-8 space-y-2 px-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Bone className="h-4 w-6" />
          <Bone className="h-4 flex-1" />
          <Bone className="h-4 w-20" />
          <Bone className="h-5 w-14 rounded-full" />
          <Bone className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// ── Page-level skeleton ──────────────────────────────────────────────

export function PageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Bone className="w-16 h-16 rounded-2xl" />
      <Bone className="h-8 w-48" />
      <Bone className="h-4 w-72" />
    </div>
  );
}
