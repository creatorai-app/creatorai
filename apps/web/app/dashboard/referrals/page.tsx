"use client"

import { useState, useEffect } from "react"
import { Button } from "@repo/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card"
import { Badge } from "@repo/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs"
import { useSupabase } from "@/components/supabase-provider"
import { Copy, Gift, Users, Clock, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { ReferralPageSkeleton } from "@/components/dashboard/referrals/ReferralSkeleton"
import { api } from "@/lib/api-client"

// Helper function for better time formatting
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  } else if (diffInHours < 48) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
};

interface ReferralData {
  referralCode: string;
  totalReferrals: number;
  referralCredits: number;
  userProfile: {
    full_name: string;
    avatar_url: string | null;
  };
  pendingReferrals: Array<{
    id: string;
    referred_user_id: string | null;
    status: string;
    created_at: string;
    referred_email: string;
  }>;
  completedReferrals: Array<{
    id: string;
    referred_user_id: string;
    status: string;
    credits_awarded: number;
    created_at: string;
    completed_at: string;
    referred_email: string;
    referred_user: {
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
}

export default function Referrals() {
  const { user } = useSupabase()
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingCode, setGeneratingCode] = useState(false)

  useEffect(() => {
    if (user) {
      fetchReferralData()
    }
  }, [user])

  const fetchReferralData = async () => {
    try {
      const data = await api.get<ReferralData>("/api/v1/referral", { requireAuth: true })
      setReferralData(data)
    } catch (error: any) {
      toast.error("Error fetching referral data", { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const generateReferralCode = async () => {
    setGeneratingCode(true)
    try {
      const data = await api.post<{ referralCode: string }>("/api/v1/referral/generate", undefined, { requireAuth: true })
      toast.success("Referral code generated!", { description: `Your code: ${data.referralCode}` })
      await fetchReferralData()
    } catch (error: any) {
      toast.error("Error generating referral code", { description: error.message })
    } finally {
      setGeneratingCode(false)
    }
  }

  const copyReferralLink = async () => {
    if (!referralData?.referralCode) return;

    const referralLink = `${window.location.origin}/signup?ref=${referralData.referralCode}`;

    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Referral link copied!", { description: "Share this link with friends" });
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = referralLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Referral link copied!", { description: "Share this link with friends" });
    }
  };

  const handleShareReferral = async () => {
    if (!referralData?.referralCode) return;

    const referralLink = `${window.location.origin}/signup?ref=${referralData.referralCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Creator AI",
          text: "Check out Creator AI - an AI assistant for YouTubers. Use my referral link to get started:",
          url: referralLink,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      copyReferralLink();
    }
  };

  if (loading) {
    return <ReferralPageSkeleton />;
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Referral Program</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Invite friends and earn credits when they upgrade</p>
      </div>

      {/* How the reward works */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-sm text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Earn 1,000 credits per paid referral</p>
          <p className="mt-1 text-amber-800/90 dark:text-amber-200/80">
            When someone subscribes to a paid plan using your referral link, you
            get <strong>1,000 credits</strong>, and they get <strong>1,000 bonus credits</strong> too.
            Rewards are granted on their first purchase only. There is no sign-up bonus.
          </p>
        </div>
      </div>

      {/* User Profile Section */}
      {referralData?.userProfile && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                {referralData.userProfile.avatar_url ? (
                  <img
                    src={referralData.userProfile.avatar_url}
                    alt={referralData.userProfile.full_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-medium text-slate-600 dark:text-slate-300">
                    {referralData.userProfile.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{referralData.userProfile.full_name}</h2>
                <p className="text-slate-600 dark:text-slate-400">Referral Program Member</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralData?.totalReferrals || 0}</div>
            <p className="text-xs text-muted-foreground">People you've referred</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referral Credits</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralData?.referralCredits || 0}</div>
            <p className="text-xs text-muted-foreground">Credits earned from paid referrals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Referrals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referralData?.pendingReferrals?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Referral Code</CardTitle>
          <CardDescription>
            Share your link, you earn 1,000 credits when a friend subscribes to a paid plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referralData?.referralCode ? (
            <div className="flex items-center gap-4">
              <div className="flex-1 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-lg">
                {referralData.referralCode}
              </div>
              <Button onClick={copyReferralLink} className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                You don't have a referral code yet
              </p>
              <Button
                onClick={generateReferralCode}
                disabled={generatingCode}
                className="flex items-center gap-2"
              >
                {generatingCode ? "Generating..." : "Generate Referral Code"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referrals Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({referralData?.pendingReferrals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed ({referralData?.completedReferrals?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-500 border-t-transparent"></div>
            </div>
          ) : referralData?.pendingReferrals?.length ? (
            referralData.pendingReferrals.map((referral) => (
              <Card key={referral.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {referral.referred_email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {referral.referred_email}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Referred {formatTime(referral.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Referral ID: {referral.id.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-2">
                        Awaiting Purchase
                      </Badge>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Earns 1,000 credits when they upgrade
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  No pending referrals yet. Share your referral link to get started!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {referralData?.completedReferrals?.length ? (
            referralData.completedReferrals.map((referral) => (
              <Card key={referral.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {referral.referred_user?.full_name || referral.referred_email}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {referral.referred_email}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Completed {formatTime(referral.completed_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Referral ID: {referral.id.slice(0, 8)}... • Created {formatTime(referral.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="mb-2 bg-green-600 hover:bg-green-700">
                        +{referral.credits_awarded || 1000} Credits
                      </Badge>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        Upgraded to a paid plan
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  No completed referrals yet. Complete referrals to earn credits!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
