"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ImagePicker } from "@/components/store/ImagePicker";
import { repo, type NewStudyAbroadItem, type StudyAbroadItem, type StudyAbroadKind } from "@/lib/data";

type Field = { name: string; label: string; type: "text" | "number" | "textarea" };

const KIND_FIELDS: Record<StudyAbroadKind, Field[]> = {
  country: [
    { name: "name", label: "Country name", type: "text" },
    { name: "flag", label: "Flag (e.g. 🇬🇧)", type: "text" },
    { name: "overview", label: "Why study there (one line)", type: "text" },
    { name: "tuition", label: "Tuition range", type: "text" },
    { name: "livingCost", label: "Living cost", type: "text" },
    { name: "workRights", label: "Work rights", type: "text" },
    { name: "intakes", label: "Intakes", type: "text" },
    { name: "universities", label: "Popular universities", type: "text" },
    { name: "visa", label: "Visa requirements", type: "text" },
    { name: "ielts", label: "Language / IELTS requirement", type: "text" },
  ],
  scholarship: [
    { name: "name", label: "Scholarship name", type: "text" },
    { name: "country", label: "Country", type: "text" },
    { name: "coverage", label: "Coverage", type: "text" },
    { name: "deadline", label: "Deadline", type: "text" },
    { name: "eligibility", label: "Eligibility", type: "text" },
  ],
  counsellor: [
    { name: "name", label: "Counsellor name", type: "text" },
    { name: "countries", label: "Expert in (countries)", type: "text" },
    { name: "experienceYears", label: "Experience (years)", type: "number" },
    { name: "phone", label: "Phone (members call this)", type: "text" },
  ],
  promo: [
    { name: "title", label: "Promo title", type: "text" },
    { name: "tagline", label: "Tagline / offer line", type: "text" },
  ],
  blog: [
    { name: "title", label: "Post title", type: "text" },
    { name: "country", label: "Country (must match a country guide)", type: "text" },
    { name: "excerpt", label: "Excerpt (one line)", type: "text" },
    { name: "body", label: "Article (blank line between paragraphs)", type: "textarea" },
    { name: "author", label: "Author", type: "text" },
  ],
};

const KIND_LABEL: Record<StudyAbroadKind, string> = {
  country: "country guide",
  scholarship: "scholarship",
  counsellor: "counsellor",
  promo: "promo card",
  blog: "blog post",
};

/** Which kinds carry an uploaded photo. Promos are photo cards; countries,
 * counsellors, and blogs can carry one too. */
const HAS_IMAGE: Record<StudyAbroadKind, boolean> = {
  country: true,
  scholarship: false,
  counsellor: true,
  promo: true,
  blog: true,
};

const fieldClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";

export function StudyAbroadFormSheet({
  open,
  onClose,
  kind,
  item,
}: {
  open: boolean;
  onClose: () => void;
  kind: StudyAbroadKind;
  item?: StudyAbroadItem | null;
}) {
  const { toast } = useToast();
  const editing = !!item;
  const fields = KIND_FIELDS[kind];
  const [values, setValues] = useState<Record<string, string>>({});
  const [image, setImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (!item) {
        setValues({});
        setImage(undefined);
        return;
      }
      const next: Record<string, string> = {};
      for (const f of KIND_FIELDS[item.kind]) {
        const v = (item as unknown as Record<string, unknown>)[f.name];
        next[f.name] = v == null ? "" : String(v);
      }
      setValues(next);
      setImage("image" in item ? item.image : undefined);
    });
  }, [open, kind, item]);

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    const v = (n: string) => values[n]?.trim() ?? "";
    const num = (n: string) => Number(values[n]) || 0;

    let payload: NewStudyAbroadItem;
    if (kind === "country") {
      payload = { kind, name: v("name"), flag: v("flag"), overview: v("overview"), tuition: v("tuition"), livingCost: v("livingCost"), workRights: v("workRights"), intakes: v("intakes"), universities: v("universities"), visa: v("visa"), ielts: v("ielts"), image };
    } else if (kind === "scholarship") {
      payload = { kind, name: v("name"), country: v("country"), coverage: v("coverage"), deadline: v("deadline"), eligibility: v("eligibility") };
    } else if (kind === "counsellor") {
      payload = { kind, name: v("name"), countries: v("countries"), experienceYears: num("experienceYears"), phone: v("phone"), image };
    } else if (kind === "promo") {
      payload = { kind, title: v("title"), tagline: v("tagline"), image };
    } else {
      payload = { kind, title: v("title"), country: v("country"), excerpt: v("excerpt"), body: values.body?.trim() ?? "", author: v("author"), image };
    }

    if (editing && item) {
      await repo.studyAbroad.update(item.id, payload);
      toast("Updated");
    } else {
      await repo.studyAbroad.add(payload);
      toast(kind === "promo" ? "Promo published — members notified" : `Added ${KIND_LABEL[kind]}`);
    }
    onClose();
  };

  const firstRequired = fields[0].name;
  const canSubmit = !!values[firstRequired]?.trim();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${KIND_LABEL[kind]}` : `Add ${KIND_LABEL[kind]}`}
    >
      {kind === "promo" && !editing && (
        <div className="mb-3 rounded-btn bg-blue-soft px-3 py-2.5 text-[10.5px] font-bold text-blue">
          Publishing a promo card notifies every hostel member.
        </div>
      )}
      <div className="flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.name}>
            <div className="mb-1 text-[10px] font-extrabold text-text-secondary">{f.label.toUpperCase()}</div>
            {f.type === "textarea" ? (
              <textarea
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                rows={7}
                className={`${fieldClass} resize-y leading-relaxed`}
              />
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                className={fieldClass}
              />
            )}
          </label>
        ))}
        {HAS_IMAGE[kind] && (
          <ImagePicker
            value={image}
            onChange={setImage}
            label={kind === "promo" ? "PROMO PHOTO" : "PHOTO (optional)"}
          />
        )}
      </div>
      <Button fullWidth onClick={submit} disabled={!canSubmit} className="mt-4">
        {editing ? "Save changes" : kind === "promo" ? "Publish & notify members" : "Add"}
      </Button>
      {editing && item && (
        <Button
          fullWidth
          variant="danger"
          className="mt-2"
          onClick={async () => {
            await repo.studyAbroad.remove(item.id);
            toast("Removed");
            onClose();
          }}
        >
          Remove
        </Button>
      )}
    </Sheet>
  );
}
