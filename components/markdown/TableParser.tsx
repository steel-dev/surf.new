import React from 'react';
import { parseInlineMarkdown } from './InlineParser';

// Check if a string contains HTML tags
const containsHtmlTags = (text: string): boolean => {
  return /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(text);
};

// Parse table header cells
export const parseTableHeaderCells = (headerRow: string) => {
  return headerRow.split('|')
    .filter(cell => cell.trim() !== '')
    .map(cell => cell.trim());
};

// Parse table data rows
export const parseTableDataRows = (dataRows: string[], maxRows: number = 50) => {
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
export const renderTableHeader = (headerCells: string[], keyPrefix: string) => {
  return (
    <thead className="bg-[--gray-2]">
      <tr>
        {headerCells.map((cell, idx) => (
          <th key={`${keyPrefix}-header-${idx}`} className="border border-[--gray-3] px-4 py-2 text-left text-sm font-medium">
            {renderTableCell(cell, idx)}
          </th>
        ))}
      </tr>
    </thead>
  );
};

// Render table body
export const renderTableBody = (rows: string[][], keyPrefix: string) => {
  return (
    <tbody>
      {rows.map((row, rowIdx) => (
        <tr key={`${keyPrefix}-row-${rowIdx}`} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-[--gray-1]'}>
          {row.map((cell, cellIdx) => (
            <td key={`${keyPrefix}-cell-${rowIdx}-${cellIdx}`} className="border border-[--gray-3] px-4 py-2 text-sm">
              {renderTableCell(cell, cellIdx + rowIdx * 100)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
};

// Render a table cell with special handling for HTML content
const renderTableCell = (content: string, keyOffset: number) => {
  // If the cell contains HTML tags, use dangerouslySetInnerHTML
  if (containsHtmlTags(content)) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }
  
  // Otherwise, use the normal inline markdown parser
  return parseInlineMarkdown(content, keyOffset);
};

// Validate table structure
export const isValidTable = (separatorRow: string, headerCells: string[], rows: string[][]) => {
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
export const parseTable = (tableText: string, keyPrefix: string) => {
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

// Process a well-formed table
export const processWellFormedTable = (lines: string[], i: number, keyPrefix: string, renderLinesAsParagraphs: (lines: string[], keyPrefix: string, startIdx: number) => React.ReactNode[]) => {
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
export const processMalformedTable = (lines: string[], i: number, keyPrefix: string, renderParagraph: (text: string, key: string, index: number) => React.ReactNode) => {
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

// Process tables
export const collectTableText = (lines: string[], startIndex: number, isWellFormed: boolean) => {
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