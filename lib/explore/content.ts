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

export const JOBS: Job[] = [
  { id: "job_1", title: "Junior Frontend Developer", company: "Cefalo", location: "Banani, Dhaka", type: "Full-time", pay: "৳35,000–50,000/mo", tags: ["React", "TypeScript"] },
  { id: "job_2", title: "Content Writer (Part-time)", company: "10 Minute School", location: "Remote", type: "Part-time", pay: "৳15,000/mo", tags: ["Writing", "Bangla"] },
  { id: "job_3", title: "Data Entry Operator", company: "Pathao", location: "Gulshan, Dhaka", type: "Part-time", pay: "৳12,000/mo", tags: ["MS Excel"] },
  { id: "job_4", title: "Software Engineer Intern", company: "Brain Station 23", location: "Mohakhali, Dhaka", type: "Internship", pay: "৳20,000/mo", tags: ["Java", "Spring"] },
  { id: "job_5", title: "Campus Ambassador", company: "bKash", location: "Dhaka", type: "Part-time", pay: "৳8,000/mo + incentives", tags: ["Marketing"] },
  { id: "job_6", title: "Graphic Designer", company: "Shohoz", location: "Remote", type: "Remote", pay: "৳25,000/mo", tags: ["Figma", "Illustrator"] },
];

export interface Course {
  id: string;
  title: string;
  provider: string;
  category: "Programming" | "Business" | "Design" | "Language" | "Career";
  level: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  price: string;
}

export const COURSES: Course[] = [
  { id: "crs_1", title: "Complete Web Development", provider: "Programming Hero", category: "Programming", level: "Beginner", duration: "6 months", price: "৳9,900" },
  { id: "crs_2", title: "Spoken English Mastery", provider: "10 Minute School", category: "Language", level: "Beginner", duration: "8 weeks", price: "Free" },
  { id: "crs_3", title: "Digital Marketing Bootcamp", provider: "Bohubrihi", category: "Business", level: "Intermediate", duration: "3 months", price: "৳5,500" },
  { id: "crs_4", title: "UI/UX with Figma", provider: "Ostad", category: "Design", level: "Beginner", duration: "10 weeks", price: "৳6,000" },
  { id: "crs_5", title: "Data Structures & Algorithms", provider: "Coding Ninjas", category: "Programming", level: "Advanced", duration: "4 months", price: "৳12,000" },
  { id: "crs_6", title: "CV & Interview Prep", provider: "BDJobs Academy", category: "Career", level: "Beginner", duration: "2 weeks", price: "Free" },
];

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

export const BOOKS: BookListing[] = [
  { id: "bk_1", title: "Introduction to Algorithms (CLRS)", author: "Cormen et al.", price: 900, condition: "Good", seller: "Tanvir A.", phone: "01711-000008" },
  { id: "bk_2", title: "Fundamentals of Physics", author: "Halliday & Resnick", price: 650, condition: "Like new", seller: "Fahim C.", phone: "01711-000007" },
  { id: "bk_3", title: "Clean Code", author: "Robert C. Martin", price: 750, condition: "New", seller: "Karim R.", phone: "01711-000006" },
  { id: "bk_4", title: "Organic Chemistry", author: "Morrison & Boyd", price: 500, condition: "Fair", seller: "Nabila I.", phone: "01711-000009" },
  { id: "bk_5", title: "HSC Higher Math (1st Paper)", author: "Ketab Uddin", price: 220, condition: "Good", seller: "Rashed K.", phone: "01711-000002" },
  { id: "bk_6", title: "The Lean Startup", author: "Eric Ries", price: 480, condition: "Like new", seller: "Tanvir A.", phone: "01711-000008" },
];

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
export const EXTRA_HOSTELS: HostelListing[] = [
  { id: "eh_1", name: "Nokkhotro Boys Hostel", area: "Farmgate, Dhaka", seatRentFrom: 3500, seatsAvailable: 4, rating: 4.2, amenities: ["WiFi", "3 meals", "Generator"], phone: "01712-100200" },
  { id: "eh_2", name: "Shukonna Girls Hostel", area: "Dhanmondi, Dhaka", seatRentFrom: 4200, seatsAvailable: 2, rating: 4.6, amenities: ["WiFi", "AC", "CCTV", "3 meals"], phone: "01712-100201" },
  { id: "eh_3", name: "Campus View Hostel", area: "Nilkhet, Dhaka", seatRentFrom: 2800, seatsAvailable: 6, rating: 3.9, amenities: ["WiFi", "2 meals"], phone: "01712-100202" },
];

export interface CookListing {
  id: string;
  name: string;
  cuisine: string;
  experienceYears: number;
  monthlyRate: number;
  rating: number;
  phone: string;
}

export const COOKS: CookListing[] = [
  { id: "ck_1", name: "Rahima Begum", cuisine: "Bengali home food", experienceYears: 12, monthlyRate: 14000, rating: 4.8, phone: "01713-200300" },
  { id: "ck_2", name: "Abdul Karim", cuisine: "Bengali & Indian", experienceYears: 8, monthlyRate: 13000, rating: 4.5, phone: "01713-200301" },
  { id: "ck_3", name: "Shefali Akter", cuisine: "Bengali, veg-friendly", experienceYears: 6, monthlyRate: 11500, rating: 4.3, phone: "01713-200302" },
  { id: "ck_4", name: "Jamal Uddin", cuisine: "Bengali & Chinese", experienceYears: 15, monthlyRate: 16000, rating: 4.9, phone: "01713-200303" },
];

export interface Offer {
  id: string;
  shop: string;
  title: string;
  discount: string;
  code: string;
  expires: string;
  category: string;
}

export const OFFERS: Offer[] = [
  { id: "of_1", shop: "Foodpanda", title: "Flat ৳120 off on first 3 orders", discount: "৳120 off", code: "HOSTEL120", expires: "31 Aug", category: "Food" },
  { id: "of_2", shop: "Chaldal", title: "10% off groceries above ৳1000", discount: "10%", code: "FRESH10", expires: "25 Aug", category: "Grocery" },
  { id: "of_3", shop: "Daraz", title: "Student deal: ৳200 off electronics", discount: "৳200 off", code: "STUDENT200", expires: "5 Sep", category: "Shopping" },
  { id: "of_4", shop: "Pathao", title: "25% off next 5 rides", discount: "25%", code: "RIDE25", expires: "20 Aug", category: "Transport" },
  { id: "of_5", shop: "Rokomari", title: "Buy 2 books get 1 free", discount: "B2G1", code: "READMORE", expires: "10 Sep", category: "Books" },
];

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
export const GROCERY_SEED = [
  { id: "gr_1", name: "Miniket Rice", price: 78, unit: "1 kg", category: "Rice & Grains" },
  { id: "gr_2", name: "Red Lentil (Masoor Dal)", price: 135, unit: "1 kg", category: "Rice & Grains" },
  { id: "gr_3", name: "Soybean Oil", price: 168, unit: "1 L", category: "Oil & Spices" },
  { id: "gr_4", name: "Farm Eggs", price: 130, unit: "1 dozen", category: "Dairy & Eggs" },
  { id: "gr_5", name: "Potato", price: 45, unit: "1 kg", category: "Vegetables" },
  { id: "gr_6", name: "Onion", price: 55, unit: "1 kg", category: "Vegetables" },
  { id: "gr_7", name: "Broiler Chicken", price: 190, unit: "1 kg", category: "Meat & Fish" },
  { id: "gr_8", name: "Rui Fish", price: 320, unit: "1 kg", category: "Meat & Fish" },
  { id: "gr_9", name: "Banana", price: 48, unit: "1 dozen", category: "Fruits" },
  { id: "gr_10", name: "Powder Milk", price: 85, unit: "500 g", category: "Dairy & Eggs" },
  { id: "gr_11", name: "Sugar", price: 120, unit: "1 kg", category: "Oil & Spices" },
  { id: "gr_12", name: "Toilet Tissue", price: 60, unit: "4 rolls", category: "Household" },
];

/** Seed NEW-book inventory — shape matches the Product entity (kind "book"). */
export const NEW_BOOKS_SEED = [
  { id: "nb_1", name: "HSC Physics 1st Paper", author: "Dr. Shahjahan Tapan", price: 380, category: "Academic / Textbook", academicClass: "HSC (Class 11–12)" },
  { id: "nb_2", name: "SSC Higher Math", author: "S. U. Ahmed", price: 290, category: "Academic / Textbook", academicClass: "SSC (Class 9–10)" },
  { id: "nb_3", name: "Bank Job Question Bank", author: "Professor's", price: 450, category: "Competitive / Job", academicClass: "Admission" },
  { id: "nb_4", name: "English Grammar & Composition", author: "P. C. Das", price: 210, category: "Guide / Note", academicClass: "Class 8" },
  { id: "nb_5", name: "University Admission Guide", author: "Uttoron", price: 520, category: "Competitive / Job", academicClass: "Admission" },
  { id: "nb_6", name: "Class 5 Amar Bangla Boi", author: "NCTB", price: 120, category: "Academic / Textbook", academicClass: "Class 5" },
];

// ── Study abroad hub seeds (countries, scholarships, counsellors, promos) ──

export const STUDY_COUNTRIES = [
  { id: "sc_uk", name: "United Kingdom", flag: "🇬🇧", overview: "1-year master's degrees, strong scholarships, and a 2-year post-study work visa.", tuition: "£14,000–25,000/yr", livingCost: "£900–1,300/mo", workRights: "20 hrs/week + 2-yr Graduate Route", intakes: "Sep · Jan", universities: "Oxford · Manchester · Coventry · UEL · Greenwich", visa: "Student visa: CAS letter, ~£13,000 maintenance funds shown for 28 days, TB test", ielts: "IELTS 6.0–6.5 (many accept MOI from private universities)" },
  { id: "sc_ca", name: "Canada", flag: "🇨🇦", overview: "Affordable tuition, co-op programs, and one of the clearest paths to permanent residency.", tuition: "CA$15,000–30,000/yr", livingCost: "CA$1,000–1,500/mo", workRights: "24 hrs/week + up to 3-yr PGWP", intakes: "Sep · Jan · May", universities: "Toronto · UBC · Windsor · Manitoba · Conestoga", visa: "Study permit: LOA, GIC CA$20,635, proof of first-year tuition", ielts: "IELTS 6.0–6.5 (SDS stream needs 6.0 in each band)" },
  { id: "sc_au", name: "Australia", flag: "🇦🇺", overview: "High-ranked universities, a big Bangladeshi student community, and generous work rights.", tuition: "AU$20,000–35,000/yr", livingCost: "AU$1,400–1,800/mo", workRights: "48 hrs/fortnight + 2–4-yr post-study", intakes: "Feb · Jul", universities: "Melbourne · Monash · UNSW · Deakin · Wollongong", visa: "Subclass 500: GTE statement, OSHC health cover, ~AU$29,700 funds", ielts: "IELTS 6.0–6.5 (some accept PTE 50+)" },
  { id: "sc_de", name: "Germany", flag: "🇩🇪", overview: "Public universities charge little or no tuition — you mainly budget the blocked account.", tuition: "€0–1,500/yr (public)", livingCost: "€850–1,100/mo", workRights: "120 full days/yr + 18-mo job-seeker visa", intakes: "Oct · Apr", universities: "TU Munich · RWTH Aachen · TU Berlin · Stuttgart · Magdeburg", visa: "National visa: APS certificate, blocked account €11,904/yr, admission letter", ielts: "IELTS 6.0–6.5 for English programs · German B2 for German-taught" },
  { id: "sc_us", name: "United States", flag: "🇺🇸", overview: "The widest university choice — STEM assistantships can cover tuition and living fully.", tuition: "US$20,000–45,000/yr", livingCost: "US$1,000–1,800/mo", workRights: "On-campus 20 hrs/week + OPT/STEM-OPT", intakes: "Fall · Spring", universities: "ASU · UT Arlington · NEU · Wichita State · Troy", visa: "F-1 visa: I-20, SEVIS fee, embassy interview, ~1 year of funds shown", ielts: "IELTS 6.5+ / TOEFL 80+ · GRE for many STEM master's" },
];

/** Country-tagged articles shown inside each country's detail view. Paragraphs
 * separated by blank lines. */
export const STUDY_BLOGS = [
  {
    id: "blog_uk_apply",
    title: "How to apply to UK universities from Bangladesh",
    country: "United Kingdom",
    excerpt: "From choosing a course to getting your CAS — the whole journey in 6 steps.",
    author: "Sadia Rahman",
    body: "Start 8–10 months before your target intake. Shortlist 5–6 universities that match your CGPA and budget — league tables matter less than course content and city living costs.\n\nApply directly on university portals or through UCAS for undergrad. Most master's applications are free and need your transcripts, two references, an SOP, and your passport.\n\nOnce you get a conditional offer, meet the conditions (usually IELTS) and pay the deposit to receive your CAS. With the CAS you can book your visa appointment.\n\nFor the visa you must show 28-day-old maintenance funds — roughly the first year's tuition balance plus £9,207–£13,347 living costs depending on city.\n\nFinal tip: apply for Chevening or Commonwealth in parallel. The deadlines come earlier than university deadlines, so plan both timelines together.",
  },
  {
    id: "blog_uk_cost",
    title: "Real monthly budget of a Bangladeshi student in the UK",
    country: "United Kingdom",
    excerpt: "What London vs. smaller cities actually costs once you land.",
    author: "Sadia Rahman",
    body: "Outside London you can live on £800–1,000 a month: £450–550 for a room, £150 groceries, £60 transport, and the rest for phone, utilities, and occasional travel.\n\nLondon pushes rent alone to £700–900, which is why most students on a budget pick Midlands or northern cities.\n\nPart-time work at 20 hrs/week on minimum wage brings in roughly £900/month before tax — enough to cover living costs in most cities, but never count on it for tuition.\n\nOpen a student bank account in the first month and always pay rent through bank transfer — you will need the statements for future visa extensions.",
  },
  {
    id: "blog_de_blocked",
    title: "Germany's blocked account, explained simply",
    country: "Germany",
    excerpt: "What the Sperrkonto is, how much to load, and how you get the money back.",
    author: "Farid Hossain",
    body: "A blocked account (Sperrkonto) is a special bank account where you deposit one year of living costs — currently €11,904 — before applying for your German student visa.\n\nThe money stays yours. After you arrive and register, the bank releases €992 to you every month. It is proof of funds, not a fee.\n\nUse providers like Expatrio, Fintiba, or Coracle — they open the account online from Bangladesh in a few days and bundle health insurance, which the visa also requires.\n\nRemember the APS certificate is mandatory for Bangladeshi applicants since 2023 — book it before anything else, as verification can take 2–3 months.",
  },
  {
    id: "blog_ca_sds",
    title: "Canada SDS vs regular stream — which should you pick?",
    country: "Canada",
    excerpt: "SDS is faster but stricter. Here's how to decide in 5 minutes.",
    author: "Nusrat Sharmin",
    body: "SDS (Student Direct Stream) processes most study permits in about 4–6 weeks, versus 3+ months in the regular stream. But it demands IELTS 6.0 in every band and a CA$20,635 GIC.\n\nIf one IELTS band dipped to 5.5, you can still apply through the regular stream with stronger financial documents — bank statements, sponsor letters, and property papers.\n\nEither way, your Letter of Acceptance must come from a DLI (Designated Learning Institute) that is PGWP-eligible — always verify this list before paying any deposit.\n\nPay first-year tuition upfront if you can. It is the single strongest signal in a Canadian study permit file.",
  },
  {
    id: "blog_au_gte",
    title: "Writing a GTE statement that gets approved",
    country: "Australia",
    excerpt: "The GTE is where most Australian visa refusals happen. Avoid the traps.",
    author: "Tanim Ahmed",
    body: "The Genuine Temporary Entrant statement is a short essay explaining why you chose Australia, your course, and how it fits your career plan back home.\n\nBe specific: name the subjects in the course, compare it with local options in Bangladesh, and connect it to a realistic job outcome. Generic praise about 'world-class education' reads as template writing.\n\nExplain every gap in your study history honestly — a documented job or family reason is fine; an unexplained gap is a red flag.\n\nNever copy a sample from Facebook groups. Case officers see the same recycled paragraphs daily, and similarity alone can sink an otherwise strong file.",
  },
];

export const STUDY_SCHOLARSHIPS = [
  { id: "sch_chev", name: "Chevening Scholarship", country: "United Kingdom", coverage: "Full — tuition, living, flights", deadline: "Nov 2026", eligibility: "Bachelor's + 2 yrs work experience" },
  { id: "sch_comm", name: "Commonwealth Master's", country: "United Kingdom", coverage: "Full — tuition, stipend, airfare", deadline: "Dec 2026", eligibility: "First-class bachelor's, development subject" },
  { id: "sch_daad", name: "DAAD EPOS", country: "Germany", coverage: "Full — tuition + €992/mo stipend", deadline: "Oct 2026", eligibility: "Bachelor's + 2 yrs work experience" },
  { id: "sch_aus", name: "Australia Awards", country: "Australia", coverage: "Full — tuition, living, health cover", deadline: "Apr 2027", eligibility: "Bangladeshi citizens, development sectors" },
  { id: "sch_fulb", name: "Fulbright Foreign Student", country: "United States", coverage: "Full — tuition, stipend, insurance", deadline: "May 2027", eligibility: "Bachelor's, strong academics & leadership" },
];

export const STUDY_COUNSELLORS = [
  { id: "cns_1", name: "Sadia Rahman", countries: "UK · Canada", experienceYears: 8, phone: "01714-300500" },
  { id: "cns_2", name: "Tanim Ahmed", countries: "Australia · New Zealand", experienceYears: 6, phone: "01714-300501" },
  { id: "cns_3", name: "Farid Hossain", countries: "Germany · Europe", experienceYears: 10, phone: "01714-300502" },
  { id: "cns_4", name: "Nusrat Sharmin", countries: "USA · Canada", experienceYears: 7, phone: "01714-300503" },
];

export const STUDY_PROMOS = [
  { id: "pr_1", title: "Fall 2026 UK intake is open", tagline: "Free profile assessment with our UK counsellor this week — call now." },
  { id: "pr_2", title: "Study in Germany for free", tagline: "Public universities, no tuition fees. Join Saturday's online session." },
];
