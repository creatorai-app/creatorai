"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@repo/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/avatar";
import { LogOut, Settings, UserPlus, Coins, BarChart3, Gift, Handshake } from "lucide-react";
import { useSupabase } from "@/components/supabase-provider";
import { toast } from "sonner";
import { Separator } from "@repo/ui/separator";

export default function DashboardHeader() {
  const pathname = usePathname();
  const { user, profile: initialProfile, logout } = useSupabase();
  const [pageTitle, setPageTitle] = useState("");
  const [profile, setProfile] = useState(initialProfile);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    const path = pathname.split("/").filter(Boolean);
    if (path.length === 1) {
      setPageTitle("Dashboard");
    } else {
      const title = path[1] ? path[1].charAt(0).toUpperCase() + path[1].slice(1) : "";
      setPageTitle(title);
    }
    // Close the popover when the pathname changes
    setIsPopoverOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    toast.success("Logged out successfully");
    router.replace("/");
    logout();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/40 bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex-1">
        <h1 className="text-lg font-semibold">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard/referrals">
                <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/20">
                  <Gift className="h-3.5 w-3.5" />
                  Refer & Earn 1,000 Credits
                </Button>
                <Button variant="outline" size="icon" className="sm:hidden border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400">
                  <Gift className="h-4 w-4" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-center">
              Earn 1,000 credits when a friend subscribes to a paid plan using
              your link and they get 1,000 bonus credits too. Rewards apply on
              purchase only, not at sign-up.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Link href="/dashboard/settings?tab=usage">
          <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 px-3.5 py-1.5 text-sm ring-1 ring-purple-500/20 dark:ring-purple-400/20 cursor-pointer hover:ring-purple-500/40 dark:hover:ring-purple-400/40 transition-all">
            <Coins className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold bg-gradient-to-r from-purple-700 to-indigo-600 dark:from-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
              {profile?.credits || "0"}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">credits</span>
          </div>
        </Link>

        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="p-0 w-9 h-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage
                  src={profile?.avatar_url || ""}
                  alt="User avatar"
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-black dark:text-white">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ||
                    user?.email?.charAt(0)?.toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-64 rounded-xl border-border/20 bg-background/95 p-0 backdrop-blur-md"
            align="end"
            sideOffset={12}
          >
            <div className="flex flex-col">
              {/* User Info Section */}
              <div className="p-4">
                <p className="font-semibold text-md text-foreground">
                  {profile?.full_name || "User"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user?.email}
                </p>
              </div>

              <Separator className="bg-border/50" />

              {/* Links Section */}
              <div className="p-2">
                <Link href="/dashboard/channel-stats">
                  <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                    <BarChart3 className="h-4 w-4" />
                    Channel Stats
                  </Button>
                </Link>
                <Link href="/dashboard/settings">
                  <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Button>
                </Link>
                <Link href="/dashboard/referrals">
                  <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                    <UserPlus className="h-4 w-4" />
                    Referrals
                  </Button>
                </Link>
                <Link href="/dashboard/affiliate">
                  <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                    <Handshake className="h-4 w-4" />
                    Affiliate Hub
                  </Button>
                </Link>
              </div>

              <Separator className="bg-border/50" />

              {/* Logout Section */}
              <div className="p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2 text-red-500 hover:text-red-500 hover:bg-red-500/10"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}