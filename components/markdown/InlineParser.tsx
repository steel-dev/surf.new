import React, { ReactNode } from "react";

// Helper function to process inline markdown with enhanced features
export const parseInlineMarkdown = (text: string, keyOffset: number): ReactNode | ReactNode[] => {
  if (!/[\[\*_~`\|]/.test(text)) {
    return text;
  }

  const processedHtml = preserveHtmlTags(text);

  let processed: ReactNode | ReactNode[] = processedHtml;

  processed = processLinks(processed, keyOffset);
  processed = processBold(processed, keyOffset);
  processed = processItalic(processed, keyOffset);
  processed = processStrikethrough(processed, keyOffset);
  processed = processInlineCode(processed, keyOffset);
  processed = processSpoiler(processed, keyOffset);

  return processed;
};

// Preserve HTML tags by replacing them with placeholders
const preserveHtmlTags = (text: string): string => {
  return text.replace(/<([a-z][a-z0-9]*)\b[^>]*>(.*?)<\/\1>/gi, match => {
    return match;
  });
};

// Process markdown links [text](url)
const processLinks = (
  text: string | ReactNode | ReactNode[],
  keyOffset: number
): ReactNode | ReactNode[] => {
  if (typeof text !== "string") {
    if (Array.isArray(text)) {
      return text.map((item, index) =>
        typeof item === "string" ? processLinks(item, keyOffset + index * 100) : item
      );
    }
    return text;
  }

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let result: ReactNode[] = [];
  let match;
  let matchIndex = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    const linkText = match[1];
    const linkUrl = match[2];

    // Process the link text for nested formatting
    const processedLinkText = parseInlineMarkdown(linkText, keyOffset + 1000 + matchIndex);

    // Add the link
    result.push(
      <a
        key={`link-${keyOffset}-${matchIndex}`}
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded text-[--blue-11] hover:underline focus:outline-none focus:ring-2 focus:ring-[--blue-9] focus:ring-opacity-50"
      >
        {processedLinkText}
      </a>
    );

    lastIndex = linkRegex.lastIndex;
    matchIndex++;
  }

  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result.length === 1 && typeof result[0] === "string" ? result[0] : result;
};

// Process bold text **text** or *text*
const processBold = (
  text: string | ReactNode | ReactNode[],
  keyOffset: number
): ReactNode | ReactNode[] => {
  if (typeof text !== "string") {
    if (Array.isArray(text)) {
      return text.map((item, index) =>
        typeof item === "string" ? processBold(item, keyOffset + index * 100) : item
      );
    }
    return text;
  }

  // Process **bold** first (double asterisks)
  const boldRegex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let result: ReactNode[] = [];
  let match;
  let matchIndex = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the bold
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    // Extract bold content
    const boldContent = match[1];

    // Process the bold content for nested formatting
    const processedBoldContent = parseInlineMarkdown(boldContent, keyOffset + 2000 + matchIndex);

    // Add the bold text
    result.push(<strong key={`bold-${keyOffset}-${matchIndex}`}>{processedBoldContent}</strong>);

    lastIndex = boldRegex.lastIndex;
    matchIndex++;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  // If no double asterisk bold was found, try single asterisk (but only for whole strings)
  if (result.length === 1 && typeof result[0] === "string") {
    const singleAsteriskRegex = /^\*(.*)\*$/;
    const singleMatch = text.match(singleAsteriskRegex);

    if (singleMatch) {
      const boldContent = singleMatch[1];
      const processedBoldContent = parseInlineMarkdown(boldContent, keyOffset + 3000);
      return <strong key={`bold-single-${keyOffset}`}>{processedBoldContent}</strong>;
    }
  }

  return result.length === 1 && typeof result[0] === "string" ? result[0] : result;
};

// Process italic text _text_
const processItalic = (
  text: string | ReactNode | ReactNode[],
  keyOffset: number
): ReactNode | ReactNode[] => {
  if (typeof text !== "string") {
    if (Array.isArray(text)) {
      return text.map((item, index) =>
        typeof item === "string" ? processItalic(item, keyOffset + index * 100) : item
      );
    }
    return text;
  }

  const italicRegex = /_(.*?)_/g;
  let lastIndex = 0;
  let result: ReactNode[] = [];
  let match;
  let matchIndex = 0;

  while ((match = italicRegex.exec(text)) !== null) {
    // Add text before the italic
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    // Extract italic content
    const italicContent = match[1];

    // Process the italic content for nested formatting
    const processedItalicContent = parseInlineMarkdown(
      italicContent,
      keyOffset + 4000 + matchIndex
    );

    // Add the italic text
    result.push(<em key={`italic-${keyOffset}-${matchIndex}`}>{processedItalicContent}</em>);

    lastIndex = italicRegex.lastIndex;
    matchIndex++;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result.length === 1 && typeof result[0] === "string" ? result[0] : result;
};

// Process strikethrough text ~~text~~
const processStrikethrough = (
  text: string | ReactNode | ReactNode[],
  keyOffset: number
): ReactNode | ReactNode[] => {
  if (typeof text !== "string") {
    if (Array.isArray(text)) {
      return text.map((item, index) =>
        typeof item === "string" ? processStrikethrough(item, keyOffset + index * 100) : item
      );
    }
    return text;
  }

  const strikeRegex = /~~(.*?)~~/g;
  let lastIndex = 0;
  let result: ReactNode[] = [];
  let match;
  let matchIndex = 0;

  while ((match = strikeRegex.exec(text)) !== null) {
    // Add text before the strikethrough
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    // Extract strikethrough content
    const strikeContent = match[1];

    // Process the strikethrough content for nested formatting
    const processedStrikeContent = parseInlineMarkdown(
      strikeContent,
      keyOffset + 5000 + matchIndex
    );

    // Add the strikethrough text
    result.push(
      <del key={`strike-${keyOffset}-${matchIndex}`} className="line-through">
        {processedStrikeContent}
      </del>
    );

    lastIndex = strikeRegex.lastIndex;
    matchIndex++;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result.length === 1 && typeof result[0] === "string" ? result[0] : result;
};

// Process inline code `code`
const processInlineCode = (
  text: string | ReactNode | ReactNode[],
  keyOffset: number
): ReactNode | ReactNode[] => {
  if (typeof text !== "string") {
    if (Array.isArray(text)) {
      return text.map((item, index) =>
        typeof item === "string" ? processInlineCode(item, keyOffset + index * 100) : item
      );
    }
    return text;
  }

  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let result: ReactNode[] = [];
  let match;
  let matchIndex = 0;

  while ((match = codeRegex.exec(text)) !== null) {
    // Add text before the code
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    // Extract code content (no nested formatting in code)
    const codeContent = match[1];

    // Add the code
    result.push(
      <code
        key={`code-${keyOffset}-${matchIndex}`}
        className="rounded border border-[--gray-3] bg-[--gray-2] px-1.5 py-0.5 font-mono text-sm text-[--gray-12]"
      >
        {codeContent}
      </code>
    );

    lastIndex = codeRegex.lastIndex;
    matchIndex++;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result.length === 1 && typeof result[0] === "string" ? result[0] : result;
};

// Process spoiler text ||text||
const processSpoiler = (
  text: string | ReactNode | ReactNode[],
  keyOffset: number
): ReactNode | ReactNode[] => {
  if (typeof text !== "string") {
    if (Array.isArray(text)) {
      return text.map((item, index) =>
        typeof item === "string" ? processSpoiler(item, keyOffset + index * 100) : item
      );
    }
    return text;
  }

  const spoilerRegex = /\|\|(.*?)\|\|/g;
  let lastIndex = 0;
  let result: ReactNode[] = [];
  let match;
  let matchIndex = 0;

  while ((match = spoilerRegex.exec(text)) !== null) {
    // Add text before the spoiler
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    // Extract spoiler content
    const spoilerContent = match[1];

    // Process the spoiler content for nested formatting
    const processedSpoilerContent = parseInlineMarkdown(
      spoilerContent,
      keyOffset + 6000 + matchIndex
    );

    // Add the spoiler text
    result.push(
      <span
        key={`spoiler-${keyOffset}-${matchIndex}`}
        className="cursor-pointer rounded bg-[--gray-3] px-1 text-[--gray-3] transition-colors hover:bg-transparent hover:text-[--gray-12]"
        title="Click to reveal spoiler"
      >
        {processedSpoilerContent}
      </span>
    );

    lastIndex = spoilerRegex.lastIndex;
    matchIndex++;
  }

  // Add any remaining text
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result.length === 1 && typeof result[0] === "string" ? result[0] : result;
};
