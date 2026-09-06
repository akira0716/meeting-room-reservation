"use client";

import { useState } from "react";

export type Faq = { q: string; a: string };

/** LP（ランディングページ）専用のシンプルなアコーディオン。1問だけ開く単純な実装 */
export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex min-w-0 flex-col border-t border-black/10">
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={faq.q} className="border-b border-black/10">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left text-[15px] font-medium text-neutral-900"
            >
              <span>{faq.q}</span>
              <span className="shrink-0 font-mono text-lg text-emerald-700">{isOpen ? "−" : "＋"}</span>
            </button>
            {isOpen && (
              <p className="pb-5 pr-1 text-sm leading-[1.9] text-neutral-600">{faq.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
