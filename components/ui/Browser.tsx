"use client";

import React, { useEffect, useRef, useState } from "react";
import { GlobeIcon } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";

import { cn, truncateUrl } from "@/lib/utils";

import { useSteelContext } from "@/app/contexts/SteelContext";

import { DomTimer } from "./DomTimer";

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

export function Browser({ isPaused }: { isPaused?: boolean }) {
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
  const [url, setUrl] = useState<string | null>(null);
  const [favicon, setFavicon] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const { currentSession, isExpired, maxSessionDuration } = useSteelContext();
  const { toast } = useToast();

  const debugUrl = currentSession?.debugUrl;

  // Listen for messages from the iframe to update URL
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if the message is from our iframe
      if (event.data && event.data.type === "navigation") {
        const navigationUrl = event.data.url;
        // Only set the URL if it's not a Steel API backend URL
        if (
          navigationUrl &&
          !navigationUrl.includes("steel-api") &&
          !navigationUrl.includes("steel.dev")
        ) {
          // Handle special cases to avoid nullblank
          if (
            navigationUrl === "about:blank" ||
            navigationUrl === "null" ||
            navigationUrl === "undefined"
          ) {
            setUrl("about:blank");
          } else {
            setUrl(navigationUrl);
          }

          if (event.data.favicon) {
            setFavicon(event.data.favicon);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

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

  // Add function to handle taking control
  const handleTakeControl = async () => {
    if (!currentSession?.id) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/sessions/${currentSession.id}/pause`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error taking control:", {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        toast({
          title: "Error",
          description: "Failed to take control. Please try again.",
          className: "border border-[--red-6] bg-[--red-3] text-[--red-11]",
        });
        throw new Error("Failed to pause session");
      }

      toast({
        title: "Control Taken",
        description: "You now have control of the browser",
        className: "border border-[--green-6] bg-[--green-3] text-[--green-11]",
      });

      // Trigger a custom event that page.tsx can listen for
      window.dispatchEvent(
        new CustomEvent("browser-paused", {
          detail: { sessionId: currentSession.id },
        })
      );
    } catch (error) {
      console.error("Error taking control:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add function to handle resuming AI control
  const handleResume = async () => {
    if (!currentSession?.id) return;

    try {
      setIsLoading(true);

      // Instead of making our own API call, just dispatch the event
      // to let page.tsx handle the actual API call
      console.info("🔄 Dispatching browser-resumed event to let page.tsx handle the resume");
      window.dispatchEvent(
        new CustomEvent("browser-resumed", {
          detail: { sessionId: currentSession.id },
        })
      );

      // Show a toast notification so user gets feedback
      toast({
        title: "Resuming Control",
        description: "Returning control to AI...",
        className: "border border-[--green-6] bg-[--green-3] text-[--green-11]",
      });

      // Add a timeout to turn off loading after a reasonable delay
      // This will be overridden if the page.tsx handles it properly
      setTimeout(() => {
        setIsLoading(false);
      }, 2000);
    } catch (error) {
      console.error("Error triggering resume:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to resume AI control. Please try again.",
        className: "border border-[--red-6] bg-[--red-3] text-[--red-11]",
      });
    }
  };

  return (
    <>
      <div
        className="
        relative 
        flex 
        aspect-[16/8.5] 
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
        <div className="relative flex h-[60px] items-center justify-center border-b border-[--gray-3] bg-[--gray-1] p-2.5">
          <div className="flex h-10 w-[360px] items-center justify-center rounded-[0.5rem] border border-[--gray-3] bg-[--gray-1] px-4 py-3">
            <div className="flex w-full items-center justify-center overflow-hidden">
              {favicon ? (
                <Image
                  src={
                    favicon.startsWith("/") && url ? new URL(new URL(url), favicon).href : favicon
                  }
                  alt="Favicon"
                  width={24}
                  height={24}
                  className="mr-2 flex-shrink-0 object-contain"
                />
              ) : (
                <GlobeIcon className="mr-2 size-4 flex-shrink-0" />
              )}
              <span className="truncate max-w-full font-geist text-base font-normal leading-normal text-[--gray-12]">
                {!currentSession
                  ? "Session not connected"
                  : url
                    ? url === "about:blank" || url === "null" || url === "undefined"
                      ? "about:blank"
                      : truncateUrl(url)
                    : debugUrl
                      ? "Loading..."
                      : "Session not connected"}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          ref={parentRef}
          className="relative flex-1"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {debugUrl ? (
            <>
              <iframe
                src={`${debugUrl}?showControls=false&interactive=true&initialInteractive=true`}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                className="size-full border border-[--gray-3]"
                onLoad={e => {
                  // Try to update the URL when iframe loads
                  const iframeEl = e.target as HTMLIFrameElement;
                  try {
                    // This might not work due to cross-origin restrictions
                    if (iframeEl.contentWindow?.location?.href) {
                      const iframeUrl = iframeEl.contentWindow.location.href;
                      // Only update URL if it's not a Steel API backend URL
                      if (!iframeUrl.includes("steel-api") && !iframeUrl.includes("steel.dev")) {
                        // Handle special cases to avoid nullblank
                        if (
                          iframeUrl === "about:blank" ||
                          iframeUrl === "null" ||
                          iframeUrl === "undefined"
                        ) {
                          setUrl("about:blank");
                        } else {
                          setUrl(iframeUrl);
                        }
                      }
                    }
                  } catch (error) {
                    // Cross-origin errors are expected and ignored
                    console.debug("Could not access iframe location (expected for cross-origin)");
                  }
                }}
              />
              {isPaused && (
                <div
                  className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(0deg, rgba(23, 23, 23, 0.80) 0%, rgba(23, 23, 23, 0.80) 100%)",
                    opacity: isHovering ? 0 : 1,
                    pointerEvents: "none" /* Always allow clicks to pass through to iframe */,
                  }}
                >
                  <span className="font-geist font-normal text-white">Awaiting your input...</span>
                </div>
              )}
              {!isPaused && currentSession && !isExpired && (
                <div
                  className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(0deg, rgba(23, 23, 23, 0.70) 0%, rgba(23, 23, 23, 0.70) 100%)",
                    opacity: isHovering ? 1 : 0,
                    pointerEvents: isHovering
                      ? "auto"
                      : "none" /* Only capture clicks when visible */,
                  }}
                >
                  <Button
                    onClick={handleTakeControl}
                    disabled={isLoading}
                    className={`rounded-full bg-white px-6 py-3 text-base font-medium text-black transition-colors hover:bg-[--gray-11] hover:text-[--gray-1] ${isLoading ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {isLoading ? (
                      <>
                        <div className="mr-2 size-4 animate-spin rounded-full border-2 border-gray-800 border-t-transparent"></div>
                        Taking Control...
                      </>
                    ) : (
                      "Take Control"
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="size-full" />
          )}
        </div>

        {/* Status Bar */}
        <div className="flex h-[40px] items-center border-t border-[--gray-3] bg-[--gray-1] p-1 px-3">
          <div className="flex w-full justify-between font-ibm-plex-mono text-sm text-[--gray-11]">
            <div className="flex gap-2 font-sans">
              <span className="flex items-center gap-2">
                <div
                  className={cn(
                    "size-2 rounded-full",
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
                    : isPaused
                      ? "Interactive Mode"
                      : debugUrl
                        ? "Session Connected"
                        : "Connecting..."
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

      {isPaused && currentSession && !isExpired && (
        <div className="mt-2 flex justify-center">
          <div className="flex max-w-[90%] items-center justify-between gap-4 rounded-lg border border-[--gray-3] bg-[--gray-2] p-3 shadow-md">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-[--gray-12]">You are in control</p>
              <p className="text-xs text-[--gray-11]">No screenshots are being taken</p>
            </div>
            <Button
              onClick={handleResume}
              variant="secondary"
              disabled={isLoading}
              className={`rounded-full bg-white px-5 py-2 text-base font-medium text-black transition-colors hover:bg-[--gray-11] hover:text-[--gray-1] ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isLoading ? (
                <>
                  <div className="mr-2 size-4 animate-spin rounded-full border-2 border-gray-800 border-t-transparent"></div>
                  Resuming...
                </>
              ) : (
                "Resume"
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
