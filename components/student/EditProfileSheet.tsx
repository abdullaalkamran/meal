"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { GeoSelect, isCompleteAddress } from "@/components/ui/GeoSelect";
import { ImagePicker } from "@/components/store/ImagePicker";
import { ChangePasswordSheet } from "@/components/student/ChangePasswordSheet";
import { repo, type GeoAddress, type User } from "@/lib/data";
import { normalizePhone } from "@/lib/utils/phone";

function Field({
  label,
  optional,
  ...input
}: { label: string; optional?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        {label}
        {optional && <span className="font-semibold normal-case"> · optional</span>}
      </div>
      <input
        {...input}
        className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
    </div>
  );
}

/** Personal information editing — name, phone (kept unique: it's the sign-in),
 * email, and student details. */
export function EditProfileSheet({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: User | undefined;
  onSaved?: () => void;
}) {
  const [avatarImage, setAvatarImage] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [address, setAddress] = useState<Partial<GeoAddress>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const prefilled = useRef(false);
  useEffect(() => {
    if (!open) {
      prefilled.current = false;
      return;
    }
    if (!user || prefilled.current) return;
    prefilled.current = true;
    queueMicrotask(() => {
      setAvatarImage(user.avatarImage);
      setName(user.name);
      setPhone(user.phone);
      setEmail(user.email ?? "");
      setStudentId(user.studentId ?? "");
      setDepartment(user.department ?? "");
      setAddress(user.address ?? {});
      setError("");
    });
  }, [open, user]);

  if (!user) return null;
  const isStudent = user.role === "student";

  const save = async () => {
    if (saving) return;
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    const all = await repo.users.listAll();
    if (all.some((u) => u.id !== user.id && normalizePhone(u.phone) === normalizePhone(phone))) {
      setError("Another account already uses this phone number.");
      return;
    }
    setError("");
    setSaving(true);
    await repo.users.updateUser(user.id, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: isCompleteAddress(address) ? address : undefined,
      // "" (not undefined) so removing a photo actually clears it — an
      // `undefined` value is dropped entirely by JSON.stringify on the way
      // to the server, so the old photo would silently stick around.
      avatarImage: avatarImage ?? "",
      ...(isStudent
        ? { studentId: studentId.trim() || undefined, department: department.trim() || undefined }
        : {}),
    });
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Personal information">
      {!email.trim() && (
        <div className="mb-3 rounded-btn bg-primary-soft px-3 py-2.5 text-[10.5px] font-bold leading-relaxed text-primary">
          Add an email so you can reset your own password if you forget it.
          Without one, you&rsquo;ll need your manager or owner to reset it for you.
        </div>
      )}
      <div className="mb-3 flex justify-center">
        <ImagePicker value={avatarImage} onChange={setAvatarImage} label="PROFILE PHOTO (optional)" maxDim={320} />
      </div>
      <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <Field label="Phone number (your sign-in)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Field label="Email" optional type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <GeoSelect label="Address" optional value={address} onChange={setAddress} />
      {isStudent && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Student ID" optional value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          <Field label="Department" optional value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}
      <Button fullWidth onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
      <button
        type="button"
        onClick={() => setPwOpen(true)}
        className="mt-2 min-h-11 w-full rounded-btn border border-border text-[12px] font-extrabold text-text-secondary"
      >
        Change password
      </button>
      <ChangePasswordSheet open={pwOpen} onClose={() => setPwOpen(false)} />
    </Sheet>
  );
}
