"use client"

import Link from "next/link"
import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
import { Switch } from "@repo/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@repo/ui/card"
import { Badge } from "@repo/ui/badge"
import {
  Loader2, Sparkles, BookOpen, Users, Clock, Film, Palette, Wand2,
  ArrowRight, Lightbulb, Clapperboard, GraduationCap,
} from "lucide-react"
import {
  VIDEO_DURATIONS,
  VIDEO_DURATION_LABELS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  STORY_MODES,
  STORY_MODE_LABELS,
  AUDIENCE_LEVELS,
  AUDIENCE_LEVEL_LABELS,
  type VideoDuration,
  type ContentType,
  type StoryMode,
  type AudienceLevel,
} from "@repo/validation"
import type { IdeationJob } from "@repo/validation"

interface StoryBuilderFormProps {
  videoTopic: string
  setVideoTopic: (v: string) => void
  targetAudience: string
  setTargetAudience: (v: string) => void
  audienceLevel: AudienceLevel
  setAudienceLevel: (v: AudienceLevel) => void
  videoDuration: VideoDuration
  setVideoDuration: (v: VideoDuration) => void
  contentType: ContentType
  setContentType: (v: ContentType) => void
  storyMode: StoryMode
  setStoryMode: (v: StoryMode) => void
  tone: string
  setTone: (v: string) => void
  additionalContext: string
  setAdditionalContext: (v: string) => void
  personalized: boolean
  setPersonalized: (v: boolean) => void
  aiTrained: boolean
  isGenerating: boolean
  onGenerate: () => void
  ideationJobs: IdeationJob[]
  isLoadingIdeations: boolean
  onSelectIdea: (ideationId: string, ideaIndex: number, ideaTitle: string) => void
  selectedIdeationId?: string
  selectedIdeaIndex?: number
}

const STORY_MODE_DESCRIPTIONS: Record<StoryMode, string> = {
  cinematic: "Dramatic visuals, slow reveals, epic tone",
  high_energy: "Fast cuts, bold statements, rapid pacing",
  documentary: "Facts-first, measured pacing, authoritative",
  conversational: "Casual, direct-to-camera, relatable",
  dramatic: "Tension-heavy, cliffhangers, suspenseful",
  minimal: "Clean, essential info only, elegant pacing",
}

export function StoryBuilderForm({
  videoTopic, setVideoTopic,
  targetAudience, setTargetAudience,
  audienceLevel, setAudienceLevel,
  videoDuration, setVideoDuration,
  contentType, setContentType,
  storyMode, setStoryMode,
  tone, setTone,
  additionalContext, setAdditionalContext,
  personalized, setPersonalized,
  aiTrained, isGenerating, onGenerate,
  ideationJobs, isLoadingIdeations, onSelectIdea,
  selectedIdeationId, selectedIdeaIndex,
}: StoryBuilderFormProps) {
  const allIdeas = ideationJobs.flatMap(job =>
    (job.result?.ideas || []).map((idea, idx) => ({
      ideationId: job.id,
      ideaIndex: idx,
      title: idea.title,
      format: idea.suggestedFormat,
      score: idea.opportunityScore,
    }))
  )

  const selectedIdeaKey = selectedIdeationId && selectedIdeaIndex != null
    ? `${selectedIdeationId}::${selectedIdeaIndex}`
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-500" />
          Story Builder
        </CardTitle>
        <CardDescription>
          Build a modular story blueprint with structured hooks, escalation segments, tension mapping, and retention scoring
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Personalization Toggle */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-500" />
              <Label htmlFor="personalized" className="font-medium cursor-pointer">
                Personalize to my style
              </Label>
            </div>
            <Switch
              id="personalized"
              checked={personalized && aiTrained}
              onCheckedChange={setPersonalized}
              disabled={!aiTrained || isGenerating}
            />
          </div>
          {aiTrained ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {personalized
                ? "Blueprint adapts to your channel's past videos' style"
                : "Toggle on to use your past trained profile"}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Train your AI in the AI Studio to unlock personalized blueprints
              </p>
              <Link href="/dashboard/train">
                <Button variant="outline" size="sm" className="shrink-0 text-xs gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40">
                  AI Studio <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Idea Selector from Ideation */}
        {allIdeas.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" />
              Select from Generated Ideas
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Select
              value={selectedIdeaKey || "custom"}
              onValueChange={(v) => {
                if (v === "custom") {
                  setVideoTopic("")
                  return
                }
                const [ideationId, indexStr] = v.split("::")
                const idea = allIdeas.find(i => i.ideationId === ideationId && i.ideaIndex === Number(indexStr))
                if (idea) onSelectIdea(idea.ideationId, idea.ideaIndex, idea.title)
              }}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type your own idea or select one..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">
                  <span className="text-slate-500">Type your own idea...</span>
                </SelectItem>
                {allIdeas.map((idea) => (
                  <SelectItem key={`${idea.ideationId}::${idea.ideaIndex}`} value={`${idea.ideationId}::${idea.ideaIndex}`}>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[280px]">{idea.title}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{idea.score}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Video Topic */}
        <div className="space-y-2">
          <Label htmlFor="videoTopic">Video Topic / Idea *</Label>
          <Textarea
            id="videoTopic"
            placeholder="e.g., How I grew from 0 to 100K subscribers in 6 months using only Shorts"
            value={videoTopic}
            onChange={(e) => setVideoTopic(e.target.value)}
            disabled={isGenerating}
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Structure Template + Story Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contentType" className="flex items-center gap-1.5">
              <Film className="h-4 w-4" />
              Structure Template
            </Label>
            <Select
              value={contentType}
              onValueChange={(v) => setContentType(v as ContentType)}
              disabled={isGenerating}
            >
              <SelectTrigger id="contentType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((ct) => (
                  <SelectItem key={ct} value={ct}>
                    {CONTENT_TYPE_LABELS[ct]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storyMode" className="flex items-center gap-1.5">
              <Clapperboard className="h-4 w-4" />
              Story Mode
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {STORY_MODES.map((sm) => (
                <button
                  key={sm}
                  type="button"
                  onClick={() => setStoryMode(sm)}
                  disabled={isGenerating}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-left ${
                    storyMode === sm
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{STORY_MODE_LABELS[sm]}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {STORY_MODE_DESCRIPTIONS[storyMode]}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-purple-500" />
              Every story mode is unlocked on all plans.
            </p>
          </div>
        </div>

        {/* Duration + Audience Level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="videoDuration" className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Target Duration
            </Label>
            <Select
              value={videoDuration}
              onValueChange={(v) => setVideoDuration(v as VideoDuration)}
              disabled={isGenerating}
            >
              <SelectTrigger id="videoDuration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_DURATIONS.map((vd) => (
                  <SelectItem key={vd} value={vd}>
                    {VIDEO_DURATION_LABELS[vd]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audienceLevel" className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" />
              Audience Level
            </Label>
            <Select
              value={audienceLevel}
              onValueChange={(v) => setAudienceLevel(v as AudienceLevel)}
              disabled={isGenerating}
            >
              <SelectTrigger id="audienceLevel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_LEVELS.map((al) => (
                  <SelectItem key={al} value={al}>
                    {AUDIENCE_LEVEL_LABELS[al]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <Label htmlFor="targetAudience" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Target Audience
            <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Input
            id="targetAudience"
            placeholder="e.g., Beginner content creators aged 18-30"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <Label htmlFor="tone" className="flex items-center gap-1.5">
            <Palette className="h-4 w-4" />
            Tone Preference
            <span className="text-slate-400 font-normal">
              {personalized && aiTrained ? "(auto from your style if empty)" : "(optional)"}
            </span>
          </Label>
          <Input
            id="tone"
            placeholder={personalized && aiTrained
              ? "Leave empty for your trained tone, or override"
              : "e.g., Energetic and motivational, casual and conversational"}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        {/* Additional Context */}
        <div className="space-y-2">
          <Label htmlFor="additionalContext">
            Additional Context
            <span className="text-slate-400 font-normal ml-1">(optional)</span>
          </Label>
          <Textarea
            id="additionalContext"
            placeholder="Any specific points, filming style, brand guidelines, etc."
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            disabled={isGenerating}
            rows={2}
            className="resize-none"
          />
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onGenerate}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          disabled={isGenerating || !videoTopic.trim()}
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Story Blueprint...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {personalized && aiTrained ? "Generate Personalized Blueprint" : "Generate Story Blueprint"}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
