"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { marked } from "marked"
import { adminApi } from "@/hooks/useAdmin"
import { ArrowLeft, Archive, Send, Loader2 } from "lucide-react"
import { AdminButton } from "@/components/admin/admin-button"
import { Input } from "@repo/ui/input"
import { Textarea } from "@repo/ui/textarea"
import { toast } from "sonner"
import type { MailMessage } from "@repo/validation"

const statusColor = (s: string) => {
  switch (s) {
    case "unread": return "bg-blue-900/40 text-blue-400"
    case "replied": return "bg-green-900/40 text-green-400"
    case "archived": return "bg-slate-800 text-slate-500"
    default: return "bg-slate-800 text-slate-400"
  }
}

const looksLikeHtml = (s: string) => /<([a-z][a-z0-9]*)(\s[^>]*)?\/?>/i.test(s)

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// Escape plain text, then turn bare and <angle-bracketed> URLs into links.
function linkifyPlainText(body: string) {
  const escaped = escapeHtml(body)
  return escaped.replace(/(&lt;)?(https?:\/\/[^\s<>&]+)(&gt;)?/g, (_m, lt, url) => {
    const clean = url.replace(/[.,)]+$/, "")
    return `${lt ?? ""}<a href="${clean}" target="_blank" rel="noopener noreferrer" style="color:#818cf8;word-break:break-all">${clean}</a>`
  })
}

// ponytail: wraps the body in a fresh document shell. A body that is itself a full
// <html> doc still renders (browsers show body content), just without our <base>.
function htmlSrcDoc(body: string) {
  return `<!DOCTYPE html><html><head><base target="_blank"><meta charset="utf-8">
<style>body{margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;background:#fff;line-height:1.6}
img{max-width:100%;height:auto}a{color:#4F46E5}table{max-width:100%}</style></head><body>${body}</body></html>`
}

function MailBody({ body }: { body: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const isHtml = looksLikeHtml(body)

  // Auto-size the iframe to its content. sandbox has allow-same-origin (but NOT
  // allow-scripts, so no email JS runs), which lets us read the rendered height
  // and re-measure once images finish loading (emails are image-heavy).
  const resize = useCallback(() => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    if (!frame || !doc?.body) return
    const apply = () => { frame.style.height = `${doc.body.scrollHeight + 8}px` }
    apply()
    doc.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", apply, { once: true })
    })
  }, [])

  if (isHtml) {
    return (
      <iframe
        ref={frameRef}
        title="Message body"
        onLoad={resize}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={htmlSrcDoc(body)}
        className="w-full rounded-lg bg-white"
        style={{ minHeight: 240, border: "none" }}
      />
    )
  }

  return (
    <div
      className="rounded-lg bg-white p-5 text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: linkifyPlainText(body) }}
    />
  )
}

export default function AdminMailDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [mail, setMail] = useState<MailMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState("")
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const m = await adminApi.getMail(id)
      setMail(m)
      setSubject(m.subject?.startsWith("Re:") ? m.subject : `Re: ${m.subject ?? ""}`)
      if (m.status === "unread") {
        adminApi.updateMailStatus(id, "read").catch(() => {})
      }
    } catch {
      setMail(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleArchive = async () => {
    try {
      await adminApi.updateMailStatus(id, "archived")
      toast.success("Mail archived")
      load()
    } catch {
      toast.error("Failed to archive")
    }
  }

  const handleSend = async () => {
    if (!reply.trim()) {
      toast.error("Write a reply first")
      return
    }
    setSending(true)
    try {
      const html = await marked.parse(reply)
      await adminApi.replyToMail(id, subject, html)
      toast.success(`Reply sent to ${mail?.from_email}`)
      setReply("")
      load()
    } catch {
      toast.error("Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="h-64 rounded-xl bg-slate-800/50 animate-pulse" />
  }
  if (!mail) {
    return (
      <div className="space-y-4">
        <AdminButton variant="tertiary" onClick={() => router.push("/dashboard/admin/mails")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </AdminButton>
        <p className="text-slate-400">Mail not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <AdminButton variant="tertiary" size="icon" onClick={() => router.push("/dashboard/admin/mails")}>
          <ArrowLeft className="h-4 w-4" />
        </AdminButton>
        <AdminButton variant="secondary" onClick={handleArchive}>
          <Archive className="h-4 w-4 mr-1" /> Archive
        </AdminButton>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="border-b border-slate-800 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-semibold text-slate-100">{mail.subject}</h1>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(mail.status)}`}>
              {mail.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-slate-500">From: </span>
              <span className="text-slate-200">
                {mail.from_name ? `${mail.from_name} ` : ""}
                &lt;{mail.from_email}&gt;
              </span>
            </div>
            <div>
              <span className="text-slate-500">Received: </span>
              <span className="text-slate-300">{new Date(mail.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <MailBody body={mail.body} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Reply</h2>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-slate-500">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-slate-500">Message</label>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={10}
            placeholder="Write your reply… Markdown supported (**bold**, [links](https://…), lists)."
            className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-sm"
          />
          <p className="text-xs text-slate-500">Markdown is rendered to HTML before sending via Resend.</p>
        </div>
        <div className="flex justify-end">
          <AdminButton variant="primary" onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Send reply to {mail.from_email}
          </AdminButton>
        </div>
      </div>
    </div>
  )
}
