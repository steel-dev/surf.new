"use client";

import React, { useEffect, useRef, useState } from "react";
import { GlobeIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

import { useSteelContext } from "@/app/contexts/SteelContext";
import { useTimerStore } from "@/app/stores/timerStore";

import { DomTimer } from "./DomTimer";

let renderCount = 0;

// Format time as MM:SS
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Create a separate memoized component just for the timer display
const SessionTimer = React.memo(({ maxDuration }: { maxDuration: number }) => {
  console.log("[RENDER] SessionTimer rendering");
  return (
    <span className="flex items-center gap-2">
      <span className="text-[--gray-12]">
        <DomTimer />
      </span>{" "}
      /<span className="text-[--gray-11]">{formatTime(maxDuration)}</span>
    </span>
  );
});

SessionTimer.displayName = "SessionTimer";

export function Browser() {
  const renderIndex = ++renderCount;
  console.log(`[RENDER] Browser component rendering #${renderIndex}`);

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

  // Get session from SteelContext but timer from Zustand
  const { currentSession, isExpired, maxSessionDuration } = useSteelContext();

  // Don't access sessionTimeElapsed here to avoid re-renders on timer change
  // The TimerText component will access it directly

  const debugUrl = currentSession?.debugUrl;

  // Add detailed debugging
  useEffect(() => {
    console.log("[DEBUG] Browser session info:", {
      hasSession: !!currentSession,
      debugUrl,
      sessionDetails: currentSession,
    });
  }, [currentSession, debugUrl]);

  // Track prop changes that might cause re-renders
  useEffect(() => {
    console.log(`[CHANGE] Browser props changed:`, {
      hasSession: !!currentSession,
      sessionId: currentSession?.id,
      isExpired,
      debugUrl,
    });
  }, [currentSession, isExpired, debugUrl]);

  // Track state changes
  useEffect(() => {
    console.log(`[STATE] Browser url/favicon changed:`, { url, favicon });
  }, [url, favicon]);

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
    console.log(`[EFFECT] Browser message listener setup with debugUrl: ${debugUrl}`);

    // Create a debounce function
    let navigationDebounceTimer: NodeJS.Timeout | null = null;
    let lastUrl: string | null = null;
    let lastFavicon: string | null = null;

    const handleMessage = (event: MessageEvent) => {
      // Verify message origin matches debugUrl
      if (!debugUrl) return;

      try {
        const debugUrlOrigin = new URL(debugUrl).origin;
        if (event.origin !== debugUrlOrigin) return;

        // Handle different message types
        if (event.data?.type === "navigation") {
          const newUrl = event.data.url;
          const newFavicon = event.data.favicon;

          // Only process if URL or favicon has changed
          if (newUrl !== lastUrl || newFavicon !== lastFavicon) {
            lastUrl = newUrl;
            lastFavicon = newFavicon;

            // Clear any existing timer
            if (navigationDebounceTimer) {
              clearTimeout(navigationDebounceTimer);
            }

            // Set a new timer to update state after delay
            navigationDebounceTimer = setTimeout(() => {
              console.log(`[MESSAGE:DEBOUNCED] Browser received navigation:`, event.data);
              setUrl(newUrl);
              setFavicon(newFavicon);
              navigationDebounceTimer = null;
            }, 300); // 300ms debounce
          }
        }
      } catch (error) {
        console.error("Invalid URL in handleMessage:", error);
        // Don't process the message if there's an error creating the URL
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      // Clear any pending timer on cleanup
      if (navigationDebounceTimer) {
        clearTimeout(navigationDebounceTimer);
      }
    };
  }, [debugUrl]);

  // Add explicit logging for session time to help debug
  useEffect(() => {
    // Get time value for logging only
    const timeValue = useTimerStore.getState().sessionTimeElapsed;
    console.log("[TIME] Session time in Browser component:", {
      sessionTimeElapsed: timeValue,
      formattedTime: formatTime(timeValue),
      hasCurrentSession: !!currentSession,
      renderCount: renderIndex,
    });
  }, [currentSession, renderIndex]);

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
                src={(() => {
                  try {
                    // Handle relative favicons by combining with the URL
                    if (favicon.startsWith("/") && url) {
                      return new URL(favicon, url).href;
                    }
                    return favicon;
                  } catch (error) {
                    console.error("Error constructing favicon URL:", error);
                    return "/fallback-favicon.svg"; // Use a fallback icon
                  }
                })()}
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
          <div className="flex gap-2 font-sans">
            <span className="flex items-center gap-2">
              <div
                className={cn(
                  "size-2 rounded-full",
                  currentSession ? (isExpired ? "bg-[--red-9]" : "bg-[--green-9]") : "bg-[--gray-8]"
                )}
              />
              {currentSession
                ? isExpired
                  ? "Session Expired"
                  : "Session Connected"
                : "No Session"}
            </span>
            <SessionTimer maxDuration={maxSessionDuration} />
          </div>

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
