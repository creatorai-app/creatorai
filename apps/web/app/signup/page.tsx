"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Checkbox } from "@repo/ui/checkbox";
import { Progress } from "@repo/ui/progress";
import { useSupabase } from "@/components/supabase-provider";
import { registerUserSchema } from "@repo/validation";
import { api, getApiErrorMessage } from "@/lib/api-client";
import AuthLayout from "@/components/auth/AuthLayout";
import {
  authKeyframes,
  AuthField,
  AuthSubmit,
  GoogleButton,
  AuthFootLine,
  AuthFootLink,
} from "@/components/auth/AuthFields";
import * as z from "zod";

type FormData = z.infer<typeof registerUserSchema> & { confirmPassword?: string };
type FormErrors = Partial<Record<keyof FormData, string>>;

function isZodError(error: unknown): error is z.ZodError {
  if (error instanceof z.ZodError) return true;
  return (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name: string }).name === "ZodError"
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, user } = useSupabase();

  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<Partial<FormData>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [showReferralBanner, setShowReferralBanner] = useState(false);

  const totalSteps = 2;
  const progress = (step / totalSteps) * 100;

  const trackReferral = async (userEmail: string | undefined) => {
    if (!referralCode || !userEmail) return;
    try {
      await api.post("/api/v1/referral/track", { referralCode, userEmail });
      toast.success("Referral applied!", {
        description: "Subscribe to any paid plan and you'll both get 1,000 bonus credits.",
      });
      setShowReferralBanner(false);
    } catch (err: unknown) {
      toast.warning("Referral not applied", {
        description: getApiErrorMessage(err, "Could not apply referral code."),
      });
    }
  };

  /**
   * Where to land after signing up. Set by the free-tool pages so a result
   * generated at /tools survives the signup and is claimed into the new
   * account (see lib/free-tool-session.ts). Same-origin paths only, and the
   * auth callback narrows it again to /dashboard before honoring it.
   */
  const rawNext = searchParams.get("next");
  const nextPath =
    rawNext?.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  useEffect(() => {
    if (user) {
      router.push(nextPath ?? "/dashboard");
    }
  }, [user, router, nextPath]);

  // Check the code before promising anyone a bonus for it. Doing this at sign-up
  // time instead of after account creation is what keeps a mistyped or expired
  // link from turning into a failed referral the user can no longer fix.
  useEffect(() => {
    const ref = searchParams.get("ref")?.toUpperCase().trim();
    if (!ref) return;

    setShowReferralBanner(true);
    api
      .get<{ valid: boolean; referrerName: string | null }>(
        `/api/v1/referral/validate/${encodeURIComponent(ref)}`,
      )
      .then(({ valid, referrerName }) => {
        if (!valid) {
          setReferralError(
            `The referral code "${ref}" doesn't exist. You can still sign up — check the link you were sent to claim the bonus.`,
          );
          return;
        }
        setReferralCode(ref);
        setReferrerName(referrerName);
      })
      .catch(() => {
        // Couldn't reach the check — keep the code and let /track have the final say.
        setReferralCode(ref);
      });
  }, [searchParams]);

  const handleNext = async () => {
    setErrors({});
    setTermsError(null);

    if (!acceptedTerms) {
      setTermsError("You must accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    let schemaToValidate;
    if (step === 1) {
      schemaToValidate = (registerUserSchema._def.schema as z.ZodObject<any>).pick({ name: true, email: true });
    } else {
      setStep(step + 1);
      return;
    }

    try {
      schemaToValidate.parse(details);
      setStep(step + 1);
    } catch (error) {
      if (isZodError(error)) {
        const fieldErrors: FormErrors = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as keyof FormData;
          if (path) {
            fieldErrors[path] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error("Validation failed", {
          description: "Please check your input and try again.",
        });
      }
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep(step - 1);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return; // auth client still code-splitting in
    setErrors({});
    setTermsError(null);

    if (!acceptedTerms) {
      setTermsError("You must accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);

    try {
      registerUserSchema.parse(details);

      const { data, error } = await supabase.auth.signUp({
        email: details.email!,
        password: details.password!,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextPath ?? "/login")}`,
          data: {
            full_name: details.name,
          },
        },
      });

      if (error) throw new Error(error.message);

      if (data.user) {
        toast.success("Account created!", { description: "Please check your email to verify your account." });
        await trackReferral(data.user.email);
        // Carry `next` to the login page too: the confirmation email already
        // has it, but someone who signs in by hand from here should land in the
        // same place.
        router.push(
          nextPath ? `/login?redirectTo=${encodeURIComponent(nextPath)}` : "/login",
        );
      }
    } catch (error: unknown) {
      if (isZodError(error)) {
        const fieldErrors: FormErrors = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as keyof FormData;
          if (path) fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        const message = error instanceof Error ? error.message : "An unexpected error occurred.";
        toast.error("Signup Failed", { description: message });
      }
    } finally {
      setLoading(false);
    }
  };


  const handleGoogleSignup = async () => {
    if (!supabase) return; // auth client still code-splitting in
    if (!acceptedTerms) {
      setTermsError("You must accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      const callbackUrl = new URL("/api/auth/callback", window.location.origin);
      if (referralCode) callbackUrl.searchParams.set("ref", referralCode);
      if (nextPath) callbackUrl.searchParams.set("next", nextPath);
      const redirectUrl = callbackUrl.toString();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          scopes: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not sign up with Google. Please try again.";
      toast.error("Google Signup Failed", { description: message });
    } finally {
      setLoading(false);
    }
  };


  const stepVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };
  if (user) return null;

  return (
    <AuthLayout
      tag="NEW ACCOUNT"
      title="One upload. Everything after it, handled"
      subhead="Scripts in your voice, subs in 12 languages, dubs in 29, thumbnails that get clicked."
    >
      <style>{authKeyframes}</style>

      {showReferralBanner && referralCode && (
        <div
          className="mb-5 rounded-md px-4 py-3"
          style={{ background: "rgba(99,102,241,.12)", color: "#4338ca", fontSize: "12.5px", lineHeight: 1.6 }}
        >
          {referrerName ? `${referrerName} invited you.` : "You've been invited by a friend."} Code{" "}
          <span className="au-mono font-bold">{referralCode}</span>. Subscribe to any paid plan and you
          both earn 1,000 bonus credits.
        </div>
      )}
      {showReferralBanner && referralError && (
        <div
          className="mb-5 rounded-md px-4 py-3"
          style={{ background: "rgba(236,72,153,.13)", color: "#be185d", fontSize: "12.5px" }}
        >
          {referralError}
        </div>
      )}

      <div className="mb-6">
        <Progress value={progress} className="w-full" />
        <p
          className="au-mono mt-2 font-bold"
          style={{ fontSize: "10px", letterSpacing: ".18em", color: "rgba(18,21,26,.4)" }}
        >
          STEP {step} OF {totalSteps}
        </p>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-6">
        {step === 1 && (
          <>
            <div className="au-rise">
              <AuthField
                label="NAME"
                id="name"
                type="text"
                placeholder="Alex Rivera"
                value={details.name || ""}
                onChange={(e) => setDetails({ ...details, name: e.target.value })}
                error={errors.name}
                disabled={loading}
              />
            </div>
            <AuthField
              label="EMAIL"
              id="email"
              type="email"
              placeholder="you@channel.com"
              value={details.email || ""}
              onChange={(e) => setDetails({ ...details, email: e.target.value })}
              error={errors.email}
              disabled={loading}
            />
          </>
        )}

        {step === 2 && (
          <>
            <AuthField
              label="PASSWORD"
              id="password"
              type="password"
              placeholder="••••••••••"
              value={details.password || ""}
              onChange={(e) => setDetails({ ...details, password: e.target.value })}
              error={errors.password}
              shake={!!errors.password}
              disabled={loading}
            />
            <AuthField
              label="CONFIRM PASSWORD"
              id="confirmPassword"
              type="password"
              placeholder="••••••••••"
              value={details.confirmPassword || ""}
              onChange={(e) => setDetails({ ...details, confirmPassword: e.target.value })}
              error={errors.confirmPassword}
              disabled={loading}
            />
          </>
        )}

        <div className="flex gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="au-google mt-8 flex-1 cursor-pointer"
              style={{
                padding: 16,
                border: "1.5px solid rgba(18,21,26,.16)",
                borderRadius: 6,
                background: "transparent",
                color: "#12151A",
                transition: "border-color .2s",
              }}
            >
              <span className="au-mono font-bold" style={{ fontSize: "12.5px", letterSpacing: ".12em" }}>
                BACK
              </span>
            </button>
          )}
          {step < totalSteps ? (
            <button
              type="button"
              onClick={handleNext}
              className="au-cta mt-8 flex-1 cursor-pointer"
              style={{
                padding: 16,
                border: 0,
                borderRadius: 6,
                background: "linear-gradient(135deg,#6366f1 0%,#a855f7 55%,#ec4899 100%)",
                color: "#ffffff",
                transition: "transform .16s, box-shadow .22s, background .2s",
              }}
            >
              <span className="au-mono font-bold" style={{ fontSize: "12.5px", letterSpacing: ".12em" }}>
                CONTINUE
              </span>
            </button>
          ) : (
            <div className="flex-1">
              <AuthSubmit loading={loading} loadingLabel="CREATING YOUR ACCOUNT…">
                CREATE FREE ACCOUNT
              </AuthSubmit>
            </div>
          )}
        </div>
      </form>

      <GoogleButton onClick={handleGoogleSignup} />

      <div className="mt-5 flex items-start gap-2">
        <Checkbox
          id="acceptTerms"
          checked={acceptedTerms}
          onCheckedChange={(checked) => {
            setAcceptedTerms(checked === true);
            if (checked) setTermsError(null);
          }}
          className="mt-0.5"
        />
        <label
          htmlFor="acceptTerms"
          className="cursor-pointer"
          style={{ fontSize: "12.5px", lineHeight: 1.6, color: "rgba(18,21,26,.5)" }}
        >
          I agree to the{" "}
          <Link href="/terms" target="_blank" style={{ color: "#2563eb" }}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" style={{ color: "#2563eb" }}>
            Privacy Policy
          </Link>
        </label>
      </div>
      {termsError && (
        <p className="au-rise-fast mt-2 font-medium" style={{ fontSize: "12px", color: "#C0453F" }}>
          {termsError}
        </p>
      )}

      <AuthFootLine>
        Already have an account? <AuthFootLink href="/login">Log in</AuthFootLink>
      </AuthFootLine>
    </AuthLayout>
  );
}

export default function MultiStepSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-500 border-t-transparent"></div>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}