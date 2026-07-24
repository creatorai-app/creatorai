"use client"

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-m";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, History, Mic, Pause, Play, Send, SquarePen, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import HannahLogo from "./HannahLogo";
import { useHannah, sessionTitle, type HannahSession } from "@/hooks/useHannah"

const SUGGESTIONS: Record<"public" | "dashboard", string[]> = {
  public: ["What can Creator AI do?", "How does script writing work?", "How much does it cost?"],
  dashboard: ["How do I train the AI?", "How many credits do I have left?", "What did I make recently?"],
}

function MessageBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          const url = href ?? "#"
          const internal = url.startsWith("/")
          const className = "font-medium text-purple-600 underline underline-offset-2 hover:text-pink-600"
          return internal ? (
            <Link href={url} className={className}>
              {children}
            </Link>
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
              {children}
            </a>
          )
        },
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

/** Elegant "writing" reveal: characters stream in, markdown re-renders as it grows. */
function TypewriterBody({ content, onGrow }: { content: string; onGrow: () => void }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let n = 0
    const iv = setInterval(() => {
      n = Math.min(n + 7, content.length) // ~350 chars/sec
      setShown(n)
      onGrow()
      if (n >= content.length) clearInterval(iv)
    }, 20)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])
  return <MessageBody content={content.slice(0, shown)} />
}

/** Playable voice-message bubble: play/pause + progress bars + time. */
function VoiceBubble({ src, durationSec }: { src: string; durationSec?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1

  const getAudio = () => {
    if (!audioRef.current) {
      const a = new Audio(src)
      a.ontimeupdate = () => {
        // Chrome reports Infinity for webm blob durations — fall back to the recorded length.
        const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : durationSec || 1
        setProgress(Math.min(a.currentTime / dur, 1))
      }
      a.onended = () => {
        setPlaying(false)
        setProgress(0)
      }
      audioRef.current = a
    }
    return audioRef.current
  }

  useEffect(
    () => () => {
      audioRef.current?.pause()
    },
    [],
  )

  const toggle = () => {
    const a = getAudio()
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.play()
      setPlaying(true)
    }
  }

  const BARS = 20
  const total = durationSec ?? 0
  const shownTime = playing ? Math.round(progress * (total || 0)) : total
  return (
    <span className="flex items-center gap-2.5">
      <button
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
      </button>
      <span className="flex h-6 items-center gap-[2.5px]" aria-hidden>
        {Array.from({ length: BARS }).map((_, i) => {
          const played = (i + 1) / BARS <= progress
          return (
            <motion.span
              key={i}
              className={cn("w-[3px] rounded-full", played ? "bg-white" : "bg-white/40")}
              style={{ height: `${25 + ((i * 37) % 55)}%` }}
              animate={playing && !played ? { scaleY: [1, 1.4, 1] } : { scaleY: 1 }}
              transition={{ duration: 0.7 + ((i * 13) % 5) / 10, repeat: playing ? Infinity : 0 }}
            />
          )
        })}
      </span>
      {total > 0 && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/80">
          {Math.floor(shownTime / 60)}:{String(shownTime % 60).padStart(2, "0")}
        </span>
      )}
    </span>
  )
}

/** Recording strip: pulsing dot + live equalizer bars + timer. */
function RecordingBar({
  seconds,
  onCancel,
  onSend,
}: {
  seconds: number
  onCancel: () => void
  onSend: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 items-center gap-3 rounded-full border border-red-200 bg-red-50 px-4 py-2 dark:border-red-900/50 dark:bg-red-950/30"
    >
      <motion.span
        className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      <div className="flex h-6 flex-1 items-center justify-center gap-[3px]" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-gradient-to-t from-purple-500 to-pink-400"
            animate={{ height: ["30%", `${35 + ((i * 37) % 60)}%`, "30%"] }}
            transition={{ duration: 0.8 + ((i * 13) % 7) / 10, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums text-red-600 dark:text-red-400">
        {String(Math.floor(seconds / 60)).padStart(1, "0")}:{String(seconds % 60).padStart(2, "0")}
      </span>
      <button
        onClick={onCancel}
        aria-label="Cancel recording"
        className="shrink-0 rounded-full p-1 text-slate-400 transition hover:text-red-500"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        onClick={onSend}
        aria-label="Send voice message"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white transition hover:opacity-90"
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

const MAX_RECORD_SECONDS = 60

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
  return candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) ?? ""
}

export default function HannahChat({
  context,
  autoOpen = false,
}: {
  context: "public" | "dashboard"
  /** Set when this component was itself lazy-loaded by a launcher click. */
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const [view, setView] = useState<"chat" | "history">("chat")
  const [input, setInput] = useState("")
  const { messages, sessions, isSending, freshIndex, send, sendVoice, newChat, openSession, deleteSession } =
    useHannah(context)
  const scrollRef = useRef<HTMLDivElement>(null)

  // voice recording state
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const discardRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0) // survives the state reset in stopTracks — read by onstop

  const scrollToBottom = () =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending, open, view])

  const stopTracks = () => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    setRecording(false)
    setRecordSeconds(0)
  }

  const startRecording = async () => {
    if (recording || isSending) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined)
      chunksRef.current = []
      discardRef.current = false
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
      rec.onstop = () => {
        const type = (rec.mimeType || "audio/webm").split(";")[0] ?? "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        stopTracks()
        if (!discardRef.current && blob.size > 0) sendVoice(blob, type, Math.max(elapsedRef.current, 1))
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setRecordSeconds(0)
      elapsedRef.current = 0
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          elapsedRef.current = s + 1
          if (s + 1 >= MAX_RECORD_SECONDS) recorderRef.current?.stop() // auto-send at cap
          return s + 1
        })
      }, 1000)
    } catch {
      // mic permission denied — silently no-op; the button simply won't record
    }
  }

  const finishRecording = () => recorderRef.current?.state === "recording" && recorderRef.current.stop()
  const cancelRecording = () => {
    discardRef.current = true
    finishRecording()
  }

  // cleanup if the panel unmounts mid-recording
  useEffect(() => () => stopTracks(), [])

  const submit = (text: string) => {
    if (!text.trim()) return
    send(text)
    setInput("")
  }

  const openFresh = () => {
    newChat() // every launcher click starts a clean conversation; history keeps the old ones
    setView("chat")
    setOpen(true)
  }

  // Mounting already-open means the placeholder launcher was clicked, which is
  // the same intent as openFresh() — start clean.
  useEffect(() => {
    if (autoOpen) newChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showSuggestions = messages.length === 1 && !isSending

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="mb-3 flex h-[32rem] max-h-[75vh] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            {/* header */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-3 text-white">
              <HannahLogo size={36} />
              <div className="flex-1">
                <p className="font-semibold leading-tight">Hannah</p>
                <p className="text-xs text-white/80">Ask me anything ✨</p>
              </div>
              <button
                onClick={() => {
                  newChat()
                  setView("chat")
                }}
                aria-label="New chat"
                title="New chat"
                className="rounded-full p-1.5 transition hover:bg-white/20"
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView(view === "history" ? "chat" : "history")}
                aria-label="Chat history"
                title="Chat history"
                className={cn("rounded-full p-1.5 transition hover:bg-white/20", view === "history" && "bg-white/20")}
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-full p-1.5 transition hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {view === "history" ? (
              /* ---------- history view ---------- */
              <div data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-3 dark:bg-slate-950/40">
                <button
                  onClick={() => setView("chat")}
                  className="mb-2 flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-pink-600"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to chat
                </button>
                {sessions.length === 0 ? (
                  <div className="flex h-4/5 flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
                    <History className="h-8 w-8 opacity-40" />
                    No past chats yet.
                    <br />
                    Your conversations will show up here.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sessions.map((s: HannahSession) => (
                      <motion.li
                        key={s.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-purple-300 dark:border-slate-700 dark:bg-slate-800"
                      >
                        <button
                          onClick={() => {
                            openSession(s.id)
                            setView("chat")
                          }}
                          className="flex-1 text-left"
                        >
                          <p className="line-clamp-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            {sessionTitle(s)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {new Date(s.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            · {s.messages.filter((m) => m.role === "user").length} messages
                          </p>
                        </button>
                        <button
                          onClick={() => deleteSession(s.id)}
                          aria-label="Delete chat"
                          className="rounded-full p-1.5 text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              /* ---------- chat view ---------- */
              <>
                <div
                  ref={scrollRef}
                  data-lenis-prevent
                  className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4 dark:bg-slate-950/40"
                >
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={cn("flex items-end gap-2", m.role === "user" && "flex-row-reverse")}
                    >
                      {m.role === "assistant" && <HannahLogo size={26} animated={false} className="mb-1 shrink-0" />}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                          m.role === "user"
                            ? "rounded-br-sm bg-purple-600 text-white"
                            : "rounded-bl-sm bg-white text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200",
                          m.kind === "voice" && !m.audioUrl && "italic",
                        )}
                      >
                        {m.kind === "voice" && m.audioUrl ? (
                          <VoiceBubble src={m.audioUrl} durationSec={m.durationSec} />
                        ) : m.role === "assistant" && i === freshIndex ? (
                          <TypewriterBody content={m.content} onGrow={scrollToBottom} />
                        ) : (
                          <MessageBody content={m.content} />
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {isSending && (
                    <div className="flex items-end gap-2">
                      <HannahLogo size={26} animated={false} className="mb-1 shrink-0" />
                      <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-white px-3 py-3 shadow-sm dark:bg-slate-800">
                        {[0, 1, 2].map((d) => (
                          <motion.span
                            key={d}
                            className="h-2 w-2 rounded-full bg-purple-400"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {showSuggestions && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {SUGGESTIONS[context].map((s) => (
                        <button
                          key={s}
                          onClick={() => submit(s)}
                          className="rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50 dark:border-purple-900 dark:bg-slate-800 dark:text-purple-300"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* input row */}
                <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  {recording ? (
                    <RecordingBar seconds={recordSeconds} onCancel={cancelRecording} onSend={finishRecording} />
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        submit(input)
                      }}
                      className="flex flex-1 items-center gap-2"
                    >
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Hannah anything…"
                        maxLength={2000}
                        className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <motion.button
                        type="button"
                        onClick={startRecording}
                        whileTap={{ scale: 0.9 }}
                        disabled={isSending}
                        aria-label="Record a voice message"
                        title="Record a voice message"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-purple-300 hover:text-purple-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400"
                      >
                        <Mic className="h-4 w-4" />
                      </motion.button>
                      <button
                        type="submit"
                        disabled={!input.trim() || isSending}
                        aria-label="Send"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* launcher */}
      <motion.button
        onClick={() => (open ? setOpen(false) : openFresh())}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={open ? "Close Hannah" : "Chat with Hannah"}
        className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-500/30 ring-1 ring-white/20"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6 text-white" />
            </motion.span>
          ) : (
            <motion.span key="logo" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
              <HannahLogo size={40} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
