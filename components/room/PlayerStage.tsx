"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRoomSocketContext } from "@/lib/RoomSocketContext";
import { getUser, updateTrack } from "@/lib/api";
import type { Track } from "@/lib/types";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const totalSec = Math.round(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface WordSpan {
  time: number;
  text: string;
}

export interface LyricLine {
  time: number;
  text: string;
  words?: WordSpan[];
}

function parseTimestamp(minStr: string, secStr: string, msStr?: string): number {
  const min = parseInt(minStr, 10);
  const sec = parseInt(secStr, 10);
  let ms = 0;
  if (msStr) {
    if (msStr.length === 2) ms = parseInt(msStr, 10) * 10;
    else if (msStr.length === 1) ms = parseInt(msStr, 10) * 100;
    else ms = parseInt(msStr.slice(0, 3), 10);
  }
  return min * 60 + sec + ms / 1000;
}

export function parseLRC(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];
  const lineTimeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const wordTimeRegex = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (/^\[[a-zA-Z]+:\s*[^\]]*\]$/.test(trimmed)) {
      continue;
    }

    const lineMatches = Array.from(trimmed.matchAll(lineTimeRegex));
    if (lineMatches.length > 0) {
      const rawContent = trimmed.replace(lineTimeRegex, "").trim();
      if (!rawContent) continue;

      const hasWordTags = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>/.test(rawContent);

      for (const lm of lineMatches) {
        const lineTime = parseTimestamp(lm[1], lm[2], lm[3]);
        let words: WordSpan[] | undefined = undefined;
        let cleanText = rawContent;

        if (hasWordTags) {
          words = [];

          const firstTagIdx = rawContent.indexOf("<");
          if (firstTagIdx > 0) {
            const leadingText = rawContent.slice(0, firstTagIdx);
            if (leadingText) {
              words.push({ time: lineTime, text: leadingText });
            }
          }

          const tagPattern = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>([^<]*)/g;
          let match: RegExpExecArray | null;
          while ((match = tagPattern.exec(rawContent)) !== null) {
            const wTime = parseTimestamp(match[1], match[2], match[3]);
            const wText = match[4];
            if (wText) {
              words.push({ time: wTime, text: wText });
            }
          }

          cleanText = rawContent.replace(wordTimeRegex, "");
        }

        result.push({
          time: lineTime,
          text: cleanText,
          words: words && words.length > 0 ? words : undefined,
        });
      }
    } else {
      result.push({ time: -1, text: trimmed });
    }
  }

  return result.sort((a, b) => (a.time >= 0 && b.time >= 0 ? a.time - b.time : 0));
}

const SYNC_DRIFT_THRESHOLD_SEC = 1.5;
const HOST_HEARTBEAT_MS = 4000;
const SYNC_INDICATOR_DURATION_MS = 1200;

type RepeatMode = "off" | "all" | "one";
 
interface PlayerStageProps {
  className?: string;
}

export default function PlayerStage({ className = "" }: PlayerStageProps) {
  const { room, tracks, send, setTrackDuration, resumeOverlay, showResyncOverlay, clearResumeOverlay, clearResyncOverlay } = useRoomSocketContext();
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [localPosition, setLocalPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const playerRef = useRef<any>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const roomRef = useRef(room);
  const tracksRef = useRef(tracks);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const advanceOnEndRef = useRef<() => void>(() => { });
  const durationSyncedRef = useRef<Set<string>>(new Set());
  const syncIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user = getUser();
  const isHost = !!(user && room && user.id === room.host_id);

  const repeatMode: RepeatMode = (room?.repeat_mode as RepeatMode) ?? "off";
  const isShuffled = room?.is_shuffled ?? false;

  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ripit_muted") === "true";
  });

  const updatePlaybackSettings = (next: { repeat_mode?: RepeatMode; is_shuffled?: boolean }) => {
    if (!isHost) return;
    send({
      type: "PLAYBACK_SETTINGS",
      payload: {
        repeat_mode: next.repeat_mode ?? repeatMode,
        is_shuffled: next.is_shuffled ?? isShuffled,
      },
    });
  };

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    return () => {
      if (syncIndicatorTimeoutRef.current) clearTimeout(syncIndicatorTimeoutRef.current);
    };
  }, []);

  const currentTrack = tracks.find((t) => t.id === room?.current_track_id) || null;
  const videoId = currentTrack ? extractVideoId(currentTrack.youtube_url) : null;

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true);
      return;
    }
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      setApiReady(true);
    };
  }, []);

  const captureRealDuration = useCallback(() => {
    const dur = playerRef.current?.getDuration?.() ?? 0;
    if (dur <= 0) return;

    const ct = tracksRef.current.find((t) => t.id === roomRef.current?.current_track_id);
    if (!ct) return;

    const formatted = formatTime(dur);
    setTrackDuration(ct.id, formatted);

    if (!durationSyncedRef.current.has(ct.id) && (!ct.duration || ct.duration === "0:00")) {
      durationSyncedRef.current.add(ct.id);
      updateTrack(ct.room_id, ct.id, { duration: formatted }).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTrackDuration]);

  useEffect(() => {
    if (!apiReady || !window.YT?.Player) return;

    const tracksToResolve = tracksRef.current.filter(
      (t) => (!t.duration || t.duration === "0:00") && !durationSyncedRef.current.has(t.id)
    );
    if (tracksToResolve.length === 0) return;

    let cancelled = false;
    let tempPlayer: any = null;
    const tempDiv = document.createElement("div");
    tempDiv.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.appendChild(tempDiv);

    const resolveNext = (index: number) => {
      if (cancelled || index >= tracksToResolve.length) {
        try { tempPlayer?.destroy(); } catch { /* ignore */ }
        tempDiv.remove();
        return;
      }

      const track = tracksToResolve[index];
      if (durationSyncedRef.current.has(track.id)) {
        resolveNext(index + 1);
        return;
      }

      const vid = extractVideoId(track.youtube_url);
      if (!vid) { resolveNext(index + 1); return; }

      try { tempPlayer?.destroy(); } catch { /* ignore */ }
      tempDiv.innerHTML = "";
      const inner = document.createElement("div");
      tempDiv.appendChild(inner);

      let attempts = 0;
      tempPlayer = new window.YT.Player(inner, {
        height: "0",
        width: "0",
        videoId: vid,
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => {
            const poll = () => {
              if (cancelled) return;
              const dur = tempPlayer?.getDuration?.() ?? 0;
              if (dur > 0) {
                const formatted = formatTime(dur);
                setTrackDuration(track.id, formatted);
                if (!durationSyncedRef.current.has(track.id)) {
                  durationSyncedRef.current.add(track.id);
                  updateTrack(track.room_id, track.id, { duration: formatted }).catch(() => { });
                }
                resolveNext(index + 1);
              } else if (++attempts < 15) {
                setTimeout(poll, 500);
              } else {
                resolveNext(index + 1);
              }
            };
            poll();
          },
        },
      });
    };

    resolveNext(0);

    return () => {
      cancelled = true;
      try { tempPlayer?.destroy(); } catch { /* ignore */ }
      tempDiv.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, tracks.length, setTrackDuration]);

  useEffect(() => {
    if (!apiReady || !videoId || playerRef.current) return;

    playerRef.current = new window.YT.Player("yt-player-container", {
      height: "0",
      width: "0",
      videoId,
      playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
      events: {
        onReady: () => {
          loadedVideoIdRef.current = videoId;
          setPlayerReady(true);
          const r = roomRef.current;
          const startAt = (r?.playback_position_ms ?? 0) / 1000;
          playerRef.current.seekTo(startAt, true);
          if (r?.playback_state === "playing") {
            playerRef.current.playVideo();
          }
          captureRealDuration();
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            advanceOnEndRef.current();
          }
          if (event.data === window.YT.PlayerState.PLAYING) {
            captureRealDuration();
          }
        },
      },
    });
  }, [apiReady, videoId, captureRealDuration]);

  useEffect(() => {
    if (!playerReady || !playerRef.current || !videoId) return;
    if (loadedVideoIdRef.current === videoId) return;

    loadedVideoIdRef.current = videoId;
    const startAt = (room?.playback_position_ms ?? 0) / 1000;
    if (room?.playback_state === "playing") {
      playerRef.current.loadVideoById(videoId, startAt);
    } else {
      playerRef.current.cueVideoById(videoId, startAt);
    }
    setTimeout(() => captureRealDuration(), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, playerReady, captureRealDuration]);

  useEffect(() => {
    if (!playerReady || !playerRef.current || !room) return;

    const targetSec = room.playback_position_ms / 1000;
    const current = playerRef.current.getCurrentTime?.() ?? 0;
    const totalDuration = playerRef.current.getDuration?.() ?? 0;

    const isAtEnd = totalDuration > 0 && Math.abs(current - totalDuration) < 2.5;

    if (Math.abs(current - targetSec) > SYNC_DRIFT_THRESHOLD_SEC) {
      if (!(room.playback_state === "paused" && isAtEnd && targetSec < current)) {
        playerRef.current.seekTo(targetSec, true);
        setIsSyncing(true);
        if (syncIndicatorTimeoutRef.current) clearTimeout(syncIndicatorTimeoutRef.current);
        syncIndicatorTimeoutRef.current = setTimeout(() => {
          setIsSyncing(false);
        }, SYNC_INDICATOR_DURATION_MS);
      }
    }

    if (room.playback_state === "playing") {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.playback_state, room?.playback_position_ms, playerReady]);

  useEffect(() => {
    if (!playerRef.current || !playerReady) return;
    if (isMuted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [isMuted, playerReady]);

  useEffect(() => {
    const id = setInterval(() => {
      if (isDragging) return;
      if (playerRef.current?.getCurrentTime) {
        setLocalPosition(playerRef.current.getCurrentTime());
      }
    }, 250);
    return () => clearInterval(id);
  }, [isDragging]);

  useEffect(() => {
    if (!isHost || room?.playback_state !== "playing") return;

    const id = setInterval(() => {
      if (!playerRef.current?.getCurrentTime || !roomRef.current?.current_track_id) return;
      send({
        type: "SYNC_PLAYBACK",
        payload: {
          playback_state: "playing",
          playback_position_ms: Math.round(playerRef.current.getCurrentTime() * 1000),
          current_track_id: roomRef.current.current_track_id,
        },
      });
    }, HOST_HEARTBEAT_MS);

    return () => clearInterval(id);
  }, [isHost, room?.playback_state, send]);

  const parsedLyrics = useMemo(() => {
    return parseLRC(currentTrack?.lyrics || "");
  }, [currentTrack?.lyrics]);

  const isSyncedLyrics = useMemo(() => {
    return parsedLyrics.some((l) => l.time >= 0);
  }, [parsedLyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!isSyncedLyrics || parsedLyrics.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time >= 0 && parsedLyrics[i].time <= localPosition) {
        activeIdx = i;
      } else if (parsedLyrics[i].time > localPosition) {
        break;
      }
    }
    return activeIdx;
  }, [isSyncedLyrics, parsedLyrics, localPosition]);

  const activeLyricRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLyricIndex]);

  const handleLyricClick = (lineTime: number) => {
    if (!isHost || lineTime < 0 || durationSec <= 0 || !playerRef.current) return;
    playerRef.current.seekTo(lineTime, true);
    setLocalPosition(lineTime);
    send({
      type: "CHANGE_STATE",
      payload: {
        playback_state: room?.playback_state ?? "paused",
        position_ms: Math.round(lineTime * 1000),
      },
    });
  };

  const getNextTrackId = (direction: 1 | -1): string | null => {
    const list = tracksRef.current;
    if (list.length === 0) return null;

    const currentId = roomRef.current?.current_track_id;
    const idx = list.findIndex((t) => t.id === currentId);

    if (isShuffled && direction === 1) {
      if (list.length === 1) return list[0].id;
      const candidates = list.filter((t) => t.id !== currentId);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      return pick?.id ?? null;
    }

    const nextIdx = idx === -1 ? 0 : (idx + direction + list.length) % list.length;
    return list[nextIdx]?.id ?? null;
  };

  useEffect(() => {
    advanceOnEndRef.current = () => {
      if (!isHost) return;
      const r = roomRef.current;

      if (repeatMode === "one" && r?.current_track_id) {
        send({
          type: "SYNC_PLAYBACK",
          payload: {
            playback_state: "playing",
            playback_position_ms: 0,
            current_track_id: r.current_track_id,
          },
        });
        return;
      }

      const list = tracksRef.current;
      const idx = list.findIndex((t) => t.id === r?.current_track_id);
      const isLastTrack = idx === -1 || idx === list.length - 1;

      if (isLastTrack && repeatMode === "off" && !isShuffled) {
        const totalDurationMs = Math.round((playerRef.current?.getDuration?.() ?? 0) * 1000);
        send({
          type: "CHANGE_STATE",
          payload: {
            playback_state: "paused",
            position_ms: totalDurationMs > 0 ? totalDurationMs : undefined,
          },
        });
        return;
      }

      const nextId = getNextTrackId(1);
      if (!nextId) return;
      send({
        type: "SYNC_PLAYBACK",
        payload: { playback_state: "playing", playback_position_ms: 0, current_track_id: nextId },
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, repeatMode, isShuffled, tracks, send]);

  const handlePlayPause = () => {
    if (!isHost) return;
    if (!room?.current_track_id) {
      const first = tracks[0];
      if (!first) return;
      send({
        type: "SYNC_PLAYBACK",
        payload: {
          playback_state: "playing",
          playback_position_ms: 0,
          current_track_id: first.id,
        },
      });
      return;
    }

    const nextState = room.playback_state === "playing" ? "paused" : "playing";
    const positionMs = Math.round((playerRef.current?.getCurrentTime?.() ?? 0) * 1000);
    send({
      type: "CHANGE_STATE",
      payload: { playback_state: nextState, position_ms: positionMs },
    });
  };

  const jumpToTrack = (direction: 1 | -1) => {
    if (!isHost) return;
    if (tracks.length === 0) return;

    // If going back and the song has played for more than 3 seconds,
    // restart the current track from 0:00 instead of skipping to the previous track
    const current = playerRef.current?.getCurrentTime?.() ?? localPosition;
    if (direction === -1 && current > 3 && room?.current_track_id) {
      playerRef.current?.seekTo?.(0, true);
      setLocalPosition(0);
      send({
        type: "CHANGE_STATE",
        payload: {
          playback_state: room.playback_state ?? "playing",
          position_ms: 0,
        },
      });
      return;
    }

    const nextId = getNextTrackId(direction);
    if (!nextId) return;

    send({
      type: "SYNC_PLAYBACK",
      payload: {
        playback_state: "playing",
        playback_position_ms: 0,
        current_track_id: nextId,
      },
    });
  };

  const handlePlayPauseRef = useRef(handlePlayPause);
  useEffect(() => {
    handlePlayPauseRef.current = handlePlayPause;
  });

  const jumpToTrackRef = useRef(jumpToTrack);
  useEffect(() => {
    jumpToTrackRef.current = jumpToTrack;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Space -> Toggle Play/Pause
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        handlePlayPauseRef.current();
        return;
      }

      // Ctrl + ArrowRight -> Next Track
      if (e.ctrlKey && (e.key === "ArrowRight" || e.code === "ArrowRight")) {
        e.preventDefault();
        jumpToTrackRef.current(1);
        return;
      }

      // Ctrl + ArrowLeft -> Previous Track
      if (e.ctrlKey && (e.key === "ArrowLeft" || e.code === "ArrowLeft")) {
        e.preventDefault();
        jumpToTrackRef.current(-1);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("ripit_muted", String(next));
      }
      return next;
    });
  };

  const isPlaying = room?.playback_state === "playing";
  const durationSec = playerRef.current?.getDuration?.() ?? 0;
  const currentSec = isDragging && dragPct !== null
    ? (dragPct / 100) * durationSec
    : durationSec > 0
      ? Math.min(localPosition, durationSec)
      : localPosition;
  const livePct = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;
  const progressPct = dragPct ?? livePct;

  const pctFromPointer = (clientX: number): number => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.min(100, Math.max(0, (x / rect.width) * 100));
  };

  const seekToPct = (pct: number) => {
    if (!isHost) return;
    if (!playerRef.current || durationSec <= 0) return;
    const targetSec = (pct / 100) * durationSec;
    playerRef.current.seekTo(targetSec, true);
    setLocalPosition(targetSec);
    send({
      type: "CHANGE_STATE",
      payload: {
        playback_state: room?.playback_state ?? "paused",
        position_ms: Math.round(targetSec * 1000),
      },
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHost) return;
    if (durationSec <= 0) return;
    setIsDragging(true);
    setDragPct(pctFromPointer(e.clientX));
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setDragPct(pctFromPointer(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    const pct = pctFromPointer(e.clientX);
    seekToPct(pct);
    setDragPct(null);
  };

  const handleResume = () => {
    clearResumeOverlay();
    if (isHost) {
      const positionMs = Math.round((playerRef.current?.getCurrentTime?.() ?? 0) * 1000);
      send({
        type: "CHANGE_STATE",
        payload: { playback_state: "playing", position_ms: positionMs },
      });
    } else {
      if (room?.playback_state === "playing" && playerRef.current) {
        playerRef.current.playVideo();
      }
    }
  };

  const handleResync = () => {
    clearResyncOverlay();
    if (playerRef.current && room?.playback_position_ms !== undefined) {
      playerRef.current.seekTo(room.playback_position_ms / 1000, true);
      playerRef.current.playVideo();
    }
    send({
      type: "CHANGE_STATE",
      payload: { playback_state: "playing", position_ms: room?.playback_position_ms },
    });
  };

  return (
    <div className={`relative flex flex-col justify-between p-space-md md:p-space-lg lg:px-space-2xl lg:py-space-lg h-full min-h-0 ${className}`}>
      <div id="yt-player-container" className="w-0 h-0 overflow-hidden" />

      {resumeOverlay && (
        <div
          onClick={handleResume}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF7F2]/90 backdrop-blur-sm cursor-pointer select-none"
        >
          <div className="flex flex-col items-center gap-space-md text-center px-space-lg">
            <span className="material-symbols-outlined text-[44px] text-[#7A7672]">
              wifi_off
            </span>
            <div className="flex flex-col items-center gap-space-2xs">
              <p className="font-headline-md text-[#262422]">
                {resumeOverlay === "self-reconnect" && "Welcome back"}
                {resumeOverlay === "host-disconnected" && "Host disconnected"}
                {resumeOverlay === "host-changed" && "You're the host now"}
              </p>
              <p className="font-body-sm text-[#7A7672] text-sm">
                {resumeOverlay === "host-changed"
                  ? "Click anywhere to resume playback"
                  : "Click anywhere to continue"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Listener sendiri yang refresh — resync overlay hanya untuk dia */}
      {showResyncOverlay && (
        <div
          onClick={handleResync}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF7F2]/90 backdrop-blur-sm cursor-pointer select-none"
        >
          <div className="flex flex-col items-center gap-space-md text-center px-space-lg">
            <span className="material-symbols-outlined text-[44px] text-[#7A7672]">
              sync
            </span>
            <div className="flex flex-col items-center gap-space-2xs">
              <p className="font-headline-md text-[#262422]">You're back</p>
              <p className="font-body-sm text-[#7A7672] text-sm">
                Click anywhere to resync and keep listening
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Seamless Header (No bottom border) */}
      <div className="shrink-0 flex items-center justify-between gap-space-md pb-space-xs">
        <div className="flex items-center gap-space-md text-left">
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-lg overflow-hidden shrink-0 bg-[#EAE1D7] flex items-center justify-center">
            {currentTrack?.cover_url ? (
              <img
                className="w-full h-full object-cover"
                alt={currentTrack.title}
                src={currentTrack.cover_url}
              />
            ) : (
              <span className="material-symbols-outlined text-[24px] text-[#7A7672]">
                album
              </span>
            )}
          </div>
          <div>
            <h1 className="font-headline-lg text-title-sm lg:text-headline-md text-[#262422]">
              {currentTrack?.title ?? "Nothing queued yet"}
            </h1>
            <p className="font-body-sm text-body-sm text-[#7A7672]">
              {currentTrack?.artist ?? "Add a track to get started"}
            </p>
          </div>
        </div>

        {/* {currentTrack && (
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 bg-surface-container-low rounded-full border border-[#E5DDD3]/50">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "bg-[#EE5522] animate-pulse" : "bg-[#4CAF50]"
                }`}
            />
            <span className="font-label-sm text-[11px] text-[#7A7672]">
              {isSyncing ? "Syncing…" : "Synced"}
            </span>
          </div>
        )} */}
      </div>

      <section className="flex-1 min-h-0 flex flex-col items-start justify-center text-left px-space-md max-w-[760px] w-full mx-auto overflow-hidden relative">
        {currentTrack && parsedLyrics.length > 0 ? (
          <div
            ref={lyricsContainerRef}
            className="w-full h-full overflow-y-auto flex flex-col items-start space-y-space-md lg:space-y-space-lg py-space-2xl no-scrollbar scroll-smooth"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
            }}
          >
            <div className="h-[25vh] shrink-0" />
            {parsedLyrics.map((line, idx) => {
              const isActive = isSyncedLyrics && idx === activeLyricIndex;
              const distance = activeLyricIndex === -1 ? 99 : Math.abs(idx - activeLyricIndex);

              return (
                <p
                  key={`${idx}-${line.time}`}
                  ref={isActive ? activeLyricRef : null}
                  onClick={() => handleLyricClick(line.time)}
                  style={{ fontWeight: 800 }}
                  className={`select-none transition-all duration-300 text-left font-black font-headline-md text-headline-md lg:text-headline-lg ${line.time >= 0 ? "cursor-pointer" : ""
                    } ${!isSyncedLyrics
                      ? "text-[#262422]"
                      : isActive
                        ? "text-[#262422] scale-[1.02] origin-left"
                        : distance === 1
                          ? "text-[#7A7672]/60 hover:text-[#262422]"
                          : "text-[#7A7672]/35 hover:text-[#262422]"
                    }`}
                >
                  {line.words && line.words.length > 0 ? (
                    <span>
                      {line.words.map((w, wIdx) => {
                        const isWordSung = isActive ? localPosition >= w.time : false;
                        return (
                          <span
                            key={wIdx}
                            className={`transition-colors duration-150 ${isActive
                              ? isWordSung
                                ? "text-[#262422]"
                                : "text-[#7A7672]/60" 
                              : ""  
                              }`}
                          >
                            {w.text}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    line.text
                  )}
                </p>
              );
            })}
            <div className="h-[30vh] shrink-0" />
          </div>
        ) : currentTrack ? (
          <div className="w-full flex flex-col items-center justify-center gap-space-sm text-center my-auto">
            <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-2xl overflow-hidden bg-[#EAE1D7] flex items-center justify-center shadow-sm border border-[#E5DDD3]">
              {currentTrack.cover_url ? (
                <img
                  className="w-full h-full object-cover"
                  alt={currentTrack.title}
                  src={currentTrack.cover_url}
                />
              ) : (
                <span className="material-symbols-outlined text-[48px] text-[#7A7672]">
                  album
                </span>
              )}
            </div>
            <div className="flex flex-col items-center">
              <p className="font-title-sm font-semibold text-[#262422]">
                {currentTrack.title}
              </p>
              <p className="font-body-sm text-[#7A7672] text-[12px]">
                {currentTrack.artist}
              </p>
            </div>
            <p className="font-label-sm text-[11px] text-[#7A7672]/70 mt-1">
              No lyrics added for this track
            </p>
          </div>
        ) : (
          <div className="w-full text-center my-auto">
            <p className="font-body-md text-body-md text-[#7A7672]">
              {tracks.length > 0
                ? 'Press play to start the queue.'
                : "Queue is empty — add a track first."}
            </p>
          </div>
        )}
      </section>

      {/* Seamless Floating Controls (No top border) */}
      <div className="shrink-0 pt-space-xs pb-4 md:pb-0 flex flex-col gap-space-sm">
        <div className="w-full flex flex-col gap-space-2xs">
          <div
            ref={progressBarRef}
            className={`relative w-full h-[3px] bg-[#E5DDD3] group/bar ${durationSec > 0 && isHost ? "cursor-pointer" : "cursor-default"}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div className="h-full bg-[#EE5522] relative" style={{ width: `${progressPct}%` }}>
              <div
                className={`absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-[#2B2A27] transition-transform ${isDragging ? "scale-125" : ""
                  } w-2 h-2`}
              ></div>
            </div>
          </div>
          <div className="w-full flex items-center justify-between font-label-sm text-label-sm text-[#7A7672]">
            <span>{formatTime(currentSec)}</span>
            <span>{durationSec > 0 ? formatTime(durationSec) : currentTrack?.duration || "0:00"}</span>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="flex items-center justify-center gap-space-sm lg:gap-space-lg">
            <button
              className={`transition-colors p-space-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${isShuffled ? "text-[#EE5522]" : "text-[#2B2A27] hover:text-[#EE5522]"
                } ${isHost ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
              title={isHost ? "Shuffle" : "Only the host can control playback"}
              type="button"
              disabled={!isHost}
              onClick={() => updatePlaybackSettings({ is_shuffled: !isShuffled })}
            >
              <span className="material-symbols-outlined text-[20px]">shuffle</span>
            </button>

            <button
              className={`text-[#2B2A27] transition-colors p-space-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${isHost ? "hover:text-[#EE5522] cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
              title={isHost ? "Previous track" : "Only the host can control playback"}
              type="button"
              disabled={!isHost}
              onClick={() => jumpToTrack(-1)}
            >
              <span className="material-symbols-outlined text-[26px]">skip_previous</span>
            </button>

            <button
              className={`text-[#EE5522] transition-opacity p-space-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${isHost ? "hover:opacity-85 cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
              title={isHost ? "Play or Pause" : "Only the host can control playback"}
              type="button"
              disabled={tracks.length === 0 || !isHost}
              onClick={handlePlayPause}
            >
              <span className="material-symbols-outlined text-[38px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? "pause" : "play_arrow"}
              </span>
            </button>

            <button
              className={`text-[#2B2A27] transition-colors p-space-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${isHost ? "hover:text-[#EE5522] cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
              title={isHost ? "Next track" : "Only the host can control playback"}
              type="button"
              disabled={!isHost}
              onClick={() => jumpToTrack(1)}
            >
              <span className="material-symbols-outlined text-[26px]">skip_next</span>
            </button>

            <button
              className={`transition-colors p-space-xs flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${repeatMode !== "off" ? "text-[#EE5522]" : "text-[#2B2A27] hover:text-[#EE5522]"
                } ${isHost ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
              title={isHost ? `Repeat: ${repeatMode}` : "Only the host can control playback"}
              type="button"
              disabled={!isHost}
              onClick={() =>
                updatePlaybackSettings({
                  repeat_mode: repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off",
                })
              }
            >
              <span className="material-symbols-outlined text-[20px]">
                {repeatMode === "one" ? "repeat_one" : "repeat"}
              </span>
            </button>
          </div>

          <div className="absolute right-0 inset-y-0 flex items-center">
            <button
              onClick={toggleMute}
              className="p-space-xs text-[#7A7672] hover:text-[#2B2A27] transition-colors cursor-pointer flex items-center justify-center"
              title={isMuted ? "Unmute" : "Mute"}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isMuted ? "volume_off" : "volume_up"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}