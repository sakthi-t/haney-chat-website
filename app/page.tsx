"use client";

import { LandingCarousel } from "@/components/landing-carousel";
import { AuthSwitcher } from "@/components/auth-switcher";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Side — Branding */}
      <div className="relative flex-1 flex flex-col justify-center px-8 py-16 lg:px-16 lg:py-0 overflow-hidden">
        {/* Glass background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-zinc-950 to-cyan-900/20" />
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-xl mx-auto lg:mx-0">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-zinc-400 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Model actively serving on Modal GPUs
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            Haney{" "}
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Chat
            </span>
          </h1>

          <p className="text-xl text-zinc-400 mb-4">
            Your personal AI assistant powered by a language model built from
            scratch.
          </p>

          <p className="text-sm text-zinc-500 mb-8 leading-relaxed max-w-lg">
            Haney Chat is powered by a custom GPT-style transformer model
            trained from scratch and deployed on GPU infrastructure. The model
            was designed from scratch, trained on custom datasets, converted to
            GGUF, and deployed on Modal GPU infrastructure.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mb-10">
            {[
              "Streaming responses",
              "Conversation memory",
              "Persistent chat history",
              "Threaded conversations",
              "Secure authentication",
            ].map((feature) => (
              <span
                key={feature}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300 backdrop-blur-sm"
              >
                {feature}
              </span>
            ))}
          </div>

          {/* Carousel */}
          <LandingCarousel />
        </div>
      </div>

      {/* Right Side — Authentication (Clerk components with social logins) */}
      <div className="flex-1 flex flex-col justify-center items-center px-8 py-16 lg:px-16 lg:py-0 bg-zinc-900/50 backdrop-blur-sm border-l border-white/5">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold text-white text-center mb-2">
            Get Started
          </h2>
          <p className="text-sm text-zinc-400 text-center mb-8">
            Sign in or create an account to start chatting with Haney.
          </p>
          <AuthSwitcher />
        </div>
      </div>
    </div>
  );
}
