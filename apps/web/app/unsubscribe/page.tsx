"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"

type State = "confirm" | "loading" | "done" | "error" | "invalid"

// useSearchParams must sit inside a Suspense boundary or `next build` fails when
// it tries to prerender this public route.
export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0a29]" />}>
      <UnsubscribeInner />
    </Suspense>
  )
}

function UnsubscribeInner() {
  const userId = useSearchParams().get("u")
  const [state, setState] = useState<State>("confirm")

  useEffect(() => {
    if (!userId) setState("invalid")
  }, [userId])

  const unsubscribe = async () => {
    setState("loading")
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0a29] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-8 text-center space-y-5">
        <Image src="/colored logo.png" alt="Creator AI" width={140} height={40} className="mx-auto h-10 w-auto object-contain" />

        {state === "invalid" ? (
          <p className="text-slate-300">This unsubscribe link is invalid or incomplete.</p>
        ) : state === "done" ? (
          <>
            <h1 className="text-xl font-semibold text-white">You&apos;re unsubscribed</h1>
            <p className="text-slate-400 text-sm">You won&apos;t receive further marketing emails from Creator AI. Account and billing emails are unaffected.</p>
          </>
        ) : state === "error" ? (
          <>
            <p className="text-slate-300">Something went wrong. Please try again.</p>
            <button onClick={unsubscribe} className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Retry</button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white">Unsubscribe from emails?</h1>
            <p className="text-slate-400 text-sm">You&apos;ll stop receiving product updates, tips, and announcements. You can still get account-related emails.</p>
            <button
              onClick={unsubscribe}
              disabled={state === "loading"}
              className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {state === "loading" ? "Unsubscribing…" : "Yes, unsubscribe me"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
