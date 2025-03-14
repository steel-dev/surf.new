import React from "react";
import { BookOpen, Target } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { InlineCode } from "./InlineCode";

// Enhanced MarkdownText component with support for more markdown features
export function MarkdownText({ content }: { content: string }) {
  // Helper function to process inline markdown with enhanced features
  const parseInlineMarkdown = (text: string, keyOffset: number) => {
    // If there are no special markdown characters, return the text directly without wrapping in a span
    if (!/[\[\*_~`\|]/.test(text)) {
      return text;
    }
    
    // Enhanced regex to capture more markdown elements
    const segments = text.split(
      /(\[.*?\]\(.*?\))|(\*\*.*?\*\*)|(\*.*?\*)|(_.*?_)|(~~.*?~~)|(`.*?`)|(\|\|.*?\|\|)/g
    ).filter(Boolean);
    
    return segments.map((segment, index) => {
      const key = `${keyOffset}-${index}`;
      return renderInlineSegment(segment, key);
    });
  };

  // Render a single inline markdown segment
  const renderInlineSegment = (segment: string, key: string) => {
    // Handle markdown links [text](url)
    if (/^\[.*?\]\(.*?\)$/.test(segment)) {
      return renderMarkdownLink(segment, key);
    }
    
    // Handle bold text **text** or *text*
    if (/^\*\*.*\*\*$/.test(segment) || /^\*.*\*$/.test(segment)) {
      return renderBoldText(segment, key);
    }
    
    // Handle italics _text_
    if (/^_.*_$/.test(segment)) {
      return renderItalicText(segment, key);
    }
    
    // Handle strikethrough ~~text~~
    if (/^~~.*~~$/.test(segment)) {
      return renderStrikethroughText(segment, key);
    }
    
    // Handle inline code `code`
    if (/^`.*`$/.test(segment)) {
      return renderInlineCodeText(segment, key);
    }
    
    // Handle spoiler text ||text||
    if (/^\|\|.*\|\|$/.test(segment)) {
      return renderSpoilerText(segment, key);
    }
    
    // Return plain text if no markdown matched
    return <span key={key}>{segment}</span>;
  };

  // Render markdown link [text](url)
  const renderMarkdownLink = (segment: string, key: string) => {
    const linkMatch = segment.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[--blue-11] hover:underline focus:outline-none focus:ring-2 focus:ring-[--blue-9] focus:ring-opacity-50 rounded"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={key}>{segment}</span>;
  };

  // Render bold text **text** or *text*
  const renderBoldText = (segment: string, key: string) => {
    const boldMatch = segment.match(/^\*\*(.*?)\*\*$/) || segment.match(/^\*(.*?)\*$/);
    if (boldMatch) {
      return <strong key={key}>{boldMatch[1]}</strong>;
    }
    return <span key={key}>{segment}</span>;
  };

  // Render italic text _text_
  const renderItalicText = (segment: string, key: string) => {
    const italicMatch = segment.match(/^_(.*?)_$/);
    if (italicMatch) {
      return <em key={key}>{italicMatch[1]}</em>;
    }
    return <span key={key}>{segment}</span>;
  };

  // Render strikethrough text ~~text~~
  const renderStrikethroughText = (segment: string, key: string) => {
    const strikeMatch = segment.match(/^~~(.*?)~~$/);
    if (strikeMatch && strikeMatch[1] !== undefined) {
      return <del key={key} className="line-through">{strikeMatch[1]}</del>;
    }
    return <span key={key}>{segment}</span>;
  };

  // Render inline code `code`
  const renderInlineCodeText = (segment: string, key: string) => {
    const codeMatch = segment.match(/^`(.*?)`$/);
    if (codeMatch && codeMatch[1] !== undefined) {
      return <InlineCode key={key}>{codeMatch[1]}</InlineCode>;
    }
    return <span key={key}>{segment}</span>;
  };

  // Render spoiler text ||text||
  const renderSpoilerText = (segment: string, key: string) => {
    const spoilerMatch = segment.match(/^\|\|(.*?)\|\|$/);
    if (spoilerMatch && spoilerMatch[1] !== undefined) {
      return (
        <span 
          key={key} 
          className="bg-[--gray-3] text-[--gray-3] hover:text-[--gray-12] hover:bg-transparent transition-colors cursor-pointer rounded px-1"
          title="Click to reveal spoiler"
        >
          {spoilerMatch[1]}
        </span>
      );
    }
    return <span key={key}>{segment}</span>;
  };

  // Parse lists (ordered and unordered)
  const parseList = (text: string, isOrdered: boolean, keyPrefix: string) => {
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

  // Parse table header cells
  const parseTableHeaderCells = (headerRow: string) => {
    return headerRow.split('|')
      .filter(cell => cell.trim() !== '')
      .map(cell => cell.trim());
  };

  // Parse table data rows
  const parseTableDataRows = (dataRows: string[], maxRows: number = 50) => {
    const rows = [];
    try {
      for (let i = 0; i < dataRows.length; i++) {
        const cells = dataRows[i].split('|')
          .filter(cell => cell.trim() !== '')
          .map(cell => cell.trim());
        
        if (cells.length > 0) {
          rows.push(cells);
        }
        
        // Add a safety limit to prevent excessive processing
        if (rows.length >= maxRows) {
          break;
        }
      }
    } catch (error) {
      return [];
    }
    return rows;
  };

  // Render table header
  const renderTableHeader = (headerCells: string[], keyPrefix: string) => {
    return (
      <thead className="bg-[--gray-2]">
        <tr>
          {headerCells.map((cell, idx) => (
            <th key={`${keyPrefix}-header-${idx}`} className="border border-[--gray-3] px-4 py-2 text-left text-sm font-medium">
              {parseInlineMarkdown(cell, idx)}
            </th>
          ))}
        </tr>
      </thead>
    );
  };

  // Render table body
  const renderTableBody = (rows: string[][], keyPrefix: string) => {
    return (
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={`${keyPrefix}-row-${rowIdx}`} className={rowIdx % 2 === 0 ? 'bg-[--gray-1]' : 'bg-[--gray-2]'}>
            {row.map((cell, cellIdx) => (
              <td key={`${keyPrefix}-cell-${rowIdx}-${cellIdx}`} className="border border-[--gray-3] px-4 py-2 text-sm">
                {parseInlineMarkdown(cell, cellIdx)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  };

  // Validate table structure
  const isValidTable = (separatorRow: string, headerCells: string[], rows: string[][]) => {
    // Check separator row format
    if (!separatorRow || !separatorRow.includes('|') || !separatorRow.includes('-')) {
      return false;
    }
    
    // Check header cells and rows
    if (headerCells.length === 0 || rows.some(row => row.length === 0)) {
      return false;
    }
    
    return true;
  };

  // Parse tables
  const parseTable = (tableText: string, keyPrefix: string) => {
    const lines = tableText.trim().split('\n');
    
    if (lines.length < 3) {
      return null; // Need at least header, separator, and one row
    }
    
    // Parse header and separator rows
    const headerRow = lines[0];
    const separatorRow = lines[1];
    const dataRows = lines.slice(2);
    
    // Parse header cells and data rows
    const headerCells = parseTableHeaderCells(headerRow);
    const rows = parseTableDataRows(dataRows);
    
    // Validate table structure
    if (!isValidTable(separatorRow, headerCells, rows)) {
      return null;
    }
    
    // Render the table
    return (
      <div className="my-4 overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-[--gray-3]">
          {renderTableHeader(headerCells, keyPrefix)}
          {renderTableBody(rows, keyPrefix)}
        </table>
      </div>
    );
  };

  // Parse blockquotes
  const parseBlockquote = (text: string, keyPrefix: string) => {
    const content = text.replace(/^>\s*/gm, '').trim();
    return (
      <blockquote key={keyPrefix} className="my-4 border-l-4 border-[--gray-5] bg-[--gray-2] pl-4 py-2 italic text-[--gray-11] rounded-r-lg">
        {parseContent(content, `${keyPrefix}-content`)}
      </blockquote>
    );
  };

  // Normalize text content
  const normalizeTextContent = (text: string) => {
    let normalizedText = text;
    
    // Check if the text contains literal \n sequences that should be newlines
    if (text.includes('\\n')) {
      normalizedText = text.replace(/\\n/g, '\n');
    }
    
    // Normalize line endings to ensure consistent behavior across platforms
    normalizedText = normalizedText.replace(/\r\n/g, '\n');
    
    return normalizedText;
  };

  // Main parser with enhanced support for more markdown elements
  const parseContent = (text: string, keyPrefix = 'content') => {
    // Handle the case where \n is a literal string in the test
    const normalizedText = normalizeTextContent(text);
    
    const elements = [];
    let key = 0;
    
    // Process the text in multiple passes to handle different markdown elements
    
    // First pass: Handle code blocks
    const processedText = { text: normalizedText, lastIndex: 0, elements: [] };
    processCodeBlocks(processedText, key, keyPrefix);
    
    // Second pass: Handle blockquotes, lists, and tables in the remaining text segments
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
  
  // Helper function to process code blocks
  const processCodeBlocks = (processed: { text: string, lastIndex: number, elements: any[] }, startKey: number, keyPrefix: string) => {
    let key = startKey;
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    
    while ((match = codeBlockRegex.exec(processed.text)) !== null) {
      // Process any text before the code block
      if (match.index > processed.lastIndex) {
        const inlineText = processed.text.substring(processed.lastIndex, match.index);
        processed.elements.push(inlineText);
      }
      
      // Extract language and code content
      const language = match[1] || "";
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

  // Process headings (# Heading)
  const processHeading = (line: string, i: number, keyPrefix: string) => {
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

  // Get heading size class based on level
  const getHeadingSize = (level: number) => {
    switch (level) {
      case 1: return 'text-2xl';
      case 2: return 'text-xl';
      case 3: return 'text-lg';
      default: return 'text-base';
    }
  };

  // Process horizontal rule (---, ***, ___)
  const processHorizontalRule = (line: string, i: number, keyPrefix: string) => {
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      return <hr key={`${keyPrefix}-hr-${i}`} className="my-4 border-t border-[--gray-3]" />;
    }
    return null;
  };

  // Process blockquotes (> text)
  const collectBlockquoteText = (lines: string[], startIndex: number) => {
    let i = startIndex;
    let text = '';
    
    while (i < lines.length && lines[i].trim().startsWith('>')) {
      text += lines[i] + '\n';
      i++;
    }
    
    return { text, endIndex: i };
  };

  // Process lists (- item or 1. item)
  const collectListText = (lines: string[], startIndex: number, pattern: RegExp) => {
    let i = startIndex;
    let text = '';
    
    while (i < lines.length && pattern.test(lines[i])) {
      text += lines[i] + '\n';
      i++;
    }
    
    return { text, endIndex: i };
  };

  // Check if a line is likely to be part of a table
  const isLikelyTableLine = (line: string) => {
    const pipeCount = (line.match(/\|/g) || []).length;
    return pipeCount >= 2 && line.trim().startsWith('|');
  };

  // Check if a line is a table separator row
  const isTableSeparatorRow = (line: string) => {
    return line.includes('|') && line.includes('-');
  };

  // Process tables
  const collectTableText = (lines: string[], startIndex: number, isWellFormed: boolean) => {
    let i = startIndex;
    let text = '';
    
    // For well-formed tables, collect header and separator rows
    if (isWellFormed) {
      // Collect header row
      text += lines[i] + '\n';
      i++;
      
      // Collect separator row
      text += lines[i] + '\n';
      i++;
    }
    
    // Collect data rows
    let rowCount = 0;
    const maxRows = isWellFormed ? 50 : 10; // Reduced limit for malformed tables
    
    while (i < lines.length && lines[i].includes('|') && rowCount < maxRows) {
      // For malformed tables, check if line starts with pipe
      if (!isWellFormed && !lines[i].trim().startsWith('|')) {
        break;
      }
      
      text += lines[i] + '\n';
      i++;
      rowCount++;
    }
    
    return { text, endIndex: i };
  };

  // Check if a line is the start of a special markdown element
  const isSpecialMarkdownElement = (line: string) => {
    return line.trim().startsWith('#') || // Heading
           line.trim().startsWith('>') || // Blockquote
           /^\s*[-*+]\s+/.test(line) || // Unordered list
           /^\s*\d+\.\s+/.test(line) || // Ordered list
           (line.includes('|') && line.trim().startsWith('|')) || // Table
           /^(\*{3,}|-{3,}|_{3,})$/.test(line.trim()); // Horizontal rule
  };

  // Process paragraph text
  const collectParagraphText = (lines: string[], startIndex: number) => {
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
  const renderParagraph = (text: string, key: string, index: number) => {
    return (
      <p key={key} className="my-2">
        {parseInlineMarkdown(text.trim(), index)}
      </p>
    );
  };

  // Render a collection of lines as paragraphs
  const renderLinesAsParagraphs = (lines: string[], keyPrefix: string, startIdx: number) => {
    return lines.filter(line => line.trim()).map((line, idx) => {
      return renderParagraph(line, `${keyPrefix}-${startIdx}-${idx}`, idx);
    });
  };
  
  // Process a well-formed table
  const processWellFormedTable = (lines: string[], i: number, keyPrefix: string) => {
    const startIdx = i;
    const { text: tableText, endIndex } = collectTableText(lines, i, true);
    
    // Try to parse as table, fall back to paragraph if parsing fails
    const tableElement = parseTable(tableText, `${keyPrefix}-table-${startIdx}`);
    
    if (tableElement) {
      return { element: tableElement, endIndex };
    } else {
      // If table parsing failed, render as regular paragraphs
      const tableLines = tableText.split('\n').filter(line => line.trim());
      const paragraphs = renderLinesAsParagraphs(tableLines, `${keyPrefix}-failed-table`, startIdx);
      return { element: paragraphs, endIndex };
    }
  };

  // Process a malformed table
  const processMalformedTable = (lines: string[], i: number, keyPrefix: string) => {
    // Render the current line as a paragraph
    const paragraph = renderParagraph(lines[i], `${keyPrefix}-p-${i}`, i);
    i++;
    
    // If we're still in the table-like structure, render the next line too
    if (i < lines.length && lines[i].includes('|')) {
      const nextParagraph = renderParagraph(lines[i], `${keyPrefix}-p-${i}`, i);
      i++;
      return { element: [paragraph, nextParagraph], endIndex: i };
    }
    
    return { element: paragraph, endIndex: i };
  };
  
  // Helper function to process text segments for other markdown elements
  const processTextSegment = (text: string, keyPrefix: string) => {
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
        
        const { element, endIndex } = processWellFormedTable(lines, i, keyPrefix);
        
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
          const { element, endIndex } = processMalformedTable(lines, i, keyPrefix);
          
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

  // Determine if content is a memory or goal block
  const isMemoryOrGoalContent = () => {
    const isMemory = content.startsWith("*Memory*:");
    const isGoal = content.startsWith("*Next Goal*:") || content.startsWith("*Previous Goal*:");
    return { isMemory, isGoal };
  };

  // Extract title from memory or goal content
  const extractMemoryOrGoalTitle = (content: string) => {
    const titleMatch = content.match(/^\*(Memory|Next Goal|Previous Goal)\*:/);
    return titleMatch ? titleMatch[1] : "";
  };

  // Extract content from memory or goal block
  const extractMemoryOrGoalContent = (content: string) => {
    return content.replace(/^\*(Memory|Next Goal|Previous Goal)\*:/, "").trim();
  };

  // Render memory or goal block
  const renderMemoryOrGoalBlock = () => {
    const { isMemory, isGoal } = isMemoryOrGoalContent();
    
    if (!isMemory && !isGoal) return null;
    
    const title = extractMemoryOrGoalTitle(content);
    const strippedContent = extractMemoryOrGoalContent(content);

    return (
      <div className="relative">
        {isMemory ? (
          <BookOpen className="absolute right-4 top-4 size-4 text-[--gray-11]" />
        ) : (
          <Target className="absolute right-4 top-4 size-4 text-[--gray-11]" />
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

  // Main render function
  const memoryOrGoalBlock = renderMemoryOrGoalBlock();
  if (memoryOrGoalBlock) return memoryOrGoalBlock;

  return <div className="markdown-content" data-testid="markdown-content">{parseContent(content, "root-content")}</div>;
} 