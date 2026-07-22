"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const inputClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass =
  "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

/** Super Admin form for the platform's outgoing email (SMTP) — the account
 * password-reset codes are sent from. The password is write-only: it's shown
 * as "set" but never returned, and left blank on save to keep the stored one. */
export function SmtpSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [host, setHost] = useState("");
  const [port, setPort] = useState("465");
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("MyDorm");
  const [hasPassword, setHasPassword] = useState(false);
  const [source, setSource] = useState<"db" | "env" | "none">("none");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setError("");
      try {
        const res = await fetch("/api/admin/smtp", { cache: "no-store" });
        if (!res.ok) return;
        const s = await res.json();
        setHost(s.host ?? "");
        setPort(String(s.port ?? 465));
        setSecure(s.secure !== false);
        setUsername(s.username ?? "");
        setFromEmail(s.fromEmail ?? "");
        setFromName(s.fromName || "MyDorm");
        setHasPassword(!!s.hasPassword);
        setSource(s.source ?? "none");
        setPassword("");
      } catch {
        /* leave defaults */
      }
    })();
  }, [open]);

  const save = async () => {
    if (busy) return;
    if (!host.trim() || !username.trim()) {
      setError("Server and username are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port) || 465,
          secure,
          username: username.trim(),
          password, // blank keeps the stored one
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      setHasPassword(hasPassword || !!password);
      setPassword("");
      setSource("db");
      toast("SMTP settings saved");
    } catch {
      setBusy(false);
      setError("Network error — try again.");
    }
  };

  const sendTest = async () => {
    if (busy || !testTo.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/smtp/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(data.error ?? "Could not send the test email.");
        return;
      }
      toast(`Test email sent to ${testTo.trim()}`);
    } catch {
      setBusy(false);
      setError("Network error — try again.");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Email (SMTP) settings">
      <div className="mb-3 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary">
        Outgoing email used for password-reset codes.{" "}
        {source === "env"
          ? "Currently taken from server environment variables — saving here stores it in the database instead."
          : source === "db"
            ? "Configured."
            : "Not configured yet."}
      </div>

      <div className={labelClass}>Outgoing server (SMTP host)</div>
      <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="mail.spacemail.com" className={`${inputClass} mb-3`} />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className={labelClass}>Port</div>
          <input value={port} inputMode="numeric" onChange={(e) => setPort(e.target.value)} placeholder="465" className={inputClass} />
        </div>
        <div>
          <div className={labelClass}>Encryption</div>
          <button
            type="button"
            onClick={() => setSecure((v) => !v)}
            className={`min-h-[42px] w-full rounded-btn border text-[11.5px] font-extrabold ${
              secure ? "border-primary bg-primary-soft text-primary" : "border-border text-text-secondary"
            }`}
          >
            {secure ? "SSL (465)" : "STARTTLS (587)"}
          </button>
        </div>
      </div>

      <div className={labelClass}>Username</div>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="noreply@mydorm.xyz" className={`${inputClass} mb-3`} />

      <div className={labelClass}>Password</div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={hasPassword ? "•••••• (leave blank to keep)" : "Mailbox password"}
        className={`${inputClass} mb-3`}
      />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className={labelClass}>From email</div>
          <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="noreply@mydorm.xyz" className={inputClass} />
        </div>
        <div>
          <div className={labelClass}>From name</div>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="MyDorm" className={inputClass} />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">
          {error}
        </div>
      )}

      <Button fullWidth onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </Button>

      <div className="mt-4 border-t border-border pt-3">
        <div className={labelClass}>Send a test email to</div>
        <div className="flex gap-2">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className={inputClass} />
          <button
            type="button"
            onClick={sendTest}
            disabled={busy || !testTo.trim()}
            className="shrink-0 rounded-btn bg-bg px-3 text-[11px] font-extrabold text-primary disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </Sheet>
  );
}
