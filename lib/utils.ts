import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isLocalhost = () => {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
};

export const truncateUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);

    // First, ensure the hostname + pathname doesn't get too long
    let baseUrl = urlObj.origin;
    if (urlObj.pathname.length > 1) {
      // Skip if just "/"
      // Limit pathname display to 12 chars if it's long
      if (urlObj.pathname.length > 12) {
        baseUrl += urlObj.pathname.substring(0, 10) + "...";
      } else {
        baseUrl += urlObj.pathname;
      }
    }

    // If there are query parameters, show a portion of them
    if (urlObj.search) {
      // Extract the first parameter
      const params = urlObj.searchParams;
      const firstParam = params.entries().next().value;

      if (firstParam) {
        const [key, value] = firstParam;
        // Very strict truncation for the value
        const truncatedValue = value.length > 8 ? value.substring(0, 6) + "..." : value;

        return `${baseUrl}?${key}=${truncatedValue}${params.size > 1 ? "..." : ""}`;
      }

      // Fallback if we can't get the first parameter
      return `${baseUrl}?...`;
    }

    return baseUrl;
  } catch (e) {
    // If URL parsing fails, just return the original but truncated
    if (url.length > 30) {
      return url.substring(0, 27) + "...";
    }
    return url;
  }
};
