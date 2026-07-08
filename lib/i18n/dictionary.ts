export type Locale = "en" | "bn";

export const dictionary = {
  // nav
  home: { en: "Home", bn: "হোম" },
  meals: { en: "Meals", bn: "খাবার" },
  bill: { en: "Bill", bn: "বিল" },
  more: { en: "More", bn: "আরও" },
  dashboard: { en: "Dashboard", bn: "ড্যাশবোর্ড" },
  approvals: { en: "Approvals", bn: "অনুমোদন" },
  finance: { en: "Finance", bn: "আর্থিক" },
  students: { en: "Students", bn: "শিক্ষার্থী" },
  overview: { en: "Overview", bn: "সারসংক্ষেপ" },
  hostels: { en: "Hostels", bn: "হোস্টেল" },
  reports: { en: "Reports", bn: "রিপোর্ট" },

  // meals
  breakfast: { en: "Breakfast", bn: "সকালের নাস্তা" },
  lunch: { en: "Lunch", bn: "দুপুরের খাবার" },
  dinner: { en: "Dinner", bn: "রাতের খাবার" },
  stopMeal: { en: "Stop meal", bn: "মিল বন্ধ করুন" },
  guestMeal: { en: "Guest meal", bn: "অতিথি মিল" },
  submit: { en: "Submit", bn: "জমা দিন" },

  // bill
  payBill: { en: "Pay bill", bn: "বিল পরিশোধ" },
  outstanding: { en: "Outstanding", bn: "বকেয়া" },
  payNow: { en: "Pay now", bn: "এখনই পরিশোধ করুন" },

  // common
  today: { en: "Today", bn: "আজ" },
  viewMenu: { en: "View menu", bn: "মেনু দেখুন" },
  shopping: { en: "Shopping", bn: "বাজার" },
  logOut: { en: "Log out", bn: "লগ আউট" },
  switchToStudentView: {
    en: "Switch to my boarder view",
    bn: "আমার বোর্ডার ভিউতে যান",
  },
  switchToManagerView: {
    en: "Back to manager view",
    bn: "ম্যানেজার ভিউতে ফিরে যান",
  },
  viewingAsBoarder: {
    en: "Viewing as boarder",
    bn: "বোর্ডার হিসেবে দেখছেন",
  },
} as const;

export type DictionaryKey = keyof typeof dictionary;
