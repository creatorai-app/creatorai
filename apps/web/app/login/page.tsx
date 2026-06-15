"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/card"
import { useSupabase } from "@/components/supabase-provider"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { loginUserSchema } from "@repo/validation"
import { ZodError } from "zod"

import logo from "@/public/dark-logo.png"
import { AuroraBackground } from "@repo/ui/aurora-background"
import { motion } from "motion/react"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"

// IMPROVEMENT: More descriptive constant name and corrected placeholder.
const formFields = [
  { id: "email" as const, name: "Email", type: "email", placeholder: "Enter your email" },
  { id: "password" as const, name: "Password", type: "password", placeholder: "Enter your password" },
]


function isZodError(error: unknown): error is ZodError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'ZodError' &&
    'errors' in error &&
    Array.isArray((error as any).errors)
  );
}

//Define a type for the form state for better type safety.
type FormState = Record<"email" | "password", string>
type ErrorState = Partial<FormState>

export default function LoginPage() {
  // Initializing state with a more specific type.
  const [details, setDetails] = useState<FormState>({ email: "", password: "" })
  //  Added state to hold and display validation errors.
  const [errors, setErrors] = useState<ErrorState>({})
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const { supabase, user, profile, profileLoading } = useSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get("redirectTo") || searchParams.get("redirectedFrom")
  const redirectTo = rawRedirect?.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : null

  useEffect(() => {
    if (user && !profileLoading && profile) {
      if (profile.role === "admin") {
        router.replace("/admin/login")
        return
      }
      if (redirectTo) {
        router.replace(redirectTo)
      } else {
        router.replace("/dashboard")
      }
    }
  }, [user, profile, profileLoading, router, redirectTo])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // Clear previous errors on a new submission attempt.
    setErrors({})
    setLoading(true)

    try {
      // Validate form data before sending it to the server
      loginUserSchema.parse(details)

      const { data, error } = await supabase.auth.signInWithPassword({
        email: details.email,
        password: details.password,
      })

      if (error) {
        throw new Error(error.message) // Centralize error handling in the catch block
      }

      if (data.user) {
        toast.success("You have been successfully logged in.")

        if (redirectTo) {
          router.push(redirectTo)
          return
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", data.user.id)
          .single()

        const role = profileData?.role
        if (role === "admin") {
          await supabase.auth.signOut()
          toast.error("Access Denied", { description: "Admins must use the admin login portal." })
          return
        }
        router.push("/dashboard")
      }
    } catch (error: any) {
      if (isZodError(error)) {
        // Map Zod errors to our state format
        const fieldErrors: ErrorState = {}
        error.errors.forEach(err => {
          if (err.path[0] === "email" || err.path[0] === "password") {
            fieldErrors[err.path[0] as keyof ErrorState] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        // Handle Supabase auth errors or other unexpected errors
        // console.error("Login error:", error)
        toast.error("Login Failed", {
          description: error.message || "An unexpected error occurred. Please try again.",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const callbackUrl = new URL("/api/auth/callback", window.location.origin)
      if (redirectTo) callbackUrl.searchParams.set("next", redirectTo)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      })

      if (error) throw error
    } catch (error: any) {
      toast.error("Google Login Failed", {
        description: error.message || "Could not sign in with Google. Please try again.",
      })
    }
  }

  // Prevents a flash of the login form while redirecting.
  if (user) {
    return null
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <LandingPageNavbar />
      <AuroraBackground>
        <div className="relative mx-3 my-24 box-border grid w-full max-w-[min(100%,calc(100vw-1.5rem))] flex-1 grid-cols-1 items-start justify-center gap-8 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:mx-5 sm:px-4 sm:py-8 md:mx-auto md:max-w-7xl md:grid-cols-2 md:items-center md:px-8 md:py-10 lg:px-12">

          {/* ## Left Column: Brand Messaging (hidden on mobile) ## */}
          <motion.div
            initial={{ opacity: 0.0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{
              delay: 0.2,
              duration: 0.8,
              ease: "easeInOut",
            }}
            className="hidden flex-col justify-center gap-4 md:flex"
          >
            <Link href="/">
              <Image src={logo} alt="Creator AI" width={80} height={80} className="mb-4" />
            </Link>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900">
              The Future of Content Creation is Here.
            </h1>
            <p className="max-w-md text-lg text-slate-600">
              Building the next generation of automated solutions. Sign in to be part of the journey.
            </p>
          </motion.div>

          {/* ## Right Column: Login Form ## */}
          <motion.div
            initial={{ opacity: 0.0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.3,
              duration: 0.8,
              ease: "easeInOut",
            }}
            className="flex w-full justify-center md:justify-end"
          >
            <Card className="w-full max-w-md bg-white/20 dark:bg-black/20 backdrop-blur-lg border border-white/30 shadow-2xl rounded-2xl">
              <CardHeader className="space-y-1 pt-6">
                {/* Mobile Logo inside card */}
                <div className="flex justify-center md:hidden">
                  <Image src={logo} alt="Creator AI" width={60} height={60} />
                </div>
                <CardTitle className="text-2xl text-center text-slate-900 dark:text-white">
                  Welcome back
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full bg-white/50 hover:bg-white/70" onClick={handleGoogleLogin} type="button">
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </Button>

                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2 text-slate-500 dark:text-slate-400">Or continue with</span>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {formFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id} className="dark:text-slate-200">{field.name}</Label>
                      <div className="relative">
                        <Input
                          id={field.id}
                          type={field.type === "password" ? (visible ? "text" : "password") : field.type}
                          placeholder={field.placeholder}
                          value={details[field.id]}
                          onChange={(e) => setDetails({ ...details, [field.id]: e.target.value })}
                          required
                          className={`bg-white/30 dark:bg-black/30 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:ring-pink-500 ${errors[field.id] ? "border-destructive focus-visible:ring-destructive" : ""
                            }`}
                        />
                        {field.type === "password" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setVisible(!visible)}
                          >
                            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                      {errors[field.id] && <p className="text-sm text-destructive mt-1">{errors[field.id]}</p>}
                    </div>
                  ))}
                  <Button
                    type="submit"
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 shadow-md"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="flex flex-col space-y-2 pb-8">
                <div className="text-sm text-center">
                  <Link href="/forgot-password" className="font-medium mt-4 text-sm text-slate-600">
                    Forgot your password?
                  </Link>
                </div>
                <div className="text-sm text-center dark:text-slate-300">
                  Don't have an account?{" "}
                  <Link href="/signup" className="font-medium text-purple-600 hover:underline dark:text-purple-400">
                    Sign up
                  </Link>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </div>
      </AuroraBackground>
      <Footer />
    </div>

  )
}