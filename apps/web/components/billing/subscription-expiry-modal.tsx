"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/dialog"
import { Button } from "@repo/ui/button"

type Reminder = {
  id: string
  milestone: "7d" | "3d" | "24h"
  periodEnd: string
  planName: string
}

const MILESTONE_TEXT: Record<Reminder["milestone"], string> = {
  "7d": "in 7 days",
  "3d": "in 3 days",
  "24h": "in 24 hours",
}

// Shows a one-time modal when the user's admin-granted plan is about to expire.
// The reminder row is created by the worker's daily cron (7d/3d/24h out); this
// just surfaces the nearest un-dismissed one and marks it seen on close.
export function SubscriptionExpiryModal() {
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api
      .get<{ reminder: Reminder | null }>("/api/v1/billing/info", { requireAuth: true })
      .then((info) => {
        if (info?.reminder) {
          setReminder(info.reminder)
          setOpen(true)
        }
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    setOpen(false)
    if (reminder) {
      api
        .post(`/api/v1/billing/expiry-reminder/${reminder.id}/seen`, undefined, { requireAuth: true })
        .catch(() => {})
    }
  }

  if (!reminder) return null

  const expiresOn = new Date(reminder.periodEnd).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your {reminder.planName} plan expires {MILESTONE_TEXT[reminder.milestone]}</DialogTitle>
          <DialogDescription>
            On {expiresOn} your account will drop back to the free Starter plan and your monthly
            credit allowance will decrease. Upgrade now to keep your current credits and throughput.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>Remind me later</Button>
          <Button asChild onClick={dismiss}>
            <Link href="/pricing">Upgrade my plan</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
