import React from 'react';
import { parseContent } from './BlockParser';
import { Crosshair2Icon, ReaderIcon } from "@radix-ui/react-icons";

// Determine if content is a memory or goal block
export const isMemoryOrGoalContent = (content: string) => {
  const isMemory = content.startsWith("*Memory*:");
  const isGoal = content.startsWith("*Next Goal*:") || content.startsWith("*Previous Goal*:");
  return { isMemory, isGoal };
};

// Extract title from memory or goal content
export const extractMemoryOrGoalTitle = (content: string) => {
  const titleMatch = content.match(/^\*(Memory|Next Goal|Previous Goal)\*:/);
  return titleMatch ? titleMatch[1] : "";
};

// Extract content from memory or goal block
export const extractMemoryOrGoalContent = (content: string) => {
  return content.replace(/^\*(Memory|Next Goal|Previous Goal)\*:/, "").trim();
};

// Render memory or goal block
export const renderMemoryOrGoalBlock = (content: string) => {
  const { isMemory, isGoal } = isMemoryOrGoalContent(content);
  
  if (!isMemory && !isGoal) return null;
  
  const title = extractMemoryOrGoalTitle(content);
  const strippedContent = extractMemoryOrGoalContent(content);

  return (
    <div className="relative">
      {isMemory ? (
        <ReaderIcon className="absolute right-4 top-4 size-4 text-[--gray-11]" />
      ) : (
        <Crosshair2Icon className="absolute right-4 top-4 size-4 text-[--gray-11]" />
      )}
      <div className="rounded-2xl border border-[--gray-3] bg-[--gray-2] p-4">
        <div className="pr-8">
          <div className="mb-1 font-medium text-[--gray-12] text-sm">{title}</div>
          {strippedContent ? (
            <div className="text-sm text-[--gray-10]">{parseContent(strippedContent, "memory-content")}</div>
          ) : (
            <span className="text-sm text-[--gray-10]">Empty</span>
          )}
        </div>
      </div>
    </div>
  );
}; 