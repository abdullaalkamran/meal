"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { QrScannerSheet } from "@/components/ui/QrScannerSheet";
import { useRooms } from "@/hooks/useRooms";
import { parseMemberCode } from "@/lib/utils/qr";
import { normalizePhone } from "@/lib/utils/phone";
import { repo, type Hostel, type User } from "@/lib/data";

export function AddMemberSheet({
  open,
  onClose,
  hostelId,
  /** Member id arriving via the ?assign= deep link (a member QR scanned with
   * a regular camera app) — jumps straight to the assign-room step. */
  initialScanUserId,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  initialScanUserId?: string;
}) {
  const { toast } = useToast();
  const rooms = useRooms(hostelId);
  const [phone, setPhone] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState<User | null>(null);
  const [otherHostel, setOtherHostel] = useState<Hostel | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const freeRooms = rooms.filter((r) => r.occupantIds.length < r.capacity);

  // Resolves a platform account and shows it for room assignment — the only
  // way to add a member. Both the QR scanner and the phone lookup funnel
  // through here, so a person who isn't on the platform can never be added.
  const showAccount = async (u: User) => {
    setScannerOpen(false);
    setScanned(u);
    setOtherHostel(
      u.hostelId && u.hostelId !== hostelId
        ? ((await repo.hostels.getHostel(u.hostelId)) ?? null)
        : null
    );
  };

  // Scanning a member's QR pulls up their account by name immediately — the
  // manager only has to tap the room.
  const loadScanned = async (userId: string) => {
    const u = await repo.users.getUser(userId);
    if (!u) {
      toast("No platform account found for this QR code");
      return;
    }
    await showAccount(u);
  };

  // Manual add is a lookup of an EXISTING platform account by phone — never a
  // free-text create. A number with no account can't be added.
  const lookupByPhone = async () => {
    if (!phone.trim() || lookingUp) return;
    setLookingUp(true);
    try {
      const target = normalizePhone(phone);
      const u = (await repo.users.listAll()).find(
        (x) => normalizePhone(x.phone) === target
      );
      if (!u) {
        toast(
          "No platform account for this number — ask them to create an account and scan your hostel's QR."
        );
        return;
      }
      await showAccount(u);
    } finally {
      setLookingUp(false);
    }
  };

  useEffect(() => {
    if (open && initialScanUserId) {
      queueMicrotask(() => void loadScanned(initialScanUserId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialScanUserId]);

  const reset = () => {
    setScanned(null);
    setOtherHostel(null);
    setPhone("");
  };

  const assign = async (roomId: string) => {
    if (!scanned || !hostelId || assigning) return;
    setAssigning(true);
    try {
      await repo.users.attachToHostel(scanned.id, hostelId, roomId);
      const room = rooms.find((r) => r.id === roomId);
      toast(`${scanned.name} assigned to Room ${room?.number ?? ""}`);
      reset();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not assign the room");
    } finally {
      setAssigning(false);
    }
  };

  const alreadyHere = scanned?.hostelId === hostelId;

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Add member">
        {scanned ? (
          <>
            <div className="mb-3 flex items-center gap-3 rounded-card bg-bg p-3">
              <Avatar name={scanned.name} seed={scanned.avatarSeed} size={42} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-extrabold">{scanned.name}</div>
                <div className="text-[10.5px] font-semibold text-text-secondary">
                  {scanned.phone}
                </div>
              </div>
            </div>

            {otherHostel || (scanned.hostelId && !alreadyHere) ? (
              <div className="mb-3 rounded-btn bg-danger-soft px-3 py-3 text-[11px] font-bold text-danger">
                {scanned.name} is already a member of {otherHostel?.name ?? "another hostel"} —
                a member can only belong to one hostel. They can request a hostel transfer to
                move here.
              </div>
            ) : (
              <>
                <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
                  {alreadyHere ? "Already a member — move to a room" : "Assign a room"}
                </div>
                {freeRooms.length === 0 && (
                  <div className="mb-3 rounded-btn bg-bg px-3 py-2.5 text-[10.5px] font-semibold text-text-secondary">
                    No free seats — add a room or free a seat first.
                  </div>
                )}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {freeRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      disabled={assigning}
                      onClick={() => assign(room.id)}
                      className="rounded-pill bg-primary-soft px-3 py-2 text-[11px] font-extrabold text-primary"
                    >
                      Room {room.number} · {room.capacity - room.occupantIds.length} free
                    </button>
                  ))}
                </div>
              </>
            )}
            <Button variant="secondary" fullWidth onClick={reset}>
              Choose someone else
            </Button>
          </>
        ) : (
          <>
            <div className="mb-3 rounded-btn bg-bg px-3 py-2.5 text-[10px] font-semibold text-text-secondary">
              Only people with a platform account can be added. Scan their QR
              code or look them up by phone — if they&rsquo;re new, ask them to
              create an account and scan your hostel&rsquo;s QR first.
            </div>

            <Button
              variant="secondary"
              fullWidth
              onClick={() => setScannerOpen(true)}
            >
              <span className="flex items-center justify-center gap-2">
                <Icon icon={ScanLine} size={15} />
                Scan member&rsquo;s QR code
              </span>
            </Button>

            <div className="my-4 text-center text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
              or find by phone
            </div>

            <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">
              MEMBER&rsquo;S PHONE
            </div>
            <input
              type="text"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void lookupByPhone()}
              placeholder="01711-000000"
              className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
            />
            <Button fullWidth onClick={lookupByPhone} disabled={!phone.trim() || lookingUp}>
              {lookingUp ? "Looking up…" : "Find member"}
            </Button>
          </>
        )}
      </Sheet>

      <QrScannerSheet
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title="Scan member QR"
        hint="Point the camera at the member's QR code (Profile → My QR code) — their name comes up and you assign the room."
        onScan={(text) => {
          const userId = parseMemberCode(text);
          if (!userId) {
            toast("That doesn't look like a member QR code");
            return;
          }
          void loadScanned(userId);
        }}
      />
    </>
  );
}
