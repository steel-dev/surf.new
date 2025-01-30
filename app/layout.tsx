"use client";

import { SteelProvider } from "./contexts/SteelContext";
import { SettingsProvider } from "@/app/contexts/SettingsContext";
import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ChatProvider } from "./contexts/ChatContext";
import { NavBar } from "@/components/ui/navbar";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

const instrumentSerif = localFont({
  src: "../public/InstrumentSerif-Regular.ttf",
  variable: "--font-instrument-serif",
});
const instrumentSerifItalic = localFont({
  src: "../public/InstrumentSerif-Italic.ttf",
  variable: "--font-instrument-serif-italic",
});

const ibmPlexMono = localFont({
  src: "../public/IBM_Plex_Mono/IBMPlexMono-Regular.ttf",
  variable: "--font-ibm-plex-mono",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(
        "dark",
        instrumentSerif.variable,
        instrumentSerifItalic.variable,
        GeistSans.variable,
        GeistMono.variable,
        ibmPlexMono.variable
      )}
    >
      <body className={inter.className}>
        <ChatProvider>
          <SettingsProvider>
            <SteelProvider>
              <NavBar />
              <div className="pt-14 bg-[--gray-1]">
                {" "}
                {/* Add padding to account for fixed navbar */}
                {children}
              </div>
            </SteelProvider>
          </SettingsProvider>
        </ChatProvider>
      </body>
    </html>
  );
}
