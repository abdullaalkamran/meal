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
