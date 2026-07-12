"use client"

import { useRef, useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@repo/ui/button"
import { Card, CardContent } from "@repo/ui/card"
import { Textarea } from "@repo/ui/textarea"
import { Label } from "@repo/ui/label"
import { cn } from "@repo/ui/lib/utils"
import { Sparkles, Loader2, Wand2, Lock, UploadCloud, X, Pencil, Ban } from "lucide-react"
import {
  VIDEO_ASPECT_RATIOS,
  VIDEO_DURATION_SECONDS,
  VIDEO_INPUT_IMAGE_MIME_TYPES,
  MAX_VIDEO_INPUT_IMAGE_BASE64_BYTES,
  requiredImageRange,
} from "@repo/validation"
import type { useVideoGeneration } from "@/hooks/useVideoGeneration"

type Vm = ReturnType<typeof useVideoGeneration>

// A little segmented control — reused for aspect ratio and duration.
function Segmented<T extends string | number>({
  value, options, onChange, disabled, render,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  disabled?: boolean
  render?: (v: T) => React.ReactNode
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 gap-1">
      {options.map((opt) => (
        <button
          key={String(opt)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-50",
            value === opt
              ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm font-medium"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
          )}
        >
          {render ? render(opt) : String(opt)}
        </button>
      ))}
    </div>
  )
}

function ImageInputs({ vm }: { vm: Vm }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { max } = requiredImageRange(vm.mode)

  // Object URLs are created once per file and revoked on change/unmount — creating them
  // inline in render would leak a new URL on every progress tick during generation.
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = vm.images.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [vm.images])

  if (max === 0) return null

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const picked = Array.from(files)
    const valid = picked.filter((f) => {
      if (!(VIDEO_INPUT_IMAGE_MIME_TYPES as readonly string[]).includes(f.type)) return false
      // base64 inflates ~33%; compare against the raw-file equivalent of the base64 cap.
      if (f.size > (MAX_VIDEO_INPUT_IMAGE_BASE64_BYTES * 3) / 4) return false
      return true
    })
    vm.setImages([...vm.images, ...valid].slice(0, max))
  }

  return (
    <div className="space-y-2">
      <Label>
        {vm.mode === "image_to_video" ? "Source image" : `Reference images (up to ${max})`}
      </Label>
      <div className="flex flex-wrap gap-3">
        {vm.images.map((_file, i) => (
          <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previews[i]} alt={`input ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => vm.setImages(vm.images.filter((_, idx) => idx !== i))}
              disabled={vm.isGenerating}
              className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {vm.images.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={vm.isGenerating}
            className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-purple-400 hover:text-purple-500 transition-colors disabled:opacity-50"
          >
            <UploadCloud className="h-5 w-5" />
            <span className="text-[10px] mt-1">Add</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_INPUT_IMAGE_MIME_TYPES.join(",")}
        multiple={max > 1}
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = "" }}
      />
      <p className="text-xs text-slate-400">PNG, JPG or WebP · up to ~5MB each</p>
    </div>
  )
}

export function VideoGenerationForm({ vm, locked }: { vm: Vm; locked: boolean }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="prompt">
              {vm.mode === "image_to_video" ? "Describe the motion" : "Prompt"}
            </Label>
            {/* Surprise me — on-brand prompt from the creator's trained style. */}
            <motion.button
              type="button"
              onClick={vm.surpriseMe}
              disabled={vm.isSurprising || vm.isGenerating || vm.isTyping}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="group relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm disabled:opacity-60"
            >
              <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
              {vm.isSurprising ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <motion.span
                  animate={{ rotate: [0, -12, 12, 0] }}
                  transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.8 }}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </motion.span>
              )}
              Surprise me
            </motion.button>
          </div>
          <Textarea
            id="prompt"
            placeholder={
              vm.mode === "image_to_video"
                ? "Slowly zoom in as the character turns toward the camera, cinematic light..."
                : "A cinematic drone shot flying over a misty mountain range at sunrise..."
            }
            value={vm.prompt}
            onChange={(e) => vm.setPrompt(e.target.value)}
            rows={4}
            disabled={vm.isGenerating || vm.isTyping}
            className={cn(vm.isTyping && "ring-1 ring-purple-400/60 transition-shadow")}
          />
        </div>

        <ImageInputs vm={vm} />

        <div className="flex flex-wrap gap-6">
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <div>
              <Segmented
                value={vm.aspectRatio}
                options={VIDEO_ASPECT_RATIOS}
                onChange={vm.setAspectRatio}
                disabled={vm.isGenerating}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Duration</Label>
            <div>
              <Segmented
                value={vm.durationSeconds}
                options={VIDEO_DURATION_SECONDS}
                onChange={vm.setDurationSeconds}
                disabled={vm.isGenerating}
                render={(s) => `${s}s`}
              />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {vm.isGenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-600"
                  animate={{ width: `${vm.progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{vm.statusMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {vm.isGenerating ? (
          <div className="flex gap-3">
            <Button disabled className="flex-1">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
            </Button>
            {/* Bail out if it hangs — removes a queued job or flags an active one to stop. */}
            <Button variant="outline" onClick={vm.cancelGeneration} className="text-red-600 hover:text-red-700">
              <Ban className="h-4 w-4 mr-2" /> Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={vm.handleGenerate} disabled={vm.isTyping} className="w-full">
            {locked ? (
              <><Lock className="h-4 w-4 mr-2" /> Unlock video generation</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Generate video</>
            )}
          </Button>
        )}

        {vm.videoUrl && !vm.isGenerating && (
          <div className="space-y-3">
            <Label>Result</Label>
            <video src={vm.videoUrl} controls className="w-full rounded-lg border border-slate-200 dark:border-slate-700" />
            {vm.videoJobId && (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/dashboard/video-generation/${vm.videoJobId}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" /> Regenerate / edit this video
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
