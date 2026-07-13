"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { repo, type Room } from "@/lib/data";

const COMMON_FACILITIES = ["Attached bath", "AC", "Balcony", "Study desk", "Wardrobe", "Ceiling fan"];

export function RoomFormSheet({
  open,
  onClose,
  hostelId,
  room,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  /** null → create a new room; a Room → edit it. */
  room: Room | null;
}) {
  const { toast } = useToast();
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [seatRent, setSeatRent] = useState("");
  const [facilities, setFacilities] = useState<string[]>([]);
  const [facilityInput, setFacilityInput] = useState("");

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setNumber(room?.number ?? "");
        setCapacity(String(room?.capacity ?? 1));
        setSeatRent(room ? String(room.seatRent) : "");
        setFacilities(room?.facilities ?? []);
        setFacilityInput("");
      });
    }
  }, [open, room]);

  const addFacility = (f: string) => {
    const v = f.trim();
    if (v && !facilities.includes(v)) setFacilities((prev) => [...prev, v]);
    setFacilityInput("");
  };

  const removeFacility = (f: string) => setFacilities((prev) => prev.filter((x) => x !== f));

  const submit = async () => {
    if (!hostelId || !number.trim() || !capacity || !seatRent) return;
    const patch = {
      number: number.trim(),
      capacity: Math.max(1, Number(capacity)),
      seatRent: Number(seatRent),
      facilities,
    };
    if (room) {
      await repo.rooms.update(room.id, patch);
      toast(`Room ${patch.number} updated`);
    } else {
      await repo.rooms.create({ hostelId, ...patch });
      toast(`Room ${patch.number} added`);
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={room ? `Edit Room ${room.number}` : "Add room"}>
      <div className="mb-4 flex gap-3">
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">ROOM NO.</div>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="e.g. 105"
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
        <label className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">SEATS</div>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
        </label>
      </div>

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">SEAT RENT (৳ / MONTH)</div>
      <input
        type="number"
        value={seatRent}
        onChange={(e) => setSeatRent(e.target.value)}
        placeholder="e.g. 2200"
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">FACILITIES</div>
      {facilities.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {facilities.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => removeFacility(f)}
              className="flex items-center gap-1 rounded-pill bg-primary-soft px-2.5 py-1 text-[10.5px] font-extrabold text-primary"
            >
              {f}
              <Icon icon={X} size={11} />
            </button>
          ))}
        </div>
      )}
      <div className="mb-2 flex gap-2">
        <input
          type="text"
          value={facilityInput}
          onChange={(e) => setFacilityInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFacility(facilityInput);
            }
          }}
          placeholder="Add a facility"
          className="min-w-0 flex-1 rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
        />
        <button
          type="button"
          onClick={() => addFacility(facilityInput)}
          className="shrink-0 rounded-btn bg-primary px-4 text-[11.5px] font-extrabold text-white"
        >
          Add
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {COMMON_FACILITIES.filter((f) => !facilities.includes(f)).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => addFacility(f)}
            className="rounded-pill bg-bg px-2.5 py-1 text-[10px] font-bold text-text-secondary"
          >
            + {f}
          </button>
        ))}
      </div>

      <Button fullWidth onClick={submit} disabled={!number.trim() || !capacity || !seatRent}>
        {room ? "Save changes" : "Add room"}
      </Button>
    </Sheet>
  );
}
