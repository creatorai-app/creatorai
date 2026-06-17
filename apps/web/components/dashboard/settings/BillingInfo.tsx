"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Skeleton } from "@repo/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useBilling } from "@/hooks/useBilling";
import {
  AlertTriangle,
  Check,
  Crown,
  Loader2,
  Sparkles,
  Zap,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function BillingInfo() {
  const {
    plans,
    billingInfo,
    loading,
    checkoutLoading,
    portalLoading,
    cancelLoading,
    subscribe,
    cancelSubscription,
    refresh,
  } = useBilling();

  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      setShowSuccess(true);
      // Pull the freshly-awarded credits / new plan.
      refresh();
      // Drop the status param so a manual refresh doesn't replay the modal.
      window.history.replaceState(null, "", "/dashboard/settings?tab=billing");
      // Show the confirmation for 3s, then send the user to their dashboard
      // (staying on the same origin they checked out from).
      const timer = setTimeout(() => {
        setShowSuccess(false);
        router.push("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    } else if (status === "cancelled") {
      toast.info("Checkout cancelled");
      window.history.replaceState(null, "", "/dashboard/settings?tab=billing");
    }
  }, [searchParams, refresh, router]);

  const currentPlanName = billingInfo?.currentPlan?.name ?? "Starter";
  const hasActiveSubscription = !!billingInfo?.subscription;

  if (loading) return <BillingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Order confirmation modal (shown after a successful checkout redirect) */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <Check className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center">Payment successful 🎉</DialogTitle>
            <DialogDescription className="text-center">
              Your <strong>{currentPlanName}</strong> plan is now active and your
              credits have been added. Taking you to your dashboard…
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Current Plan Card */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your subscription and credit balance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {currentPlanName} Plan
                  </p>
                  {hasActiveSubscription && (
                    <Badge
                      variant="outline"
                      className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                    >
                      {billingInfo.subscription!.status}
                    </Badge>
                  )}
                </div>
                {billingInfo?.subscription?.currentPeriodEnd && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Renews{" "}
                    {new Date(
                      billingInfo.subscription.currentPeriodEnd,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {billingInfo?.credits ?? 0}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                credits remaining
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            {hasActiveSubscription && (
              <AlertDialog>
                <AlertDialogTrigger asChild className="w-full">
                  <Button
                    variant="ghost"
                    disabled={cancelLoading}
                    className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                  >
                    {cancelLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Cancel Subscription?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel your <strong>{currentPlanName}</strong> subscription
                      and switch you to the free Starter plan. Your credits will be
                      reset to the free plan allowance.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={cancelSubscription}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Yes, Cancel
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle>
            {hasActiveSubscription ? "Change Plan" : "Upgrade Plan"}
          </CardTitle>
          <CardDescription>
            Choose the plan that fits your content creation needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.name === currentPlanName;
              const isPopular = plan.name === "Creator+";
              const isEnterprise = plan.name === "Enterprise";
              const isFree = plan.price_monthly === 0;
              let features: string[] = [];
              try {
                features =
                  typeof plan.features === "string"
                    ? JSON.parse(plan.features)
                    : Array.isArray(plan.features)
                      ? plan.features
                      : [];
              } catch {
                features = [];
              }

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-5 transition-all",
                    isCurrent
                      ? "border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/10"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600",
                  )}
                >
                  {isPopular && (
                    <Badge className="absolute -top-2.5 right-3 bg-purple-600 text-white">
                      Popular
                    </Badge>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {plan.name}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        ${plan.price_monthly}
                      </span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        /mo
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {plan.credits_monthly.toLocaleString()} credits/month
                    </p>
                  </div>

                  <Separator className="mb-4" />

                  <ul className="mb-6 flex-1 space-y-2">
                    {features.map((feature, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : isFree && hasActiveSubscription ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={cancelLoading}
                          className="w-full"
                        >
                          {cancelLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="mr-2 h-4 w-4" />
                          )}
                          Switch to Free
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Switch to Free Plan?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will cancel your <strong>{currentPlanName}</strong> subscription
                            and switch you to the free Starter plan. Your credits will
                            be reset to the free plan allowance.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Current Plan</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={cancelSubscription}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Yes, Switch to Free
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : isFree ? (
                    <Button variant="outline" disabled className="w-full">
                      Free
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "w-full",
                        isPopular &&
                        "bg-purple-600 hover:bg-purple-700 text-white",
                        isEnterprise &&
                        "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0",
                      )}
                      variant={isPopular || isEnterprise ? "default" : "outline"}
                      onClick={() => subscribe(plan.id)}
                      disabled={!!checkoutLoading}
                    >
                      {checkoutLoading === plan.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isEnterprise ? (
                        <Crown className="mr-2 h-4 w-4" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      {hasActiveSubscription ? "Switch Plan" : "Subscribe"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full rounded-lg" />
        </CardContent>
      </Card>
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
