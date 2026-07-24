"use client"

import { useState } from "react";
import * as motion from "motion/react-m";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Progress } from "@repo/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/accordion";
import {
  RefreshCw, Zap, Target, Repeat, Shuffle, Heart, Megaphone,
  Timer, FileText, Copy, Check, TrendingUp, BarChart3,
  AlertTriangle, Layers, Flame, Eye, ArrowUpRight, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { StoryBuilderResult, TensionMapping, SectionScore } from "@repo/validation"

interface StoryBuilderResultsProps {
  result: StoryBuilderResult
  onRegenerate: () => void
  isGenerating: boolean
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}

function ScoreRing({ score, max = 10, label, color }: { score: number; max?: number; label: string; color: string }) {
  const percentage = (score / max) * 100
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
        <span className="text-lg font-bold text-white">{score}</span>
        <span className="absolute -bottom-0.5 text-[8px] text-white/80">/{max}</span>
      </div>
      <span className="text-[10px] sm:text-xs text-slate-500 font-medium text-center">{label}</span>
    </div>
  )
}

function SectionScoreRow({ score }: { score: SectionScore }) {
  const scoreColor = (v: number) =>
    v >= 8 ? "bg-green-500" : v >= 6 ? "bg-yellow-500" : v >= 4 ? "bg-orange-500" : "bg-red-500"

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-28 shrink-0 truncate">{score.section}</span>
      <div className="flex-1 grid grid-cols-3 gap-2">
        {[
          { label: "Curiosity", value: score.curiosityDensity },
          { label: "Emotion", value: score.emotionalShift },
          { label: "Info Spike", value: score.informationSpike },
        ].map(({ label, value }) => (
          <div key={label} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">{label}</span>
              <span className="text-[10px] font-medium">{value}</span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${scoreColor(value)}`} style={{ width: `${value * 10}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 w-10 text-center">
        <span className={`text-sm font-bold ${score.overallScore >= 7 ? "text-green-600" : score.overallScore >= 5 ? "text-yellow-600" : "text-red-600"}`}>
          {score.overallScore}
        </span>
      </div>
    </div>
  )
}

function TensionMappingPanel({ mapping }: { mapping: TensionMapping }) {
  const riskConfig = {
    low: { color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
    medium: { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
    high: { color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  }
  const risk = riskConfig[mapping.predictedDropRisk] || riskConfig.medium

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/20 dark:to-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-purple-500" />
            Tension Mapping & Retention Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Top-level metrics */}
          <div className="flex items-center justify-around py-3">
            <ScoreRing
              score={mapping.retentionScore}
              label="Retention"
              color="from-purple-500 to-indigo-500"
            />
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5 text-2xl font-bold text-blue-600 dark:text-blue-400">
                <Repeat className="h-5 w-5" />
                {mapping.curiosityLoops}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500">Curiosity Loops</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5 text-2xl font-bold text-pink-600 dark:text-pink-400">
                <Flame className="h-5 w-5" />
                {mapping.emotionalPeaks}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500">Emotional Peaks</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Badge className={`${risk.bg} ${risk.color} text-xs px-2.5 py-1`}>
                {mapping.predictedDropRisk === 'low' && <Check className="h-3 w-3 mr-1" />}
                {mapping.predictedDropRisk === 'medium' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {mapping.predictedDropRisk === 'high' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {mapping.predictedDropRisk.toUpperCase()}
              </Badge>
              <span className="text-[10px] sm:text-xs text-slate-500">Drop Risk</span>
            </div>
          </div>

          {/* Section scores */}
          {mapping.sectionScores?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Per-Section Scores</h4>
              <div className="rounded-lg border bg-white dark:bg-slate-900/50 p-3">
                {mapping.sectionScores.map((s, i) => (
                  <SectionScoreRow key={i} score={s} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function StoryBuilderResults({ result, onRegenerate, isGenerating }: StoryBuilderResultsProps) {
  const bp = result.structuredBlueprint
  const copyFullBlueprint = async () => {
    await navigator.clipboard.writeText(formatFullBlueprint(result))
    toast.success("Full blueprint copied to clipboard")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-500" />
          Story Blueprint
          {result.storyMode && (
            <Badge variant="secondary" className="text-xs capitalize ml-1">{result.storyMode.replace(/_/g, ' ')}</Badge>
          )}
          {result.detectedContentType && (
            <Badge variant="outline" className="text-xs ml-1">AI suggests: {result.detectedContentType}</Badge>
          )}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyFullBlueprint} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copy All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={isGenerating}
            className="gap-1.5"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </Button>
        </div>
      </div>

      {/* Tension Mapping */}
      {result.tensionMapping && (
        <TensionMappingPanel mapping={result.tensionMapping} />
      )}

      {/* Structured Blueprint (Modular Sections) */}
      <Accordion
        type="multiple"
        defaultValue={["blueprint-hook", "blueprint-context", "blueprint-escalation", "blueprint-climax", "blueprint-resolution", "retention", "loops", "interrupts", "arc", "cta", "pacing", "outline"]}
        className="space-y-3"
      >
        {/* Hook (0-15 sec) */}
        {bp && (
          <AccordionItem value="blueprint-hook" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="font-semibold">Hook</span>
                <Badge variant="secondary" className="text-xs">0–15 sec</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="grid gap-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Opening Line</p>
                      <p className="text-sm font-medium italic">&ldquo;{bp.hook.openingLine}&rdquo;</p>
                    </div>
                    <CopyButton text={bp.hook.openingLine} />
                  </div>
                </div>
                <InfoBlock label="Curiosity Statement" value={bp.hook.curiosityStatement} />
                <InfoBlock label="Promise" value={bp.hook.promise} />
                <InfoBlock label="Stakes" value={bp.hook.stakes} />
                <InfoBlock label="Visual Suggestion" value={bp.hook.visualSuggestion} />
                <InfoBlock label="Emotional Trigger" value={bp.hook.emotionalTrigger} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Context Setup (15-45 sec) */}
        {bp && (
          <AccordionItem value="blueprint-context" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="font-semibold">Context Setup</span>
                <Badge variant="secondary" className="text-xs">15–45 sec</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <InfoBlock label="Problem" value={bp.contextSetup.problem} />
              <InfoBlock label="Why It Matters" value={bp.contextSetup.whyItMatters} />
              <InfoBlock label="Background Info" value={bp.contextSetup.backgroundInfo} />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Escalation Segments */}
        {bp?.escalationSegments?.length > 0 && (
          <AccordionItem value="blueprint-escalation" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-semibold">Escalation</span>
                <Badge variant="secondary" className="text-xs">{bp.escalationSegments.length} segments</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              {bp.escalationSegments.map((seg) => (
                <div key={seg.segmentNumber} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 text-xs">
                      Segment {seg.segmentNumber}
                    </Badge>
                    <span className="text-sm font-semibold">{seg.title}</span>
                    <span className="ml-auto text-xs text-slate-400">{seg.estimatedDuration}</span>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-0.5">Micro-Hook</p>
                        <p className="text-sm">{seg.microHook}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowUpRight className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-0.5">Insight</p>
                        <p className="text-sm">{seg.insight}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Zap className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-0.5">Transition Tension</p>
                        <p className="text-sm">{seg.transitionTension}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Climax */}
        {bp && (
          <AccordionItem value="blueprint-climax" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-semibold">Climax</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <InfoBlock label="Biggest Insight" value={bp.climax.biggestInsight} />
              <InfoBlock label="Unexpected Twist" value={bp.climax.unexpectedTwist} />
              <InfoBlock label="Core Value Moment" value={bp.climax.coreValueMoment} />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Resolution + Callback */}
        {bp && (
          <AccordionItem value="blueprint-resolution" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="font-semibold">Resolution + Callback</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <InfoBlock label="Close Loop" value={bp.resolution.closeLoop} />
              <InfoBlock label="Reinforce Transformation" value={bp.resolution.reinforceTransformation} />
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-1">Soft CTA</p>
                    <p className="text-sm italic">&ldquo;{bp.resolution.softCTA}&rdquo;</p>
                  </div>
                  <CopyButton text={bp.resolution.softCTA} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Retention Beats */}
        <AccordionItem value="retention" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="font-semibold">Retention Beats</span>
              <Badge variant="secondary" className="text-xs">{result.retentionBeats?.length || 0} beats</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3">
              {result.retentionBeats?.map((beat, i) => (
                <div key={i} className="flex gap-3 items-start rounded-lg border p-3">
                  <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-xs">{beat.timestamp}</Badge>
                  <div className="flex-1 min-w-0">
                    <Badge className="text-xs mb-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">
                      {beat.type.replace(/_/g, ' ')}
                    </Badge>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{beat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Open Loops */}
        <AccordionItem value="loops" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-green-500" />
              <span className="font-semibold">Open Loops</span>
              <Badge variant="secondary" className="text-xs">{result.openLoops?.length || 0} loops</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3">
              {result.openLoops?.map((loop, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{loop.setup}</p>
                    <Badge variant="outline" className="shrink-0 font-mono text-xs">Payoff @ {loop.payoffTimestamp}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{loop.description}</p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Pattern Interrupts */}
        <AccordionItem value="interrupts" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-orange-500" />
              <span className="font-semibold">Pattern Interrupts</span>
              <Badge variant="secondary" className="text-xs">{result.patternInterrupts?.length || 0}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3">
              {result.patternInterrupts?.map((interrupt, i) => (
                <div key={i} className="flex gap-3 items-start rounded-lg border p-3">
                  <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-xs">{interrupt.timestamp}</Badge>
                  <div className="flex-1 min-w-0">
                    <Badge className="text-xs mb-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100">
                      {interrupt.type.replace(/_/g, ' ')}
                    </Badge>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{interrupt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Emotional Arc */}
        <AccordionItem value="arc" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="font-semibold">Emotional Arc</span>
              <Badge variant="secondary" className="text-xs">{result.emotionalArc?.beats?.length || 0} phases</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 p-3">
              <p className="text-xs font-medium text-pink-700 dark:text-pink-400 mb-1">Arc Structure</p>
              <p className="text-sm font-medium">{result.emotionalArc?.structure}</p>
            </div>
            <div className="space-y-3">
              {result.emotionalArc?.beats?.map((beat, i) => (
                <div key={i} className="flex gap-3 items-start rounded-lg border p-3">
                  <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-xs">{beat.timestamp}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{beat.phase}</span>
                      <Badge className="text-xs bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 hover:bg-pink-100">
                        {beat.emotion}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{beat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* CTA Placement */}
        <AccordionItem value="cta" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-indigo-500" />
              <span className="font-semibold">CTA Placement</span>
              <Badge variant="secondary" className="text-xs">{result.ctaPlacement?.length || 0} CTAs</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-3">
              {result.ctaPlacement?.map((cta, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{cta.timestamp}</Badge>
                    <Badge className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-100">{cta.type}</Badge>
                  </div>
                  <div className="rounded bg-indigo-50 dark:bg-indigo-900/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm italic">&ldquo;{cta.script}&rdquo;</p>
                      <CopyButton text={cta.script} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{cta.rationale}</p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Story Pacing */}
        <AccordionItem value="pacing" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-teal-500" />
              <span className="font-semibold">Story Pacing</span>
              <Badge variant="secondary" className="text-xs">{result.storyPacing?.sections?.length || 0} sections</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">{result.storyPacing?.overview}</p>
            <div className="space-y-2">
              {result.storyPacing?.sections?.map((section, i) => {
                const paceColor =
                  section.pace === 'fast' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100'
                    : section.pace === 'peak' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100'
                    : section.pace === 'building' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100'
                    : section.pace === 'slow' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100'
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="shrink-0 text-center">
                      <p className="text-xs text-slate-500">{section.duration}</p>
                      <Badge className={`text-xs mt-1 ${paceColor}`}>{section.pace}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{section.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{section.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Full Outline */}
        <AccordionItem value="outline" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-500" />
              <span className="font-semibold">Full Production Outline</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex justify-end mb-2">
                <CopyButton text={result.fullOutline} />
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">
                {result.fullOutline}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

function formatFullBlueprint(result: StoryBuilderResult): string {
  let text = "=== STORY BLUEPRINT ===\n\n"
  const bp = result.structuredBlueprint

  if (bp) {
    text += "## HOOK (0–15 sec)\n"
    text += `Curiosity: ${bp.hook.curiosityStatement}\n`
    text += `Promise: ${bp.hook.promise}\n`
    text += `Stakes: ${bp.hook.stakes}\n`
    text += `Opening: "${bp.hook.openingLine}"\n`
    text += `Visual: ${bp.hook.visualSuggestion}\n\n`

    text += "## CONTEXT SETUP (15–45 sec)\n"
    text += `Problem: ${bp.contextSetup.problem}\n`
    text += `Why It Matters: ${bp.contextSetup.whyItMatters}\n`
    text += `Background: ${bp.contextSetup.backgroundInfo}\n\n`

    text += "## ESCALATION SEGMENTS\n"
    bp.escalationSegments.forEach((seg) => {
      text += `\nSegment ${seg.segmentNumber}: ${seg.title} (${seg.estimatedDuration})\n`
      text += `  Micro-Hook: ${seg.microHook}\n`
      text += `  Insight: ${seg.insight}\n`
      text += `  Transition: ${seg.transitionTension}\n`
    })
    text += "\n"

    text += "## CLIMAX\n"
    text += `Biggest Insight: ${bp.climax.biggestInsight}\n`
    text += `Unexpected Twist: ${bp.climax.unexpectedTwist}\n`
    text += `Core Value: ${bp.climax.coreValueMoment}\n\n`

    text += "## RESOLUTION + CALLBACK\n"
    text += `Close Loop: ${bp.resolution.closeLoop}\n`
    text += `Transformation: ${bp.resolution.reinforceTransformation}\n`
    text += `Soft CTA: "${bp.resolution.softCTA}"\n\n`
  }

  if (result.tensionMapping) {
    text += "## TENSION MAPPING\n"
    text += `Retention Score: ${result.tensionMapping.retentionScore}/10\n`
    text += `Curiosity Loops: ${result.tensionMapping.curiosityLoops}\n`
    text += `Emotional Peaks: ${result.tensionMapping.emotionalPeaks}\n`
    text += `Drop Risk: ${result.tensionMapping.predictedDropRisk}\n\n`
  }

  text += "## RETENTION BEATS\n"
  result.retentionBeats?.forEach((b, i) => {
    text += `${i + 1}. [${b.timestamp}] ${b.type.replace(/_/g, ' ')}, ${b.description}\n`
  })
  text += "\n"

  text += "## OPEN LOOPS\n"
  result.openLoops?.forEach((l, i) => {
    text += `${i + 1}. Setup: ${l.setup} (Payoff @ ${l.payoffTimestamp})\n   ${l.description}\n`
  })
  text += "\n"

  text += "## EMOTIONAL ARC\n"
  text += `Structure: ${result.emotionalArc?.structure}\n`
  result.emotionalArc?.beats?.forEach((b, i) => {
    text += `${i + 1}. [${b.timestamp}] ${b.phase} (${b.emotion}), ${b.description}\n`
  })
  text += "\n"

  text += "## FULL PRODUCTION OUTLINE\n"
  text += result.fullOutline

  return text
}
