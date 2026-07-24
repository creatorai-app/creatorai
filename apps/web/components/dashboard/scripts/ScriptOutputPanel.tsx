"use client"

import { useState } from "react";
import * as motion from "motion/react-m";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import {
  Copy, Check, Download, RefreshCw, Save, CreditCard, Plus,
  Loader2, Sparkles, PenTool, Upload, CheckCircle2,
} from "lucide-react";
import { ScriptContentEditor } from "@/components/dashboard/scripts/ScriptContentEditor";
import { toast } from "sonner";
import { updateScript } from "@/lib/api/getScripts";
import { api } from "@/lib/api-client";
import { downloadBlob } from "@/lib/download";
import { GenerationProgress, type GenerationProgressStep } from "@/components/dashboard/common/GenerationProgress";
import { GenerationPlaceholder } from "@/components/dashboard/common/GenerationPlaceholder"

const SCRIPT_STEPS: GenerationProgressStep[] = [
  { label: "Queued", icon: Loader2, threshold: 0 },
  { label: "Preparing", icon: Sparkles, threshold: 10 },
  { label: "Writing", icon: PenTool, threshold: 30 },
  { label: "Saving", icon: Upload, threshold: 80 },
  { label: "Done", icon: CheckCircle2, threshold: 100 },
]

interface ScriptOutputPanelProps {
  isGenerating: boolean
  progress: number
  statusMessage: string
  generatedScript: string
  setGeneratedScript: (s: string) => void
  generatedTitle: string
  setGeneratedTitle: (s: string) => void
  creditsConsumed: number
  scriptId: string | null
  onRegenerate: () => void
  onNewGeneration: () => void
}

export default function ScriptOutputPanel({
  isGenerating,
  progress,
  statusMessage,
  generatedScript,
  setGeneratedScript,
  generatedTitle,
  setGeneratedTitle,
  creditsConsumed,
  scriptId,
  onRegenerate,
  onNewGeneration,
}: ScriptOutputPanelProps) {
  const [copiedScript, setCopiedScript] = useState(false)
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const copyToClipboard = async (text: string, type: "title" | "script") => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === "title") {
        setCopiedTitle(true)
        setTimeout(() => setCopiedTitle(false), 2000)
      } else {
        setCopiedScript(true)
        setTimeout(() => setCopiedScript(false), 2000)
      }
      toast.success("Copied to clipboard!")
    } catch {
      toast.error("Failed to copy")
    }
  }

  const handleSave = async () => {
    if (!scriptId || !generatedTitle || !generatedScript) return
    setIsSaving(true)
    try {
      const result = await updateScript(scriptId, { title: generatedTitle, content: generatedScript })
      if (!result) throw new Error("Save failed")
      toast.success("Script saved!")
    } catch {
      toast.error("Failed to save script")
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    if (!scriptId) return
    try {
      const blob = await api.get<Blob>(`/api/v1/script/${scriptId}/export`, {
        requireAuth: true,
        responseType: "blob",
      })
      downloadBlob(blob, `${generatedTitle || "script"}.pdf`)
      toast.success("PDF exported!")
    } catch {
      toast.error("Failed to export PDF")
    }
  }

  const hasContent = !!generatedScript

  return (
    <Card className="lg:sticky lg:top-8 lg:min-h-[600px]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Your Script</CardTitle>
          {hasContent && (
            <div className="flex items-center gap-3">
              {creditsConsumed > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>{creditsConsumed} credit{creditsConsumed > 1 ? "s" : ""} used</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={onNewGeneration}>
                <Plus className="h-4 w-4 mr-2" />
                New Script
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isGenerating ? (
          <GenerationProgress
            progress={progress}
            statusMessage={statusMessage}
            steps={SCRIPT_STEPS}
            compact
          />
        ) : hasContent ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="space-y-5"
          >
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport} title="Export PDF">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSave} disabled={isSaving} title="Save">
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRegenerate} disabled={isGenerating} title="Regenerate">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <ScriptContentEditor
              title={generatedTitle}
              setTitle={setGeneratedTitle}
              content={generatedScript}
              setContent={setGeneratedScript}
              onCopyTitle={() => copyToClipboard(generatedTitle, "title")}
              onCopyScript={() => copyToClipboard(generatedScript, "script")}
              copiedTitle={copiedTitle}
              copiedScript={copiedScript}
            />
          </motion.div>
        ) : (
          <GenerationPlaceholder
            title="Ready to create your script?"
            description="Fill out the form and let AI bring your ideas to life."
          />
        )}
      </CardContent>

    </Card>
  )
}
