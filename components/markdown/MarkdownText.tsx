import React from "react";

import { parseContent } from "./BlockParser";
import { renderMemoryOrGoalBlock } from "./MemoryGoalBlock";
import { normalizeTextContent } from "./utils";

export function MarkdownText({ content }: { content: string }) {
  // Normalize text content
  const normalizedContent = normalizeTextContent(content);

  // Check if this is a memory or goal block
  const memoryOrGoalBlock = renderMemoryOrGoalBlock(normalizedContent);
  if (memoryOrGoalBlock) return memoryOrGoalBlock;

  // Render regular markdown content
  return (
    <div className="markdown-content" data-testid="markdown-content">
      {parseContent(normalizedContent, "root-content")}
    </div>
  );
}
