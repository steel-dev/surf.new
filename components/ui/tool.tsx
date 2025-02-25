import React from 'react';
import { CheckIcon } from '@radix-ui/react-icons';

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
  return str.replaceAll('_', ' ').replace(/^./, match => match.toUpperCase());
}

export function ToolInvocations({ toolInvocations, onImageClick }: ToolRenderProps) {
  if (!toolInvocations) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {toolInvocations.map(toolInvocation => {
        const { toolCallId, toolName, args, state, result } = toolInvocation;
        const displayToolName = capitalizeAndReplaceUnderscores(toolName);
        const entries = Object.entries(args || {});

        // Identify if there's an image result
        const imageResult = Array.isArray(result)
          ? (result.find((item: any) => item.type === 'image') as ImageResult | undefined)
          : result?.image
            ? {
                type: 'image',
                source: {
                  media_type: 'image/png',
                  data: result.image,
                },
              }
            : null;

        // Construct a data URL if we have an image
        let imageSrc = '';
        if (imageResult?.source) {
          imageSrc = `data:${imageResult.source.media_type};base64,${imageResult.source.data}`;
        }

        return (
          <div
            key={toolCallId}
            className={`
              inline-flex h-28 flex-col items-start justify-start
              gap-2 rounded-2xl border border-[--gray-3] bg-[--gray-2] p-4 shadow-[0px_8px_16px_0px_rgba(0,0,0,0.08)]
              ${state === 'call' ? 'opacity-40' : ''}
            `}
          >
            {/* Header row: tool name + spinner/check */}
            <div className="inline-flex items-center justify-center gap-1 self-stretch">
              <div className="shrink grow basis-0 font-['Geist'] text-xs font-medium leading-tight text-[--gray-12]">
                {displayToolName}
              </div>
              <div className="flex size-5 items-center justify-center">
                {state === 'call' ? (
                  <div className="size-4 animate-spin rounded-full border-2 border-[--gray-12] border-t-transparent" />
                ) : (
                  state === 'result' && (
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
                      <div className="font-['Geist'] text-xs font-medium leading-tight text-[--gray-11]">
                        {displayParamName}
                      </div>
                      <div className="font-['Geist Mono'] overflow-hidden truncate whitespace-nowrap text-xs font-medium leading-tight text-[--gray-12]">
                        {String(paramValue)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {state === 'result' && imageResult && (
                <div className="inline-flex h-[39px] w-[71px] flex-col items-start justify-start gap-2.5">
                  <img
                    src={imageSrc}
                    alt="Preview"
                    className="h-[39px] cursor-pointer self-stretch rounded-lg border border-[--gray-3] transition-opacity hover:opacity-90"
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
