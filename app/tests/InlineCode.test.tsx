import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InlineCode } from '@/components/InlineCode';

describe('InlineCode Component', () => {
  test('renders correctly with text content', () => {
    render(<InlineCode>const x = 1;</InlineCode>);
    
    const codeElement = screen.getByText('const x = 1;');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.tagName).toBe('CODE');
    expect(codeElement).toHaveClass('rounded', 'bg-[--gray-2]', 'border');
  });

  test('renders correctly with JSX content', () => {
    render(<InlineCode><span data-testid="inner-span">test</span></InlineCode>);
    
    const innerElement = screen.getByTestId('inner-span');
    expect(innerElement).toBeInTheDocument();
    expect(innerElement.closest('code')).toBeInTheDocument();
  });

  test('applies correct styling', () => {
    render(<InlineCode>test</InlineCode>);
    
    const codeElement = screen.getByText('test');
    expect(codeElement).toHaveClass(
      'rounded', 
      'bg-[--gray-2]', 
      'px-1.5', 
      'py-0.5', 
      'font-mono', 
      'text-sm', 
      'text-[--gray-12]', 
      'border', 
      'border-[--gray-3]'
    );
  });
}); 