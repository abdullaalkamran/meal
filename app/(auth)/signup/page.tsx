"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { repo, type GeoAddress, type PersonGender } from "@/lib/data";
import { useSession } from "@/lib/auth/SessionProvider";
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
  const [name, setName] = useState("");
  const [gender, setGender] = useState<PersonGender | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [address, setAddress] = useState<Partial<GeoAddress>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!name.trim() || !phone.trim() || !password) {
      setError("Name, phone number, and password are required.");
      return;
    }
    if (!gender) {
      setError("Please select your gender.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setSaving(true);
    if (!(await repo.users.phoneAvailable(phone))) {
      setSaving(false);
      setError("An account with this phone number already exists — sign in instead.");
      return;
    }

    // Members start WITHOUT a hostel — after signup they find their hostel
    // (or scan its QR invite) and send a join request; the manager's approval
    // + room assignment makes them a member. `signup` (not `users.create`) is
    // the public path: it only ever mints a hostel-less student/owner, so the
    // open endpoint can't be used to create a privileged account.
    let created;
    try {
      created = await repo.users.signup({
        name: name.trim(),
        phone: phone.trim(),
        password,
        email: email.trim() || undefined,
        role,
        gender,
        avatarSeed: `${role}-${slug(name)}`,
        address: isCompleteAddress(address) ? address : undefined,
        ...(role === "student"
          ? {
              studentId: studentId.trim() || undefined,
              department: department.trim() || undefined,
            }
          : {}),
      });
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Could not create the account.");
      return;
    }
    // The account exists on the server now — sign in with its own credentials.
    const res = await login(created.phone, password);
    if (!res.ok) {
      setSaving(false);
      setError(res.error ?? "Account created, but sign-in failed — try signing in.");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-5 py-10">
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
        <div className="mb-3">
          <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Gender
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`min-h-11 rounded-btn border text-[12px] font-extrabold capitalize transition-colors ${
                  gender === g ? "border-primary bg-primary text-white" : "border-border bg-transparent text-text"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <Field
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
          />
        </div>
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
    </main>
  );
}
