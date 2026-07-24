"use client";

import React from "react";
import * as motion from "motion/react-m";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence } from "motion/react";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import { Loader2, Mail, ArrowLeft } from "lucide-react";

import logo from "@/public/dark-logo.png";
import { forgotPasswordSchema } from "@repo/validation";
import { api, ApiClientError } from "@/lib/api-client";
import { toast } from "sonner";
import Footer from "@/components/footer";

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
    clearErrors,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange", // Required for real-time isValid
    defaultValues: {
      email: "",
    },
  });

  // Auto-clear error after 3s
  React.useEffect(() => {
    if (errors.email) {
      const timer = setTimeout(() => clearErrors("email"), 3000);
      return () => clearTimeout(timer);
    }
  }, [errors.email, clearErrors]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      const response = await api.post<{ message: string }>(
        "/api/v1/auth/forgot-password",
        { email: data.email },
        { requireAuth: false }
      );

      toast.success("Check your email", {
        description:
          response.message ||
          "If an account exists, a password reset OTP has been sent.",
      });

      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(data.email)}`);
      }, 3000);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Failed to send reset link. Please try again.";

      toast.error("Request failed", { description: message });
    }
  };

  const isButtonDisabled = !isValid || isSubmitting || !isDirty;

  return (
    <div className="min-h-screen flex flex-col justify-center bg-slate-50 dark:bg-slate-900 px-4 pt-16">
      <Card className="w-full max-w-md mx-auto mb-16">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center items-center">
            {logo && <Image src={logo} alt="Creator AI" width={100} height={100} className="mb-4" />}
          </div>
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email to receive a password reset OTP
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10 h-12 transition-all duration-200"
                  disabled={isSubmitting}
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
              </div>

              <AnimatePresence mode="wait">
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="text-sm text-destructive font-medium"
                    role="alert"
                    aria-live="assertive"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all"
              disabled={isButtonDisabled}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send OTP Code"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter>
          <Link
            href="/login"
            className="flex items-center text-sm font-medium text-slate-900 dark:text-slate-300 hover:underline mx-auto transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Login
          </Link>
        </CardFooter>
      </Card>

      <Footer />
    </div>
  );
}