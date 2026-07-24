"use client";

import React, { useState, useRef, useEffect } from "react";
import * as motion from "motion/react-m";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Mic,
} from "lucide-react";

const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time)) return "0:00";
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

type Props = {
  url: string;
  isVideo: boolean;
  title?: string;
};

/**
 * Custom media player for dubbed output — modeled on the subtitle feature's
 * VideoPlayer (center play, custom control bar, speed menu), purple-themed and
 * extended to render an animated surface for audio-only dubs.
 */
export function DubbingMediaPlayer({ url, isVideo, title }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const togglePlay = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (mediaRef.current) {
      mediaRef.current.volume = v;
      mediaRef.current.muted = v === 0;
      setIsMuted(v === 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    if (mediaRef.current && duration) {
      mediaRef.current.currentTime = (pct / 100) * duration;
      setProgress(pct);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handlePlaybackRate = (rate: number) => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const onTimeUpdate = () => {
    const el = mediaRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    setProgress((el.currentTime / el.duration) * 100 || 0);
  };

  const onLoadedMetadata = () => {
    if (mediaRef.current) setDuration(mediaRef.current.duration);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) controlsTimeout.current = setTimeout(() => setShowControls(false), 2500);
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (showSettings && !(e.target as HTMLElement)?.closest?.(".settings-container")) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showSettings]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isVideo ? "aspect-video bg-black" : "aspect-video bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-900"} rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 group select-none`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {isVideo ? (
        <video
          ref={(el) => { mediaRef.current = el; }}
          key={url}
          src={url}
          className="w-full h-full object-contain bg-black"
          onClick={togglePlay}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      ) : (
        <>
          {/* Audio visual surface — animated equalizer that reacts to playback */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6" onClick={togglePlay}>
            <div className="flex items-end gap-1.5 h-24">
              {[...Array(9)].map((_, i) => (
                <motion.span
                  key={i}
                  className="w-2.5 rounded-full bg-gradient-to-t from-purple-500 to-indigo-400"
                  animate={isPlaying ? { height: [16, 60 - Math.abs(4 - i) * 6, 16] } : { height: 16 }}
                  transition={isPlaying ? { duration: 0.9, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" } : { duration: 0.3 }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <Mic className="h-4 w-4" />
              <span className="text-sm font-medium max-w-[240px] truncate">{title || "Dubbed audio"}</span>
            </div>
          </div>
          <audio
            ref={(el) => { mediaRef.current = el; }}
            key={url}
            src={url}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
          />
        </>
      )}

      {/* Center play button */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        onClick={togglePlay}
      >
        <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-purple-600/90 hover:scale-110 transition-all cursor-pointer shadow-xl ring-1 ring-white/20">
          {isPlaying ? <Pause className="w-8 h-8 text-white fill-current" /> : <Play className="w-8 h-8 ml-1 text-white fill-current" />}
        </div>
      </div>

      {/* Control bar */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`}>
        {/* Timeline */}
        <div className="relative group/timeline w-full h-1.5 mb-4 cursor-pointer flex items-center">
          <div className="absolute w-full h-full bg-white/20 rounded-full" />
          <div className="absolute h-full bg-purple-500 rounded-full pointer-events-none z-10" style={{ width: `${progress}%` }} />
          <div className="absolute h-4 w-4 bg-white rounded-full shadow-lg scale-0 group-hover/timeline:scale-100 transition-transform z-20" style={{ left: `${progress}%`, transform: "translateX(-50%)" }} />
          <input type="range" min="0" max="100" step="0.1" value={progress} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30" />
        </div>

        <div className="flex justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:text-purple-400 transition-colors">
              {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />}
            </button>

            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="hover:text-purple-400 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            <span className="text-xs font-mono opacity-80 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4 relative settings-container">
            {showSettings && (
              <div className="absolute bottom-12 right-0 bg-black/90 border border-white/10 backdrop-blur-md rounded-xl p-3 w-48 shadow-2xl z-50">
                <p className="text-xs font-semibold text-slate-400 px-2 py-1 mb-1 uppercase tracking-wider">Speed</p>
                <div className="grid grid-cols-4 gap-1">
                  {[0.5, 1, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handlePlaybackRate(rate)}
                      className={`text-xs font-medium py-1.5 rounded-md transition-colors hover:bg-white/20 ${playbackRate === rate ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20" : "bg-white/5 text-slate-300"}`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`transition-all duration-300 ${showSettings ? "text-purple-400 rotate-90" : "text-white hover:text-purple-400"}`}
            >
              <Settings className="w-5 h-5" />
            </button>

            {isVideo && (
              <button onClick={toggleFullscreen} className="hover:text-purple-400 transition-colors text-white">
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
