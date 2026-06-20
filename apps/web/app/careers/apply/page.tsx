"use client"

import type React from "react"
import { Suspense, useState, useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { motion } from "motion/react"
import { toast } from "sonner"
import { ArrowLeft, Loader2, MapPin, Briefcase, Upload, FileCheck } from "lucide-react"

import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
import { SparklesCore } from "@repo/ui/sparkles"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import { createClient } from "@/lib/supabase/client"
import type { JobPost } from "@repo/validation"

const DEV_TEAMS = ["Engineering", "AI"]

const experienceOptions = ["0-1 years", "1-3 years", "3-5 years", "5-8 years", "8+ years"]

interface FormData {
  full_name: string
  email: string
  phone: string
  experience: string
  linkedin_url: string
  github_url: string
  portfolio_url: string
  problem_solving: string
}

const initialFormData: FormData = {
  full_name: "",
  email: "",
  phone: "",
  experience: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  problem_solving: "",
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-purple-600" /></div>}>
      <ApplyPageContent />
    </Suspense>
  )
}

function ApplyPageContent() {
  const searchParams = useSearchParams()
  const position = searchParams.get("position") || ""
  const jobPostId = searchParams.get("id") || ""

  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [job, setJob] = useState<JobPost | null>(null)

  useEffect(() => {
    if (!jobPostId && !position) return
    const supabase = createClient()
    const base = supabase.from("job_posts").select("*").eq("status", "active")
    const promise = jobPostId
      ? base.eq("id", jobPostId).maybeSingle()
      : base.ilike("title", position).maybeSingle()
    promise.then(({ data }) => { if (data) setJob(data) })
  }, [position, jobPostId])

  const isDev = useMemo(() => {
    const team = job?.team || ""
    return DEV_TEAMS.some((t) => team.toLowerCase().includes(t.toLowerCase()))
  }, [job])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed")
      e.target.value = ""
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB")
      e.target.value = ""
      return
    }
    setter(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      const fd = new FormData()
      fd.append("position", position || job?.title || "General Application")
      fd.append("full_name", formData.full_name)
      fd.append("email", formData.email)
      fd.append("phone", formData.phone)
      fd.append("linkedin_url", formData.linkedin_url)
      fd.append("experience", formData.experience)
      fd.append("problem_solving", formData.problem_solving)
      if (formData.github_url) fd.append("github_url", formData.github_url)
      if (formData.portfolio_url) fd.append("portfolio_url", formData.portfolio_url)
      if (jobPostId || job?.id) fd.append("job_post_id", jobPostId || job!.id)
      if (resumeFile) fd.append("resume_file", resumeFile)
      if (coverLetterFile) fd.append("cover_letter_file", coverLetterFile)

      const response = await fetch("/api/careers/apply", { method: "POST", body: fd })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Failed to submit application")

      setSubmitted(true)
      toast.success("Application submitted!", {
        description: "We'll review your application and get back to you soon.",
      })
    } catch (error: any) {
      toast.error("Failed to submit application", {
        description: error?.message || "Something went wrong. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <LandingPageNavbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-md"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Application Submitted!</h1>
            <p className="text-slate-600 mb-6">
              Thank you for your interest in the <strong>{position || "open"}</strong> role.
              We'll review your application and get back to you within a few days.
            </p>
            <Link
              href="/careers"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Careers
            </Link>
          </motion.div>
        </div>
        <Footer />
      </div>
    )
  }

  const inputClass = "bg-white border-slate-200 placeholder:text-slate-400 focus-visible:ring-purple-500"

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <LandingPageNavbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full min-h-[40vh] flex items-center justify-center bg-gradient-to-b from-white to-slate-50 overflow-hidden pt-24 pb-12">
          <div aria-hidden="true" className="absolute inset-0 -z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] bg-purple-100/40 rounded-full blur-3xl" />
            <SparklesCore
              background="transparent"
              minSize={0.2}
              maxSize={0.8}
              className="absolute inset-0 w-full h-full z-0"
              particleColor="#a855f7"
              particleDensity={15}
            />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Link
                href="/careers"
                className="inline-flex items-center gap-1.5 text-sm text-purple-600 font-medium hover:text-purple-800 transition-colors mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                All Open Positions
              </Link>
              <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                Apply for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  {position || "a Position"}
                </span>
              </h1>

              {job && (
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" />
                    {job.team}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {job.location}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-medium">
                    {job.type}
                  </span>
                </div>
              )}

              {job?.description && (
                <p className="text-slate-600 max-w-2xl mx-auto mt-5 text-base leading-relaxed">
                  {job.description}
                </p>
              )}

              {job?.requirements && (
                <div className="mt-4 text-sm text-slate-500 max-w-2xl mx-auto">
                  <span className="font-medium text-slate-700">Requirements: </span>
                  {job.requirements}
                </div>
              )}

              <div className="mt-8 mx-auto max-w-2xl rounded-2xl border border-purple-100 bg-purple-50/50 px-6 py-5 text-left">
                <h3 className="text-sm font-semibold text-purple-800 mb-2">About Creator AI</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  We're a small, fast-moving team building AI tools that thousands of YouTube creators rely on daily.
                  You'll have real ownership over what you build, work with cutting-edge AI technology, and directly
                  impact how creators grow their channels. We offer competitive pay, equity, fully remote work,
                  and the kind of autonomy you won't find at bigger companies.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Application Form */}
        <section className="py-16 bg-slate-50">
          <div className="max-w-3xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-1 text-center">Submit Your Application</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input id="full_name" name="full_name" placeholder="Your full name" value={formData.full_name} onChange={handleChange} required className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" name="email" type="email" placeholder="you@example.com" value={formData.email} onChange={handleChange} required className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" value={formData.phone} onChange={handleChange} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience">Experience *</Label>
                    <select id="experience" name="experience" value={formData.experience} onChange={handleChange} required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2">
                      <option value="">Select experience level</option>
                      {experienceOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin_url">LinkedIn Profile *</Label>
                  <Input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/yourprofile" value={formData.linkedin_url} onChange={handleChange} required className={inputClass} />
                </div>

                {/* Conditional GitHub for dev roles */}
                {isDev && (
                  <div className="space-y-2">
                    <Label htmlFor="github_url">GitHub Profile *</Label>
                    <Input id="github_url" name="github_url" type="url" placeholder="https://github.com/yourusername" value={formData.github_url} onChange={handleChange} required className={inputClass} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="portfolio_url">Portfolio / Website</Label>
                  <Input id="portfolio_url" name="portfolio_url" type="url" placeholder="https://yourportfolio.com" value={formData.portfolio_url} onChange={handleChange} className={inputClass} />
                </div>

                {/* File Uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <FileUploadField
                    id="resume_file"
                    label="Resume (PDF)"
                    file={resumeFile}
                    onChange={(e) => handleFileChange(e, setResumeFile)}
                    onClear={() => setResumeFile(null)}
                  />
                  <FileUploadField
                    id="cover_letter_file"
                    label="Cover Letter (PDF)"
                    file={coverLetterFile}
                    onChange={(e) => handleFileChange(e, setCoverLetterFile)}
                    onClear={() => setCoverLetterFile(null)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="problem_solving">Describe a real-world problem you faced and how you tackled it *</Label>
                  <Textarea
                    id="problem_solving"
                    name="problem_solving"
                    value={formData.problem_solving}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder="Tell us about a challenging problem you encountered, what was the situation, what did you do, and what was the outcome?"
                    className={inputClass}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 shadow-md h-12 text-base"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function FileUploadField({
  id,
  label,
  file,
  onChange,
  onClear,
}: {
  id: string
  label: string
  file: File | null
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input ref={inputRef} id={id} type="file" accept=".pdf" onChange={onChange} className="hidden" />
      {file ? (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm">
          <FileCheck className="h-4 w-4 text-green-600 shrink-0" />
          <span className="truncate text-green-800 flex-1">{file.name}</span>
          <button type="button" onClick={() => { onClear(); if (inputRef.current) inputRef.current.value = "" }} className="text-slate-400 hover:text-red-500 text-xs font-medium shrink-0">
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 w-full rounded-md border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Upload PDF (max 5MB)
        </button>
      )}
    </div>
  )
}
