import { auth } from "@clerk/nextjs/server";

export default async function SettingsPage() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 w-full space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure your Haney Chat experience.
          </p>
        </div>

        {/* Theme */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-base font-medium text-white mb-1">
            Appearance
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            Choose how Haney Chat looks.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border-2 border-purple-500 flex items-center justify-center">
                <span className="text-lg">🌙</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-sm text-white font-medium">Dark Mode</p>
              <p className="text-xs text-zinc-500">
                Haney Chat is always in dark mode for a comfortable coding
                experience.
              </p>
            </div>
          </div>
        </div>

        {/* Model info */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-base font-medium text-white mb-1">
            Model Information
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            Details about the AI model powering your chats.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="text-zinc-500 text-xs mb-0.5">Model</p>
              <p className="text-white font-medium">Haney Chat</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="text-zinc-500 text-xs mb-0.5">Parameters</p>
              <p className="text-white font-medium">537M</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="text-zinc-500 text-xs mb-0.5">Architecture</p>
              <p className="text-white font-medium">GPT-style Transformer</p>
            </div>
            <div className="px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5">
              <p className="text-zinc-500 text-xs mb-0.5">Infrastructure</p>
              <p className="text-white font-medium">Modal L4 GPU</p>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-base font-medium text-white mb-1">
            Account
          </h2>
          <p className="text-xs text-zinc-500 mb-4">
            Manage your account settings via Clerk.
          </p>
          <p className="text-sm text-zinc-400">
            Click your profile picture in the sidebar to manage your account,
            update your email, change your password, and more.
          </p>
        </div>
      </div>
    </div>
  );
}
