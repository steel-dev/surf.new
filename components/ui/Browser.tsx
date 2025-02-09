"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSteelContext } from "@/app/contexts/SteelContext";
import { GlobeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Browser() {
  // WebSocket and canvas state
  const parentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [latestImage, setLatestImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [favicon, setFavicon] = useState<string | null>(null);
  const { currentSession, sessionTimeElapsed, isExpired, maxSessionDuration } =
    useSteelContext();

  const debugUrl = currentSession?.debugUrl;
  console.log("debugUrl", debugUrl);
  console.log("currentSession", currentSession);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

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
        aspect-[896/555] 
        w-full 
        max-w-full 
        bg-[--gray-1] 
        rounded-xl
        shadow-[0px_8px_16px_0px_rgba(0,0,0,0.08)] 
        border 
        border-[--gray-3] 
        flex 
        flex-col 
        overflow-hidden
      "
    >
      {/* Top Bar */}
      {/* <div className="h-[60px] bg-[--gray-1] border-b border-[--gray-3] flex items-center justify-center p-2.5">
        <div className="w-[360px] h-10 px-4 py-3 bg-[--gray-1] rounded-full border border-[--gray-3] flex justify-center items-center">
          <div className="flex items-center justify-center mr-auto">
            {favicon ? (
              <Image
                src={
                  favicon.startsWith("/") && url
                    ? new URL(new URL(url), favicon).href
                    : favicon
                }
                alt="Favicon"
                width={24}
                height={24}
                className="object-contain mr-2"
              />
            ) : (
              <GlobeIcon className="w-4 h-4 mr-2" />
            )}
          </div>
          <span className="text-[--gray-12] text-base font-normal font-geist leading-normal truncate mr-auto">
            {url ? url : "Session not connected"}
          </span>
        </div>
      </div> */}

      {/* Main Content */}
      <div ref={parentRef} className="relative flex-1 p2">
        {debugUrl ? (
          <iframe
            src={debugUrl /* + "?showControls=false" */}
            sandbox="allow-same-origin allow-scripts"
            className="w-full h-full rounded-sm border border-[--gray-3]"
          />
        ) : (
          <div className="w-full h-full" />
        )}

        <div className="absolute left-[372px] top-[236px] text-white text-base font-normal font-geist leading-normal opacity-0">
          Awaiting your input...
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-6 p-1 bg-[--gray-1] border-t border-[--gray-3] px-3 flex items-center">
        <div className="flex justify-between w-full text-sm text-[--gray-11] font-ibm-plex-mono">
          <div className="flex gap-2">
            <span className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  currentSession
                    ? isExpired
                      ? "bg-[--red-9]"
                      : "bg-[--green-9]"
                    : "bg-[--gray-8]"
                )}
              />
              {currentSession
                ? isExpired
                  ? "Session Expired"
                  : "Session Connected"
                : "No Session"}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[--gray-12]">
                {currentSession ? formatTime(sessionTimeElapsed) : "--:--"}
              </span>{" "}
              /
              <span className="text-[--gray-11]">
                {formatTime(maxSessionDuration)}
              </span>
            </span>
          </div>

          <span className="flex items-center gap-2">
            Browser Powered by{" "}
            <a
              href="https://steel.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--gray-12] hover:text-[--gray-11] transition-colors duration-200 underline"
            >
              Steel.dev
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
