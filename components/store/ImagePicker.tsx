"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

// Uploaded photos are downscaled + JPEG-compressed client-side before being
// stored as a data URL — the whole mock DB lives in localStorage (~5 MB), so
// full-resolution photos would blow the quota after a handful of products.
const MAX_DIM = 320;

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

/** Photo-upload field: pick an image → downscaled preview, removable. */
export function ImagePicker({
  value,
  onChange,
  label = "PHOTO (optional)",
}: {
  value: string | undefined;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToDataUrl(file));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-1 text-[10px] font-extrabold text-text-secondary">{label}</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative h-24 w-24 overflow-hidden rounded-btn border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Product photo" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label="Remove photo"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <Icon icon={X} size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-btn border border-dashed border-border text-text-secondary"
        >
          <Icon icon={Camera} size={20} />
          <span className="text-[9.5px] font-bold">{busy ? "Loading…" : "Add photo"}</span>
        </button>
      )}
    </div>
  );
}
