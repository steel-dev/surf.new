// Normalize text content
export const normalizeTextContent = (text: string) => {
  let normalizedText = text;

  // Check if the text contains literal \n sequences that should be newlines
  if (text.includes("\\n")) {
    normalizedText = text.replace(/\\n/g, "\n");
  }

  // Normalize line endings to ensure consistent behavior across platforms
  normalizedText = normalizedText.replace(/\r\n/g, "\n");

  return normalizedText;
};

// Get heading size class based on level
export const getHeadingSize = (level: number) => {
  switch (level) {
    case 1:
      return "text-2xl";
    case 2:
      return "text-xl";
    case 3:
      return "text-lg";
    default:
      return "text-base";
  }
};

// Check if a line is likely to be part of a table
export const isLikelyTableLine = (line: string) => {
  const pipeCount = (line.match(/\|/g) || []).length;
  return pipeCount >= 2 && line.trim().startsWith("|");
};

// Check if a line is a table separator row
export const isTableSeparatorRow = (line: string) => {
  return line.includes("|") && line.includes("-");
};

// Check if a line is the start of a special markdown element
export const isSpecialMarkdownElement = (line: string) => {
  return (
    line.trim().startsWith("#") || // Heading
    line.trim().startsWith(">") || // Blockquote
    /^\s*[-*+]\s+/.test(line) || // Unordered list
    /^\s*\d+\.\s+/.test(line) || // Ordered list
    (line.includes("|") && line.trim().startsWith("|")) || // Table
    /^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())
  ); // Horizontal rule
};
