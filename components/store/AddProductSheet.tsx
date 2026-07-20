"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ImagePicker } from "@/components/store/ImagePicker";
import { ServiceAreaPicker } from "@/components/ui/ServiceAreaPicker";
import { repo, type GeoArea, type NewProduct, type Product, type ProductKind } from "@/lib/data";
import { BD_ACADEMIC_CLASSES, BOOK_CATEGORIES, GROCERY_CATEGORIES } from "@/lib/explore/content";

const KIND_TABS: { kind: ProductKind; label: string }[] = [
  { kind: "grocery", label: "Grocery" },
  { kind: "book", label: "New book" },
];

const fieldClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass = "mb-1 text-[10px] font-extrabold text-text-secondary";

/** Add a new store product, or edit an existing one when `product` is passed
 * (kind is then fixed and fields come prefilled). */
export function AddProductSheet({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}) {
  const { toast } = useToast();
  const editing = !!product;
  const [kind, setKind] = useState<ProductKind>("grocery");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  // grocery
  const [unit, setUnit] = useState("");
  const [groceryCat, setGroceryCat] = useState<string>(GROCERY_CATEGORIES[0]);
  // book
  const [author, setAuthor] = useState("");
  const [bookCat, setBookCat] = useState<string>(BOOK_CATEGORIES[0]);
  const [academicClass, setAcademicClass] = useState<string>(BD_ACADEMIC_CLASSES[0]);
  const [areas, setAreas] = useState<GeoArea[]>([]);

  useEffect(() => {
    if (open)
      queueMicrotask(() => {
        setKind(product?.kind ?? "grocery");
        setName(product?.name ?? "");
        setPrice(product ? String(product.price) : "");
        setImage(product?.image);
        setUnit(product?.unit ?? "");
        setGroceryCat(product?.kind === "grocery" ? product.category : GROCERY_CATEGORIES[0]);
        setAuthor(product?.author ?? "");
        setBookCat(product?.kind === "book" ? product.category : BOOK_CATEGORIES[0]);
        setAcademicClass(
          product?.kind === "book" && product.academicClass ? product.academicClass : BD_ACADEMIC_CLASSES[0]
        );
        setAreas(product?.areas ?? []);
      });
  }, [open, product]);

  const canSubmit = !!name.trim() && Number(price) > 0;

  const submit = async () => {
    const payload: NewProduct =
      kind === "grocery"
        ? {
            kind,
            name: name.trim(),
            price: Number(price),
            category: groceryCat,
            image,
            unit: unit.trim() || undefined,
            areas: areas.length > 0 ? areas : undefined,
          }
        : {
            kind,
            name: name.trim(),
            price: Number(price),
            category: bookCat,
            image,
            author: author.trim() || undefined,
            academicClass,
            areas: areas.length > 0 ? areas : undefined,
          };
    if (editing && product) {
      await repo.products.update(product.id, payload);
      toast("Product updated");
    } else {
      await repo.products.add(payload);
      toast(kind === "grocery" ? "Grocery product added" : "New book added");
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit product" : "Add product"}>
      {!editing && (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {KIND_TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => setKind(t.kind)}
              className={`min-h-9 rounded-btn text-[11.5px] font-extrabold ${
                kind === t.kind ? "bg-primary text-white" : "bg-bg text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label>
          <div className={labelClass}>{kind === "grocery" ? "PRODUCT NAME" : "BOOK TITLE"}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>

        {kind === "book" && (
          <label>
            <div className={labelClass}>AUTHOR</div>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className={fieldClass} />
          </label>
        )}

        <label>
          <div className={labelClass}>PRICE (৳)</div>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={fieldClass} />
        </label>

        {kind === "grocery" ? (
          <>
            <label>
              <div className={labelClass}>UNIT (e.g. 1 kg, 1 dozen)</div>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldClass} />
            </label>
            <label>
              <div className={labelClass}>CATEGORY</div>
              <select value={groceryCat} onChange={(e) => setGroceryCat(e.target.value)} className={fieldClass}>
                {GROCERY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              <div className={labelClass}>CATEGORY</div>
              <select value={bookCat} onChange={(e) => setBookCat(e.target.value)} className={fieldClass}>
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
          </>
        )}

        <ImagePicker value={image} onChange={setImage} label="PRODUCT PHOTO (optional)" />
        <ServiceAreaPicker value={areas} onChange={setAreas} />
      </div>

      <Button fullWidth onClick={submit} disabled={!canSubmit} className="mt-4">
        {editing ? "Save changes" : "Add to store"}
      </Button>
      {editing && product && (
        <Button
          fullWidth
          variant="danger"
          className="mt-2"
          onClick={async () => {
            await repo.products.remove(product.id);
            toast("Product removed");
            onClose();
          }}
        >
          Remove product
        </Button>
      )}
    </Sheet>
  );
}
