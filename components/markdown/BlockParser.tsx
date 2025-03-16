import React from 'react';
import { CodeBlock } from './CodeBlock';
import { parseInlineMarkdown } from './InlineParser';
import { parseList, collectListText } from './ListParser';
import { parseTable, processWellFormedTable, processMalformedTable, collectTableText } from './TableParser';
import { getHeadingSize, isLikelyTableLine, isTableSeparatorRow, isSpecialMarkdownElement } from './utils';

// Process headings (# Heading)
export const processHeading = (line: string, i: number, keyPrefix: string) => {
  const headingMatch = line.trim().match(/^(#{1,6})\s+(.+)$/);
  if (!headingMatch) return null;
  
  const level = headingMatch[1].length;
  const content = headingMatch[2];
  
  const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <HeadingTag 
      key={`${keyPrefix}-h${level}-${i}`} 
      className={`my-2 font-bold text-[--gray-12] ${getHeadingSize(level)}`}
    >
      {parseInlineMarkdown(content, i)}
    </HeadingTag>
  );
};

// Process horizontal rule (---, ***, ___)
export const processHorizontalRule = (line: string, i: number, keyPrefix: string) => {
  if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
    return <hr key={`${keyPrefix}-hr-${i}`} className="my-4 border-t border-[--gray-3]" />;
  }
  return null;
};

// Parse blockquotes
export const parseBlockquote = (text: string, keyPrefix: string) => {
  const content = text.replace(/^>\s*/gm, '').trim();
  return (
    <blockquote key={keyPrefix} className="my-4 border-l-4 border-[--gray-5] bg-[--gray-2] pl-4 py-2 italic text-[--gray-11] rounded-r-lg">
      {parseContent(content, `${keyPrefix}-content`)}
    </blockquote>
  );
};

// Process blockquotes (> text)
export const collectBlockquoteText = (lines: string[], startIndex: number) => {
  let i = startIndex;
  let text = '';
  
  while (i < lines.length && lines[i].trim().startsWith('>')) {
    text += lines[i] + '\n';
    i++;
  }
  
  return { text, endIndex: i };
};

// Process paragraph text
export const collectParagraphText = (lines: string[], startIndex: number) => {
  let i = startIndex;
  let text = '';
  
  while (
    i < lines.length && 
    !isSpecialMarkdownElement(lines[i]) &&
    lines[i].trim() !== ''
  ) {
    text += (text ? ' ' : '') + lines[i];
    i++;
  }
  
  // Skip empty lines
  if (i < lines.length && lines[i].trim() === '') {
    i++;
  }
  
  return { text, endIndex: i };
};

// Render a paragraph element
export const renderParagraph = (text: string, key: string, index: number) => {
  return (
    <p key={key} className="my-2">
      {parseInlineMarkdown(text.trim(), index)}
    </p>
  );
};

// Render a collection of lines as paragraphs
export const renderLinesAsParagraphs = (lines: string[], keyPrefix: string, startIdx: number) => {
  return lines.filter(line => line.trim()).map((line, idx) => {
    return renderParagraph(line, `${keyPrefix}-${startIdx}-${idx}`, idx);
  });
};

// Helper function to process code blocks
export const processCodeBlocks = (processed: { text: string, lastIndex: number, elements: any[] }, startKey: number, keyPrefix: string) => {
  let key = startKey;
  const codeBlockRegex = /```(\w*)\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  
  while ((match = codeBlockRegex.exec(processed.text)) !== null) {
    // Process any text before the code block
    if (match.index > processed.lastIndex) {
      const inlineText = processed.text.substring(processed.lastIndex, match.index);
      processed.elements.push(inlineText);
    }
    
    // Extract language and code content
    const language = match[1] ? match[1].trim() : "";
    const codeContent = match[2].trim(); // Trim to remove extra newlines
    processed.elements.push(<CodeBlock key={`${keyPrefix}-code-${key}`} language={language} code={codeContent} />);
    key++;
    processed.lastIndex = codeBlockRegex.lastIndex;
  }
  
  // Process any remaining text
  if (processed.lastIndex < processed.text.length) {
    const inlineText = processed.text.substring(processed.lastIndex);
    processed.elements.push(inlineText);
  }
};

// Helper function to process text segments for other markdown elements
export const processTextSegment = (text: string, keyPrefix: string) => {
  const elements = [];
  const lines = text.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    // Handle headings - this needs to come before other checks
    if (lines[i].trim().startsWith('#')) {
      const headingElement = processHeading(lines[i], i, keyPrefix);
      if (headingElement) {
        elements.push(headingElement);
        i++;
        continue;
      }
    }
    
    // Check for horizontal rule - must be a line containing only *, -, or _
    const hrElement = processHorizontalRule(lines[i], i, keyPrefix);
    if (hrElement) {
      elements.push(hrElement);
      i++;
      continue;
    }
    
    // Check for blockquote
    if (lines[i].trim().startsWith('>')) {
      const startIdx = i;
      const { text: blockquoteText, endIndex } = collectBlockquoteText(lines, i);
      i = endIndex;
      
      elements.push(parseBlockquote(blockquoteText, `${keyPrefix}-blockquote-${startIdx}`));
      continue;
    }
    
    // Check for unordered list
    if (/^\s*[-*+]\s+/.test(lines[i])) {
      const startIdx = i;
      const { text: listText, endIndex } = collectListText(lines, i, /^\s*[-*+]\s+/);
      i = endIndex;
      
      elements.push(parseList(listText, false, `${keyPrefix}-ul-${startIdx}`));
      continue;
    }
    
    // Check for ordered list
    if (/^\s*\d+\.\s+/.test(lines[i])) {
      const startIdx = i;
      const { text: listText, endIndex } = collectListText(lines, i, /^\s*\d+\.\s+/);
      i = endIndex;
      
      elements.push(parseList(listText, true, `${keyPrefix}-ol-${startIdx}`));
      continue;
    }
    
    // Check for well-formed table
    if (i < lines.length - 2 && 
        isLikelyTableLine(lines[i]) && 
        isTableSeparatorRow(lines[i+1])) {
      
      const { element, endIndex } = processWellFormedTable(lines, i, keyPrefix, renderLinesAsParagraphs);
      
      if (Array.isArray(element)) {
        elements.push(...element);
      } else {
        elements.push(element);
      }
      
      i = endIndex;
      continue;
    }
    // Handle malformed tables (missing separator row or other issues)
    else if (i < lines.length - 1 && 
             lines[i].includes('|') && 
             lines[i+1].includes('|')) {
      
      const pipeCount1 = (lines[i].match(/\|/g) || []).length;
      const pipeCount2 = (lines[i+1].match(/\|/g) || []).length;
      
      // A proper table should have at least 2 pipes per line and start with a pipe
      const isLikelyTable = pipeCount1 >= 2 && pipeCount2 >= 2 && 
                            lines[i].trim().startsWith('|') && 
                            lines[i+1].trim().startsWith('|');
      
      // Check if the second line looks like a separator row (contains dashes)
      const hasSeparatorRow = lines[i+1].includes('-');
      
      // If it doesn't look like a table or doesn't have a proper separator row,
      // just render as paragraphs without attempting complex parsing
      if (!isLikelyTable || !hasSeparatorRow) {
        const { element, endIndex } = processMalformedTable(lines, i, keyPrefix, renderParagraph);
        
        if (Array.isArray(element)) {
          elements.push(...element);
        } else {
          elements.push(element);
        }
        
        i = endIndex;
        continue;
      }
      
      const startIdx = i;
      const { text: tableText, endIndex } = collectTableText(lines, i, false);
      i = endIndex;
      
      // For malformed tables, we skip the parsing attempt and directly render as paragraphs
      const tableLines = tableText.split('\n').filter(line => line.trim());
      const paragraphs = renderLinesAsParagraphs(tableLines, `${keyPrefix}-malformed-table`, startIdx);
      elements.push(...paragraphs);
      continue;
    }
    
    // Handle regular paragraph text
    const startIdx = i;
    const { text: paragraphText, endIndex } = collectParagraphText(lines, i);
    i = endIndex;
    
    if (paragraphText.trim()) {
      elements.push(renderParagraph(paragraphText, `${keyPrefix}-p-${startIdx}`, startIdx));
    }
  }
  
  return elements;
};

// Main parser for markdown elements
export const parseContent = (text: string, keyPrefix = 'content') => {
  // Process the text in multiple passes to handle different markdown elements
  
  // First pass: Handle code blocks
  const processedText = { text, lastIndex: 0, elements: [] };
  processCodeBlocks(processedText, 0, keyPrefix);
  
  // Second pass: Handle blockquotes, lists, and tables in the remaining text segments
  const elements = [];
  for (let i = 0; i < processedText.elements.length; i++) {
    const element = processedText.elements[i];
    if (typeof element === 'string') {
      // Process the text segment for other markdown elements
      const textSegmentElements = processTextSegment(element, `${keyPrefix}-segment-${i}`);
      elements.push(...textSegmentElements);
    } else {
      // Add the already processed element (code block)
      elements.push(element);
    }
  }
  
  // Wrap each element with a key if it doesn't already have one
  return elements.map((element, index) => {
    if (React.isValidElement(element) && element.key) {
      return element;
    }
    return (
      <React.Fragment key={`${keyPrefix}-frag-${index}`}>
        {element}
      </React.Fragment>
    );
  });
}; 