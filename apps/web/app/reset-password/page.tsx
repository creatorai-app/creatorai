"use client";

import { useState, Suspense } from "react";
import * as motion from "motion/react-m";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { OTPInput } from "@repo/ui/otp-input";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import logo from "@/public/dark-logo.png";
import { AnimatePresence } from "motion/react";

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const stepVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const verifyOtp = async () => {
    if (otp.length !== 6) return;
    setIsVerifyingOtp(true);
    try {
      const res = await api.post<{ valid: boolean; message?: string }>("/api/v1/auth/verify-otp", {
        email: email.toLowerCase().trim(),
        otp,
      }, { requireAuth: false });

      if (!res.valid) throw new Error(res.message ?? "Invalid OTP");

      setVerified(true);
      toast.success("OTP verified! Now set your new password.");
    } catch (err: any) {
      toast.error(err.message ?? "Invalid or expired OTP");
      setOtp("");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!verified) {
      return verifyOtp();
    }

    try {
      passwordSchema.parse({ newPassword, confirmPassword });
      setIsResettingPassword(true);

      await api.post("/api/v1/auth/reset-password", {
        email: email.toLowerCase().trim(),
        otp,
        newPassword,
        confirmNewPassword: confirmPassword
      }, { requireAuth: false });

      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      if (err.name === "ZodError") {
        toast.error(err.errors[0].message);
      } else {
        toast.error(err.message ?? "Failed to reset password");
        setVerified(false);
        setOtp("");
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  const resendOtp = async () => {
    if (cooldown > 0 || !email) return;

    setIsResendingOtp(true);
    try {
      await api.post("/api/v1/auth/forgot-password", { email: email.toLowerCase().trim() }, { requireAuth: false });
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      toast.success("New OTP sent to your email!");
    } catch {
      toast.error("Failed to resend OTP");
    } finally {
      setIsResendingOtp(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
            <p className="text-xl font-semibold">Password Reset Successful</p>
            <p className="text-muted-foreground mt-2">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="text-center space-y-4">
          <Link href="/" className="w-full mx-auto flex justify-center items-center">
            <Image src={logo} alt="Logo" width={100} height={100} />
          </Link>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {verified ? "Set your new password" : "Enter the 6-digit code sent to your email"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} disabled className="bg-muted" />
            </div>

            <AnimatePresence mode="wait">
              {!verified ? (
                <motion.div
                  key="otp-step"
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <OTPInput
                      value={otp}
                      onChange={setOtp}
                      length={6}
                      disabled={isVerifyingOtp}
                      onComplete={verifyOtp}
                    />

                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={resendOtp}
                      disabled={isResendingOtp || cooldown > 0}
                      className="mx-auto block"
                    >
                      {isResendingOtp ? (
                        <>Sending...</>
                      ) : cooldown > 0 ? (
                        `Resend in ${cooldown}s`
                      ) : (
                        "Resend OTP"
                      )}
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isVerifyingOtp || otp.length !== 6}
                  >
                    {isVerifyingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify OTP
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="password-step"
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <div className="relative">
                        <Input
                          type={showPass ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-0"
                          onClick={() => setShowPass(!showPass)}
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Confirm Password</Label>
                      <Input
                        type={showPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isResettingPassword}
                  >
                    {isResettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reset Password
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-6 text-center">
            <Button variant="ghost" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}