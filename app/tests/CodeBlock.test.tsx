import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CodeBlock } from "@/components/markdown/CodeBlock";

import "@testing-library/jest-dom";

// Mock the SyntaxHighlighter component
jest.mock("react-syntax-highlighter", () => ({
  Prism: ({
    children,
    language,
    showLineNumbers,
  }: {
    children: React.ReactNode;
    language: string;
    showLineNumbers: boolean;
  }) => (
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
jest.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  atomDark: {},
}));

// Mock the Lucide icons
jest.mock("lucide-react", () => ({
  Copy: () => <div data-testid="copy-icon" />,
  Check: () => <div data-testid="check-icon" />,
}));

describe("CodeBlock Component", () => {
  test("renders with language", () => {
    render(<CodeBlock code="const x = 1;" language="javascript" />);

    expect(screen.getByText("JAVASCRIPT")).toBeInTheDocument();
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();

    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter).toHaveAttribute("data-language", "javascript");
  });

  test("renders without language", () => {
    render(<CodeBlock code="Some code" />);

    expect(screen.getByText("CODE")).toBeInTheDocument();
    expect(screen.getByText("Some code")).toBeInTheDocument();

    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter).toHaveAttribute("data-language", "text");
  });

  test("copy button works", async () => {
    // Mock clipboard API
    const mockClipboard = {
      writeText: jest.fn().mockImplementation(() => Promise.resolve()),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
    });

    render(<CodeBlock code="const x = 1;" language="javascript" />);

    const copyButton = screen.getByRole("button", { name: /copy code/i });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(mockClipboard.writeText).toHaveBeenCalledWith("const x = 1;");

    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
      expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    });
  });

  test("shows line numbers for code with more than 5 lines", () => {
    const multilineCode = "line1\nline2\nline3\nline4\nline5\nline6";
    render(<CodeBlock code={multilineCode} />);

    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter).toHaveAttribute("data-show-line-numbers", "true");
  });

  test("does not show line numbers for code with 5 or fewer lines", () => {
    const shortCode = "line1\nline2\nline3\nline4\nline5";
    render(<CodeBlock code={shortCode} />);

    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter).toHaveAttribute("data-show-line-numbers", "false");
  });

  test("handles empty code gracefully", () => {
    render(<CodeBlock code="" />);

    expect(screen.getByText("CODE")).toBeInTheDocument();
    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter).toBeInTheDocument();
    expect(highlighter).toHaveAttribute("data-show-line-numbers", "false");
  });

  test("handles very long code blocks correctly", () => {
    const longCode = Array(100).fill('console.log("test");').join("\n");
    render(<CodeBlock code={longCode} language="javascript" />);

    expect(screen.getByText("JAVASCRIPT")).toBeInTheDocument();
    const highlighter = screen.getByTestId("syntax-highlighter");
    expect(highlighter).toHaveAttribute("data-show-line-numbers", "true");
  });

  test("handles clipboard API errors gracefully", async () => {
    // Mock console.error to prevent actual error output during test
    const originalConsoleError = console.error;
    const mockConsoleError = jest.fn();
    console.error = mockConsoleError;

    // Mock clipboard API to throw an error
    const mockClipboard = {
      writeText: jest.fn().mockImplementation(() => Promise.reject(new Error("Clipboard error"))),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
    });

    render(<CodeBlock code="const x = 1;" language="javascript" />);

    const copyButton = screen.getByRole("button", { name: /copy/i });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(mockClipboard.writeText).toHaveBeenCalledWith("const x = 1;");
    expect(mockConsoleError).toHaveBeenCalled();

    // The "Copied" text should not appear
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();

    // Restore console.error
    console.error = originalConsoleError;
  });

  test("copy button changes back after timeout", async () => {
    // Mock timers
    jest.useFakeTimers();

    // Mock clipboard API
    const mockClipboard = {
      writeText: jest.fn().mockImplementation(() => Promise.resolve()),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
    });

    render(<CodeBlock code="const x = 1;" language="javascript" />);

    const copyButton = screen.getByRole("button", { name: /copy/i });

    await act(async () => {
      fireEvent.click(copyButton);
      // Wait for the promise to resolve
      await Promise.resolve();
    });

    // Check that it shows "Copied"
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
      expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    });

    // Fast-forward time
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    // Check that it changed back to "Copy"
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();

    // Restore timers
    jest.useRealTimers();
  });

  test("has proper accessibility attributes", async () => {
    // Mock clipboard API
    const mockClipboard = {
      writeText: jest.fn().mockImplementation(() => Promise.resolve()),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
    });

    render(<CodeBlock code="const x = 1;" language="javascript" />);

    const copyButton = screen.getByRole("button", { name: /copy/i });
    expect(copyButton).toHaveAttribute("aria-label", "Copy code");

    // Click the button to change state
    await act(async () => {
      fireEvent.click(copyButton);
      // Wait for the promise to resolve
      await Promise.resolve();
    });

    // Check that aria-label updates
    await waitFor(() => {
      expect(copyButton).toHaveAttribute("aria-label", "Copied");
    });
  });
});
