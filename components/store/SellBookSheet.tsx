"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ImagePicker } from "@/components/store/ImagePicker";
import { repo, type UsedBookListing } from "@/lib/data";
import { BD_ACADEMIC_CLASSES, BOOK_CATEGORIES } from "@/lib/explore/content";
import type { User } from "@/lib/data";

const CONDITIONS: UsedBookListing["condition"][] = ["Like new", "Good", "Fair"];

const fieldClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass = "mb-1 text-[10px] font-extrabold text-text-secondary";

/** Member form to list one of their own old books for sale or to give away free. */
export function SellBookSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null | undefined;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState<string>(BOOK_CATEGORIES[0]);
  const [academicClass, setAcademicClass] = useState<string>(BD_ACADEMIC_CLASSES[0]);
  const [condition, setCondition] = useState<UsedBookListing["condition"]>("Good");
  const [free, setFree] = useState(false);
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [image, setImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open)
      queueMicrotask(() => {
        setTitle("");
        setAuthor("");
        setCategory(BOOK_CATEGORIES[0]);
        setAcademicClass(BD_ACADEMIC_CLASSES[0]);
        setCondition("Good");
        setFree(false);
        setPrice("");
        setPhone(user?.phone ?? "");
        setImage(undefined);
      });
  }, [open, user?.phone]);

  const canSubmit = !!title.trim() && !!phone.trim() && (free || Number(price) > 0);

  const submit = async () => {
    if (!user) return;
    await repo.usedBooks.add({
      hostelId: user.hostelId,
      sellerId: user.id,
      sellerName: user.name,
      title: title.trim(),
      author: author.trim(),
      category,
      academicClass,
      condition,
      free,
      price: free ? 0 : Number(price),
      phone: phone.trim(),
      image,
    });
    toast("Book listed");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Sell a book">
      <div className="flex flex-col gap-3">
        <label>
          <div className={labelClass}>BOOK TITLE</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <div className={labelClass}>AUTHOR</div>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <div className={labelClass}>CATEGORY</div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
            {BOOK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className={labelClass}>ACADEMIC CLASS</div>
          <select value={academicClass} onChange={(e) => setAcademicClass(e.target.value)} className={fieldClass}>
            {BD_ACADEMIC_CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className={labelClass}>CONDITION</div>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as UsedBookListing["condition"])}
            className={fieldClass}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
          <span className="text-[11.5px] font-extrabold">Give away free</span>
          <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-4 w-4" />
        </label>

        {!free && (
          <label>
            <div className={labelClass}>PRICE (৳)</div>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={fieldClass} />
          </label>
        )}

        <label>
          <div className={labelClass}>CONTACT PHONE</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
        </label>

        <ImagePicker value={image} onChange={setImage} label="BOOK PHOTO (optional)" />
      </div>

      <Button fullWidth onClick={submit} disabled={!canSubmit} className="mt-4">
        List book
      </Button>
    </Sheet>
  );
}
