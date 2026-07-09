"use client"

import { useCallback, useEffect, useState } from "react"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { useSupabase } from "@/components/supabase-provider"

export interface HannahMessage {
  role: "user" | "assistant"
  content: string
  kind?: "voice"
  /** Playable data URL for voice messages — live session only, not persisted. */
  audioUrl?: string
  durationSec?: number
}

export interface HannahSession {
  id: string
  createdAt: number
  messages: HannahMessage[]
}

const GREETING: Record<"public" | "dashboard", string> = {
  public:
    "Hi, I'm Hannah 👋 your guide to Creator AI. Ask me about scripts, thumbnails, video ideas, pricing — anything.",
  dashboard:
    "Hey, I'm Hannah 👋 Ask me how any tool works, or about your own account — credits, plan, what you've made so far.",
}

const MAX_SESSIONS = 20

function loadSessions(key: string): HannahSession[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]")
  } catch {
    return []
  }
}

/** Title = first user message, truncated. */
export function sessionTitle(s: HannahSession): string {
  const first = s.messages.find((m) => m.role === "user")?.content ?? "New chat"
  return first.length > 48 ? `${first.slice(0, 48)}…` : first
}

export function useHannah(context: "public" | "dashboard") {
  const { user } = useSupabase()
  // Dashboard history is keyed per user so a shared browser never leaks another
  // account's chats. ponytail: localStorage for both bots; move dashboard history
  // to a Supabase table if cross-device persistence is ever needed.
  const storageKey =
    context === "dashboard" ? `hannah-chats-dashboard-${user?.id ?? "anon"}` : "hannah-chats-public"

  const greeting: HannahMessage = { role: "assistant", content: GREETING[context] }

  const [sessions, setSessions] = useState<HannahSession[]>([])
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [messages, setMessages] = useState<HannahMessage[]>([greeting])
  const [isSending, setIsSending] = useState(false)
  // Index of the reply that just arrived live (drives the typewriter); null for
  // anything loaded from history.
  const [freshIndex, setFreshIndex] = useState<number | null>(null)

  useEffect(() => {
    setSessions(loadSessions(storageKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persist = useCallback(
    (id: string, msgs: HannahMessage[]) => {
      if (!msgs.some((m) => m.role === "user")) return // don't save greeting-only chats
      // Strip audio data URLs before saving — a few voice clips would blow the
      // localStorage quota. Reopened history shows a plain "Voice message" label.
      const slim = msgs.map(({ audioUrl: _drop, ...m }) => m)
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === id)
        const next = [
          { id, createdAt: existing?.createdAt ?? Date.now(), messages: slim },
          ...prev.filter((s) => s.id !== id),
        ].slice(0, MAX_SESSIONS)
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch { /* storage full — history is best-effort */ }
        return next
      })
    },
    [storageKey],
  )

  const post = useCallback(
    async (history: HannahMessage[], audio?: { data: string; mimeType: string }) => {
      // Send only real turns (drop the canned greeting) + cap history to bound cost.
      const turns = history
        .filter((m, i) => !(i === 0 && m.role === "assistant"))
        .slice(-12)
        .map(({ role, content }) => ({ role, content }))
      const body = { messages: turns, ...(audio ? { audio } : {}) }
      return context === "dashboard"
        ? api.post<{ reply: string }>("/api/v1/hannah/chat/dashboard", body, { requireAuth: true })
        : api.post<{ reply: string }>("/api/v1/hannah/chat", body)
    },
    [context],
  )

  const deliver = useCallback(
    async (next: HannahMessage[], audio?: { data: string; mimeType: string }) => {
      setMessages(next)
      setIsSending(true)
      try {
        const { reply } = await post(next, audio)
        const withReply: HannahMessage[] = [...next, { role: "assistant", content: reply }]
        setFreshIndex(withReply.length - 1)
        setMessages(withReply)
        persist(sessionId, withReply)
      } catch (error) {
        const withError: HannahMessage[] = [
          ...next,
          { role: "assistant", content: getApiErrorMessage(error, "I hit a snag — mind trying again?") },
        ]
        setMessages(withError)
        persist(sessionId, withError)
      } finally {
        setIsSending(false)
      }
    },
    [post, persist, sessionId],
  )

  const send = useCallback(
    (text: string) => {
      const content = text.trim()
      if (!content || isSending) return
      deliver([...messages, { role: "user", content }])
    },
    [messages, isSending, deliver],
  )

  const sendVoice = useCallback(
    async (blob: Blob, mimeType: string, durationSec?: number) => {
      if (isSending) return
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "")
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      if (!data) return
      deliver(
        [
          ...messages,
          {
            role: "user",
            content: "🎤 Voice message",
            kind: "voice",
            audioUrl: `data:${mimeType};base64,${data}`,
            durationSec,
          },
        ],
        { data, mimeType },
      )
    },
    [messages, isSending, deliver],
  )

  /** Fresh conversation — called every time the launcher opens the panel. */
  const newChat = useCallback(() => {
    setSessionId(crypto.randomUUID())
    setMessages([greeting])
    setFreshIndex(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])

  const openSession = useCallback(
    (id: string) => {
      const s = loadSessions(storageKey).find((x) => x.id === id)
      if (!s) return
      setSessionId(s.id)
      setMessages(s.messages)
      setFreshIndex(null)
    },
    [storageKey],
  )

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id)
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch { /* ignore */ }
        return next
      })
    },
    [storageKey],
  )

  return {
    messages,
    sessions,
    sessionId,
    isSending,
    freshIndex,
    send,
    sendVoice,
    newChat,
    openSession,
    deleteSession,
  }
}
