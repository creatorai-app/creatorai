"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { MessageSquareHeart, Send } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@repo/ui/dialog"
import { issueTypes } from "../../../../../packages/ui/src/utils/data"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api-client"
import { useSupabase } from "@/components/supabase-provider"

const MAX_MESSAGE = 5000

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user } = useSupabase()
  const pathname = usePathname()
  const [type, setType] = useState(issueTypes[0]!.value)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.email || !message.trim()) return
    setSending(true)
    try {
      await api.post(
        "/api/v1/support/report-issue",
        {
          subject: `Dashboard feedback: ${type} (${pathname})`.slice(0, 200),
          email: user.email,
          body: message.trim(),
        },
        { requireAuth: true },
      )
      toast.success("Thanks for the feedback!", { description: "It went straight to the team." })
      setMessage("")
      onOpenChange(false)
    } catch (error: any) {
      toast.error("Couldn't send your feedback", {
        description: error?.message || "Please try again.",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg [&>button]:top-5 [&>button]:text-white [&>button]:opacity-80 [&>button:hover]:opacity-100">
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 px-6 py-5 pr-12 text-white">
          <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-2.5 pr-8">
            <div className="rounded-lg bg-white/15 p-2">
              <MessageSquareHeart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold text-white">Send feedback</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-purple-100">
                Found a bug or have an idea? It goes straight to the team.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6 pt-5">
          <div className="space-y-2">
            <Label id="feedback-type" className="text-sm font-medium">
              What kind of feedback?
            </Label>
            <div role="group" aria-labelledby="feedback-type" className="grid grid-cols-3 gap-2">
              {issueTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={type === t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none sm:text-sm",
                    type === t.value
                      ? "border-purple-500 bg-purple-50/70 text-purple-700 ring-1 ring-purple-500 dark:bg-purple-900/20 dark:text-purple-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-purple-300 focus-visible:border-purple-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-purple-700",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-message" className="text-sm font-medium">
              Your feedback
            </Label>
            <Textarea
              id="feedback-message"
              required
              maxLength={MAX_MESSAGE}
              rows={5}
              className="resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-purple-400"
              placeholder="Tell us what happened or what you'd like to see"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={sending || !message.trim() || !user?.email}
            className="w-full gap-1.5 border-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700"
          >
            <Send className="h-4 w-4" />
            {sending ? "Sending..." : "Send feedback"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
