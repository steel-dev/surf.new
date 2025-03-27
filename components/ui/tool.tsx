import React from "react";
import { CheckIcon } from "@radix-ui/react-icons";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  state: "call" | "result" | "partial-call";
  result?: string | Array<ImageResult> | ImageResult;
}

interface ImageResult {
  type: string;
  source: {
    media_type?: string;
    data?: string;
  };
}

interface ToolRenderProps {
  toolInvocations?: ToolInvocation[];
  onImageClick?: (src: string) => void;
}

/**
 * Capitalizes the first letter and replaces all underscores with spaces.
 */
function capitalizeAndReplaceUnderscores(str: string) {
  return str.replaceAll("_", " ").replace(/^./, match => match.toUpperCase());
}

export const ToolInvocations = ({
  toolInvocations,
  onImageClick,
}: {
  toolInvocations: any[];
  onImageClick?: (imageSrc: string) => void;
}) => {
  if (!toolInvocations || toolInvocations.length === 0) {
    return null;
  }

  // Filter out tools we don't want to display
  const filteredTools = toolInvocations.filter(toolInvocation => {
    // Skip pause_execution tools since we handle them with custom UI
    if (toolInvocation.toolName === "pause_execution") {
      return false;
    }

    // Skip print_call tools with no message or empty message
    if (toolInvocation.toolName === "print_call") {
      const message = toolInvocation.args?.message;
      return message && typeof message === "string" && message.trim() !== "";
    }

    // For other tools, ensure they have meaningful content
    return toolInvocation.args && Object.keys(toolInvocation.args).length > 0;
  });

  if (filteredTools.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {filteredTools.map((toolInvocation, index) => {
        const { toolName, args, state } = toolInvocation;

        // Render print_call tools with optimized display
        if (toolName === "print_call") {
          const message = args?.message;
          if (!message || typeof message !== "string" || message.trim() === "") {
            return null; // Extra check to avoid empty messages
          }

          return (
            <div key={index} className="text-sm text-[--gray-12]">
              {message}
            </div>
          );
        }

        const displayToolName = capitalizeAndReplaceUnderscores(toolName);
        const entries = Object.entries(args || {});

        // Skip rendering if there are no arguments to show
        if (entries.length === 0) {
          return null;
        }

        return (
          <div
            key={toolInvocation.toolCallId}
            className={`
              inline-flex w-full flex-col items-start justify-start
              gap-2
              ${state === "call" ? "opacity-40" : ""}
            `}
          >
            {/* Header row: tool name + spinner/check */}
            <div className="inline-flex items-center justify-center gap-1 self-stretch">
              <div className="shrink grow basis-0 font-sans text-sm font-medium leading-tight text-[--gray-12]">
                {displayToolName}
              </div>
              <div className="flex size-5 items-center justify-center">
                {state === "call" ? (
                  <div className="size-4 animate-spin rounded-full border-2 border-[--gray-12] border-t-transparent" />
                ) : (
                  state === "result" && (
                    <span className="flex size-4 items-center justify-center text-[--gray-12]">
                      <CheckIcon className="size-4" />
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="flex h-0 flex-col items-start justify-start">
              <div className="h-0 self-stretch border border-[--gray-3]" />
            </div>

            {/* Body: arguments + optional image */}
            <div className="inline-flex items-end justify-start gap-2 self-stretch overflow-hidden">
              <div className="inline-flex shrink grow basis-0 flex-col items-start justify-start gap-1 self-stretch overflow-hidden">
                {entries.map(([paramName, paramValue]) => {
                  const displayParamName = capitalizeAndReplaceUnderscores(paramName);
                  return (
                    <div
                      key={paramName}
                      className="inline-flex h-5 items-center justify-start gap-6 self-stretch"
                    >
                      <div className="font-sans text-sm font-medium leading-tight text-[--gray-11]">
                        {displayParamName}
                      </div>
                      <div className="overflow-hidden truncate whitespace-nowrap font-mono text-xs font-medium leading-tight text-[--gray-12]">
                        {String(paramValue)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {state === "result" && toolInvocation.result && (
                <div className="inline-flex h-[39px] w-[71px] flex-col items-start justify-start gap-2.5">
                  {(() => {
                    // Identify if there's an image result
                    const imageResult = Array.isArray(toolInvocation.result)
                      ? (toolInvocation.result.find((item: any) => item.type === "image") as
                          | ImageResult
                          | undefined)
                      : typeof toolInvocation.result === "object" &&
                          toolInvocation.result?.type === "image"
                        ? (toolInvocation.result as ImageResult)
                        : undefined;

                    if (imageResult?.source) {
                      const imageSrc = `data:${imageResult.source.media_type};base64,${imageResult.source.data}`;
                      return (
                        <img
                          src={imageSrc}
                          alt="Preview"
                          className="h-[39px] cursor-pointer self-stretch rounded-lg border border-[--gray-3] transition-opacity hover:opacity-90"
                          onClick={() => onImageClick?.(imageSrc)}
                        />
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
