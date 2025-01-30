import { CheckIcon } from "@radix-ui/react-icons";
import React from "react";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  state: string; // "call" or "result"
  result?: any; // Or use a more specific type
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
  return str.replaceAll("_", " ").replace(/^./, (match) => match.toUpperCase());
}

export function ToolInvocations({
  toolInvocations,
  onImageClick,
}: ToolRenderProps) {
  if (!toolInvocations) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {toolInvocations.map((toolInvocation) => {
        const { toolCallId, toolName, args, state, result } = toolInvocation;
        const displayToolName = capitalizeAndReplaceUnderscores(toolName);
        const entries = Object.entries(args || {});

        // Identify if there's an image result
        const imageResult = Array.isArray(result)
          ? (result.find((item: any) => item.type === "image") as
              | ImageResult
              | undefined)
          : result?.image
          ? {
              type: "image",
              source: {
                media_type: "image/png",
                data: result.image,
              },
            }
          : null;

        // Construct a data URL if we have an image
        let imageSrc = "";
        if (imageResult?.source) {
          imageSrc = `data:${imageResult.source.media_type};base64,${imageResult.source.data}`;
        }

        return (
          <div
            key={toolCallId}
            className={`
              h-28 p-4 bg-[--gray-2] rounded-2xl shadow-[0px_8px_16px_0px_rgba(0,0,0,0.08)]
              border border-[--gray-3] flex-col justify-start items-start gap-2 inline-flex
              ${state === "call" ? "opacity-40" : ""}
            `}
          >
            {/* Header row: tool name + spinner/check */}
            <div className="self-stretch justify-center items-center gap-1 inline-flex">
              <div className="grow shrink basis-0 text-[--gray-12] text-xs font-medium font-['Geist'] leading-tight">
                {displayToolName}
              </div>
              <div className="w-5 h-5 flex items-center justify-center">
                {state === "call" ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[--gray-12] border-t-transparent" />
                ) : (
                  state === "result" && (
                    <span className="text-[--gray-12] h-4 w-4 flex items-center justify-center">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-[0px] flex-col justify-start items-start flex">
              <div className="self-stretch h-[0px] border border-[--gray-3]" />
            </div>

            {/* Body: arguments + optional image */}
            <div className="self-stretch justify-start items-end gap-2 inline-flex overflow-hidden">
              <div className="grow shrink basis-0 self-stretch flex-col justify-start items-start gap-1 inline-flex overflow-hidden">
                {entries.map(([paramName, paramValue]) => {
                  const displayParamName =
                    capitalizeAndReplaceUnderscores(paramName);
                  return (
                    <div
                      key={paramName}
                      className="self-stretch h-5 justify-start items-center gap-6 inline-flex"
                    >
                      <div className="text-[--gray-11] text-xs font-medium font-['Geist'] leading-tight">
                        {displayParamName}
                      </div>
                      <div className="text-[--gray-12] text-xs font-medium font-['Geist Mono'] leading-tight overflow-hidden whitespace-nowrap truncate">
                        {String(paramValue)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {state === "result" && imageResult && (
                <div className="w-[71px] h-[39px] flex-col justify-start items-start gap-2.5 inline-flex">
                  <img
                    src={imageSrc}
                    alt="Preview"
                    className="self-stretch h-[39px] rounded-lg border border-[--gray-3] cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => onImageClick?.(imageSrc)}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
