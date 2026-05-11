"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Progress } from "@repo/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { Loader2, Play, Download, UploadCloud, RefreshCw, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { useDubbing } from "@/hooks/useDubbing";
import { supportedLanguages } from "@repo/validation";
import { downloadFile } from "@/lib/download";

export default function NewDubbing() {
  const router = useRouter();
  const {
    fileInputRef,
    mediaFile,
    isVideo,
    targetLanguage,
    setTargetLanguage,
    mediaName,
    setMediaName,
    dubbedResult,
    progress,
    isLoading,
    handleFileChange,
    resetForm,
    handleDubMedia,
  } = useDubbing();

  const [activeTab, setActiveTab] = useState("create");

  const isComingSoon = true;

  // Auto-switch to preview tab when dubbing completes
  useEffect(() => {
    if (dubbedResult && progress.state === "completed") {
      setActiveTab("preview");
    }
  }, [dubbedResult, progress.state]);

  const handleCreateNew = () => {
    resetForm();
    setActiveTab("create");
  };

  const selectedLanguageLabel = supportedLanguages.find(
    (l) => l.value === targetLanguage
  )?.label;

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!dubbedResult?.dubbedUrl) return;
    setIsDownloading(true);
    try {
      const ext = isVideo ? "mp4" : "mp3";
      const filename = `dubbed_${isVideo ? "video" : "audio"}_${dubbedResult.targetLanguage}.${ext}`;
      await downloadFile(dubbedResult.dubbedUrl, filename);
    } catch {
      toast.error("Download failed", { description: "Please try again" });
    } finally {
      setIsDownloading(false);
    }
  }, [dubbedResult, isVideo]);

  return (
    <div className="container py-8 max-w-full mx-auto relative">
      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Dubbing</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Upload an audio or video file and dub it into another language with AI.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/dubbing")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dubbings
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="sticky top-1 z-20 grid w-full grid-cols-2 bg-background shadow-sm">
          <TabsTrigger value="create">Create Dub</TabsTrigger>
          <TabsTrigger value="preview" disabled={!dubbedResult}>
            Preview Result
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Dub Your Media</CardTitle>
              <CardDescription>
                Translate your audio or video into one of 29 languages while keeping the original voice characteristics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="media-name">Media Name</Label>
                <Input
                  id="media-name"
                  type="text"
                  placeholder="Enter a name for your dubbed media"
                  value={mediaName}
                  onChange={(e) => setMediaName(e.target.value)}
                  disabled={isLoading}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="media-upload">Upload Audio or Video File</Label>
                  {progress.state === "failed" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={resetForm}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Try Again</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Input
                  ref={fileInputRef}
                  id="media-upload"
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Upload MP3, WAV, MP4, or MOV (max 500MB, 45 minutes).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-language">Target Language</Label>
                <Select
                  value={targetLanguage}
                  onValueChange={setTargetLanguage}
                  disabled={isLoading}
                >
                  <SelectTrigger id="target-language">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {progress.state !== "idle" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {progress.state === "uploading" && <UploadCloud className="h-4 w-4" />}
                      {progress.state === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                      {progress.state === "completed" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      <span className="text-sm font-medium">{progress.message}</span>
                    </div>
                    <span className="text-sm text-slate-500">{Math.round(progress.progress)}%</span>
                  </div>
                  <Progress value={progress.progress} className="w-full h-2" />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div />
              <Button
                onClick={handleDubMedia}
                className="bg-slate-950 hover:bg-slate-900 text-white"
                disabled={isLoading || !mediaFile || !targetLanguage || !mediaName.trim() || progress.state === "completed"}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Dub
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          {dubbedResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Dubbing Complete
                </CardTitle>
                <CardDescription>
                  Your media has been dubbed into {selectedLanguageLabel}. Preview and download below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Preview</Label>
                  <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/40 p-4">
                    {isVideo ? (
                      <video
                        controls
                        src={dubbedResult.dubbedUrl}
                        className="w-full max-h-[400px] rounded-lg"
                      >
                        Your browser does not support the video element.
                      </video>
                    ) : (
                      <audio
                        controls
                        src={dubbedResult.dubbedUrl}
                        className="w-full"
                      >
                        Your browser does not support the audio element.
                      </audio>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t">
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => router.push("/dashboard/dubbing")} className="w-full sm:w-auto">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to List
                  </Button>
                  <Button variant="outline" onClick={handleCreateNew} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Dub Another
                  </Button>
                </div>
                <Button
                  className="w-full sm:w-auto bg-slate-950 hover:bg-slate-900 text-white"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {isDownloading ? "Downloading..." : `Download ${isVideo ? "Video" : "Audio"}`}
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {isComingSoon && (
        <div className="absolute inset-0 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center space-y-4 px-4 max-w-md">
            <Clock className="h-12 w-12 mx-auto text-slate-500 dark:text-slate-400" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Coming Soon
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              AI-powered audio &amp; video dubbing is under preparation.<br />
              Stay tuned, launching very soon!
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="bg-slate-950 hover:bg-slate-900 text-white"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
