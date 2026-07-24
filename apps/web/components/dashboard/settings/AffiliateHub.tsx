"use client";

import { useMemo, useState } from "react";
import * as motion from "motion/react-m";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import { Label } from "@repo/ui/label";
import { Badge } from "@repo/ui/badge";
import { Skeleton } from "@repo/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/tooltip";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Wallet,
  Clock,
  TrendingUp,
  MousePointerClick,
  Plus,
  Copy,
  Trash2,
  Ticket,
  Banknote,
  ArrowUpRight,
  Link2,
  Info,
  Repeat,
  ShieldCheck,
  Hourglass,
  PiggyBank,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAffiliateHub, affiliateHubApi } from "@/hooks/useAffiliateHub";
import { getApiErrorMessage } from "@/lib/api-client";
import type {
  AffiliateWithdrawal,
  PayoutMethodType,
} from "@repo/validation";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_STYLES: Record<string, string> = {
  requested: "border-amber-200 text-amber-600 dark:border-amber-800 dark:text-amber-400",
  approved: "border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400",
  paid: "border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400",
  rejected: "border-rose-200 text-rose-600 dark:border-rose-800 dark:text-rose-400",
  pending: "border-amber-200 text-amber-600 dark:border-amber-800 dark:text-amber-400",
  confirmed: "border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400",
  refunded: "border-rose-200 text-rose-600 dark:border-rose-800 dark:text-rose-400",
};

const PAYOUT_FIELDS: Record<PayoutMethodType, { key: string; label: string }[]> = {
  paypal: [{ key: "email", label: "PayPal email" }],
  wise: [{ key: "email", label: "Wise email" }],
  bank: [
    { key: "account_name", label: "Account holder name" },
    { key: "account_number", label: "Account number / IBAN" },
    { key: "bank_name", label: "Bank name" },
    { key: "swift", label: "SWIFT / routing" },
  ],
};

export function AffiliateHub() {
  const {
    stats,
    links,
    promoCodes,
    sales,
    payoutMethod,
    withdrawals,
    loading,
    refresh,
  } = useAffiliateHub();

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const chartData = useMemo(
    () =>
      (stats?.earnings ?? []).map((e) => ({
        commission: e.commission,
        label: new Date(e.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
      })),
    [stats?.earnings],
  );

  if (loading) return <HubSkeleton />;

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${baseUrl}/?ref=${code}`);
    toast.success("Affiliate link copied");
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Promo code copied");
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <HubHeader />

        <ProgramHighlights minWithdrawal={stats?.minWithdrawal ?? 50} />

        <StatCards stats={stats} />

        <SecondaryStats stats={stats} />

        <EarningsChart chartData={chartData} />

        <LinksSection links={links} onCopy={copyLink} onChanged={refresh} />

        <PromoCodesSection promoCodes={promoCodes} onCopy={copyCode} baseUrl={baseUrl} />

        <WithdrawalsSection
          available={stats?.availableBalance ?? 0}
          minWithdrawal={stats?.minWithdrawal ?? 50}
          payoutMethod={payoutMethod}
          withdrawals={withdrawals}
          onChanged={refresh}
        />

        <SalesSection sales={sales} />
      </div>
    </TooltipProvider>
  );
}

function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          className="inline-flex text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function HubHeader() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-200/60 dark:border-purple-900/40 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-purple-950/30 dark:via-slate-900 dark:to-indigo-950/30 p-6">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-purple-300/20 blur-3xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Use, promote and Earn
            </h1>
            <Badge className="bg-purple-600 text-white hover:bg-purple-600 gap-1">
              <Repeat className="h-3 w-3" /> 20% recurring
            </Badge>
          </div>
          <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Share your links and promo codes, earn 20% recurring commission on every
            subscription you refer, and withdraw your earnings whenever you like.
          </p>
        </div>
        <Link
          href="/affiliate-program"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white/70 dark:bg-slate-900/50 px-3 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-white dark:hover:bg-slate-900 transition-colors"
        >
          <Sparkles className="h-4 w-4" /> How the program works
        </Link>
      </div>
    </div>
  );
}

function ProgramHighlights({ minWithdrawal }: { minWithdrawal: number }) {
  const items = [
    {
      icon: TrendingUp,
      label: "Commission",
      value: "20%",
      hint: "You earn 20% of every payment made by customers you refer, for as long as they stay subscribed (up to 12 billing cycles).",
      accent: "text-purple-500",
    },
    {
      icon: Repeat,
      label: "Recurring",
      value: "Up to 12 mo",
      hint: "Commission repeats on each successful monthly renewal of a referred subscription, capped at 12 payments per customer.",
      accent: "text-indigo-500",
    },
    {
      icon: Hourglass,
      label: "Holding period",
      value: "30 days",
      hint: "New commissions are 'pending' for 30 days to cover refunds. After that they mature into your available balance.",
      accent: "text-amber-500",
    },
    {
      icon: PiggyBank,
      label: "Min. payout",
      value: usd(minWithdrawal),
      hint: `You can request a withdrawal once your available (matured) balance reaches ${usd(minWithdrawal)}.`,
      accent: "text-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4"
        >
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
            <it.icon className={`h-4 w-4 ${it.accent}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {it.label}
              <InfoHint text={it.hint} />
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              {it.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SecondaryStats({ stats }: { stats: ReturnType<typeof useAffiliateHub>["stats"] }) {
  const items = [
    { icon: ShieldCheck, label: "Total withdrawn", value: usd(stats?.totalWithdrawn ?? 0), hint: "Total commission you've already been paid out." },
    { icon: Clock, label: "Reserved", value: usd(stats?.reservedBalance ?? 0), hint: "Amount locked in requested or approved withdrawals that haven't been paid yet." },
    { icon: MousePointerClick, label: "Total clicks", value: (stats?.totalClicks ?? 0).toLocaleString(), hint: "Combined clicks across all of your affiliate links." },
    { icon: Link2, label: "Active links", value: (stats?.totalLinks ?? 0).toLocaleString(), hint: "Number of affiliate tracking links you've created." },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 px-4 py-3"
        >
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <it.icon className="h-3.5 w-3.5" />
            {it.label}
            <InfoHint text={it.hint} />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCards({ stats }: { stats: ReturnType<typeof useAffiliateHub>["stats"] }) {
  const cards = [
    {
      label: "Available Balance",
      value: usd(stats?.availableBalance ?? 0),
      icon: Wallet,
      bar: "from-emerald-400 to-teal-500",
      accent: "text-emerald-500",
      hint: "Matured commission that's ready to withdraw right now (lifetime earnings minus pending, withdrawn and reserved amounts).",
    },
    {
      label: "Pending Earnings",
      value: usd(stats?.pendingEarnings ?? 0),
      icon: Clock,
      bar: "from-amber-400 to-orange-500",
      accent: "text-amber-500",
      hint: "Commission earned but still inside the 30-day holding window. It becomes available once it matures.",
    },
    {
      label: "Lifetime Earnings",
      value: usd(stats?.lifetimeEarnings ?? 0),
      icon: TrendingUp,
      bar: "from-purple-500 to-indigo-500",
      accent: "text-purple-500",
      hint: "Total commission you've ever earned across all links and promo codes, excluding refunded sales.",
    },
    {
      label: "Conversions",
      value: (stats?.totalConversions ?? 0).toLocaleString(),
      icon: MousePointerClick,
      bar: "from-sky-400 to-blue-500",
      accent: "text-sky-500",
      hint: "Number of paid subscriptions attributed to your links and promo codes.",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
        >
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${c.bar}`} />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {c.label}
                  <InfoHint text={c.hint} />
                </span>
                <c.icon className={`h-4 w-4 ${c.accent}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {c.value}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function EarningsChart({ chartData }: { chartData: { commission: number; label: string }[] }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-purple-500" />
          Earnings Over Time
        </CardTitle>
        <CardDescription>Commission earned per week</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[260px] mt-2">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <TrendingUp className="h-10 w-10 text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No earnings yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Share your link or promo code to start earning
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="affEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    border: "none",
                    borderRadius: "10px",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    padding: "10px 14px",
                  }}
                  formatter={(value: number) => [usd(value), "Commission"]}
                />
                <Area
                  type="monotone"
                  dataKey="commission"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#affEarnings)"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LinksSection({
  links,
  onCopy,
  onChanged,
}: {
  links: ReturnType<typeof useAffiliateHub>["links"];
  onCopy: (code: string) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [promotion, setPromotion] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!promotion.trim()) {
      toast.error("Tell us where you'll promote Creator AI");
      return;
    }
    try {
      setCreating(true);
      await affiliateHubApi.createLink({ promotion_channel: promotion.trim() });
      toast.success("Your affiliate code is ready");
      setPromotion("");
      setOpen(false);
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await affiliateHubApi.deleteLink(id);
      toast.success("Link deleted");
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-purple-500" />
            Your Links
          </CardTitle>
          <CardDescription>Tracking links that attribute sales to you</CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Generate New Link
        </Button>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            No links yet. Create one to start sharing.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {link.code}
                    </span>
                    {!link.is_active && (
                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {link.label || "Affiliate link"} · {link.click_count} clicks · {link.commission_rate}%
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onCopy(link.code)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:text-rose-600"
                    onClick={() => remove(link.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg [&>button]:top-5 [&>button]:text-white [&>button]:opacity-80 [&>button:hover]:opacity-100">
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 px-6 py-5 pr-12 text-white">
            <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start gap-2.5 pr-8">
              <div className="rounded-lg bg-white/15 p-2">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-white">
                    Get paid to promote Creator AI
                  </DialogTitle>
                  <Badge className="shrink-0 bg-white/20 text-white hover:bg-white/20">20% recurring</Badge>
                </div>
                <p className="mt-2 text-sm text-purple-100">
                  Share your link and earn 20% recurring commission on every subscription you refer.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-6 pb-6 pt-5">
            <div className="space-y-2">
              <Label htmlFor="promotion-channel" className="text-sm font-medium">
                Where will you promote Creator AI?
              </Label>
              <Textarea
                id="promotion-channel"
                value={promotion}
                onChange={(e) => setPromotion(e.target.value)}
                placeholder="X, newsletter, YouTube, cold email, personal network..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              Commissions repeat for up to 12 billing cycles and mature after a 30-day holding
              period. You can't earn commission on your own subscription. A unique tracking code
              is generated for you automatically.
            </div>

            <Button
              className="w-full gap-1.5 border-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700"
              onClick={create}
              disabled={creating}
            >
              <Sparkles className="h-4 w-4" />
              {creating ? "Generating your code..." : "Apply and get my code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PromoCodesSection({
  promoCodes,
  onCopy,
  baseUrl,
}: {
  promoCodes: ReturnType<typeof useAffiliateHub>["promoCodes"];
  onCopy: (code: string) => void;
  baseUrl: string;
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="h-4 w-4 text-pink-500" />
          Your Promo Codes
        </CardTitle>
        <CardDescription>
          Codes assigned by our team. Buyers get a discount and you earn the commission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {promoCodes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            No promo codes assigned yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {promoCodes.map((promo) => (
              <div
                key={promo.id}
                className="rounded-lg border border-dashed border-pink-300 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/20 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-base font-bold text-pink-700 dark:text-pink-300">
                    {promo.code}
                  </span>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onCopy(promo.code)}>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  {promo.amount_type === "percent" ? `${promo.amount}% off` : `${usd(promo.amount)} off`}
                  {" · "}
                  {promo.commission_rate}% commission
                  {!promo.is_active && " · inactive"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  Share: {baseUrl}/?promo={promo.code}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WithdrawalsSection({
  available,
  minWithdrawal,
  payoutMethod,
  withdrawals,
  onChanged,
}: {
  available: number;
  minWithdrawal: number;
  payoutMethod: ReturnType<typeof useAffiliateHub>["payoutMethod"];
  withdrawals: AffiliateWithdrawal[];
  onChanged: () => void;
}) {
  const [method, setMethod] = useState<PayoutMethodType>(payoutMethod?.method ?? "paypal");
  const [details, setDetails] = useState<Record<string, string>>(payoutMethod?.details ?? {});
  const [savingMethod, setSavingMethod] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);

  const saveMethod = async () => {
    const fields = PAYOUT_FIELDS[method];
    if (fields.some((f) => !details[f.key]?.trim())) {
      toast.error("Fill in all payout details");
      return;
    }
    try {
      setSavingMethod(true);
      await affiliateHubApi.savePayoutMethod({ method, details });
      toast.success("Payout method saved");
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSavingMethod(false);
    }
  };

  const requestWithdrawal = async () => {
    const value = Number(amount);
    if (!value || value < minWithdrawal) {
      toast.error(`Minimum withdrawal is ${usd(minWithdrawal)}`);
      return;
    }
    if (value > available) {
      toast.error("Amount exceeds your available balance");
      return;
    }
    try {
      setRequesting(true);
      await affiliateHubApi.requestWithdrawal(value);
      toast.success("Withdrawal requested");
      setAmount("");
      setWithdrawOpen(false);
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4 text-emerald-500" />
            Withdrawals
          </CardTitle>
          <CardDescription>
            Available to withdraw: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{usd(available)}</span>
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setWithdrawOpen(true)}
          disabled={available < minWithdrawal}
        >
          <ArrowUpRight className="h-4 w-4" /> Withdraw
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Payout method</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v: string) => setMethod(v as PayoutMethodType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="wise">Wise</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {PAYOUT_FIELDS[method].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <Input
                  value={details[field.key] ?? ""}
                  onChange={(e) => setDetails((d) => ({ ...d, [field.key]: e.target.value }))}
                  placeholder={field.label}
                />
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={saveMethod} disabled={savingMethod}>
            {savingMethod ? "Saving..." : "Save payout method"}
          </Button>
        </div>

        {withdrawals.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-2 text-center">
            No withdrawal requests yet.
          </p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{usd(w.amount)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {w.method} · {new Date(w.created_at).toLocaleDateString()}
                    {w.admin_notes ? ` · ${w.admin_notes}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={`text-xs capitalize ${STATUS_STYLES[w.status] ?? ""}`}>
                  {w.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">Amount (USD)</Label>
            <Input
              id="withdraw-amount"
              type="number"
              min={minWithdrawal}
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(minWithdrawal)}
            />
            <p className="text-xs text-slate-500">
              Available {usd(available)} · minimum {usd(minWithdrawal)}. Paid to your saved {payoutMethod?.method ?? "payout"} method.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button onClick={requestWithdrawal} disabled={requesting}>
              {requesting ? "Requesting..." : "Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SalesSection({ sales }: { sales: ReturnType<typeof useAffiliateHub>["sales"] }) {
  if (sales.length === 0) return null;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Commissions</CardTitle>
        <CardDescription>Your latest attributed sales</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sales.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {usd(s.commission)} commission
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {s.source === "promo" ? "Promo code" : s.affiliate_links?.code ?? "Link"}
                  {" · "}
                  {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className={`text-xs capitalize ${STATUS_STYLES[s.status] ?? ""}`}>
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HubSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="pt-5 pb-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}
