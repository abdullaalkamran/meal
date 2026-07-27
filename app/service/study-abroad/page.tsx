"use client";

import { useState } from "react";
import {
  Award,
  Download,
  Globe2,
  Headset,
  Mail,
  Megaphone,
  Newspaper,
  Phone,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useStudyAbroadItems } from "@/hooks/useStudyAbroad";
import { useStudyLeads } from "@/hooks/useStudyLeads";
import { StudyAbroadFormSheet } from "@/components/service/StudyAbroadFormSheet";
import { ProductImage } from "@/components/store/ProductImage";
import { repo, type StudyAbroadItem, type StudyAbroadKind, type StudyLead } from "@/lib/data";
import { formatShortDate, today } from "@/lib/utils/date";

/** Excel-compatible export: UTF-8 CSV with BOM, quoted cells. */
function downloadLeadsExcel(leads: StudyLead[]) {
  const rows = [
    ["Name", "Number", "Email", "Interested country", "Last academic detail", "English test score", "Subjects", "Submitted", "Status"],
    ...leads.map((l) => [
      l.name,
      l.phone,
      l.email,
      l.interestedCountry,
      l.lastAcademic,
      l.englishTest,
      l.subjects,
      l.createdAt.slice(0, 10),
      l.contacted ? "Contacted" : "New",
    ]),
  ];
  const csv =
    "﻿" +
    rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `study-abroad-leads-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const KINDS: { kind: StudyAbroadKind; label: string; add: string; icon: typeof Globe2; tone: string }[] = [
  { kind: "country", label: "Countries", add: "Add country", icon: Globe2, tone: "bg-blue-soft text-blue" },
  { kind: "scholarship", label: "Scholarships", add: "Add scholarship", icon: Award, tone: "bg-orange-soft text-orange" },
  { kind: "counsellor", label: "Counsellors", add: "Add counsellor", icon: Headset, tone: "bg-primary-soft text-primary" },
  { kind: "blog", label: "Blogs", add: "Write post", icon: Newspaper, tone: "bg-blue-soft text-blue" },
  { kind: "promo", label: "Promos", add: "New promo", icon: Megaphone, tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]" },
];

function title(i: StudyAbroadItem): string {
  switch (i.kind) {
    case "country":
      return `${i.flag} ${i.name}`;
    case "scholarship":
      return i.name;
    case "counsellor":
      return i.name;
    case "promo":
      return i.title;
    case "blog":
      return i.title;
  }
}
function subtitle(i: StudyAbroadItem): string {
  switch (i.kind) {
    case "country":
      return `${i.tuition} · intakes ${i.intakes}`;
    case "scholarship":
      return `${i.country} · ${i.coverage} · due ${i.deadline}`;
    case "counsellor":
      return `${i.countries} · ${i.experienceYears} yrs · ${i.phone}`;
    case "promo":
      return i.tagline;
    case "blog":
      return `${i.country} · by ${i.author}`;
  }
}


export default function ServiceStudyAbroadPage() {
  const all = useStudyAbroadItems();
  const leads = useStudyLeads();
  const { toast } = useToast();
  const [tab, setTab] = useState<StudyAbroadKind | "leads">("country");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<{ item: StudyAbroadItem | null } | null>(null);

  const live = all.filter((i) => i.active).length;
  const newLeads = leads.filter((l) => !l.contacted).length;
  const activeKind = tab === "leads" ? null : KINDS.find((k) => k.kind === tab)!;
  const q = query.toLowerCase();
  const results = all.filter(
    (i) => i.kind === tab && `${title(i)} ${subtitle(i)}`.toLowerCase().includes(q)
  );
  const leadResults = leads.filter((l) =>
    `${l.name} ${l.interestedCountry} ${l.subjects}`.toLowerCase().includes(q)
  );

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Study abroad hub</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Countries, scholarships, counsellors &amp; promos for members
          </div>
        </div>
        {activeKind ? (
          <button
            type="button"
            onClick={() => setSheet({ item: null })}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-btn bg-primary px-3.5 text-[11.5px] font-extrabold text-white shadow-chip"
          >
            <Icon icon={Plus} size={15} /> {activeKind.add}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              downloadLeadsExcel(leads);
              toast("Excel file downloaded");
            }}
            disabled={leads.length === 0}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-btn bg-primary px-3.5 text-[11.5px] font-extrabold text-white shadow-chip disabled:opacity-50"
          >
            <Icon icon={Download} size={15} /> Excel
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="flex flex-col items-center gap-1 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-soft text-blue">
            <Icon icon={Globe2} size={15} />
          </div>
          <div className="text-[15px] font-extrabold leading-none">{all.length}</div>
          <div className="text-[9px] font-bold text-text-secondary">Hub items</div>
        </Card>
        <Card className="flex flex-col items-center gap-1 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon icon={Award} size={15} />
          </div>
          <div className="text-[15px] font-extrabold leading-none">{live}</div>
          <div className="text-[9px] font-bold text-text-secondary">Live to members</div>
        </Card>
        <button type="button" onClick={() => { setTab("leads"); setQuery(""); }} className="cursor-pointer">
          <Card className="flex flex-col items-center gap-1 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={UsersRound} size={15} />
            </div>
            <div className="text-[15px] font-extrabold leading-none">{leads.length}</div>
            <div className="text-[9px] font-bold text-text-secondary">
              Leads{newLeads > 0 ? ` · ${newLeads} new` : ""}
            </div>
          </Card>
        </button>
      </div>

      {/* Kind tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {KINDS.map((k) => {
          const count = all.filter((i) => i.kind === k.kind).length;
          const isActive = tab === k.kind;
          return (
            <button
              key={k.kind}
              type="button"
              onClick={() => {
                setTab(k.kind);
                setQuery("");
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-2 text-[10.5px] font-extrabold ${
                isActive ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
              }`}
            >
              <Icon icon={k.icon} size={13} />
              {k.label}
              <span className={`rounded-pill px-1.5 py-0.5 text-[8.5px] ${isActive ? "bg-white/25" : "bg-bg"}`}>
                {count}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setTab("leads");
            setQuery("");
          }}
          className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-2 text-[10.5px] font-extrabold ${
            tab === "leads" ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
          }`}
        >
          <Icon icon={UsersRound} size={13} />
          Leads
          <span className={`rounded-pill px-1.5 py-0.5 text-[8.5px] ${tab === "leads" ? "bg-white/25" : "bg-bg"}`}>
            {leads.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={activeKind ? `Search ${activeKind.label.toLowerCase()}` : "Search leads by name, country, subject"}
          className="w-full rounded-btn border border-border bg-card py-2.5 pl-9 pr-3 text-[12px] font-bold shadow-chip"
        />
      </div>

      {/* Home-carousel controls now live in Service → Home page promotions,
          so every promo source is managed in one place. */}

      {!activeKind ? (
        leadResults.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon icon={UsersRound} size={26} className="text-text-secondary" />
            <div className="text-[12px] font-extrabold">No leads yet</div>
            <div className="text-[10.5px] font-semibold text-text-secondary">
              Eligibility-check submissions from members land here.
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-wide text-text-secondary">
              <span>{leadResults.length} lead{leadResults.length > 1 ? "s" : ""}</span>
              <span>Excel button downloads all</span>
            </div>
            {leadResults.map((l) => (
              <Card key={l.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-extrabold">{l.name}</div>
                    <div className="text-[9.5px] font-semibold text-text-secondary">
                      {formatShortDate(l.createdAt.slice(0, 10))} · wants {l.interestedCountry}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => repo.studyLeads.setContacted(l.id, !l.contacted)}
                    className={`shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                      l.contacted ? "bg-primary-soft text-primary" : "bg-orange-soft text-orange"
                    }`}
                  >
                    {l.contacted ? "Contacted ✓" : "New — mark contacted"}
                  </button>
                </div>
                <div className="flex flex-col gap-1 rounded-btn bg-bg px-3 py-2.5 text-[10.5px] font-semibold text-text-secondary">
                  <div>🎓 {l.lastAcademic}</div>
                  <div>🗣️ English: {l.englishTest}</div>
                  {l.subjects && <div>📚 {l.subjects}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${l.phone}`}
                    className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-btn bg-primary-soft text-[11px] font-extrabold text-primary"
                  >
                    <Icon icon={Phone} size={13} /> {l.phone}
                  </a>
                  {l.email && (
                    <a
                      href={`mailto:${l.email}`}
                      className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-btn bg-blue-soft text-[11px] font-extrabold text-blue"
                    >
                      <Icon icon={Mail} size={13} /> Email
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await repo.studyLeads.remove(l.id);
                      toast("Lead removed");
                    }}
                    aria-label="Remove lead"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                  >
                    <Icon icon={Trash2} size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : results.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon icon={activeKind.icon} size={26} className="text-text-secondary" />
          <div className="text-[12px] font-extrabold">No {activeKind.label.toLowerCase()} yet</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            {tab === "promo"
              ? "Publish a promo card — every member gets notified."
              : "Add one with the button above."}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-wide text-text-secondary">
            <span>{results.length} item{results.length > 1 ? "s" : ""}</span>
            <span>Tap an item to edit</span>
          </div>
          {results.map((i) => (
            <Card key={i.id} className={`flex items-center gap-3 ${i.active ? "" : "opacity-55"}`}>
              <button
                type="button"
                onClick={() => setSheet({ item: i })}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                {"image" in i && i.image ? (
                  <ProductImage image={i.image} kind="book" alt={title(i)} className="h-12 w-12 shrink-0 rounded-btn" />
                ) : (
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-btn ${activeKind.tone}`}>
                    <Icon icon={activeKind.icon} size={19} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-extrabold">{title(i)}</div>
                  <div className="mt-0.5 truncate text-[9.5px] font-semibold text-text-secondary">{subtitle(i)}</div>
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Switch checked={i.active} onChange={() => repo.studyAbroad.toggleActive(i.id)} />
                <span className={`text-[8.5px] font-extrabold ${i.active ? "text-primary" : "text-text-secondary"}`}>
                  {i.active ? "LIVE" : "HIDDEN"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <StudyAbroadFormSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        kind={sheet?.item ? sheet.item.kind : tab === "leads" ? "country" : tab}
        item={sheet?.item}
      />
    </div>
  );
}
