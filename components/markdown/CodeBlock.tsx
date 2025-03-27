import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

/**
 * Enhanced CodeBlock component for rendering code blocks with a copy button and language display
 */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-[--gray-3]">
      {/* Header bar displaying the language (if provided) and the copy button */}
      <div className="flex items-center justify-between bg-[--gray-2] px-3 py-1.5 text-xs text-[--gray-12]">
        <span className="font-medium">{language ? language.toUpperCase() : "CODE"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded border border-[--gray-3] bg-[--gray-1] px-2 py-1 text-xs transition-colors hover:bg-[--gray-2] focus:outline-none focus:ring-2 focus:ring-[--blue-9] focus:ring-opacity-50"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <>
              <Check className="size-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={atomDark}
        customStyle={{
          padding: "1rem",
          margin: 0,
          borderRadius: "0 0 0.5rem 0.5rem",
          fontSize: "0.9rem",
          lineHeight: "1.5",
        }}
        showLineNumbers={code.split("\n").length > 5}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
