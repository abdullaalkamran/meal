"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { repo, type User } from "@/lib/data";

const fieldClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass = "mb-1 text-[10px] font-extrabold text-text-secondary";

/** "Check your eligibility" — name/phone/email come prefilled from the app
 * profile; the rest the member fills in. Submitting creates a study-abroad
 * lead for the Service Manager. */
export function EligibilityFormSheet({
  open,
  onClose,
  countryName,
  user,
}: {
  open: boolean;
  onClose: () => void;
  countryName: string;
  user: User | null | undefined;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lastAcademic, setLastAcademic] = useState("");
  const [englishTest, setEnglishTest] = useState("");
  const [interestedCountry, setInterestedCountry] = useState("");
  const [subjects, setSubjects] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open)
      queueMicrotask(() => {
        setName(user?.name ?? "");
        setPhone(user?.phone ?? "");
        setEmail(user?.email ?? "");
        setLastAcademic("");
        setEnglishTest("");
        setInterestedCountry(countryName);
        setSubjects("");
        setSubmitted(false);
      });
  }, [open, user, countryName]);

  const canSubmit = !!name.trim() && !!phone.trim() && !!lastAcademic.trim();

  const submit = async () => {
    if (!user) return;
    await repo.studyLeads.add({
      userId: user.id,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      lastAcademic: lastAcademic.trim(),
      englishTest: englishTest.trim() || "None",
      interestedCountry: interestedCountry.trim() || countryName,
      subjects: subjects.trim(),
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Sheet open={open} onClose={onClose} title="Request received">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-[26px]">
            🎓
          </div>
          <div className="text-[14px] font-extrabold">We got your details!</div>
          <div className="text-[11px] font-semibold leading-relaxed text-text-secondary">
            A study-abroad counsellor will review your profile for{" "}
            <span className="font-extrabold text-text">{interestedCountry}</span> and call you at{" "}
            <span className="font-extrabold text-text">{phone}</span> shortly.
          </div>
          <Button className="mt-2" onClick={onClose}>
            Done
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title="Check your eligibility">
      <div className="mb-3 rounded-btn bg-blue-soft px-3 py-2.5 text-[10.5px] font-bold text-blue">
        Free assessment — a counsellor calls you back with your options.
      </div>
      <div className="flex flex-col gap-3">
        <label>
          <div className={labelClass}>NAME</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <div className={labelClass}>NUMBER</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <div className={labelClass}>EMAIL</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </label>
        <label>
          <div className={labelClass}>LAST ACADEMIC DETAIL</div>
          <input
            value={lastAcademic}
            onChange={(e) => setLastAcademic(e.target.value)}
            placeholder="e.g. BSc in CSE, CGPA 3.4 (2025)"
            className={fieldClass}
          />
        </label>
        <label>
          <div className={labelClass}>ENGLISH PROFICIENCY TEST SCORE (IF ANY)</div>
          <input
            value={englishTest}
            onChange={(e) => setEnglishTest(e.target.value)}
            placeholder="e.g. IELTS 6.5 · Duolingo 110 · None"
            className={fieldClass}
          />
        </label>
        <label>
          <div className={labelClass}>INTERESTED COUNTRY</div>
          <input
            value={interestedCountry}
            onChange={(e) => setInterestedCountry(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label>
          <div className={labelClass}>SUBJECTS YOU WANT TO STUDY</div>
          <input
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
            placeholder="e.g. Computer Science, Data Science"
            className={fieldClass}
          />
        </label>
      </div>
      <Button fullWidth onClick={submit} disabled={!canSubmit} className="mt-4">
        Submit for free assessment
      </Button>
    </Sheet>
  );
}
