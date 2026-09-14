"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRoomSocketContext } from "@/lib/RoomSocketContext";
import { getUser } from "@/lib/api";
import type { Track } from "@/lib/types";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Matches watch?v=, youtu.be/, embed/, and shorts/ URL forms.
function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface WordSpan {
  time: number; // in seconds
  text: string;
}

export interface LyricLine {
  time: number; // seconds, or -1 if plain text
  text: string;
  words?: WordSpan[]; // Word-by-word timestamps (Enhanced LRC)
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

    // Ignore metadata tags e.g. [ar: ...], [ti: ...], [id: ...], [length: ...]
    if (/^\[[a-zA-Z]+:\s*[^\]]*\]$/.test(trimmed)) {
      continue;
    }

    // Find line-level timestamps e.g. [00:12.34]
    const lineMatches = Array.from(trimmed.matchAll(lineTimeRegex));
    if (lineMatches.length > 0) {
      const rawContent = trimmed.replace(lineTimeRegex, "").trim();
      if (!rawContent) continue;

      // Check if line contains Enhanced LRC word timestamps: <mm:ss.xx>
      const hasWordTags = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>/.test(rawContent);

      for (const lm of lineMatches) {
        const lineTime = parseTimestamp(lm[1], lm[2], lm[3]);
        let words: WordSpan[] | undefined = undefined;
        let cleanText = rawContent;

        if (hasWordTags) {
          words = [];

          // 1. Check if there is leading text before the first <tag>
          const firstTagIdx = rawContent.indexOf("<");
          if (firstTagIdx > 0) {
            const leadingText = rawContent.slice(0, firstTagIdx);
            if (leadingText) {
              words.push({ time: lineTime, text: leadingText });
            }
          }

          // 2. Extract each <time>word segment
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

  // Sort by timestamp
  return result.sort((a, b) => (a.time >= 0 && b.time >= 0 ? a.time - b.time : 0));
}

const SYNC_DRIFT_THRESHOLD_SEC = 1.5;
const HOST_HEARTBEAT_MS = 4000;

type RepeatMode = "off" | "all" | "one";

export default function PlayerStage() {
  const { room, tracks, send } = useRoomSocketContext();
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [localPosition, setLocalPosition] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  // const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  // const [isShuffled, setIsShuffled] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPct, setDragPct] = useState<number | null>(null);

  const playerRef = useRef<any>(null);
  const loadedVideoIdRef = useRef<string | null>(null);
  const roomRef = useRef(room);
  const tracksRef = useRef(tracks);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const advanceOnEndRef = useRef<() => void>(() => { });

  const user = getUser();
  const isHost = !!(user && room && user.id === room.host_id);

  const repeatMode: RepeatMode = (room?.repeat_mode as RepeatMode) ?? "off";
  const isShuffled = room?.is_shuffled ?? false;

  const updatePlaybackSettings = (next: { repeat_mode?: RepeatMode; is_shuffled?: boolean }) => {
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

  const currentTrack = tracks.find((t) => t.id === room?.current_track_id) || null;
  const videoId = currentTrack ? extractVideoId(currentTrack.youtube_url) : null;

  // Load the YouTube IFrame API script once, globally.
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

  // Create the player once we know what to play.
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
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            advanceOnEndRef.current();
          }
        },
      },
    });
  }, [apiReady, videoId]);

  // Swap the loaded video whenever current_track_id changes.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, playerReady]);

  // Apply playback_state / position from the room — this fires for host and
  // listeners alike, since the hub broadcasts SYNC_PLAYBACK/CHANGE_STATE back
  // to the sender too. Single source of truth, same pattern as the track
  // queue: nobody drives the player from their own click directly.
  useEffect(() => {
    if (!playerReady || !playerRef.current || !room) return;

    const targetSec = room.playback_position_ms / 1000;
    const current = playerRef.current.getCurrentTime?.() ?? 0;

    if (Math.abs(current - targetSec) > SYNC_DRIFT_THRESHOLD_SEC) {
      playerRef.current.seekTo(targetSec, true);
    }

    if (room.playback_state === "playing") {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.playback_state, room?.playback_position_ms, playerReady]);

  // Apply mute state independently of whether a player currently exists —
  // fixes the volume button doing nothing when the queue is empty. Runs
  // again once the player becomes ready so an earlier click still applies.
  useEffect(() => {
    if (!playerRef.current || !playerReady) return;
    if (isMuted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [isMuted, playerReady]);

  // Local progress bar ticker (visual only, not synced). Paused while the
  // user is dragging the seek handle so it doesn't fight the drag.
  useEffect(() => {
    const id = setInterval(() => {
      if (isDragging) return;
      if (playerRef.current?.getCurrentTime) {
        setLocalPosition(playerRef.current.getCurrentTime());
      }
    }, 250);
    return () => clearInterval(id);
  }, [isDragging]);

  // Host heartbeat: re-broadcast position every few seconds while playing so
  // listeners correct for drift over time.
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

  // Parse LRC lyrics for current track
  const parsedLyrics = useMemo(() => {
    return parseLRC(currentTrack?.lyrics || "");
  }, [currentTrack?.lyrics]);

  // Find active lyric index
  const activeLyricIndex = useMemo(() => {
    if (parsedLyrics.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time >= 0 && parsedLyrics[i].time <= localPosition) {
        activeIdx = i;
      } else if (parsedLyrics[i].time > localPosition) {
        break;
      }
    }
    return activeIdx;
  }, [parsedLyrics, localPosition]);

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
    if (lineTime < 0 || durationSec <= 0 || !playerRef.current) return;
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

  // Resolves what "next" means given current shuffle state. `direction`
  // only really matters when not shuffled — shuffle always picks a random
  // track other than the current one for "next".
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

  // Keep the "what happens when a track ends" logic in a ref so the YT
  // player's onStateChange (registered once per video) always calls the
  // latest version instead of a stale closure.
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
        send({ type: "CHANGE_STATE", payload: { playback_state: "paused" } });
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
    if (tracks.length === 0) return;
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

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const isPlaying = room?.playback_state === "playing";
  const durationSec = playerRef.current?.getDuration?.() ?? 0;
  const livePct = durationSec > 0 ? Math.min(100, (localPosition / durationSec) * 100) : 0;
  const progressPct = dragPct ?? livePct;

  // --- Seek bar drag handling ---
  const pctFromPointer = (clientX: number): number => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.min(100, Math.max(0, (x / rect.width) * 100));
  };

  const seekToPct = (pct: number) => {
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

  return (
    <main className="col-span-12 lg:col-span-7 flex flex-col justify-between p-space-lg lg:px-space-2xl lg:py-space-lg h-full min-h-0">
      {/* Hidden — audio-only, no visible video needed */}
      <div id="yt-player-container" className="w-0 h-0 overflow-hidden" />

      {/* Track Header */}
      <div className="shrink-0 flex flex-col md:flex-row items-center justify-between gap-space-md pb-space-md border-b border-[#E5DDD3]">
        <div className="flex items-center gap-space-md text-center md:text-left">
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
        <button
          onClick={toggleMute}
          className="p-space-xs text-[#7A7672] hover:text-[#2B2A27] transition-colors cursor-pointer"
          title={isMuted ? "Unmute" : "Mute"}
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">
            {isMuted ? "volume_off" : "volume_up"}
          </span>
        </button>
      </div>

      {/* Center Lyric Stage: Spotify-style, left-aligned, prominent font size */}
      <section className="flex-1 min-h-0 flex flex-col items-start justify-center text-left px-space-md max-w-[760px] w-full mx-auto overflow-hidden relative">
        {currentTrack && parsedLyrics.length > 0 ? (
          <div
            ref={lyricsContainerRef}
            className="w-full h-full overflow-y-auto flex flex-col items-start space-y-space-md lg:space-y-space-lg py-space-2xl no-scrollbar scroll-smooth"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            }}
          >
            <div className="h-[25vh] shrink-0" />
            {parsedLyrics.map((line, idx) => {
              const isActive = idx === activeLyricIndex;
              const distance = activeLyricIndex === -1 ? 99 : Math.abs(idx - activeLyricIndex);

              return (
                <p
                  key={`${idx}-${line.time}`}
                  ref={isActive ? activeLyricRef : null}
                  onClick={() => handleLyricClick(line.time)}
                  className={`font-headline-md text-headline-md lg:text-headline-lg select-none transition-all duration-300 text-left ${
                    line.time >= 0 ? "cursor-pointer" : ""
                  } ${
                    isActive
                      ? "text-[#262422] font-bold scale-[1.02] origin-left"
                      : distance === 1
                      ? "text-[#7A7672]/60 font-medium hover:text-[#262422]"
                      : "text-[#7A7672]/35 font-medium hover:text-[#262422]"
                  }`}
                >
                  {line.words && line.words.length > 0 ? (
                    <span>
                      {line.words.map((w, wIdx) => {
                        const isWordSung = isActive ? localPosition >= w.time : false;
                        return (
                          <span
                            key={wIdx}
                            className={`transition-colors duration-150 ${
                              isActive
                                ? isWordSung
                                  ? "text-[#262422] font-bold"
                                  : "text-[#7A7672]/30 font-medium"
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

      {/* Playback Console */}
      <div className="shrink-0 pt-space-md border-t border-[#E5DDD3] flex flex-col gap-space-sm">
        <div className="w-full flex flex-col gap-space-2xs">
          <div
            ref={progressBarRef}
            className={`relative w-full h-[3px] bg-[#E5DDD3] group/bar ${durationSec > 0 ? "cursor-pointer" : ""}`}
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
            <span>{formatTime(isDragging && dragPct !== null ? (dragPct / 100) * durationSec : localPosition)}</span>
            <span>{formatTime(durationSec)}</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-space-sm lg:gap-space-lg">
          <button
            className={`transition-colors p-space-xs cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${isShuffled ? "text-[#EE5522]" : "text-[#2B2A27] hover:text-[#EE5522]"
              }`}
            title="Shuffle"
            type="button"
            onClick={() => updatePlaybackSettings({ is_shuffled: !isShuffled })}
          >
            <span className="material-symbols-outlined text-[20px]">shuffle</span>
          </button>

          <button
            className="text-[#2B2A27] hover:text-[#EE5522] transition-colors p-space-xs cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous track"
            type="button"
            onClick={() => jumpToTrack(-1)}
          >
            <span className="material-symbols-outlined text-[26px]">skip_previous</span>
          </button>

          <button
            className="text-[#EE5522] hover:opacity-85 transition-opacity p-space-xs flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Play or Pause"
            type="button"
            disabled={tracks.length === 0}
            onClick={handlePlayPause}
          >
            <span className="material-symbols-outlined text-[38px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>

          <button
            className="text-[#2B2A27] hover:text-[#EE5522] transition-colors p-space-xs cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next track"
            type="button"
            onClick={() => jumpToTrack(1)}
          >
            <span className="material-symbols-outlined text-[26px]">skip_next</span>
          </button>

          <button
            className={`transition-colors p-space-xs cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${repeatMode !== "off" ? "text-[#EE5522]" : "text-[#2B2A27] hover:text-[#EE5522]"
              }`}
            title={`Repeat: ${repeatMode}`}
            type="button"
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
      </div>
    </main>
  );
}