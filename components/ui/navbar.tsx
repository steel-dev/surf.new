"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./button";
import { Github, Plus, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/app/contexts/ChatContext";
import { useSteelContext } from "@/app/contexts/SteelContext";

export function NavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { clearInitialState } = useChatContext();
  const { resetSession } = useSteelContext();

  const handleNewChat = async () => {
    // Clear all state
    clearInitialState();
    resetSession();

    // Navigate to home page
    router.push("/");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[--gray-3] bg-[--gray-1]">
      <div className="mx-auto px-4">
        <div className="h-14 px-4 flex items-center justify-between w-full">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src="/logo.svg" alt="surf.new logo" className="w-5 h-5" />
            </div>
            <Link href="/" className="w-[95px]">
              <span
                className={cn(
                  "text-[--gray-12] text-2xl font-normal leading-loose",
                  "font-instrument-serif-italic"
                )}
              >
                surf.new
              </span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-[--gray-3] bg-[--gray-1] text-[--gray-11] h-8"
              asChild
            >
              <Link
                href="https://github.com/steel-dev/surf.new"
                target="_blank"
              >
                <Github className="h-4 w-4" />
                <span className="px-1 font-geist">Github Repo</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="bg-[--gray-1] rounded-full border-[--gray-3] text-[--gray-11] h-8"
              onClick={handleNewChat}
            >
              <Plus className="h-4 w-4" />
              <span className="px-1 font-geist">New Chat</span>
            </Button>

            <Button
              size="sm"
              className="bg-[--gray-12] rounded-full hover:bg-[--gray-12]/90 h-8"
            >
              <span className="px-1 text-[--gray-1] font-geist">Sign In</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-5 w-5 text-[#ededed]" />
            ) : (
              <Menu className="h-5 w-5 text-[#ededed]" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden bg-neutral-900 border-b border-[#282828]",
          isMenuOpen ? "block" : "hidden"
        )}
      >
        <div className="p-4 flex flex-col gap-4 max-w-[1440px] mx-auto">
          <Button
            variant="outline"
            className="w-full bg-neutral-900 rounded-full border-[#282828] text-[#afafaf] justify-center h-8"
            asChild
          >
            <Link
              href="https://github.com/yourusername/surf-new"
              target="_blank"
            >
              <Github className="h-4 w-4" />
              <span className="px-1 font-geist">Github Repo</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            className="w-full bg-neutral-900 rounded-full border-[#282828] text-[#ededed] justify-center h-8"
            onClick={handleNewChat}
          >
            <Plus className="h-4 w-4" />
            <span className="px-1 font-geist">New Chat</span>
          </Button>

          <Button className="w-full bg-[#ededed] rounded-full hover:bg-[#ededed]/90 justify-center h-8">
            <span className="px-1 text-neutral-900 font-geist">Sign In</span>
          </Button>

          {/* Footer */}
          <div className="mt-6 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[#828282] text-base font-medium font-geist leading-tight">
                powered & maintained by
              </span>
              <span className="text-white text-base font-medium font-geist leading-tight">
                Steel
              </span>
            </div>
            <p className="text-[#ededed] text-base font-medium font-geist leading-tight">
              A better way to take your LLMs online. © Steel · Inc. 2025.
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}
