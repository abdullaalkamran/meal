"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { repo, type GeoAddress, type User } from "@/lib/data";
import { useSession } from "@/lib/auth/SessionProvider";
import { normalizePhone } from "@/lib/utils/phone";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GeoSelect, isCompleteAddress } from "@/components/ui/GeoSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";

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

/** Create an account — as a hostel MEMBER (joins a hostel as a boarder; the
 * manager assigns a room afterwards) or as a hostel OWNER (starts with no
 * hostels and adds their first one from the Hostels page). */
export default function SignupPage() {
  const { login } = useSession();
  const [role, setRole] = useState<"student" | "owner">("student");
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [address, setAddress] = useState<Partial<GeoAddress>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    repo.users.listAll().then(setUsers);
  }, []);

  const submit = async () => {
    if (saving) return;
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    if (users.some((u) => normalizePhone(u.phone) === normalizePhone(phone))) {
      setError("An account with this phone number already exists — sign in instead.");
      return;
    }
    setError("");
    setSaving(true);

    // Members start WITHOUT a hostel — after signup they find their hostel
    // (or scan its QR invite) and send a join request; the manager's approval
    // + room assignment makes them a member.
    const created = await repo.users.create(
      role === "student"
        ? {
            hostelId: "",
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
            role: "student",
            avatarSeed: `student-${slug(name)}`,
            studentId: studentId.trim() || undefined,
            department: department.trim() || undefined,
            address: isCompleteAddress(address) ? address : undefined,
          }
        : {
            hostelId: "",
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim() || undefined,
            role: "owner",
            avatarSeed: `owner-${slug(name)}`,
            ownedHostelIds: [],
            address: isCompleteAddress(address) ? address : undefined,
          }
    );
    // The account exists on the server now — sign in with its phone.
    const res = await login(created.phone);
    if (!res.ok) {
      setSaving(false);
      setError(res.error ?? "Account created, but sign-in failed — try signing in.");
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-5 py-10">
      <div>
        <Link
          href="/login"
          className="mb-3 flex items-center gap-1 text-[12px] font-extrabold text-text-secondary"
        >
          <Icon icon={ChevronLeft} size={16} /> Sign in
        </Link>
        <div className="text-center">
          <div className="mb-1 text-[19px] font-extrabold tracking-tight">Create account</div>
          <div className="text-[11.5px] font-semibold text-text-secondary">
            Join as a hostel member, or register as a hostel owner
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <SegmentedControl
          options={[
            { value: "student", label: "Member" },
            { value: "owner", label: "Hostel owner" },
          ]}
          value={role}
          onChange={(v) => setRole(v as "student" | "owner")}
        />
      </div>

      <Card>
        <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahim Uddin" />
        <Field label="Phone number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01711-123456" />
        <Field label="Email" optional type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <GeoSelect label="Address" optional value={address} onChange={setAddress} />

        {role === "student" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Student ID" optional value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="STU2026001" />
              <Field label="Department" optional value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="CSE, BUET" />
            </div>
            <div className="mb-3 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary">
              Next you&rsquo;ll find your hostel (or scan its QR invite) and send a join
              request — you become a member once the manager approves and assigns your room.
            </div>
          </>
        ) : (
          <div className="mb-3 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary">
            You&rsquo;ll start with no hostels — add your first hostel (with its manager) from the
            Hostels page right after signing up.
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
            {error}
          </div>
        )}

        <Button fullWidth onClick={submit} disabled={saving}>
          {saving ? "Creating…" : role === "student" ? "Create member account" : "Create owner account"}
        </Button>
      </Card>
    </div>
  );
}
