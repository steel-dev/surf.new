"use client";

import { useEffect, useRef, useState } from "react";
import { GlobeIcon } from "lucide-react";
import Image from "next/image";

import { useSteelContext } from "@/app/contexts/SteelContext";

import Timer from "./Timer";

export function Browser() {
  // WebSocket and canvas state
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [latestImage] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [favicon, setFavicon] = useState<string | null>(null);
  const { currentSession } = useSteelContext();

  const debugUrl = currentSession?.debugUrl;

  // Canvas rendering
  useEffect(() => {
    const renderFrame = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx && latestImage && canvasSize) {
        ctx.drawImage(latestImage, 0, 0, canvasSize.width, canvasSize.height);
      }
      requestAnimationFrame(renderFrame);
    };
    renderFrame();
  }, [latestImage, canvasSize]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify message origin matches debugUrl
      const debugUrlOrigin = new URL(debugUrl || "").origin;
      if (event.origin !== debugUrlOrigin) return;

      // Handle different message types
      if (event.data?.type === "navigation") {
        setUrl(event.data.url);
        setFavicon(event.data.favicon);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [debugUrl]);

  return (
    <div
      className="
        relative 
        flex 
        aspect-[896/555] 
        w-full 
        max-w-full 
        flex-col
        overflow-hidden 
        rounded-[1.75rem]
        border 
        border-[--gray-3] 
        bg-[--gray-1] 
        shadow-[0px_8px_16px_0px_rgba(0,0,0,0.08)]
      "
    >
      {/* Top Bar */}
      <div className="flex h-[60px] items-center justify-center border-b border-[--gray-3] bg-[--gray-1] p-2.5">
        <div className="flex h-10 w-[360px] items-center justify-center rounded-[0.5rem] border border-[--gray-3] bg-[--gray-1] px-4 py-3">
          <div className="mr-auto flex items-center justify-center">
            {favicon ? (
              <Image
                src={favicon.startsWith("/") && url ? new URL(new URL(url), favicon).href : favicon}
                alt="Favicon"
                width={24}
                height={24}
                className="mr-2 object-contain"
              />
            ) : (
              <GlobeIcon className="mr-2 size-4" />
            )}
          </div>
          <span className="mr-auto truncate font-geist text-base font-normal leading-normal text-[--gray-12]">
            {url ? url : "Session not connected"}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div ref={parentRef} className="relative flex-1">
        {debugUrl ? (
          <iframe
            src={debugUrl + "?showControls=false"}
            sandbox="allow-same-origin allow-scripts"
            className="size-full border border-[--gray-3]"
          />
        ) : (
          <div className="size-full" />
        )}

        <div className="absolute left-[372px] top-[236px] font-geist text-base font-normal leading-normal text-white opacity-0">
          Awaiting your input...
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex h-[40px] items-center border-t border-[--gray-3] bg-[--gray-1] p-1 px-3">
        <div className="flex w-full justify-between font-ibm-plex-mono text-sm text-[--gray-11]">
          <Timer />

          <span className="mt-1 flex items-center gap-2 font-sans text-sm md:mt-0">
            Browser Powered by{" "}
            <a
              href="https://steel.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[--gray-12] underline transition-colors duration-200 hover:text-[--gray-11]"
            >
              Steel.dev
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
