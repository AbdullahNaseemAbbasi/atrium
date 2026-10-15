import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { NavigationProgress } from "@/components/navigation/navigation-progress";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Atrium: the client portal for agencies",
    template: "%s · Atrium",
  },
  description:
    "Atrium gives agencies one secure place to run projects, share deliverables, collect client approvals and manage billing.",
  applicationName: "Atrium",
};

export const viewport: Viewport = {
  themeColor: "#07121b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-brand"
        >
          Skip to content
        </a>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "!bg-surface-raised !border !border-line-strong !text-ink !rounded-xl !shadow-[0_16px_50px_rgba(0,0,0,0.35)]",
              description: "!text-ink-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
