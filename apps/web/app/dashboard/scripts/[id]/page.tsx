"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@repo/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card"
import { toast } from "sonner"
import {
  ArrowLeft, Loader2, CreditCard, Trash2, Save, Download, RefreshCw, Plus,
  ImageIcon, Subtitles,
} from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogFooter,
} from "@repo/ui/alert-dialog"
import { ScriptContentEditor } from "@/components/dashboard/scripts/ScriptContentEditor"
import { ScriptLoaderSkeleton } from "@/components/dashboard/scripts/skeleton/scriptLoaderSkeleton"
import { ScriptMetadata } from "@/components/dashboard/scripts/ScriptMetadata"
import { api } from "@/lib/api-client"
import { downloadBlob } from "@/lib/download"

interface ScriptData {
  id: string
  title: string
  content: string
  prompt: string | null
  context: string | null
  tone: string | null
  include_storytelling: boolean
  reference_links: string | null
  language: string
  created_at: string
  updated_at: string
  include_timestamps: boolean
  duration: string
  credits_consumed: number
  status: string
}

export default function ScriptPage() {
  const router = useRouter()
  const params = useParams()
  const [script, setScript] = useState<ScriptData | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [isLoadingScript, setIsLoadingScript] = useState(true)
  const [copiedTitle, setCopiedTitle] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)

  const scriptId = params.id as string

  useEffect(() => {
    const fetchScript = async () => {
      if (!scriptId) return
      setIsLoadingScript(true)
      try {
        const data = await api.get<ScriptData>(`/api/v1/script/${scriptId}`, { requireAuth: true })
        setScript(data)
        setTitle(data.title)
        setContent(data.content)
      } catch (error: unknown) {
        toast.error("Error loading script", {
          description: error instanceof Error ? error.message : "Failed to fetch script details.",
        })
        router.push("/dashboard/scripts")
      } finally {
        setIsLoadingScript(false)
      }
    }
    fetchScript()
  }, [scriptId, router])

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

  const handleUpdateScript = async () => {
    if (!title || !content) {
      toast.error("Missing information", { description: "Please provide a title and content." })
      return
    }
    setLoading(true)
    try {
      await api.patch(`/api/v1/script/${scriptId}`, { title, content }, { requireAuth: true })
      toast.success("Script updated!", { description: "Changes saved successfully." })
    } catch (error: unknown) {
      toast.error("Error updating script", {
        description: error instanceof Error ? error.message : "Failed to update.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteScript = async () => {
    setLoading(true)
    try {
      await api.delete(`/api/v1/script/${scriptId}`, { requireAuth: true })
      toast.success("Script deleted!")
      router.push("/dashboard/scripts")
    } catch (error: unknown) {
      toast.error("Error deleting script", {
        description: error instanceof Error ? error.message : "Failed to delete.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!scriptId) return
    try {
      const blob = await api.get<Blob>(`/api/v1/script/${scriptId}/export`, {
        requireAuth: true,
        responseType: "blob",
      })
      downloadBlob(blob, `${title || "script"}.pdf`)
      toast.success("PDF exported!")
    } catch {
      toast.error("Failed to export PDF")
    }
  }

  if (isLoadingScript) return <ScriptLoaderSkeleton />
  if (!script) return null

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/scripts")}
            className="rounded-xl"
            aria-label="Back to scripts"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Script Details</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">View and edit your script</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {script.credits_consumed > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <CreditCard className="h-4 w-4" />
              <span>{script.credits_consumed} credit{script.credits_consumed > 1 ? "s" : ""} used</span>
            </div>
          )}
          <Link href={`/dashboard/thumbnails/new?scriptId=${scriptId}&title=${encodeURIComponent(title || "")}`}>
            <Button variant="outline" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" />
              Generate Thumbnail
            </Button>
          </Link>
          <Link href={`/dashboard/subtitles/new?scriptId=${scriptId}`}>
            <Button variant="outline" size="sm">
              <Subtitles className="h-4 w-4 mr-2" />
              Create Subtitles
            </Button>
          </Link>
          <Link href="/dashboard/scripts/new">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Script
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Script Content</CardTitle>
                  <CardDescription>Edit the title and content. Changes are saved when you click Save.</CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        disabled={loading}
                        title="Delete script"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the script &quot;{script.title}&quot;.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteScript} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleUpdateScript}
                    disabled={loading}
                    title="Save changes"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleExport} title="Export PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/scripts/new")} title="Regenerate">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScriptContentEditor
                title={title}
                setTitle={setTitle}
                content={content}
                setContent={setContent}
                onCopyTitle={() => copyToClipboard(title, "title")}
                onCopyScript={() => copyToClipboard(content, "script")}
                copiedTitle={copiedTitle}
                copiedScript={copiedScript}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <ScriptMetadata script={script} />
        </div>
      </div>
    </div>
  )
}
