"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle, Captions, Download, Info, Loader2 } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Badge } from "@repo/ui/badge"
import { accentLabel, dubLanguageLabel, type DubOutput, type DubOutputStatus } from "@repo/validation"
import { downloadFile } from "@/lib/download"
import { api, getApiErrorMessage } from "@/lib/api-client"
import { DubbingMediaPlayer } from "@/components/dashboard/dubbing/DubbingMediaPlayer"
import { DubTimeline } from "@/components/dashboard/dubbing/DubTimeline"

const STATUS_LABELS: Record<DubOutputStatus, string> = {
  pending: "Waiting",
  dubbing: "Dubbing",
  awaiting_video: "Waiting for video",
  completed: "Ready",
  failed: "Failed",
}

function languageName(output: DubOutput): string {
  const label = dubLanguageLabel(output.language)
  const accent = accentLabel(output.language, output.accent)
  return accent ? `${label} (${accent})` : label
}

/** "Speaker 2" for Cypher's S2 and for ElevenLabs' speaker_1 (which counts from zero). */
export function speakerName(id: string): string {
  const cypher = /^S(\d+)$/.exec(id)
  if (cypher) return `Speaker ${cypher[1]}`
  const elevenlabs = /^speaker_(\d+)$/.exec(id)
  if (elevenlabs) return `Speaker ${Number(elevenlabs[1]) + 1}`
  return id
}

/** One sentence for the speakers ElevenLabs could not clone. */
function replacedVoiceNote(output: DubOutput): string | null {
  const speakers = (output.warnings ?? [])
    .filter((w) => w.type === "voices_not_permitted")
    .flatMap((w) => w.speakerIds ?? [])
  const unique = [...new Set(speakers)].map(speakerName)
  if (!(output.warnings ?? []).some((w) => w.type === "voices_not_permitted")) return null
  if (!unique.length) return "Some voices could not be cloned, so a similar voice was used for them."
  const who = unique.length === 1 ? unique[0] : `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`
  return `${who} could not be cloned, so a similar voice was used instead.`
}

/** The file extension of a stored dub, from its URL: .mp4, .mp3, or .wav on older dubs. */
function extensionOf(url: string): string {
  return url.split("?")[0]?.split(".").pop() || "mp3"
}

/** Every language of a dub: its state, a player and a download once it has one. */
export function DubOutputsList({
  projectId,
  outputs,
  isVideo,
  mediaName,
}: {
  projectId: string
  outputs: DubOutput[]
  isVideo: boolean
  mediaName?: string | null
}) {
  const router = useRouter()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [subtitling, setSubtitling] = useState<string | null>(null)
  const [seek, setSeek] = useState<Record<string, { time: number; key: number }>>({})

  const download = async (output: DubOutput, url: string) => {
    setDownloading(output.language)
    try {
      await downloadFile(url, `${mediaName || "dubbed"}-${output.language}.${extensionOf(url)}`)
    } catch {
      toast.error("Download failed", { description: "Please try again" })
    } finally {
      setDownloading(null)
    }
  }

  // The subtitle job reads the dubbed video already in storage, so nothing is uploaded again.
  const addSubtitles = async (output: DubOutput) => {
    setSubtitling(output.language)
    try {
      const { subtitleId } = await api.post<{ subtitleId: string }>(
        "/api/v1/subtitle/from-dub",
        { projectId, language: output.language },
        { requireAuth: true },
      )
      router.push(`/dashboard/subtitles/${subtitleId}`)
    } catch (error) {
      toast.error("Could not add subtitles", { description: getApiErrorMessage(error, "Please try again.") })
      setSubtitling(null)
    }
  }

  return (
    <div className={outputs.length > 1 ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : "space-y-6"}>
      {outputs.map((output) => {
        // Only a finished language has media (the API holds back the rest until it is paid for).
        const finalUrl = output.dubbedUrl
        const previewUrl = finalUrl ?? output.dubbedAudioUrl
        const previewIsVideo = !!finalUrl && isVideo
        return (
          <section key={output.language} aria-label={languageName(output)} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-50">{languageName(output)}</h3>
                <Badge variant="outline" className={output.status === "failed" ? "text-red-600 dark:text-red-400" : ""}>
                  {STATUS_LABELS[output.status]}
                </Badge>
              </div>
              {finalUrl && (
                <div className="flex flex-wrap items-center gap-2">
                  {isVideo && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addSubtitles(output)}
                      disabled={subtitling !== null}
                    >
                      {subtitling === output.language
                        ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        : <Captions className="mr-1.5 h-4 w-4" />}
                      Add subtitles
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => download(output, finalUrl)}
                    disabled={downloading === output.language}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    {downloading === output.language
                      ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      : <Download className="mr-1.5 h-4 w-4" />}
                    Download
                  </Button>
                </div>
              )}
            </div>

            {previewUrl ? (
              <DubbingMediaPlayer
                url={previewUrl}
                isVideo={previewIsVideo}
                title={`${mediaName || "Dub"} (${languageName(output)})`}
                seek={seek[output.language] ?? null}
              />
            ) : output.status === "failed" ? (
              <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {output.errorMessage || "This language did not finish."} It was not charged.
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                {output.segmentCount
                  ? `${output.segmentsDone} of ${output.segmentCount} lines dubbed`
                  : "In progress"}
              </p>
            )}

            {replacedVoiceNote(output) && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {replacedVoiceNote(output)}
              </p>
            )}

            {output.timeline && output.timeline.length > 0 && (
              <DubTimeline
                segments={output.timeline}
                speakerLabel={speakerName}
                onSeek={previewUrl ? (time) => setSeek((s) => ({ ...s, [output.language]: { time, key: Date.now() } })) : undefined}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}
