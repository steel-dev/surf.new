"use client";

import { Button } from "@/components/ui/button";
import { GeistMono } from "geist/font/mono";
import { StopIcon } from "@radix-ui/react-icons";

interface SendButtonProps {
  disabled: boolean;
  isLoading: boolean;
  onStop?: () => void;
}

export function SendButton({ isLoading, onStop }: SendButtonProps) {
  return (
    <div className="flex items-center justify-end w-full gap-6">
      <div className="hidden md:flex h-8 items-center gap-1">
        <div className="text-[--gray-11] text-sm font-normal font-geist leading-[14px]">
          New Line
        </div>
        <div className="pl-2.5 bg-[--gray-2] rounded-full flex items-center gap-1.5 overflow-hidden border border-[--gray-3]">
          <div
            className={`text-[--gray-11] text-xs font-normal font-geist leading-[14px]`}
          >
            shift
          </div>
          <div className="w-7 h-8 bg-[--gray-2] border-l border-[--gray-3] flex items-center justify-center gap-2.5">
            <div
              className={`text-[--gray-11] text-sm font-normal font-geist leading-[14px]`}
            >
              ↵
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Button
          onClick={onStop}
          type="button"
          className="h-8 px-3 inline-flex font-geist justify-center items-center gap-2.5 flex-shrink-0 rounded-[1000px] bg-[--gray-12] hover:bg-[--gray-11] cursor-pointer"
        >
          <StopIcon className="h-4 w-4 text-[--gray-1]" />
        </Button>
      ) : (
        <Button
          type="submit"
          className="h-8 px-3 inline-flex justify-center font-geist items-center gap-2.5 flex-shrink-0 rounded-[1000px] bg-white hover:bg-white/90 text-black cursor-pointer"
        >
          Send
        </Button>
      )}
    </div>
  );
}
