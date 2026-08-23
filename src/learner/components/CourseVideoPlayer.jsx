import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, Volume1, VolumeX,
  Maximize2, Minimize2, Video, Settings, Sliders, Check, Subtitles,
  Tv
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
  durationMinutes = 20,
  isTheatreMode = false,
  onToggleTheatreMode,
  onProgress,
  onEnded,
  autoPlay = false
}, ref) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(145);
  const [duration, setDuration] = useState(durationMinutes * 60);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoQuality, setVideoQuality] = useState("1080p HD");
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [isHoveringScrubber, setIsHoveringScrubber] = useState(false);
  const [hoverPositionSec, setHoverPositionSec] = useState(0);

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const scrubberRef = useRef(null);

  // Parse video source
  const source = parseVideoSource(youtubeVideoId || videoUrl, courseId, lessonId);

  // Sync duration if durationMinutes changes
  useEffect(() => {
    if (durationMinutes && (!duration || duration === 900)) {
      setDuration(durationMinutes * 60);
    }
  }, [durationMinutes]);

  // Universal Simulated Progress Timer (Ensures scrub, elapsed time and chapters update in all modes)
  useEffect(() => {
    let interval = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 * playbackSpeed;
          if (next >= duration) {
            setIsPlaying(false);
            onEnded?.();
            return duration;
          }
          onProgress?.(next, duration);
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, duration, onProgress, onEnded]);

  // Expose imperative methods to parent (for Chapters and Transcript click)
  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      const targetSec = Math.max(0, Math.min(seconds, duration || 9999));
      setCurrentTime(targetSec);
      onProgress?.(targetSec, duration);

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
      setIsPlaying(true);
      if (source.type === "html5" && videoRef.current) {
        videoRef.current.play().catch(() => {});
      } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "playVideo", args: [] }),
          "*"
        );
      }
    },
    pause: () => {
      setIsPlaying(false);
      if (source.type === "html5" && videoRef.current) {
        videoRef.current.pause();
      } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*"
        );
      }
    },
    setSpeed: (spd) => handleSpeedChange(spd),
    setQuality: (q) => setVideoQuality(q)
  }), [source.type, duration, isPlaying, playbackSpeed]);

  // HTML5 Video Handlers
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
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);

    if (source.type === "html5" && videoRef.current) {
      if (nextPlay) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
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
    onProgress?.(nextTime, duration);

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
    onProgress?.(nextTime, duration);

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
    const nextMute = !isMuted;
    setIsMuted(nextMute);

    if (source.type === "html5" && videoRef.current) {
      videoRef.current.muted = nextMute;
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: nextMute ? "mute" : "unMute", args: [] }),
        "*"
      );
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);

    if (source.type === "html5" && videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "setVolume", args: [newVol * 100] }),
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

  const handleScrub = (e) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clickPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = clickPercent * (duration || 1);
    setCurrentTime(targetTime);
    onProgress?.(targetTime, duration);

    if (source.type === "html5" && videoRef.current) {
      videoRef.current.currentTime = targetTime;
    } else if (source.type === "youtube" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "seekTo", args: [targetTime, true] }),
        "*"
      );
    }
  };

  const handleScrubHover = (e) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const hoverPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPositionSec(hoverPercent * (duration || 1));
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

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const progressPercent = Math.max(0, Math.min(100, ((currentTime || 0) / (duration || 1)) * 100));

  return (
    <div
      ref={containerRef}
      className="tai-card"
      style={{
        padding: 0,
        overflow: "hidden",
        position: "relative",
        borderRadius: 14,
        background: "#080C16",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 20px 50px -12px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
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
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(99, 102, 241, 0.25)", border: "1px solid rgba(165, 180, 252, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Video size={24} color="#A5B4FC" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{lessonTitle}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", maxWidth: 440, lineHeight: 1.45 }}>
              Interactive simulated player active. Use the liquid glass controls below to test scrubbing, chapter seeking, and playback speeds.
            </div>
          </div>
        )}

        {/* Top Header Liquid Glass Badge */}
        <div style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "5px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 4px 14px rgba(0, 0, 0, 0.4)",
          maxWidth: "calc(100% - 24px)",
          pointerEvents: "none",
          boxSizing: "border-box"
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: isPlaying ? "#10B981" : "#F59E0B", boxShadow: isPlaying ? "0 0 8px #10B981" : "0 0 8px #F59E0B", flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "#FFFFFF", wordBreak: "break-word", lineHeight: 1.25 }}>
            {lessonTitle}
          </span>
          <span style={{ fontSize: 10.5, color: "#A5B4FC", fontWeight: 700, flexShrink: 0, background: "rgba(99, 102, 241, 0.25)", padding: "1px 6px", borderRadius: 4, border: "1px solid rgba(165, 180, 252, 0.3)" }}>
            {videoQuality}
          </span>
        </div>
      </div>

      {/* =========================================================================
          UNIVERSAL LIQUID GLASS CINEMA CONTROL BAR
          ========================================================================= */}
      <div className="tai-video-glass-bar">
        
        {/* Interactive Scrub Progress Bar with Preview Tooltip */}
        <div
          ref={scrubberRef}
          onMouseEnter={() => setIsHoveringScrubber(true)}
          onMouseLeave={() => setIsHoveringScrubber(false)}
          onMouseMove={handleScrubHover}
          onClick={handleScrub}
          style={{
            position: "relative",
            width: "100%",
            height: isHoveringScrubber ? 8 : 6,
            background: "rgba(255, 255, 255, 0.14)",
            borderRadius: 99,
            cursor: "pointer",
            transition: "height 0.15s ease"
          }}
        >
          {/* Hover Time Tooltip */}
          {isHoveringScrubber && (
            <div style={{
              position: "absolute",
              bottom: 14,
              left: `${Math.max(4, Math.min(96, (hoverPositionSec / (duration || 1)) * 100))}%`,
              transform: "translateX(-50%)",
              background: "rgba(15, 23, 42, 0.95)",
              color: "#FFFFFF",
              fontSize: 10.5,
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(8px)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
            }}>
              {formatTime(hoverPositionSec)}
            </div>
          )}

          {/* Buffer Bar */}
          <div style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.min(100, progressPercent + 20)}%`,
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: 99,
            pointerEvents: "none"
          }} />

          {/* Active Played Fill */}
          <div style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: "#4F46E5",
            borderRadius: 99,
            position: "relative",
            transition: "width 0.1s linear",
            boxShadow: "0 0 8px rgba(79, 70, 229, 0.6)"
          }}>
            <div style={{
              position: "absolute", right: -5, top: isHoveringScrubber ? -3.5 : -4,
              width: isHoveringScrubber ? 15 : 14, height: isHoveringScrubber ? 15 : 14,
              borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: "0 0 10px rgba(255, 255, 255, 0.8)",
              border: "2px solid #4F46E5"
            }} />
          </div>
        </div>

        {/* Bottom Cinema Controls Layout */}
        <div className="tai-row tai-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          
          {/* Left Actions: Play/Pause • Rewind • Forward • Volume • Timestamp */}
          <div className="tai-row tai-gap6" style={{ alignItems: "center", flexWrap: "wrap" }}>
            
            {/* Play/Pause Button with Specular Glow */}
            <button
              className="tai-video-control-pill active"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                padding: 0, justifyContent: "center",
                background: "#4F46E5"
              }}
              onClick={handlePlayPauseToggle}
              aria-label={isPlaying ? "Pause Video" : "Play Video"}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={17} fill="#FFFFFF" /> : <Play size={17} fill="#FFFFFF" style={{ marginLeft: 2 }} />}
            </button>

            {/* Rewind 10s */}
            <button
              className="tai-video-control-pill"
              style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
              onClick={() => handleRewind(10)}
              title="Rewind 10 seconds (-10s)"
              aria-label="Rewind 10s"
            >
              <RotateCcw size={14} />
            </button>

            {/* Fast Forward 10s */}
            <button
              className="tai-video-control-pill"
              style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
              onClick={() => handleForward(10)}
              title="Fast Forward 10 seconds (+10s)"
              aria-label="Forward 10s"
            >
              <RotateCw size={14} />
            </button>

            {/* Volume Control with Slider */}
            <div className="tai-row tai-gap4" style={{ alignItems: "center" }}>
              <button
                className="tai-video-control-pill"
                style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
                onClick={handleMuteToggle}
                title={isMuted ? "Unmute" : "Mute"}
                aria-label="Mute Toggle"
              >
                {isMuted || volume === 0 ? <VolumeX size={15} color="#EF4444" /> : volume > 0.5 ? <Volume2 size={15} /> : <Volume1 size={15} />}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume Slider"
                style={{
                  width: 54,
                  height: 4,
                  accentColor: "#818CF8",
                  cursor: "pointer"
                }}
              />
            </div>

            {/* Time Stamp Badge */}
            <div style={{
              fontSize: 12, fontWeight: 800, color: "#FFFFFF",
              fontVariantNumeric: "tabular-nums", marginLeft: 4,
              background: "rgba(255,255,255,0.06)", padding: "4px 8px", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.1)"
            }}>
              {formatTime(currentTime)} <span style={{ color: "#94A3B8" }}>/ {formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Actions: Speed • Quality • Captions • Theatre • Fullscreen */}
          <div className="tai-row tai-gap6" style={{ alignItems: "center", flexWrap: "wrap" }}>
            
            {/* Speed Selector Pill & Menu */}
            <div style={{ position: "relative" }}>
              <button
                className={`tai-video-control-pill ${showSpeedMenu ? "active" : ""}`}
                style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 800 }}
                onClick={() => {
                  setShowSpeedMenu(v => !v);
                  setShowQualityMenu(false);
                }}
                title="Playback Speed"
              >
                {playbackSpeed}x Speed
              </button>

              {showSpeedMenu && (
                <div className="tai-video-glass-dropdown anim-slide-down" style={{
                  position: "absolute", bottom: 36, right: 0, width: 110, padding: 6, zIndex: 120
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", padding: "4px 8px 6px" }}>Speed</div>
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
                    <div
                      key={spd}
                      style={{
                        padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                        color: playbackSpeed === spd ? "#A5B4FC" : "#FFFFFF",
                        background: playbackSpeed === spd ? "rgba(99, 102, 241, 0.25)" : "transparent",
                        fontWeight: playbackSpeed === spd ? 800 : 500, cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                      onClick={() => handleSpeedChange(spd)}
                    >
                      <span>{spd === 1.0 ? "1.0x (Normal)" : `${spd}x`}</span>
                      {playbackSpeed === spd && <Check size={13} color="#A5B4FC" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Selector Pill & Menu */}
            <div style={{ position: "relative" }}>
              <button
                className={`tai-video-control-pill ${showQualityMenu ? "active" : ""}`}
                style={{ padding: "4px 10px", fontSize: 11.5, fontWeight: 800 }}
                onClick={() => {
                  setShowQualityMenu(v => !v);
                  setShowSpeedMenu(false);
                }}
                title="Video Resolution & Quality"
              >
                <Sliders size={12} /> {videoQuality}
              </button>

              {showQualityMenu && (
                <div className="tai-video-glass-dropdown anim-slide-down" style={{
                  position: "absolute", bottom: 36, right: 0, width: 140, padding: 6, zIndex: 120
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", padding: "4px 8px 6px" }}>Quality</div>
                  {["Auto (1080p)", "1080p HD", "720p 60fps", "480p", "360p Data Saver"].map((qual) => (
                    <div
                      key={qual}
                      style={{
                        padding: "6px 8px", borderRadius: 6, fontSize: 11.5,
                        color: videoQuality === qual ? "#A5B4FC" : "#FFFFFF",
                        background: videoQuality === qual ? "rgba(99, 102, 241, 0.25)" : "transparent",
                        fontWeight: videoQuality === qual ? 800 : 500, cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center"
                      }}
                      onClick={() => {
                        setVideoQuality(qual);
                        setShowQualityMenu(false);
                      }}
                    >
                      <span>{qual}</span>
                      {videoQuality === qual && <Check size={13} color="#A5B4FC" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Closed Captions CC Toggle */}
            <button
              className={`tai-video-control-pill ${captionsEnabled ? "active" : ""}`}
              style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
              onClick={() => setCaptionsEnabled(v => !v)}
              title={captionsEnabled ? "Subtitles / CC On" : "Subtitles / CC Off"}
              aria-label="Subtitles CC"
            >
              <Subtitles size={14} />
            </button>

            {/* Theatre Mode Toggle */}
            {onToggleTheatreMode && (
              <button
                className={`tai-video-control-pill ${isTheatreMode ? "active" : ""}`}
                style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
                onClick={onToggleTheatreMode}
                title={isTheatreMode ? "Exit Cinema Theatre Mode" : "Cinema Theatre Mode"}
                aria-label="Theatre Mode"
              >
                <Tv size={14} />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              className="tai-video-control-pill"
              style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}
              onClick={handleFullscreenToggle}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              aria-label="Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CourseVideoPlayer;
