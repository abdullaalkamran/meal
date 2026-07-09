"use client";

import { Sheet } from "@/components/ui/Sheet";

const STEPS = [
  "ফোনের Settings (সেটিংস) এ যান",
  "System বা General management → Languages & input (ভাষা ও ইনপুট) এ যান",
  "Text-to-speech output (টেক্সট-টু-স্পিচ আউটপুট) এ ট্যাপ করুন",
  "Preferred engine এ Google Text-to-Speech Engine বাছাই আছে কিনা দেখুন, পাশের ⚙️ আইকনে ট্যাপ করুন",
  "Install voice data → তালিকা থেকে বাংলা (Bangla/Bengali) খুঁজে ডাউনলোড করুন",
  "ডাউনলোড শেষ হলে এই অ্যাপে ফিরে এসে আবার “বাংলায় শুনুন” বাটনে চাপুন",
];

export function BanglaVoiceHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="বাংলা ভয়েস চালু করুন">
      <div className="mb-4 text-[11px] font-semibold text-text-secondary">
        এই ফোনে এখনো বাংলা ভয়েস ইনস্টল করা নেই। নিচের ধাপগুলো অনুসরণ করে বিনামূল্যে ইনস্টল করুন —
        একবার করলেই হবে।
      </div>
      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-extrabold text-primary">
              {i + 1}
            </div>
            <div className="text-[12px] font-semibold leading-relaxed">{step}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-[10px] font-semibold text-text-secondary">
        ফোনের ব্র্যান্ড অনুযায়ী মেনুর নাম কিছুটা ভিন্ন হতে পারে (যেমন Samsung এ Accessibility এর
        ভেতরেও এটি থাকতে পারে)।
      </div>
    </Sheet>
  );
}
