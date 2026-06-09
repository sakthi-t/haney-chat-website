"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Loader2 } from "lucide-react";

function Fallback() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      <p className="text-sm text-zinc-400">Loading sign-up…</p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-white text-center mb-2">
        Create Account
      </h1>
      <p className="text-sm text-zinc-400 text-center mb-8">
        Join Haney Chat and start building with AI.
      </p>

      <div className="w-full flex justify-center">
        <SignUp
          routing="path"
          path="/sign-up"
          forceRedirectUrl="/chat"
          fallback={<Fallback />}
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent shadow-none border-0",
              headerTitle: "text-white",
              headerSubtitle: "text-zinc-400",
              formButtonPrimary:
                "bg-white text-black hover:bg-zinc-200 text-sm font-semibold",
              formFieldInput:
                "bg-white/5 border-white/10 text-white placeholder:text-zinc-500 rounded-lg",
              formFieldLabel: "text-zinc-300",
              footerActionLink: "text-zinc-400 hover:text-white",
              dividerLine: "bg-white/10",
              dividerText: "text-zinc-500",
              socialButtonsBlockButton:
                "bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-lg",
              socialButtonsBlockButtonText: "text-white font-medium",
            },
          }}
        />
      </div>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-zinc-300 hover:text-white underline transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
