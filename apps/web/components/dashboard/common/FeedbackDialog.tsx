"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { MessageSquareHeart } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Textarea } from "@repo/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog"
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="items-center gap-3 text-center sm:items-start sm:text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <MessageSquareHeart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <DialogTitle className="text-xl font-bold">Send feedback</DialogTitle>
            <DialogDescription>
              Found a bug or have an idea? It goes straight to the team. Replies go to {user?.email ?? "your email"}.
            </DialogDescription>
          </DialogHeader>

          <div role="group" aria-label="Feedback type" className="grid grid-cols-3 gap-2">
            {issueTypes.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={type === t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "rounded-md border px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  type === t.value
                    ? "border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="feedback-message" className="sr-only">
              Your feedback
            </label>
            <Textarea
              id="feedback-message"
              required
              maxLength={MAX_MESSAGE}
              className="min-h-36"
              placeholder="Tell us what happened or what you'd like to see"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={sending || !message.trim() || !user?.email}
              className="w-full bg-purple-600 text-white hover:bg-purple-700 sm:w-auto"
            >
              {sending ? "Sending..." : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
