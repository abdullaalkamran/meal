"use client";

import { useEffect, useState } from "react";
import { repo, type StudyLead } from "@/lib/data";

/** All study-abroad eligibility leads, newest first — Service Manager CRM. */
export function useStudyLeads(): StudyLead[] {
  const [leads, setLeads] = useState<StudyLead[]>([]);
  useEffect(() => repo.studyLeads.subscribe(setLeads), []);
  return leads;
}
