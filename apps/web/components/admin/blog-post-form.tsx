"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Save, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@repo/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { auditPost } from "@/lib/blog-seo-rules"
import type { BlogBrandedCta, BlogFaq, BlogPost, BlogVideo } from "@repo/validation"

/** One editor for both creating and editing, so the two pages cannot drift. */

export interface BlogFormState {
  title: string
  slug: string
  excerpt: string
  content: string
  category: string
  status: "draft" | "published" | "archived"
  featured: boolean
  tags: string
  author_name: string
  read_time: string
  published_at: string
  seo_title: string
  seo_description: string
  focus_keyword: string
  keywords: string
  faqs: BlogFaq[]
  videos: BlogVideo[]
  branded_cta: BlogBrandedCta
}

/** `datetime-local` needs "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** An all-blank CTA means "no CTA": payloadFromForm sends null for it. */
const EMPTY_CTA: BlogBrandedCta = { title: "", description: "", buttonLabel: "", buttonHref: "" }

export const EMPTY_FORM: BlogFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category: "general",
  status: "draft",
  featured: false,
  tags: "",
  author_name: "Afrin Nahar",
  read_time: "",
  published_at: "",
  seo_title: "",
  seo_description: "",
  focus_keyword: "",
  keywords: "",
  faqs: [],
  videos: [],
  branded_cta: EMPTY_CTA,
}

export function formFromPost(blog: BlogPost): BlogFormState {
  return {
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt || "",
    content: blog.content,
    category: blog.category || "general",
    status: blog.status,
    featured: blog.featured,
    tags: blog.tags?.join(", ") || "",
    author_name: blog.author_name || "",
    read_time: blog.read_time || "",
    published_at: toLocalInput(blog.published_at),
    seo_title: blog.seo_title || "",
    seo_description: blog.seo_description || "",
    focus_keyword: blog.focus_keyword || "",
    keywords: blog.keywords?.join(", ") || "",
    faqs: blog.faqs ?? [],
    videos: blog.videos ?? [],
    branded_cta: { ...EMPTY_CTA, ...(blog.branded_cta ?? {}) },
  }
}

const splitList = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean)
const orNull = (s: string) => s.trim() || null

export function payloadFromForm(form: BlogFormState) {
  return {
    title: form.title,
    slug: form.slug,
    excerpt: orNull(form.excerpt),
    content: form.content,
    category: form.category,
    status: form.status,
    featured: form.featured,
    tags: splitList(form.tags),
    author_name: orNull(form.author_name),
    read_time: orNull(form.read_time),
    published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
    seo_title: orNull(form.seo_title),
    seo_description: orNull(form.seo_description),
    focus_keyword: orNull(form.focus_keyword),
    keywords: splitList(form.keywords),
    faqs: form.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    videos: form.videos.filter((v) => v.youtubeId.trim()),
    branded_cta: brandedCtaOrNull(form.branded_cta),
  }
}

/**
 * The DB rejects a CTA missing any of the three texts, so a half-filled card is
 * stored as no card rather than as a save error the author cannot decode.
 */
function brandedCtaOrNull(cta: BlogBrandedCta): BlogBrandedCta | null {
  const title = cta.title.trim()
  const description = cta.description.trim()
  const buttonLabel = cta.buttonLabel.trim()
  if (!title || !description || !buttonLabel) return null
  return { title, description, buttonLabel, buttonHref: cta.buttonHref?.trim() || "/signup" }
}

const slugify = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

const inputCls = "bg-slate-900 border-slate-700 text-slate-200"
const labelCls = "text-sm text-slate-400 mb-1 block"
const areaCls =
  "w-full rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function IconButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-slate-500 hover:text-rose-400 shrink-0"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

/** Live version of `pnpm seo:audit`, so nothing is published blind. */
function SeoChecklist({ form }: { form: BlogFormState }) {
  const { gaps, stats } = useMemo(
    () =>
      auditPost({
        slug: form.slug,
        title: form.title,
        excerpt: form.excerpt,
        content: form.content,
        seoTitle: form.seo_title,
        seoDescription: form.seo_description,
        focusKeyword: form.focus_keyword,
        hasVideo: form.videos.length > 0,
      }),
    [form],
  )

  const tiles: Array<[string, string | number, boolean]> = [
    ["Words", stats.words, stats.words >= 1000],
    ["Keyword uses", stats.keywordCount, stats.keywordCount >= 7],
    ["Density", `${stats.density.toFixed(2)}%`, stats.density >= 0.9],
    ["Internal links", stats.internalLinks, stats.internalLinks > 0],
    ["External links", stats.externalLinks, stats.externalLinks > 0],
    ["URL length", stats.urlLength, stats.urlLength >= 70],
  ]

  return (
    <Section title="SEO check" hint="The same rules pnpm seo:audit runs. Gaps never block saving a draft.">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        {tiles.map(([label, value, ok]) => (
          <div key={label} className="rounded-lg bg-slate-900 px-3 py-2">
            <div className="text-slate-500">{label}</div>
            <div className={ok ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {gaps.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> All checks pass.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {gaps.map((gap) => (
            <li key={gap} className="flex items-start gap-2 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{gap}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

export function BlogPostForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: BlogFormState
  submitLabel: string
  onSubmit: (payload: ReturnType<typeof payloadFromForm>) => Promise<void>
}) {
  const router = useRouter()
  const [form, setForm] = useState<BlogFormState>(initial)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof BlogFormState>(key: K, value: BlogFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const setFaq = (i: number, patch: Partial<BlogFaq>) =>
    set("faqs", form.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  const setCta = (patch: Partial<BlogBrandedCta>) =>
    set("branded_cta", { ...form.branded_cta, ...patch })

  const setVideo = (i: number, patch: Partial<BlogVideo>) =>
    set("videos", form.videos.map((v, j) => (j === i ? { ...v, ...patch } : v)))

  const publishBlockers =
    form.status === "published"
      ? ([
          ["excerpt", form.excerpt],
          ["SEO title", form.seo_title],
          ["meta description", form.seo_description],
          ["focus keyword", form.focus_keyword],
        ] as const)
          .filter(([, v]) => !v.trim())
          .map(([label]) => label)
      : []

  const scheduled =
    form.status === "published" &&
    !!form.published_at &&
    new Date(form.published_at).getTime() > Date.now()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      await onSubmit(payloadFromForm(form))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Post">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  title: e.target.value,
                  // Stop auto-filling once the slug is edited by hand: changing a
                  // published slug breaks its URL and every link into it.
                  slug: f.slug === slugify(f.title) ? slugify(e.target.value) : f.slug,
                }))
              }
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Slug</label>
            <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls} required />
            <p className="text-xs text-slate-600 mt-1">/blog/{form.slug || "…"}</p>
          </div>
        </div>

        <div>
          <label className={labelCls}>Excerpt</label>
          <textarea
            value={form.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            rows={2}
            className={areaCls}
          />
        </div>

        <div>
          <label className={labelCls}>Content (Markdown)</label>
          <textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            rows={20}
            className={`${areaCls} font-mono text-xs`}
            required
          />
        </div>
      </Section>

      <Section title="Search" hint="Required to publish. The focus keyword must be unique across the blog.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>SEO title</label>
            <Input value={form.seo_title} onChange={(e) => set("seo_title", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Focus keyword</label>
            <Input
              value={form.focus_keyword}
              onChange={(e) => set("focus_keyword", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>
            Meta description{" "}
            <span className={form.seo_description.length > 155 ? "text-rose-400" : "text-slate-600"}>
              {form.seo_description.length}/155
            </span>
          </label>
          <textarea
            value={form.seo_description}
            onChange={(e) => set("seo_description", e.target.value)}
            rows={2}
            className={areaCls}
          />
        </div>
        <div>
          <label className={labelCls}>Supporting keywords (comma-separated)</label>
          <Input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} className={inputCls} />
        </div>
      </Section>

      <Section title="Publishing">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <Select value={form.status} onValueChange={(v) => set("status", v as BlogFormState["status"])}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Publish date</label>
            <Input
              type="datetime-local"
              value={form.published_at}
              onChange={(e) => set("published_at", e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
            <p className="text-xs text-slate-600 mt-1">
              {scheduled
                ? "Future date: the post stays hidden until then, and appears within an hour of it."
                : "Leave empty to stamp now on publish. Backdating reorders the blog."}
            </p>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Read time</label>
            <Input
              value={form.read_time}
              onChange={(e) => set("read_time", e.target.value)}
              placeholder="12 min read"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Author</label>
            <Input
              value={form.author_name}
              onChange={(e) => set("author_name", e.target.value)}
              placeholder="Afrin Nahar"
              className={inputCls}
            />
            <p className="text-xs text-slate-600 mt-1">Avatar and socials come from lib/authors.ts.</p>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Tags (comma-separated)</label>
            <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => set("featured", e.target.checked)}
            className="rounded border-slate-700 bg-slate-900"
          />
          <span className="text-sm text-slate-300">Featured post</span>
        </label>
      </Section>

      <Section title="FAQs" hint="Rendered under the article and emitted as FAQPage structured data.">
        {form.faqs.map((faq, i) => (
          <div key={i} className="rounded-lg border border-slate-800 p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={faq.question}
                onChange={(e) => setFaq(i, { question: e.target.value })}
                placeholder="Question"
                className={inputCls}
              />
              <IconButton
                onClick={() => set("faqs", form.faqs.filter((_, j) => j !== i))}
                label={`Remove FAQ ${i + 1}`}
              />
            </div>
            <textarea
              value={faq.answer}
              onChange={(e) => setFaq(i, { answer: e.target.value })}
              rows={3}
              placeholder="Answer"
              className={areaCls}
            />
          </div>
        ))}
        <AdminButton
          type="button"
          variant="tertiary"
          onClick={() => set("faqs", [...form.faqs, { question: "", answer: "" }])}
        >
          <Plus className="h-4 w-4" /> Add FAQ
        </AdminButton>
      </Section>

      <Section
        title="Branded CTA"
        hint="Sign-up card shown halfway down the post. Leave the fields empty for no card; match the offer to what the post is about."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <Input
              value={form.branded_cta.title}
              onChange={(e) => setCta({ title: e.target.value })}
              placeholder="Dub a 60-second video now"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Button label</label>
            <Input
              value={form.branded_cta.buttonLabel}
              onChange={(e) => setCta({ buttonLabel: e.target.value })}
              placeholder="Try AI dubbing free"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={form.branded_cta.description}
            onChange={(e) => setCta({ description: e.target.value })}
            rows={2}
            className={areaCls}
          />
        </div>
        <div>
          <label className={labelCls}>Button link</label>
          <Input
            value={form.branded_cta.buttonHref ?? ""}
            onChange={(e) => setCta({ buttonHref: e.target.value })}
            placeholder="/signup"
            className={inputCls}
          />
          <p
            className={`text-xs mt-1 ${
              form.branded_cta.buttonHref && !form.branded_cta.buttonHref.startsWith("/")
                ? "text-rose-400"
                : "text-slate-600"
            }`}
          >
            Site-relative path only, e.g. /signup or /pricing. Defaults to /signup.
          </p>
        </div>
      </Section>

      <Section title="Videos" hint="Emitted as VideoObject data. A video may only be declared on one post.">
        {form.videos.map((video, i) => (
          <div key={i} className="rounded-lg border border-slate-800 p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={video.youtubeId}
                onChange={(e) => setVideo(i, { youtubeId: e.target.value })}
                placeholder="YouTube ID"
                className={inputCls}
              />
              <Input
                type="date"
                value={video.uploadDate}
                onChange={(e) => setVideo(i, { uploadDate: e.target.value })}
                className={`${inputCls} [color-scheme:dark]`}
              />
              <Input
                value={video.duration ?? ""}
                onChange={(e) => setVideo(i, { duration: e.target.value })}
                placeholder="PT3M20S"
                className={inputCls}
              />
              <IconButton
                onClick={() => set("videos", form.videos.filter((_, j) => j !== i))}
                label={`Remove video ${i + 1}`}
              />
            </div>
            <Input
              value={video.name}
              onChange={(e) => setVideo(i, { name: e.target.value })}
              placeholder="Video title"
              className={inputCls}
            />
            <textarea
              value={video.description}
              onChange={(e) => setVideo(i, { description: e.target.value })}
              rows={2}
              placeholder="One-line description"
              className={areaCls}
            />
          </div>
        ))}
        <AdminButton
          type="button"
          variant="tertiary"
          onClick={() =>
            set("videos", [...form.videos, { youtubeId: "", name: "", description: "", uploadDate: "", duration: "" }])
          }
        >
          <Plus className="h-4 w-4" /> Add video
        </AdminButton>
      </Section>

      <SeoChecklist form={form} />

      {publishBlockers.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-rose-400">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          Publishing needs {publishBlockers.join(", ")}. Saving as published will be rejected.
        </p>
      )}

      <div className="flex gap-3">
        <AdminButton type="button" variant="tertiary" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Cancel
        </AdminButton>
        <AdminButton type="submit" variant="primary" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : submitLabel}
        </AdminButton>
      </div>
    </form>
  )
}
