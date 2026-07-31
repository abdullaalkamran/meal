"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ImagePicker } from "@/components/store/ImagePicker";
import { ServiceAreaPicker } from "@/components/ui/ServiceAreaPicker";
import { repo, type GeoArea, type Promotion } from "@/lib/data";

/** Recommended upload size per placement, shown to the uploader so cards stay
 * sharp. Hero = wide 2:1 banner; popup = square. */
const SIZE_HINT: Record<Promotion["placement"], string> = {
  hero: "Best size ≈ 1200 × 600 px (2:1 wide banner). Landscape photos look best.",
  popup: "Best size ≈ 1080 × 1080 px (square). It shows as a square card.",
};
const TITLE: Record<Promotion["placement"], string> = {
  hero: "Home banner",
  popup: "Login popup",
};

/** Upload / edit a home-page promotion (a hero banner or a login popup card).
 * Service Manager / Super Admin only — the mutations are gated in policy.ts. */
export function PromotionFormSheet({
  open,
  onClose,
  placement,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  placement: Promotion["placement"];
  editing?: Promotion;
}) {
  const { toast } = useToast();
  const [image, setImage] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [areas, setAreas] = useState<GeoArea[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setImage(editing?.image);
        setTitle(editing?.title ?? "");
        setTagline(editing?.tagline ?? "");
        setLinkUrl(editing?.linkUrl ?? "");
        setAreas(editing?.areas ?? []);
        setBusy(false);
      });
    }
  }, [open, editing]);

  const canSave = !!image && !busy;

  const save = async () => {
    if (!canSave || !image) return;
    setBusy(true);
    try {
      const fields = {
        placement,
        image,
        title: title.trim() || undefined,
        tagline: tagline.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        areas: areas.length > 0 ? areas : undefined,
      };
      if (editing) await repo.promotions.update(editing.id, fields);
      else await repo.promotions.add(fields);
      toast(editing ? "Promotion updated" : `${TITLE[placement]} added`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? `Edit ${TITLE[placement].toLowerCase()}` : `New ${TITLE[placement].toLowerCase()}`}>
      <div className="mb-3 rounded-btn bg-primary-soft px-3 py-2.5 text-[10.5px] font-semibold text-primary">
        {SIZE_HINT[placement]}
      </div>

      <div className="mb-4">
        <ImagePicker value={image} onChange={setImage} label="PHOTO" maxDim={1080} />
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">TITLE (optional)</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Eid offer"
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">TAGLINE (optional)</div>
      <input
        value={tagline}
        onChange={(e) => setTagline(e.target.value)}
        placeholder="Short line under the title"
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">LINK (optional)</div>
      <input
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        placeholder="https://… opened when tapped"
        inputMode="url"
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
      />

      <div className="mb-4">
        <ServiceAreaPicker value={areas} onChange={setAreas} />
      </div>

      <Button fullWidth onClick={save} disabled={!canSave}>
        {busy ? "Saving…" : editing ? "Save changes" : `Add ${TITLE[placement].toLowerCase()}`}
      </Button>
      {!image && (
        <div className="mt-2 text-center text-[10px] font-semibold text-text-secondary">
          Upload a photo to continue.
        </div>
      )}
    </Sheet>
  );
}
