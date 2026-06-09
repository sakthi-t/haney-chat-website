"use client";

import { useState, useEffect } from "react";
import { SignIn, SignUp, useClerk, useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";

type AuthMode = "sign-in" | "sign-up";

/**
 * ClerkScriptFallback — shown while Clerk's JS is loading from CDN.
 * Brave & other ad-blockers block clerk.accounts.dev scripts.
 * We show a loading indicator briefly, then offer a direct link
 * to the dedicated sign-in page as fallback.
 */

function ClerkLoadingFallback({ mode }: { mode: AuthMode }) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const targetPage = mode === "sign-in" ? "/sign-in" : "/sign-up";

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      {!showFallback ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <p className="text-sm text-zinc-400">Loading auth form…</p>
        </>
      ) : (
        <>
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <p className="text-sm text-zinc-300 text-center max-w-xs">
            Clerk&apos;s scripts are taking longer than expected to load.
            This is common if you&apos;re using Brave or have an ad-blocker
            enabled.
          </p>
          <Link
            href={targetPage}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors mt-2"
          >
            Go to {mode === "sign-in" ? "Sign In" : "Sign Up"} Page
            <ArrowRight size={14} />
          </Link>
          <p className="text-xs text-zinc-500 mt-1">
            Or disable Shields / ad-blocker for this site
          </p>
        </>
      )}
    </div>
  );
}

export function AuthSwitcher() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const clerk = useClerk();
  const { isSignedIn } = useAuth();

  // If already signed in (e.g., Clerk JS loaded late and detected session),
  // redirect to /chat immediately
  if (isSignedIn) {
    if (typeof window !== "undefined") {
      window.location.href = "/chat";
    }
    return null;
  }

  const clerkAppearance = {
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
      socialButtonsProviderIcon: "[&>svg]:!h-5 [&>svg]:!w-5",
      identityPreviewText: "text-white",
      identityPreviewEditButtonIcon: "text-zinc-400",
      formHeaderTitle: "text-white",
      formHeaderSubtitle: "text-zinc-400",
      otpCodeFieldInput: "text-white",
    },
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tab switcher */}
      <div className="flex rounded-xl bg-white/5 p-1 mb-6 backdrop-blur-sm border border-white/10">
        <button
          onClick={() => setMode("sign-in")}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
            mode === "sign-in"
              ? "bg-white text-black shadow-md"
              : "text-zinc-400 hover:text-white"
          )}
        >
          Sign In
        </button>
        <button
          onClick={() => setMode("sign-up")}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
            mode === "sign-up"
              ? "bg-white text-black shadow-md"
              : "text-zinc-400 hover:text-white"
          )}
        >
          Sign Up
        </button>
      </div>

      {!clerk.loaded ? (
        <ClerkLoadingFallback mode={mode} />
      ) : (
        <div className="flex justify-center w-full">
          {mode === "sign-in" ? (
            <SignIn
              routing="hash"
              forceRedirectUrl="/chat"
              fallback={<ClerkLoadingFallback mode="sign-in" />}
              appearance={clerkAppearance}
            />
          ) : (
            <SignUp
              routing="hash"
              forceRedirectUrl="/chat"
              fallback={<ClerkLoadingFallback mode="sign-up" />}
              appearance={clerkAppearance}
            />
          )}
        </div>
      )}
    </div>
  );
}
