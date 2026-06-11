import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { Footer } from "@/components/footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Haney Chat — AI Assistant",
    template: "%s | Haney Chat",
  },
  description:
    "Your personal AI assistant powered by a 537M-parameter language model built from scratch and deployed on GPU infrastructure.",
  keywords: [
    "AI chat",
    "Haney Chat",
    "LLM",
    "language model",
    "GPT",
    "transformer",
  ],
  authors: [{ name: "Haney Chat" }],
  openGraph: {
    title: "Haney Chat — AI Assistant",
    description:
      "Your personal AI assistant powered by a language model built from scratch.",
    type: "website",
    siteName: "Haney Chat",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/chat"
      signUpFallbackRedirectUrl="/chat"
      appearance={{
        variables: {
          colorPrimary: "#a855f7",
          colorTextOnPrimaryBackground: "#ffffff",
        },
      }}
    >
      <html
        lang="en"
        className={cn(
          "h-full",
          "antialiased",
          geistSans.variable,
          geistMono.variable,
          "font-sans",
          inter.variable,
          "dark"
        )}
      >
        <body className="min-h-full flex flex-col bg-zinc-950 text-white">
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
