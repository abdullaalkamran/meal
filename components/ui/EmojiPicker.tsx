"use client";

import { useState } from "react";
import EmojiPickerReact, { type EmojiClickData } from "emoji-picker-react";
import { Smile } from "lucide-react";
import { Icon } from "./Icon";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

// Wraps the emoji-picker-react dependency behind our own component so the
// library choice can change without touching call sites.
export function EmojiPickerButton({ onSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-bg text-text-secondary"
      >
        <Icon icon={Smile} size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-2">
            <EmojiPickerReact
              onEmojiClick={(data: EmojiClickData) => {
                onSelect(data.emoji);
                setOpen(false);
              }}
              width={280}
              height={340}
            />
          </div>
        </>
      )}
    </div>
  );
}
