import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeBlock } from '@/components/CodeBlock';

// Mock the SyntaxHighlighter component
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language, showLineNumbers }: { children: React.ReactNode, language: string, showLineNumbers: boolean }) => (
    <div 
      data-testid="syntax-highlighter" 
      data-language={language} 
      data-show-line-numbers={showLineNumbers}
    >
      {children}
    </div>
  ),
}));

// Mock the styles
jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  atomDark: {},
}));

// Mock the Lucide icons
jest.mock('lucide-react', () => ({
  Copy: () => <div data-testid="copy-icon" />,
  Check: () => <div data-testid="check-icon" />,
}));

describe('CodeBlock Component', () => {
  test('renders with language', () => {
    render(<CodeBlock code="const x = 1;" language="javascript" />);
    
    expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    
    const highlighter = screen.getByTestId('syntax-highlighter');
    expect(highlighter).toHaveAttribute('data-language', 'javascript');
  });
  
  test('renders without language', () => {
    render(<CodeBlock code="Some code" />);
    
    expect(screen.getByText('CODE')).toBeInTheDocument();
    expect(screen.getByText('Some code')).toBeInTheDocument();
    
    const highlighter = screen.getByTestId('syntax-highlighter');
    expect(highlighter).toHaveAttribute('data-language', 'text');
  });
  
  test('copy button works', async () => {
    // Mock clipboard API
    const mockClipboard = {
      writeText: jest.fn().mockImplementation(() => Promise.resolve())
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true
    });
    
    render(<CodeBlock code="const x = 1;" language="javascript" />);
    
    const copyButton = screen.getByRole('button', { name: /copy code/i });
    fireEvent.click(copyButton);
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith('const x = 1;');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  test('shows line numbers for code with more than 5 lines', () => {
    const multilineCode = 'line1\nline2\nline3\nline4\nline5\nline6';
    render(<CodeBlock code={multilineCode} />);
    
    const highlighter = screen.getByTestId('syntax-highlighter');
    expect(highlighter).toHaveAttribute('data-show-line-numbers', 'true');
  });
  
  test('does not show line numbers for code with 5 or fewer lines', () => {
    const shortCode = 'line1\nline2\nline3\nline4\nline5';
    render(<CodeBlock code={shortCode} />);
    
    const highlighter = screen.getByTestId('syntax-highlighter');
    expect(highlighter).toHaveAttribute('data-show-line-numbers', 'false');
  });
}); 