import React from "react";

/**
 * Enhanced InlineCode component for inline code formatting
 */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[--gray-2] px-1.5 py-0.5 font-mono text-sm text-[--gray-12] border border-[--gray-3]">
      {children}
    </code>
  );
} 