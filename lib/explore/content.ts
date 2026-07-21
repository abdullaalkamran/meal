// Seeded browse content for the shared /explore lifestyle & community section.
// Pure data — every item has a stable `id` so a user's persisted interactions
// (applied/enrolled/saved/grabbed) reference it.

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "Full-time" | "Part-time" | "Internship" | "Remote";
  pay: string;
  tags: string[];
}


export interface Course {
  id: string;
  title: string;
  provider: string;
  category: "Programming" | "Business" | "Design" | "Language" | "Career";
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  price: string;
}


export interface Investment {
  id: string;
  name: string;
  provider: string;
  risk: "Low" | "Medium" | "High";
  /** Expected annual return, e.g. 0.11 = 11% */
  annualReturn: number;
  minAmount: number;
  note: string;
}

export const INVESTMENTS: Investment[] = [
  { id: "inv_1", name: "DPS (Monthly Savings)", provider: "DBBL", risk: "Low", annualReturn: 0.08, minAmount: 500, note: "Fixed monthly deposit, guaranteed return." },
  { id: "inv_2", name: "Sanchayapatra", provider: "Bangladesh Bank", risk: "Low", annualReturn: 0.11, minAmount: 1000, note: "Govt savings certificate, very safe." },
  { id: "inv_3", name: "Mutual Fund (SIP)", provider: "IDLC Asset Mgmt", risk: "Medium", annualReturn: 0.14, minAmount: 1000, note: "Diversified, market-linked returns." },
  { id: "inv_4", name: "Gold Savings", provider: "Gold Kinen", risk: "Medium", annualReturn: 0.1, minAmount: 500, note: "Buy fractional digital gold." },
  { id: "inv_5", name: "Stock Market (DSE)", provider: "Your brokerage", risk: "High", annualReturn: 0.18, minAmount: 5000, note: "Higher risk, higher potential return." },
];

export interface BookListing {
  id: string;
  title: string;
  author: string;
  price: number;
  condition: "New" | "Like new" | "Good" | "Fair";
  seller: string;
  phone: string;
}


export interface HostelListing {
  id: string;
  name: string;
  area: string;
  seatRentFrom: number;
  seatsAvailable: number;
  rating: number;
  amenities: string[];
  phone: string;
}

// Extra listings that supplement the real hostels from repo.hostels.listAll().

export interface CookListing {
  id: string;
  name: string;
  cuisine: string;
  experienceYears: number;
  monthlyRate: number;
  rating: number;
  phone: string;
}


export interface Offer {
  id: string;
  shop: string;
  title: string;
  discount: string;
  code: string;
  expires: string;
  category: string;
}


// ── Store taxonomy + seed inventory (grocery + books) ──────────────────────

export const GROCERY_CATEGORIES = [
  "Rice & Grains",
  "Vegetables",
  "Fruits",
  "Dairy & Eggs",
  "Meat & Fish",
  "Oil & Spices",
  "Snacks",
  "Beverages",
  "Household",
  "Others",
] as const;

export const BOOK_CATEGORIES = [
  "Academic / Textbook",
  "Guide / Note",
  "Novel / Story",
  "Religious",
  "Competitive / Job",
  "Others",
] as const;

/** Bangladesh academic classes, used by both new (platform) and old (member) books. */
export const BD_ACADEMIC_CLASSES = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "SSC (Class 9–10)",
  "HSC (Class 11–12)",
  "Admission",
  "Honors / University",
  "Others",
] as const;

/** Seed grocery inventory — shape matches the Product entity (kind "grocery").
 * No seed photos: cards fall back to a neutral icon until the Service Manager
 * uploads one. */

/** Seed NEW-book inventory — shape matches the Product entity (kind "book"). */

// ── Study abroad hub seeds (countries, scholarships, counsellors, promos) ──


/** Country-tagged articles shown inside each country's detail view. Paragraphs
 * separated by blank lines. */



