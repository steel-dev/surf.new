import React from 'react';
import { parseInlineMarkdown } from './InlineParser';

// Parse lists (ordered and unordered)
export const parseList = (text: string, isOrdered: boolean, keyPrefix: string) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  return (
    <ul key={keyPrefix} className={`my-2 pl-6 ${isOrdered ? 'list-decimal' : 'list-disc'}`}>
      {lines.map((line, idx) => {
        // Remove the list marker (- or 1. etc)
        const content = line.replace(/^(\s*)([-*+]|\d+\.)\s+/, '');
        if (!content.trim()) return null; // Skip empty items
        return (
          <li key={`${keyPrefix}-${idx}`} className="my-1">
            {parseInlineMarkdown(content, idx)}
          </li>
        );
      }).filter(Boolean)}
    </ul>
  );
};

// Process lists (- item or 1. item)
export const collectListText = (lines: string[], startIndex: number, pattern: RegExp) => {
  let i = startIndex;
  let text = '';
  
  while (i < lines.length && pattern.test(lines[i])) {
    text += lines[i] + '\n';
    i++;
  }
  
  return { text, endIndex: i };
}; 