"use client";

import React, { useState, useRef, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { SettingsButton } from "@/components/ui/SettingsDrawer";
import { SendButton } from "./SendButton";
import { ChatInputProps } from "./types";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

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
      setAttachments((prev) => {
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
      <form onSubmit={handleSubmit} className="flex flex-col w-full h-full">
        {/* Attachment bubbles row */}
        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {attachments.map((file, index) => {
              return (
                <div
                  key={index}
                  className="
                  flex items-center
                  h-8 px-2
                  bg-[#1c1c1c]
                  rounded-full
                  border
                  border-[#282828]
                  gap-2
                  relative
                  cursor-default
                  hover:bg-[#282828]
                "
                >
                  <span className="text-[#6e6e6e] text-sm font-normal font-geist leading-[18px]">
                    {truncateFileName(file)}
                  </span>
                  {/* X button shows only in ChatInput */}
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="
                    flex items-center justify-center
                    w-4 h-4
                    text-[#6e6e6e] 
                    rounded-full
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
        <div className="flex-1 flex flex-col gap-2 w-full h-full">
          <textarea
            ref={ref}
            value={value}
            onKeyDown={handleKeyDown}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="
            flex-1
            w-full
            overflow-auto
            bg-muted
            text-[var(--gray-12)]
            text-base
            [&::placeholder]:text-[var(--gray-11)]
            [&:focus::placeholder]:opacity-0
            rounded-md
            outline-none
          "
            style={{ resize: "none" }}
          />

          {/* Bottom row: attachments button + settings + send */}
          <div className="flex justify-between items-center w-full">
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
