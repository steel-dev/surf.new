import { Inter } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { Metadata } from "next";
import { LayoutContent } from "@/components/LayoutContent";

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

export const metadata: Metadata = {
  title: "Surf.new - built with Steel",
  description: "Surf.new - web agent demos built on top of Steel",
  icons: {
    icon: "/logo.svg",
  },
};

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
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}
