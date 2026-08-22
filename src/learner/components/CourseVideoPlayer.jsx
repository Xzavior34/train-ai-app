import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  Maximize2, Minimize2, Video
} from "lucide-react";
import { parseVideoSource } from "../../lib/mockDataManager.js";

function formatTime(secs) {
  if (isNaN(secs) || secs === null || secs === undefined) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const CourseVideoPlayer = forwardRef(function CourseVideoPlayer({
  videoUrl,
  youtubeVideoId,
  courseId,
  lessonId,
  lessonTitle = "Lesson Video",
  durationMinutes = 15,
  isTheatreMode = false,
  onToggleTheatreMode,
  onProgress,
  onEnded,
  autoPlay = false
}, ref) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMinutes * 60);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoQuality, setVideoQuality] = useState("1080p HD");
  const [videoError, setVideoError] = useState(false);

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const iframeRef = useRef(null);

  // Parse video source
  const source = parseVideoSource(youtubeVideoId || videoUrl, courseId, lessonId);

  // Expose imperative seekTo method to parent (for Chapters and Transcript click)
  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      const targetSec = Math.max(0, Math.min(seconds, duration || 9999));
      setCurrentTime(targetSec);

      if (source.type === "html5" && videoRef.current) {
        videoRef.current.currentTime = targetSec;
        if (!isPlaying) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "seekTo", args: [targetSec, true] }),
          "*"
        );
      }
    },
    play: () => {
      if (source.type === "html5" && videoRef.current) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [] }),
          "*"
        );
      }
    },
    pause: () => {
      if (source.type === "html5" && videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*"
        );
      }
    }
  }), [source.type, duration, isPlaying]);

  // HTML5 Video Event Handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      onProgress?.(cur, videoRef.current.duration || duration);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || durationMinutes * 60);
      setVideoError(false);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onEnded?.();
  };

  const handlePlayPauseToggle = () => {
    if (source.type === "html5" && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      const nextPlay = !isPlaying;
      setIsPlaying(nextPlay);
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: "command",
          func: nextPlay ? "playVideo" : "pauseVideo",
          args: []
        }),
        "*"
      );
    }
  };

  const handleRewind = (seconds = 10) => {
    const nextTime = Math.max(0, currentTime - seconds);
    setCurrentTime(nextTime);
    if (source.type === "html5" && videoRef.current) {
      videoRef.current.currentTime = nextTime;
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [nextTime, true] }),
        "*"
      );
    }
  };

  const handleForward = (seconds = 10) => {
    const nextTime = Math.min(duration, currentTime + seconds);
    setCurrentTime(nextTime);
    if (source.type === "html5" && videoRef.current) {
      videoRef.current.currentTime = nextTime;
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [nextTime, true] }),
        "*"
      );
    }
  };

  const handleMuteToggle = () => {
    if (source.type === "html5" && videoRef.current) {
      const nextMute = !isMuted;
      videoRef.current.muted = nextMute;
      setIsMuted(nextMute);
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: nextMute ? "mute" : "unMute", args: [] }),
        "*"
      );
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (source.type === "html5" && videoRef.current) {
      videoRef.current.playbackRate = speed;
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setPlaybackRate", args: [speed] }),
        "*"
      );
    }
  };

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen change
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="tai-card"
      style={{
        padding: 0,
        overflow: "hidden",
        position: "relative",
        borderRadius: 10,
        background: "#080C16",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        width: "100%",
        boxSizing: "border-box"
      }}
    >
      {/* 16:9 Responsive Video Viewport */}
      <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", height: 0, background: "#000", overflow: "hidden" }}>
        
        {/* Case 1: Direct HTML5 Video Stream */}
        {source.type === "html5" && (
          <video
            ref={videoRef}
            src={source.src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={() => setVideoError(true)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
            autoPlay={autoPlay}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              background: "#000"
            }}
          />
        )}

        {/* Case 2: YouTube Embed Stream */}
        {source.type === "youtube" && (
          <iframe
            ref={iframeRef}
            key={source.videoId}
            title={lessonTitle}
            src={`https://www.youtube-nocookie.com/embed/${source.videoId}?enablejsapi=1&rel=0&modestbranding=1&controls=1&playsinline=1&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none"
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        {/* Case 3: Vimeo Embed Stream */}
        {source.type === "vimeo" && (
          <iframe
            key={source.videoId}
            title={lessonTitle}
            src={`https://player.vimeo.com/video/${source.videoId}?responsive=1&dnt=1`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: "none"
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}

        {/* Case 4: No Video Source or Error Fallback */}
        {(source.type === "none" || videoError) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#0F172A",
              color: "#FFFFFF",
              padding: 24,
              textAlign: "center"
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(79, 70, 229, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Video size={24} color="#818CF8" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{lessonTitle}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", maxWidth: 440, lineHeight: 1.45 }}>
              This lesson contains interactive curriculum materials, code exercises, and study notes below.
            </div>
          </div>
        )}

        {/* Top Header Overlay Badge */}
        <div style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(10, 14, 26, 0.75)",
          backdropFilter: "blur(8px)",
          padding: "4px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.12)",
          maxWidth: "85%",
          pointerEvents: "none"
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lessonTitle}
          </span>
          <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>
            • {videoQuality}
          </span>
        </div>
      </div>

      {/* HTML5 Cinema Control Bar (When direct video file is playing) */}
      {source.type === "html5" && (
        <div style={{
          background: "#0D1322",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          boxSizing: "border-box",
          width: "100%"
        }}>
          {/* Interactive Scrub Progress Bar */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 5,
              background: "rgba(255, 255, 255, 0.15)",
              borderRadius: 99,
              cursor: "pointer"
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const targetTime = clickPercent * (duration || 1);
              setCurrentTime(targetTime);
              if (videoRef.current) {
                videoRef.current.currentTime = targetTime;
              }
            }}
          >
            <div style={{
              width: `${((currentTime || 0) / (duration || 1)) * 100}%`,
              height: "100%",
              background: "var(--primary, #4F46E5)",
              borderRadius: 99,
              position: "relative"
            }}>
              <div style={{
                position: "absolute", right: -4, top: -3.5,
                width: 12, height: 12, borderRadius: "50%",
                background: "#FFFFFF"
              }} />
            </div>
          </div>

          {/* Bottom Cinema Controls */}
          <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
              <button
                className="tai-iconbtn"
                style={{ background: "var(--primary)", color: "#fff", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer" }}
                onClick={handlePlayPauseToggle}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} fill="#fff" style={{ marginLeft: 2 }} />}
              </button>

              <button
                className="tai-iconbtn"
                style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}
                onClick={() => handleRewind(10)}
                title="Rewind 10s"
              >
                <RotateCcw size={14} />
              </button>

              <button
                className="tai-iconbtn"
                style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}
                onClick={() => handleForward(10)}
                title="Forward 10s"
              >
                <RotateCw size={14} />
              </button>

              <button
                className="tai-iconbtn"
                style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}
                onClick={handleMuteToggle}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={15} color="#EF4444" /> : <Volume2 size={15} />}
              </button>

              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#FFFFFF", fontVariantNumeric: "tabular-nums", marginLeft: 2 }}>
                {formatTime(currentTime)} <span style={{ color: "rgba(255,255,255,0.5)" }}>/ {formatTime(duration)}</span>
              </span>
            </div>

            {/* Right Video Controls */}
            <div className="tai-row tai-gap6" style={{ alignItems: "center" }}>
              {/* Speed Selector */}
              <div style={{ position: "relative" }}>
                <button
                  className="tai-btn tai-btn-sm"
                  style={{
                    background: "rgba(255,255,255,0.08)", color: "#FFFFFF",
                    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 8px", fontSize: 11.5, fontWeight: 700, cursor: "pointer"
                  }}
                  onClick={() => setShowSpeedMenu(v => !v)}
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <div className="tai-card anim-slide-down" style={{
                    position: "absolute", bottom: 32, right: 0, width: 80, padding: 4, zIndex: 100,
                    background: "#1E293B", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10
                  }}>
                    {[0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                      <div
                        key={spd}
                        style={{
                          padding: "5px 6px", borderRadius: 6, fontSize: 11.5, color: playbackSpeed === spd ? "#818CF8" : "#FFFFFF",
                          fontWeight: playbackSpeed === spd ? 800 : 500, cursor: "pointer", textAlign: "center"
                        }}
                        onClick={() => handleSpeedChange(spd)}
                      >
                        {spd}x
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Theatre Mode Toggle */}
              {onToggleTheatreMode && (
                <button
                  className="tai-iconbtn"
                  style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}
                  onClick={onToggleTheatreMode}
                  title={isTheatreMode ? "Exit Theatre Mode" : "Theatre Mode"}
                >
                  <Maximize2 size={14} />
                </button>
              )}

              {/* Fullscreen Toggle */}
              <button
                className="tai-iconbtn"
                style={{ color: "rgba(255,255,255,0.8)", width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}
                onClick={handleFullscreenToggle}
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CourseVideoPlayer;
