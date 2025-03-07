"use client";

import { StopIcon } from "@radix-ui/react-icons";
import { GeistMono } from "geist/font/mono";

import { Button } from "@/components/ui/button";

interface SendButtonProps {
  disabled: boolean;
  isLoading: boolean;
  onStop?: () => void;
}

export function SendButton({ isLoading, onStop }: SendButtonProps) {
  return (
    <div className="flex w-full items-center justify-end gap-6">
      <div className="hidden items-center gap-2 md:flex">
        <div className="font-geist text-xs font-normal text-[--gray-11] whitespace-nowrap">
          New Line
        </div>
        <div className="flex items-center gap-1.5 overflow-hidden rounded-full border border-[--gray-3] bg-[--gray-2] pl-2.5">
          <div
            className={`font-geist text-xs font-normal leading-[14px] text-[--gray-11] whitespace-nowrap`}
          >
            Shift
          </div>
          <div className="flex h-6 min-w-[28px] items-center justify-center border-l border-[--gray-3] bg-[--gray-2] px-2">
            <div className={`font-geist text-xs font-normal leading-[14px] text-[--gray-11]`}>
              ↵
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Button
          onClick={onStop}
          type="button"
          className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-[1000px] bg-[--gray-12] px-3 font-geist hover:bg-[--gray-11]"
        >
          <StopIcon className="size-4 text-[--gray-1]" />
        </Button>
      ) : (
        <Button
          type="submit"
          className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-[1000px] bg-white px-3 font-geist text-black hover:bg-white/90"
        >
          Send
        </Button>
      )}
    </div>
  );
}
