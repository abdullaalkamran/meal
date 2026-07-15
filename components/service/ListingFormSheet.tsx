"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo, type NewServiceListing, type ServiceKind, type ServiceListing } from "@/lib/data";

type Field = { name: string; label: string; type: "text" | "number" | "list" };

const KIND_FIELDS: Record<ServiceKind, Field[]> = {
  cook: [
    { name: "name", label: "Name", type: "text" },
    { name: "cuisine", label: "Cuisine", type: "text" },
    { name: "experienceYears", label: "Experience (years)", type: "number" },
    { name: "monthlyRate", label: "Monthly rate (৳)", type: "number" },
    { name: "rating", label: "Rating (0–5)", type: "number" },
    { name: "phone", label: "Phone", type: "text" },
  ],
  job: [
    { name: "title", label: "Job title", type: "text" },
    { name: "company", label: "Company", type: "text" },
    { name: "location", label: "Location", type: "text" },
    { name: "jobType", label: "Type (Full-time/Part-time…)", type: "text" },
    { name: "pay", label: "Pay", type: "text" },
    { name: "tags", label: "Tags (comma separated)", type: "list" },
  ],
  course: [
    { name: "title", label: "Course title", type: "text" },
    { name: "provider", label: "Provider", type: "text" },
    { name: "category", label: "Category", type: "text" },
    { name: "level", label: "Level", type: "text" },
    { name: "duration", label: "Duration", type: "text" },
    { name: "price", label: "Price", type: "text" },
  ],
  offer: [
    { name: "shop", label: "Shop", type: "text" },
    { name: "title", label: "Offer title", type: "text" },
    { name: "discount", label: "Discount", type: "text" },
    { name: "code", label: "Promo code", type: "text" },
    { name: "expires", label: "Expires", type: "text" },
    { name: "category", label: "Category", type: "text" },
  ],
  hostel: [
    { name: "name", label: "Hostel name", type: "text" },
    { name: "area", label: "Area", type: "text" },
    { name: "seatRentFrom", label: "Seat rent from (৳)", type: "number" },
    { name: "seatsAvailable", label: "Seats available", type: "number" },
    { name: "rating", label: "Rating (0–5)", type: "number" },
    { name: "amenities", label: "Amenities (comma separated)", type: "list" },
    { name: "phone", label: "Phone", type: "text" },
  ],
};

const KIND_LABEL: Record<ServiceKind, string> = {
  cook: "cook",
  job: "job",
  course: "course",
  offer: "offer",
  hostel: "hostel listing",
};

/** Add a catalog listing of `kind`, or edit an existing one when `listing`
 * is passed (fields come prefilled and a Remove action appears). */
export function ListingFormSheet({
  open,
  onClose,
  kind,
  listing,
}: {
  open: boolean;
  onClose: () => void;
  kind: ServiceKind;
  listing?: ServiceListing | null;
}) {
  const { toast } = useToast();
  const editing = !!listing;
  const fields = KIND_FIELDS[kind];
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (!listing) {
        setValues({});
        return;
      }
      // Prefill from the listing: join list fields, stringify numbers.
      const next: Record<string, string> = {};
      for (const f of KIND_FIELDS[listing.kind]) {
        const v = (listing as unknown as Record<string, unknown>)[f.name];
        next[f.name] = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
      }
      setValues(next);
    });
  }, [open, kind, listing]);

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    const v = (n: string) => values[n]?.trim() ?? "";
    const num = (n: string) => Number(values[n]) || 0;
    const list = (n: string) =>
      (values[n] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

    // Build the per-kind payload (omit id/createdAt/active — repo fills them).
    let payload: NewServiceListing;
    if (kind === "cook") {
      payload = { kind, name: v("name"), cuisine: v("cuisine"), experienceYears: num("experienceYears"), monthlyRate: num("monthlyRate"), rating: num("rating"), phone: v("phone") };
    } else if (kind === "job") {
      payload = { kind, title: v("title"), company: v("company"), location: v("location"), jobType: v("jobType"), pay: v("pay"), tags: list("tags") };
    } else if (kind === "course") {
      payload = { kind, title: v("title"), provider: v("provider"), category: v("category"), level: v("level"), duration: v("duration"), price: v("price") };
    } else if (kind === "offer") {
      payload = { kind, shop: v("shop"), title: v("title"), discount: v("discount"), code: v("code"), expires: v("expires"), category: v("category") };
    } else {
      payload = { kind, name: v("name"), area: v("area"), seatRentFrom: num("seatRentFrom"), seatsAvailable: num("seatsAvailable"), rating: num("rating"), amenities: list("amenities"), phone: v("phone") };
    }

    if (editing && listing) {
      await repo.serviceCatalog.update(listing.id, payload);
      toast("Listing updated");
    } else {
      await repo.serviceCatalog.add(payload);
      toast(`Added ${KIND_LABEL[kind]}`);
    }
    onClose();
  };

  const firstRequired = fields[0].name;
  const canSubmit = !!values[firstRequired]?.trim();

  return (
    <Sheet open={open} onClose={onClose} title={editing ? `Edit ${KIND_LABEL[kind]}` : `Add ${KIND_LABEL[kind]}`}>
      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.name}>
            <div className="mb-1 text-[10px] font-extrabold text-text-secondary">{f.label.toUpperCase()}</div>
            <input
              type={f.type === "number" ? "number" : "text"}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
            />
          </label>
        ))}
      </div>
      <Button fullWidth onClick={submit} disabled={!canSubmit} className="mt-4">
        {editing ? "Save changes" : "Add to catalog"}
      </Button>
      {editing && listing && (
        <Button
          fullWidth
          variant="danger"
          className="mt-2"
          onClick={async () => {
            await repo.serviceCatalog.remove(listing.id);
            toast("Listing removed");
            onClose();
          }}
        >
          Remove listing
        </Button>
      )}
    </Sheet>
  );
}
