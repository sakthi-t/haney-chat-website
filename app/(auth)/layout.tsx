export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      {/* Glass background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-zinc-950 to-cyan-900/20" />
      <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
        {children}
      </div>
    </div>
  );
}
