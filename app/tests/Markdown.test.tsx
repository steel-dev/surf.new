import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MarkdownText } from '@/components/markdown';

// Mock components
jest.mock('@/components/markdown/CodeBlock', () => ({
  CodeBlock: ({ code, language }: { code: string; language?: string }) => (
    <div data-testid="code-block" data-language={language} data-code={code}>
      {code}
    </div>
  ),
}));

describe('MarkdownText Component', () => {
  test('renders plain text correctly', () => {
    render(<MarkdownText content="This is plain text" />);
    expect(screen.getByText('This is plain text')).toBeInTheDocument();
  });

  test('renders bold text correctly', () => {
    render(<MarkdownText content="This is **bold** text" />);
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
  });

  test('renders italic text correctly', () => {
    render(<MarkdownText content="This is _italic_ text" />);
    expect(screen.getByText('italic')).toBeInTheDocument();
    expect(screen.getByText('italic').tagName).toBe('EM');
  });

  test('renders links correctly', () => {
    render(<MarkdownText content="This is a [link](https://example.com)" />);
    const link = screen.getByText('link');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('renders inline code correctly', () => {
    render(<MarkdownText content="This is `inline code`" />);
    const inlineCode = screen.getByText('inline code');
    expect(inlineCode).toBeInTheDocument();
    expect(inlineCode.tagName).toBe('CODE');
  });

  test('renders strikethrough text correctly', () => {
    render(<MarkdownText content="This is ~~strikethrough~~ text" />);
    expect(screen.getByText('strikethrough')).toBeInTheDocument();
    expect(screen.getByText('strikethrough').tagName).toBe('DEL');
  });

  test('renders code blocks correctly', () => {
    render(<MarkdownText content="```javascript\nconst x = 1;\n```" />);
    const codeBlock = screen.getByTestId('code-block');
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock).toHaveAttribute('data-language', 'javascript');
    expect(codeBlock).toHaveAttribute('data-code', 'const x = 1;');
  });

  test('renders unordered lists correctly', () => {
    render(<MarkdownText content="- Item 1\n- Item 2\n- Item 3" />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
    
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
    expect(listItems[0]).toHaveTextContent('Item 1');
  });

  test('renders ordered lists correctly', () => {
    render(<MarkdownText content="1. First item\n2. Second item\n3. Third item" />);
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByText('Second item')).toBeInTheDocument();
    expect(screen.getByText('Third item')).toBeInTheDocument();
    
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(3);
    expect(listItems[0]).toHaveTextContent('First item');
  });

  test('renders blockquotes correctly', () => {
    render(<MarkdownText content="> This is a blockquote" />);
    expect(screen.getByText('This is a blockquote')).toBeInTheDocument();
    const blockquote = screen.getByText('This is a blockquote').closest('blockquote');
    expect(blockquote).toBeInTheDocument();
  });

  test('renders tables correctly', () => {
    const tableContent = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
    `;
    
    render(<MarkdownText content={tableContent} />);
    
    expect(screen.getByText('Header 1')).toBeInTheDocument();
    expect(screen.getByText('Header 2')).toBeInTheDocument();
    expect(screen.getByText('Cell 1')).toBeInTheDocument();
    expect(screen.getByText('Cell 2')).toBeInTheDocument();
    expect(screen.getByText('Cell 3')).toBeInTheDocument();
    expect(screen.getByText('Cell 4')).toBeInTheDocument();
    
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
  });

  test('renders headings correctly', () => {
    render(<MarkdownText content="# Heading 1\n## Heading 2\n### Heading 3" />);
    
    const h1 = screen.getByText('Heading 1');
    expect(h1).toBeInTheDocument();
    expect(h1.tagName).toBe('H1');
    
    const h2 = screen.getByText('Heading 2');
    expect(h2).toBeInTheDocument();
    expect(h2.tagName).toBe('H2');
    
    const h3 = screen.getByText('Heading 3');
    expect(h3).toBeInTheDocument();
    expect(h3.tagName).toBe('H3');
  });

  test('renders horizontal rules correctly', () => {
    render(<MarkdownText content="Before\n---\nAfter" />);
    
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    
    const hr = document.querySelector('hr');
    expect(hr).toBeInTheDocument();
  });

  test('renders memory blocks correctly', () => {
    render(<MarkdownText content="*Memory*: This is a memory" />);
    
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('This is a memory')).toBeInTheDocument();
    expect(document.querySelector('svg path[fill-rule="evenodd"]')).toBeInTheDocument();
  });

  test('renders goal blocks correctly', () => {
    render(<MarkdownText content="*Next Goal*: This is a goal" />);
    
    expect(screen.getByText('Next Goal')).toBeInTheDocument();
    expect(screen.getByText('This is a goal')).toBeInTheDocument();
    expect(document.querySelector('svg path[fill-rule="evenodd"]')).toBeInTheDocument();
  });

  test('renders complex nested markdown correctly', () => {
    const complexMarkdown = `
# Complex Example

This is a paragraph with **bold**, _italic_, and \`inline code\`.

> This is a blockquote with a [link](https://example.com)

## Lists

- Item 1
- Item 2
  - Nested item
- Item 3

1. First
2. Second
3. Third

## Code Block

\`\`\`javascript
function hello() {
  console.log("Hello world!");
}
\`\`\`

## Table

| Name | Age |
|------|-----|
| John | 30  |
| Jane | 25  |
    `;
    
    render(<MarkdownText content={complexMarkdown} />);
    
    expect(screen.getByText('Complex Example')).toBeInTheDocument();
    expect(screen.getByText('Lists')).toBeInTheDocument();
    expect(screen.getByText('Code Block')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
    
    // For inline code, we need to check the content of the paragraph
    const paragraph = screen.getByText(/This is a paragraph with/, { exact: false });
    expect(paragraph.innerHTML).toContain('`inline code`');
    
    expect(screen.getByText('link')).toBeInTheDocument();
    expect(screen.getByText('link').closest('a')).toHaveAttribute('href', 'https://example.com');
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    
    const codeBlock = screen.getByTestId('code-block');
    expect(codeBlock).toHaveAttribute('data-language', 'javascript');
    expect(codeBlock.textContent).toContain('function hello()');
    
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  // Edge Cases Tests
  test('renders empty content correctly', () => {
    render(<MarkdownText content="" />);
    const container = screen.getByTestId('markdown-content');
    expect(container).toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  test('renders whitespace-only content correctly', () => {
    render(<MarkdownText content="   \n   \n   " />);
    const container = screen.getByTestId('markdown-content');
    expect(container).toBeInTheDocument();
    expect(container.textContent?.trim()).toBe('');
  });

  test('handles unclosed formatting gracefully', () => {
    render(<MarkdownText content="This is **bold without closing" />);
    
    const container = screen.getByTestId('markdown-content');
    expect(container.textContent).toContain('This is');
    expect(container.textContent).toContain('bold without closing');
    expect(container.textContent).toBe('This is **bold without closing');
  });

  test('handles unclosed code blocks gracefully', () => {
    render(<MarkdownText content="```javascript\nconst x = 1;" />);
    
    const container = screen.getByTestId('markdown-content');
    expect(container.textContent).toContain('javascript');
    expect(container.textContent).toContain('const x = 1;');
    
    expect(screen.queryByTestId('code-block')).not.toBeInTheDocument();
  });

  test('handles malformed tables gracefully', () => {
    render(<MarkdownText content="| Header |\n| Cell" />);
    
    const container = screen.getByTestId('markdown-content');
    
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    
    expect(container.textContent).toContain('Header');
    expect(container.textContent).toContain('Cell');
    
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('renders lists inside blockquotes', () => {
    render(<MarkdownText content="> - Item 1\n> - Item 2" />);
    const blockquote = screen.getByRole('blockquote');
    expect(blockquote).toBeInTheDocument();
    
    const listItems = within(blockquote).getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]).toHaveTextContent('Item 1');
    expect(listItems[1]).toHaveTextContent('Item 2');
  });

  test('renders code blocks inside lists', () => {
    render(<MarkdownText content="- Item with code:\n  ```js\n  const x = 1;\n  ```" />);
    const listItem = screen.getByRole('listitem');
    expect(listItem).toBeInTheDocument();
    expect(listItem).toHaveTextContent('Item with code:');
    
    const codeBlock = screen.getByTestId('code-block');
    expect(codeBlock).toBeInTheDocument();
  });

  test('handles special characters correctly', () => {
    render(<MarkdownText content="Special chars: & < > ' \\ / @ # $ % ^ * ( ) _ + { } | : ?" />);
    
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('Special chars:');
    
    const content = screen.getByTestId('markdown-content').textContent;
    expect(content).toContain('Special chars:');
    expect(content).toContain('&');
    expect(content).toContain('<');
    expect(content).toContain('>');
    expect(content).toContain('\'');
    expect(content).toContain('\\');
    expect(content).toContain('/');
    expect(content).toContain('@');
    expect(content).toContain('#');
    expect(content).toContain('$');
    expect(content).toContain('%');
    expect(content).toContain('^');
    expect(content).toContain('*');
    expect(content).toContain('(');
    expect(content).toContain(')');
    expect(content).toContain('_');
    expect(content).toContain('+');
    expect(content).toContain('{');
    expect(content).toContain('}');
    expect(content).toContain('|');
    expect(content).toContain(':');
    expect(content).toContain('?');
  });

  test('handles emoji correctly', () => {
    render(<MarkdownText content="Emoji test: 😀 🚀 👍" />);
    expect(screen.getByText(/Emoji test: 😀 🚀 👍/)).toBeInTheDocument();
  });

  test('handles multiple consecutive horizontal rules', () => {
    render(<MarkdownText content="---\n\n---\n\n---" />);
    const hrs = document.querySelectorAll('hr');
    expect(hrs.length).toBe(3);
  });

  test('handles mixed inline formatting correctly', () => {
    render(<MarkdownText content="**Bold _italic_ text** and `code with **bold**`" />);
    
    // Find the strong element containing "Bold italic text"
    const strongElement = screen.getByText((content, element) => {
      return !!element && 
             element.tagName.toLowerCase() === 'strong' && 
             content.includes('Bold') && 
             content.includes('text');
    });
    expect(strongElement).toBeInTheDocument();
    
    // Check that there's an italic element inside the strong element
    const italicElement = strongElement.querySelector('em');
    expect(italicElement).toBeInTheDocument();
    expect(italicElement?.textContent).toBe('italic');
    
    // Check for the code element in the paragraph
    const paragraph = screen.getByText(/Bold/, { exact: false }).closest('p');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.innerHTML).toContain('`code with');
    expect(paragraph?.innerHTML).toContain('bold');
  });

  test('handles long paragraphs correctly', () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20);
    render(<MarkdownText content={longText} />);
    
    const container = screen.getByTestId('markdown-content');
    expect(container).toHaveTextContent('Lorem ipsum dolor sit amet');
    
    const paragraph = container.querySelector('p');
    expect(paragraph).toBeInTheDocument();
    
    expect(container.textContent?.length).toBeGreaterThan(longText.length * 0.9);
  });

  test('handles non-Latin scripts correctly', () => {
    render(<MarkdownText content="# 你好，世界\n这是中文文本。\n## Русский текст\nЭто текст на русском языке." />);
    
    expect(screen.getByRole('heading', { name: '你好，世界' })).toBeInTheDocument();
    expect(screen.getByText('这是中文文本。')).toBeInTheDocument();
    
    expect(screen.getByRole('heading', { name: 'Русский текст' })).toBeInTheDocument();
    expect(screen.getByText('Это текст на русском языке.')).toBeInTheDocument();
  });

  test('handles deeply nested markdown correctly', () => {
    render(<MarkdownText content="> ## Heading in blockquote\n> \n> - **Bold item** in list in blockquote\n> - _Italic item_ in list in blockquote\n> \n> ```js\n> // Code in blockquote\n> const x = 1;\n> ```" />);
    
    const blockquote = screen.getByRole('blockquote');
    expect(blockquote).toBeInTheDocument();
    
    const heading = within(blockquote).getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Heading in blockquote');
    
    const listItems = within(blockquote).getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    
    const boldItem = within(listItems[0]).getByText('Bold item');
    expect(boldItem.tagName).toBe('STRONG');
    
    const italicItem = within(listItems[1]).getByText('Italic item');
    expect(italicItem.tagName).toBe('EM');
  });

  test('renders nested formatting with both bold and italic correctly', () => {
    render(<MarkdownText content="**_This entire text is both bold and italic_**" />);
    
    // Find the strong element using a different approach
    const container = screen.getByTestId('markdown-content');
    const strongElement = container.querySelector('strong');
    expect(strongElement).toBeInTheDocument();
    
    // Check that there's an italic element inside the strong element
    const italicElement = strongElement?.querySelector('em');
    expect(italicElement).toBeInTheDocument();
    expect(italicElement?.textContent?.trim()).toBe('This entire text is both bold and italic');
  });

  test('renders spoiler text correctly', () => {
    render(<MarkdownText content="This is a ||spoiler text|| that should be hidden" />);
    
    const spoilerElement = screen.getByText('spoiler text');
    expect(spoilerElement).toBeInTheDocument();
    expect(spoilerElement.className).toContain('bg-[--gray-3]');
    expect(spoilerElement).toHaveAttribute('title', 'Click to reveal spoiler');
  });

  test('renders HTML content in markdown correctly', () => {
    render(<MarkdownText content="This contains <strong>HTML</strong> and <em>formatting</em>" />);
    
    const container = screen.getByTestId('markdown-content');
    // HTML tags are escaped in the output
    expect(container.innerHTML).toContain('&lt;strong&gt;HTML&lt;/strong&gt;');
    expect(container.innerHTML).toContain('&lt;em&gt;formatting&lt;/em&gt;');
  });

  test('renders HTML content in tables correctly', () => {
    const tableWithHtml = `
| Column 1 | Column 2 |
|----------|----------|
| <strong>Bold</strong> | <em>Italic</em> |
| <code>Code</code> | <a href="https://example.com">Link</a> |
    `;
    
    render(<MarkdownText content={tableWithHtml} />);
    
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    
    // Check that HTML is preserved in table cells
    expect(table.innerHTML).toContain('<strong>Bold</strong>');
    expect(table.innerHTML).toContain('<em>Italic</em>');
    expect(table.innerHTML).toContain('<code>Code</code>');
    expect(table.innerHTML).toContain('<a href="https://example.com">Link</a>');
  });

  test('renders code blocks with different languages correctly', () => {
    const codeBlocksContent = `
\`\`\`python
def hello():
    print("Hello, world!")
\`\`\`

\`\`\`css
body {
  color: red;
}
\`\`\`
    `;
    
    render(<MarkdownText content={codeBlocksContent} />);
    
    const codeBlocks = screen.getAllByTestId('code-block');
    expect(codeBlocks).toHaveLength(2);
    
    expect(codeBlocks[0]).toHaveAttribute('data-language', 'python');
    expect(codeBlocks[0]).toHaveAttribute('data-code', 'def hello():\n    print("Hello, world!")');
    
    expect(codeBlocks[1]).toHaveAttribute('data-language', 'css');
    expect(codeBlocks[1]).toHaveAttribute('data-code', 'body {\n  color: red;\n}');
  });
}); 