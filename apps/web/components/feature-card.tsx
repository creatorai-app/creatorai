import type React from "react";
import { GlowingEffect } from "@repo/ui/glowing-effect";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    // The list semantics live on the caller's <li> wrapper: a <ul> may only
    // directly contain <li>, and every caller wraps this card in an animated
    // element, so the card itself stays a plain div.
    <div className="h-full min-h-[14rem] focus-within:ring-2 focus-within:ring-purple-500 rounded-3xl transition">
      <div className="relative h-full rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10 dark:hover:shadow-purple-400/5 hover:scale-[1.02]">
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={1.7}
        />
        <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-white dark:bg-slate-800/50 p-4 md:p-6">
          <div className="flex flex-1 flex-col justify-between gap-4">
            <div className="w-fit rounded-xl border border-slate-100 dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20 p-3 shadow-sm">
              {icon}
            </div>
            <div className="space-y-2">
              <h3 className="font-sans text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                {title}
              </h3>
              <p className="font-sans text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
