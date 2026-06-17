"use client";

import { Suspense, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BarChart3, Bell, CreditCard, UserCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { ProfileSettingsForm } from "@/components/dashboard/settings/ProfileSettingsForm";
import { NotificationSettingsForm } from "@/components/dashboard/settings/NotificationSettingsForm";
import { BillingInfo } from "@/components/dashboard/settings/BillingInfo";
import { UsageInfo } from "@/components/dashboard/settings/UsageInfo";

type NavItemId = "profile" | "notifications" | "billing" | "usage";

interface NavItem {
  id: NavItemId;
  icon: typeof UserCircle;
  label: string;
  description: string;
}

export default function Settings() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // The affiliate hub moved to its own page; redirect old ?tab=affiliate links.
  useEffect(() => {
    if (searchParams.get("tab") === "affiliate") {
      router.replace("/dashboard/affiliate");
    }
  }, [searchParams, router]);

  const initialTab = (searchParams.get("tab") as NavItemId) || "profile";
  const validTabs: NavItemId[] = ["profile", "notifications", "billing", "usage"];
  const [activeTab, setActiveTab] = useState<NavItemId>(
    validTabs.includes(initialTab) ? initialTab : "profile",
  );

  const navItems: NavItem[] = useMemo(
    () => [
      {
        id: "profile",
        icon: UserCircle,
        label: "Profile",
        description: "Manage your personal information"
      },
      {
        id: "notifications",
        icon: Bell,
        label: "Notifications",
        description: "Control your notification preferences"
      },
      {
        id: "usage",
        icon: BarChart3,
        label: "Usage",
        description: "Track your credit consumption"
      },
      {
        id: "billing",
        icon: CreditCard,
        label: "Billing",
        description: "View subscription and payment details"
      }
    ],
    []
  );

  const handleTabChange = useCallback((tabId: NavItemId) => {
    setActiveTab(tabId);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, tabId: NavItemId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleTabChange(tabId);
    }
  }, [handleTabChange]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6 py-8 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12"
        >
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Settings
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Manage your account, preferences, and billing information.
          </p>
        </motion.div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-16">
          {/* Desktop Sidebar Navigation */}
          <aside className="hidden w-full md:flex md:w-1/4 lg:w-1/5">
            <nav
              className="flex w-full flex-col space-y-1 relative"
              aria-label="Settings navigation"
            >
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    onKeyDown={(e) => handleKeyDown(e, item.id)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`${item.label} settings`}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                      ${isActive
                        ? "text-purple-700 dark:text-purple-300"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      }
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-desktop-tab"
                        className="absolute inset-0 rounded-lg bg-purple-100 dark:bg-purple-900/30"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <item.icon className="h-5 w-5 relative z-10 flex-shrink-0" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="flex-1">
            {/* Mobile Tab Bar with Labels */}
            <nav
              className="relative mb-6 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-slate-800/60 md:hidden"
              aria-label="Settings navigation"
            >
              <div className="flex items-center relative justify-around gap-1">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      onKeyDown={(e) => handleKeyDown(e, item.id)}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={`${item.label} settings`}
                      className="relative z-10 rounded-xl p-2 flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    >
                      <item.icon
                        className={`h-5 w-5 transition-colors ${isActive
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-slate-500 dark:text-slate-400"
                          }`}
                      />
                      <span className={`text-xs font-medium transition-colors ${isActive
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-slate-600 dark:text-slate-400"
                        }`}>
                        {item.label}
                      </span>
                      {isActive && (
                        <motion.div
                          layoutId="active-settings-tab"
                          className="absolute inset-0 -z-10 rounded-xl bg-purple-50 shadow-sm dark:bg-purple-900/30"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Content Area with Enhanced Transitions */}
            <div role="region" aria-live="polite" aria-atomic="true">
              <AnimatePresence mode="wait">
                {activeTab === "profile" && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <ProfileSettingsForm />
                  </motion.div>
                )}

                {activeTab === "notifications" && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <NotificationSettingsForm />
                  </motion.div>
                )}

                {activeTab === "billing" && (
                  <motion.div
                    key="billing"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <BillingInfo />
                  </motion.div>
                )}

                {activeTab === "usage" && (
                  <motion.div
                    key="usage"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <UsageInfo />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}