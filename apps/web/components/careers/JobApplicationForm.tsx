"use client"

import type React from "react"
import { useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileCheck, Loader2, Upload } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"

const EXPERIENCE_OPTIONS = ["0-1 years", "1-3 years", "3-5 years", "5-8 years", "8+ years"]

/** Teams where a GitHub profile is required rather than optional. */
const DEV_TEAMS = ["Engineering", "AI"]

function isDevTeam(team?: string): boolean {
  return DEV_TEAMS.some((t) => (team || "").toLowerCase().includes(t.toLowerCase()))
}

interface FormState {
  full_name: string
  email: string
  phone: string
  experience: string
  linkedin_url: string
  github_url: string
  portfolio_url: string
  problem_solving: string
}

const initialFormState: FormState = {
  full_name: "",
  email: "",
  phone: "",
  experience: "",
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  problem_solving: "",
}

const inputClass = "bg-white border-slate-200 placeholder:text-slate-400 focus-visible:ring-purple-500"

export default function JobApplicationForm({
  position,
  jobPostId,
  team,
}: {
  position: string
  jobPostId?: string
  /** The role's team. Dev teams get a required GitHub field. */
  team?: string
}) {
  // Derived here rather than by the caller: a Server Component cannot call a
  // function exported from a "use client" module, only render or pass props.
  const requireGithub = isDevTeam(team)

  const [formData, setFormData] = useState<FormState>(initialFormState)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void
  ) => {
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
      fd.append("position", position || "General Application")
      fd.append("full_name", formData.full_name)
      fd.append("email", formData.email)
      fd.append("phone", formData.phone)
      fd.append("linkedin_url", formData.linkedin_url)
      fd.append("experience", formData.experience)
      fd.append("problem_solving", formData.problem_solving)
      if (formData.github_url) fd.append("github_url", formData.github_url)
      if (formData.portfolio_url) fd.append("portfolio_url", formData.portfolio_url)
      if (jobPostId) fd.append("job_post_id", jobPostId)
      if (resumeFile) fd.append("resume_file", resumeFile)
      if (coverLetterFile) fd.append("cover_letter_file", coverLetterFile)

      const response = await fetch("/api/careers/apply", { method: "POST", body: fd })
      const result = await response.json()

      if (!response.ok) throw new Error(result.error || "Failed to submit application")

      setSubmitted(true)
      toast.success("Application submitted!", {
        description: "We'll review your application and get back to you soon.",
      })
    } catch (error) {
      toast.error("Failed to submit application", {
        description:
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Application submitted</h2>
        <p className="text-slate-600 max-w-md mx-auto mb-6">
          Thank you for your interest in the <strong>{position || "open"}</strong> role. We&apos;ll
          review your application and get back to you within a few days.
        </p>
        <Link
          href="/careers"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Careers
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            {EXPERIENCE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedin_url">LinkedIn Profile *</Label>
        <Input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/yourprofile" value={formData.linkedin_url} onChange={handleChange} required className={inputClass} />
      </div>

      {requireGithub && (
        <div className="space-y-2">
          <Label htmlFor="github_url">GitHub Profile *</Label>
          <Input id="github_url" name="github_url" type="url" placeholder="https://github.com/yourusername" value={formData.github_url} onChange={handleChange} required className={inputClass} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="portfolio_url">Portfolio / Website</Label>
        <Input id="portfolio_url" name="portfolio_url" type="url" placeholder="https://yourportfolio.com" value={formData.portfolio_url} onChange={handleChange} className={inputClass} />
      </div>

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
        <Label htmlFor="problem_solving">
          Describe a real-world problem you faced and how you tackled it *
        </Label>
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
          <button
            type="button"
            onClick={() => { onClear(); if (inputRef.current) inputRef.current.value = "" }}
            className="text-slate-400 hover:text-red-500 text-xs font-medium shrink-0"
          >
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
