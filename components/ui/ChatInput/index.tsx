"use client";

import React, { forwardRef, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsButton } from "@/components/ui/SettingsDrawer";

import { SendButton } from "./SendButton";
import { ChatInputProps } from "./types";

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      disabled,
      isLoading,
      onStop,
      placeholder = "Type your request here...",
    },
    ref
  ) => {
    // Track local attachments
    const [attachments, setAttachments] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // A helper to open the hidden file input
    function handleOpenFileDialog() {
      if (attachments.length < 5 && fileInputRef.current) {
        fileInputRef.current.click();
      }
    }

    // When user selects files
    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (!e.target.files) return;
      const chosenFiles = Array.from(e.target.files);

      let updated = [...attachments];
      for (let file of chosenFiles) {
        // Enforce limit: only .png or .jpeg
        if (!/\.(png|jpe?g)$/i.test(file.name)) {
          console.warn(`Skipping file ${file.name}: not a PNG/JPEG`);
          continue;
        }
        // Enforce 30MB max
        if (file.size > 30 * 1024 * 1024) {
          console.warn(`Skipping file ${file.name}: exceeds 30MB limit`);
          continue;
        }
        // Do not exceed total of 5
        if (updated.length >= 5) break;

        updated.push(file);
      }
      setAttachments(updated);
      // Reset the file input so user can pick the same file again if needed
      e.target.value = "";
    }

    // Remove an attachment from the local list
    function removeAttachment(index: number) {
      setAttachments(prev => {
        const copy = [...prev];
        copy.splice(index, 1);
        return copy;
      });
    }

    // Utility to truncate file name while preserving extension
    function truncateFileName(file: File): string {
      const { name } = file;
      // Example: if name === "my-super-long-cat-picture.png"
      const dotIndex = name.lastIndexOf(".");
      if (dotIndex < 0) return name;
      const ext = name.slice(dotIndex + 1); // "png"
      const base = name.slice(0, dotIndex); // "my-super-long-cat-picture"

      // If base length <= 12, no need to truncate
      if (base.length <= 12) return name;

      // e.g. "my-super-long-cat-picture" => "my-super-lon" + "..." + ".png"
      const truncatedBase = base.slice(0, 12);
      return `${truncatedBase}....${ext}`;
    }

    // Wrap onSubmit so we can clear attachments after sending
    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();

      // Prevent sending if there's no text or attachments at all
      if (!value.trim() && attachments.length === 0) return;
      onSubmit(e, value, attachments);
      setAttachments([]);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
      // If user presses Enter without Shift, submit:
      if (e.key === "Enter" && !e.shiftKey) {
        handleSubmit(e);
      }
    }

    // Show button if there's input OR if we are loading
    const hasInput = value.trim().length > 0 || attachments.length > 0;
    const shouldShowButton = isLoading || hasInput;

    return (
      <form onSubmit={handleSubmit} className="flex size-full flex-col">
        {/* Attachment bubbles row */}
        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {attachments.map((file, index) => {
              return (
                <div
                  key={index}
                  className="
                  relative flex
                  h-8 cursor-default
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-[#282828]
                  bg-[#1c1c1c]
                  px-2
                  hover:bg-[#282828]
                "
                >
                  <span className="font-geist text-sm font-normal leading-[18px] text-[#6e6e6e]">
                    {truncateFileName(file)}
                  </span>
                  {/* X button shows only in ChatInput */}
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="
                    flex size-4 items-center
                    justify-center rounded-full
                    text-[#6e6e6e] 
                    hover:text-white
                  "
                    aria-label="Remove attachment"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Textarea for typed input */}
        <div className="flex size-full flex-1 flex-col gap-2">
          <textarea
            ref={ref}
            value={value}
            onKeyDown={handleKeyDown}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={[
              "w-full",
              "flex-1",
              "overflow-auto",
              "rounded-md",
              "bg-muted",
              "text-base",
              "text-[var(--gray-12)]",
              "outline-none",
              "[&::placeholder]:text-[var(--gray-11)]",
              "[&:focus::placeholder]:opacity-0"
            ].join(" ")}
            style={{ resize: "none" }}
          />

          {/* Bottom row: attachments button + settings + send */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Commenting out attachment button
              <Button
                variant="ghost"
                size="icon"
                className={`
                w-8
                h-8
                rounded-full
                border
                border-[--gray-3]
                justify-center
                items-center
                gap-2.5
                inline-flex
                bg-[--gray-2]
                hover:bg-[--gray-3]
                disabled:bg-[--gray-1]
              `}
                onClick={handleOpenFileDialog}
                disabled={attachments.length >= 5 || disabled}
                type="button"
              >
                <Paperclip className="w-5 h-5 relative text-[--gray-12]" />
              </Button>
              */}

              <SettingsButton />
            </div>

            <AnimatePresence mode="popLayout">
              {shouldShowButton && (
                <motion.div
                  key="send-button"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <SendButton
                    disabled={disabled || false}
                    isLoading={isLoading || false}
                    onStop={onStop}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </form>
    );
  }
);

ChatInput.displayName = "ChatInput";
