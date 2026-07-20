"use client"

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  adminApi,
  type EmailTemplate,
  type EmailFromAddress,
  type RecipientRecord,
  type SegmentFilter,
} from "@/hooks/useAdmin"
import { resolveMergeTags, MERGE_TAGS } from "@repo/email-templates"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@repo/ui/input"
import { Textarea } from "@repo/ui/textarea"
import { Checkbox } from "@repo/ui/checkbox"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@repo/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@repo/ui/dialog"
import { ArrowLeft, Send, Loader2, Users, Copy, Undo2, Redo2, Plus, Check } from "lucide-react"
import { toast } from "sonner"

const CATEGORY_LABELS: Record<string, string> = {
  product_update: "Product Update",
  tips_and_tricks: "Tips & Tricks",
  feature_spotlight: "Feature Spotlight",
  action_required: "Action Required",
  use_case: "Use Case",
  announcement: "Announcement",
}
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS)
const PLAN_TIERS = ["starter", "creator", "pro", "business", "scale"]
const TRISTATE = [
  { value: "any", label: "Any" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
]
// Dark-theme dropdown panel — text-slate-200 so unfocused items stay readable.
const SELECT_CONTENT = "bg-slate-900 border-slate-700 text-slate-200"

const DEMO_RECIPIENT: RecipientRecord = {
  id: "demo", email: "you@example.com", fullName: "Alex Rivera",
  planTier: "Creator", channelConnected: true, channelName: "Alex Makes", modelTrained: true,
}

type Snapshot = { html: string; subject: string }

// useSearchParams must sit inside a Suspense boundary or `next build` fails.
export default function ComposeCampaignPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-xl bg-slate-800/50 animate-pulse" />}>
      <ComposeCampaignInner />
    </Suspense>
  )
}

function ComposeCampaignInner() {
  const router = useRouter()
  const preselect = useSearchParams().get("template")

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [fromAddresses, setFromAddresses] = useState<EmailFromAddress[]>([])
  const [category, setCategory] = useState<string>("")
  const [templateId, setTemplateId] = useState<string>("")
  const [html, setHtml] = useState<string>("")
  const [subject, setSubject] = useState<string>("")
  const [fromAddress, setFromAddress] = useState<string>("")

  // Undo/redo history for the editor (html + subject move together).
  const [past, setPast] = useState<Snapshot[]>([])
  const [future, setFuture] = useState<Snapshot[]>([])
  const lastSnap = useRef(0)

  const [seg, setSeg] = useState({ channel: "any", trained: "any", plan: "any", days: "" })
  const [recipients, setRecipients] = useState<RecipientRecord[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)

  const categories = useMemo(() => [...new Set(templates.map((t) => t.category))], [templates])
  const categoryTemplates = useMemo(() => templates.filter((t) => t.category === category), [templates, category])
  const template = templates.find((t) => t.id === templateId) ?? null
  const edited = template ? html !== template.html || subject !== template.subject : false

  useEffect(() => {
    Promise.all([adminApi.getEmailTemplates(), adminApi.getEmailFromAddresses()])
      .then(([tpls, froms]) => {
        setTemplates(tpls)
        setFromAddresses(froms)
        if (froms[0]) setFromAddress(froms[0].email)
        const first = tpls.find((t) => t.id === preselect) ?? tpls[0]
        if (first) { setCategory(first.category); loadTemplate(first, froms) }
      })
      .catch(() => toast.error("Failed to load templates"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTemplate = (t: EmailTemplate, froms?: EmailFromAddress[]) => {
    setTemplateId(t.id)
    setHtml(t.html)
    setSubject(t.subject)
    setPast([]); setFuture([]) // fresh template = fresh history
    const pool = froms ?? fromAddresses
    if (t.default_from_address && pool.some((f) => f.email === t.default_from_address)) {
      setFromAddress(t.default_from_address)
    }
  }

  const onCategoryChange = (cat: string) => {
    setCategory(cat)
    const first = templates.find((t) => t.category === cat)
    if (first) loadTemplate(first)
    const def = first?.default_segment
    if (def) {
      setSeg((s) => ({
        ...s,
        channel: typeof def.channelConnected === "boolean" ? String(def.channelConnected) : "any",
        trained: typeof def.modelTrained === "boolean" ? String(def.modelTrained) : "any",
        plan: def.planTier ?? "any",
      }))
    }
  }

  // Push the pre-edit state to history, coalescing rapid keystrokes.
  const snapshot = (force = false) => {
    const now = Date.now()
    if (!force && now - lastSnap.current < 500) return
    lastSnap.current = now
    setPast((p) => [...p, { html, subject }].slice(-100))
    setFuture([])
  }
  const onHtmlChange = (v: string) => { snapshot(); setHtml(v) }
  const onSubjectChange = (v: string) => { snapshot(); setSubject(v) }

  const undo = () => {
    setPast((p) => {
      const prev = p[p.length - 1]
      if (!prev) return p
      setFuture((f) => [{ html, subject }, ...f].slice(0, 100))
      setHtml(prev.html); setSubject(prev.subject)
      lastSnap.current = 0
      return p.slice(0, -1)
    })
  }
  const redo = () => {
    setFuture((f) => {
      const next = f[0]
      if (!next) return f
      setPast((p) => [...p, { html, subject }].slice(-100))
      setHtml(next.html); setSubject(next.subject)
      lastSnap.current = 0
      return f.slice(1)
    })
  }

  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(html)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { toast.error("Copy failed") }
  }

  const insertTag = (tag: string) => {
    const el = editorRef.current
    if (!el) return
    const start = el.selectionStart ?? html.length
    const end = el.selectionEnd ?? html.length
    const snippet = `{{${tag}}}`
    snapshot(true)
    setHtml(html.slice(0, start) + snippet + html.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + snippet.length
    })
  }

  const buildFilter = (): SegmentFilter => {
    const f: SegmentFilter = {}
    if (seg.channel !== "any") f.channelConnected = seg.channel === "true"
    if (seg.trained !== "any") f.modelTrained = seg.trained === "true"
    if (seg.plan !== "any") f.planTier = seg.plan
    const days = Number(seg.days)
    if (days > 0) f.signupBeforeDays = days
    return f
  }

  const loadRecipients = async () => {
    setLoadingRecipients(true)
    try {
      const recs = await adminApi.previewRecipients(buildFilter())
      setRecipients(recs)
      setSelected(new Set(recs.map((r) => r.id)))
    } catch {
      toast.error("Failed to load recipients")
    } finally {
      setLoadingRecipients(false)
    }
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const previewRecipient = useMemo(() => {
    const firstSelected = recipients.find((r) => selected.has(r.id))
    return firstSelected ?? DEMO_RECIPIENT
  }, [recipients, selected])
  const previewHtml = useMemo(() => resolveMergeTags(html, previewRecipient), [html, previewRecipient])

  const resizeFrame = useCallback(() => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc?.body) return
    frame.style.height = `${doc.body.scrollHeight + 8}px`
  }, [])

  const doSend = async () => {
    setSending(true)
    try {
      const res = await adminApi.sendCampaign({
        templateId, fromAddress, recipientIds: [...selected],
        subject, html, edited, segmentFilter: buildFilter(),
      })
      toast.success(`Queued to ${res.recipientCount} recipient(s)`)
      setConfirmOpen(false)
      router.push("/dashboard/admin/emails/history")
    } catch {
      toast.error("Failed to queue campaign")
    } finally {
      setSending(false)
    }
  }

  const selectedCount = selected.size
  const canSend = !!templateId && !!fromAddress && selectedCount > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <AdminButton variant="tertiary" size="icon" onClick={() => router.push("/dashboard/admin/emails")}>
            <ArrowLeft className="h-4 w-4" />
          </AdminButton>
          <h1 className="text-2xl font-bold text-slate-100">Compose campaign</h1>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="secondary" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New template
          </AdminButton>
          <AdminButton variant="primary" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
            <Send className="h-4 w-4 mr-1" /> Review &amp; send
          </AdminButton>
        </div>
      </div>

      {/* Category + variant + from */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Category">
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Template">
          <Select value={templateId} onValueChange={(id) => { const t = templates.find((x) => x.id === id); if (t) loadTemplate(t) }}>
            <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue placeholder="Pick a template" /></SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              {categoryTemplates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="From">
          <Select value={fromAddress} onValueChange={setFromAddress}>
            <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue placeholder="From address" /></SelectTrigger>
            <SelectContent className={SELECT_CONTENT}>
              {fromAddresses.map((f) => <SelectItem key={f.id} value={f.email}>{f.display_name} &lt;{f.email}&gt;</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Subject (editable) */}
      <Field label={`Subject${edited ? " • edited" : ""}`}>
        <Input value={subject} onChange={(e) => onSubjectChange(e.target.value)}
          className="bg-slate-900 border-slate-700 text-slate-100" placeholder="Email subject" />
      </Field>

      {/* Editor + live preview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-500">HTML</label>
            <div className="flex items-center gap-1 shrink-0">
              <IconBtn title="Copy HTML" onClick={copyHtml}>{copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}</IconBtn>
              <IconBtn title="Undo" onClick={undo} disabled={!past.length}><Undo2 className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn title="Redo" onClick={redo} disabled={!future.length}><Redo2 className="h-3.5 w-3.5" /></IconBtn>
            </div>
          </div>
          {/* Merge-tag chips wrap on their own row so they never overlap the toolbar. */}
          <div className="flex flex-wrap gap-1">
            {MERGE_TAGS.map((m) => (
              <button key={m.tag} title={m.description} onClick={() => insertTag(m.tag)}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono hover:bg-slate-700">
                {`{{${m.tag}}}`}
              </button>
            ))}
          </div>
          <Textarea ref={editorRef} value={html} onChange={(e) => onHtmlChange(e.target.value)} rows={20}
            className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-xs" spellCheck={false} />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-500">
            Preview (as {previewRecipient.fullName ?? previewRecipient.email})
          </label>
          <iframe ref={frameRef} title="Preview" onLoad={resizeFrame} srcDoc={previewHtml}
            sandbox="allow-same-origin" className="w-full rounded-lg bg-white" style={{ minHeight: 400, border: "none" }} />
        </div>
      </div>

      {/* Segment filter */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Segment</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Channel connected"><TriSelect value={seg.channel} onChange={(v) => setSeg((s) => ({ ...s, channel: v }))} /></Field>
          <Field label="AI trained"><TriSelect value={seg.trained} onChange={(v) => setSeg((s) => ({ ...s, trained: v }))} /></Field>
          <Field label="Plan tier">
            <Select value={seg.plan} onValueChange={(v) => setSeg((s) => ({ ...s, plan: v }))}>
              <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent className={SELECT_CONTENT}>
                <SelectItem value="any">Any</SelectItem>
                {PLAN_TIERS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Signed up ≥ N days ago">
            <Input type="number" min={0} value={seg.days} onChange={(e) => setSeg((s) => ({ ...s, days: e.target.value }))}
              placeholder="any" className="bg-slate-900 border-slate-700 text-slate-100" />
          </Field>
        </div>
        <AdminButton variant="secondary" onClick={loadRecipients} disabled={loadingRecipients}>
          {loadingRecipients ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}
          Load recipients
        </AdminButton>
      </div>

      {/* Recipient checklist */}
      {recipients.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
            <span className="text-sm font-semibold text-slate-300">{selectedCount} of {recipients.length} selected</span>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set(recipients.map((r) => r.id)))} className="text-xs text-indigo-400 hover:underline">Select all</button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:underline">Clear</button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
            {recipients.map((r) => (
              <label key={r.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-900/40 cursor-pointer">
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 truncate">{r.fullName || r.email}</div>
                  <div className="text-xs text-slate-500 truncate">{r.email}</div>
                </div>
                <div className="hidden sm:flex gap-1.5 text-[11px]">
                  {r.planTier && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">{r.planTier}</span>}
                  <span className={`px-1.5 py-0.5 rounded ${r.channelConnected ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"}`}>{r.channelConnected ? "channel" : "no channel"}</span>
                  <span className={`px-1.5 py-0.5 rounded ${r.modelTrained ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"}`}>{r.modelTrained ? "trained" : "untrained"}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Send this campaign?</DialogTitle>
            <DialogDescription className="text-slate-400">This sends immediately once queued. Double-check the count.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 text-sm text-slate-300">
            <Row label="From" value={fromAddress} />
            <Row label="Category" value={CATEGORY_LABELS[category] ?? category} />
            <Row label="Template" value={template?.name ?? "—"} />
            <Row label="Subject" value={subject} />
            <Row label="Edited before send" value={edited ? "Yes (saved to template)" : "No"} />
            <Row label="Recipients" value={String(selectedCount)} />
          </div>
          <DialogFooter>
            <AdminButton variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={doSend} disabled={sending || !canSend}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send to {selectedCount}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewTemplateDialog
        open={newOpen} onOpenChange={setNewOpen} fromAddresses={fromAddresses}
        onCreated={(t) => {
          setTemplates((prev) => [t, ...prev])
          setCategory(t.category)
          loadTemplate(t)
        }}
      />
    </div>
  )
}

function NewTemplateDialog({ open, onOpenChange, fromAddresses, onCreated }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  fromAddresses: EmailFromAddress[]
  onCreated: (t: EmailTemplate) => void
}) {
  const [category, setCategory] = useState("product_update")
  const [from, setFrom] = useState("")
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!subject.trim() || !html.trim()) { toast.error("Subject and HTML are required"); return }
    setSaving(true)
    try {
      const created = await adminApi.createEmailTemplate({ category, subject, html, defaultFromAddress: from || undefined })
      toast.success("Template created")
      onCreated(created)
      onOpenChange(false)
      setSubject(""); setHtml(""); setFrom("")
    } catch {
      toast.error("Failed to create template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-100">New template</DialogTitle>
          <DialogDescription className="text-slate-400">Saved to the library and loaded into the editor.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent className={SELECT_CONTENT}>
                  {CATEGORY_KEYS.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="From">
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200"><SelectValue placeholder="Default from" /></SelectTrigger>
                <SelectContent className={SELECT_CONTENT}>
                  {fromAddresses.map((f) => <SelectItem key={f.id} value={f.email}>{f.display_name} &lt;{f.email}&gt;</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-slate-800 border-slate-700 text-slate-100" placeholder="Email subject" />
          </Field>
          <Field label="HTML">
            <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={10}
              className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-xs" spellCheck={false}
              placeholder="<!DOCTYPE html>… use {{firstName}}, {{planTier}}, {{unsubscribeUrl}} …" />
          </Field>
        </div>
        <DialogFooter>
          <AdminButton variant="secondary" onClick={() => onOpenChange(false)}>Cancel</AdminButton>
          <AdminButton variant="primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Save template
          </AdminButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IconBtn({ title, onClick, disabled, children }: {
  title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      className="p-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function TriSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200"><SelectValue /></SelectTrigger>
      <SelectContent className={SELECT_CONTENT}>
        {TRISTATE.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right break-all">{value}</span>
    </div>
  )
}
