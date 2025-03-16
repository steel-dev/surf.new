import React from 'react';
import { normalizeTextContent } from './utils';
import { parseContent } from './BlockParser';
import { renderMemoryOrGoalBlock } from './MemoryGoalBlock';

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