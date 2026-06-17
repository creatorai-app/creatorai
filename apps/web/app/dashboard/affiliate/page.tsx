"use client";

import { AffiliateHub } from "@/components/dashboard/settings/AffiliateHub";

export default function AffiliatePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 py-8 md:py-12">
        <AffiliateHub />
      </div>
    </div>
  );
}
