"use client";

import { useState } from "react";
import AddTrackModal from "@/components/room/AddTrackModal";
import { useRoomSocketContext } from "@/lib/RoomSocketContext";
import { addTrack, updateTrack, deleteTrack, getUser, type AddTrackPayload } from "@/lib/api";
import type { Track } from "@/lib/types";

export default function TrackQueue() {
  const { room, tracks, send } = useRoomSocketContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const roomId = room?.id;
  const user = getUser();
  const isHost = !!(user && room && user.id === room.host_id);

  const notifyQueueChanged = () => {
    send({ type: "QUEUE_UPDATED", payload: {} });
  };

  // Clicking the cover/play icon of a queue row: toggle play/pause if it's
  // already the current track, otherwise jump straight to that track.
  const handleTrackClick = (track: Track) => {
    if (room?.current_track_id === track.id) {
      const nextState = room.playback_state === "playing" ? "paused" : "playing";
      send({
        type: "CHANGE_STATE",
        payload: {
          playback_state: nextState,
          position_ms: room.playback_position_ms,
        },
      });
    } else {
      send({
        type: "SYNC_PLAYBACK",
        payload: {
          playback_state: "playing",
          playback_position_ms: 0,
          current_track_id: track.id,
        },
      });
    }
  };

  const handleAddTrack = async (newTrack: {
    youtubeUrl: string;
    title: string;
    artist: string;
    duration: string;
    cover: string;
    lyrics: string;
  }) => {
    if (!roomId) return;
    setError("");

    const payload: AddTrackPayload = {
      youtube_url: newTrack.youtubeUrl,
      title: newTrack.title,
      artist: newTrack.artist,
      duration: newTrack.duration,
      cover_url: newTrack.cover || undefined,
      lyrics: newTrack.lyrics.trim() ? newTrack.lyrics : undefined,
    };

    try {
      await addTrack(roomId, payload);
      notifyQueueChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add track");
    }
  };

  const handleSaveTrack = async (updated: {
    id: string;
    youtubeUrl: string;
    title: string;
    artist: string;
    duration: string;
    cover: string;
    lyrics: string;
  }) => {
    if (!roomId) return;
    setError("");

    try {
      await updateTrack(roomId, updated.id, {
        youtube_url: updated.youtubeUrl,
        title: updated.title,
        artist: updated.artist,
        duration: updated.duration,
        cover_url: updated.cover || undefined,
        lyrics: updated.lyrics,
        has_lyrics: updated.lyrics.trim().length > 0,
      });
      notifyQueueChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save track");
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!roomId) return;
    setError("");
    setPendingId(id);

    try {
      await deleteTrack(roomId, id);
      notifyQueueChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete track");
    } finally {
      setPendingId(null);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedTrack(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (track: Track) => {
    setSelectedTrack(track);
    setIsModalOpen(true);
  };

  return (
    <>
      {openMenuTrackId && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpenMenuTrackId(null)}
        />
      )}

      <aside className="col-span-12 lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[#E5DDD3] p-space-lg flex flex-col justify-between h-full min-h-0 relative">
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center justify-between pb-space-md shrink-0">
            <h2 className="font-title-sm text-title-sm text-[#2B2A27]">
              Shared queue
            </h2>
            <span className="font-label-sm text-label-sm text-[#7A7672]">
              {tracks.length} tracks queued
            </span>
          </div>

          <div className="pt-space-xs pb-space-md shrink-0">
            <button
              onClick={handleOpenAddModal}
              className="w-full py-space-sm px-space-md bg-[#FDF9F4] border border-[#E5DDD3] text-[#2B2A27] text-label-sm font-label-sm rounded-lg hover:bg-[#F7EFE8] transition-colors flex items-center justify-center shadow-none cursor-pointer"
              type="button"
            >
              <span>Add track or link</span>
            </button>
            {error && (
              <p className="text-label-sm font-label-sm text-[#EE5522] mt-space-2xs">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-col divide-y divide-[#E5DDD3] border-t border-b border-[#E5DDD3] overflow-y-auto flex-1 min-h-0 -mx-space-lg">
            {tracks.length === 0 && (
              <div className="py-space-xl px-space-lg text-center">
                <p className="text-body-sm font-body-sm text-[#7A7672]">
                  No tracks yet — add the first one to get started.
                </p>
              </div>
            )}

            {tracks.map((track) => {
              const isPlaying = room?.current_track_id === track.id;
              const isPending = pendingId === track.id;

              return (
                <div
                  key={track.id}
                  className={`py-space-md px-space-lg flex items-center justify-between gap-space-sm group hover:bg-[#F7EFE8] transition-colors cursor-pointer w-full relative ${isPending ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div
                      className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-[#EAE1D7] flex items-center justify-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrackClick(track);
                      }}
                      title="Play track"
                    >
                      {track.cover_url ? (
                        <img
                          className="w-full h-full object-cover"
                          alt={track.title}
                          src={track.cover_url}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[20px] text-[#7A7672]">
                          album
                        </span>
                      )}
                      {isPlaying ? (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                          <span
                            className="material-symbols-outlined text-[20px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {room?.playback_state === "playing" ? "pause" : "play_arrow"}
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <span
                            className="material-symbols-outlined text-[20px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            play_arrow
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`truncate ${isPlaying
                          ? "font-title-sm text-title-sm text-[#EE5522] font-semibold"
                          : "font-body-md text-body-md text-[#2B2A27]"
                          }`}
                      >
                        {track.title}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-body-sm text-body-sm text-[#7A7672] truncate">
                          {track.artist}
                        </span>
                        {track.has_lyrics && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-[#E5DDD3]/70 text-[#54504B] text-[9px] font-bold rounded-[3px] tracking-wider leading-none">
                            LYRICS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative shrink-0 flex items-center justify-end min-w-[36px] h-6">
                    <span
                      className={`font-label-sm text-label-sm text-[#7A7672] transition-opacity select-none ${openMenuTrackId === track.id
                        ? "opacity-0"
                        : "opacity-100 group-hover:opacity-0"
                        }`}
                    >
                      {track.duration}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuTrackId(
                          openMenuTrackId === track.id ? null : track.id
                        );
                      }}
                      className={`absolute right-0 top-0 bottom-0 flex items-center justify-end text-[#7A7672] hover:text-[#2B2A27] transition-opacity cursor-pointer ${openMenuTrackId === track.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                        }`}
                      title="Track options"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        more_horiz
                      </span>
                    </button>

                    {openMenuTrackId === track.id && (
                      <div
                        className="absolute right-0 top-full mt-1.5 w-36 bg-[#FDF9F4] border border-[#E5DDD3] shadow-md rounded-lg py-1 z-30 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuTrackId(null);
                            handleOpenEditModal(track);
                          }}
                          className="px-3 py-2 text-label-sm font-label-sm text-[#2B2A27] hover:bg-[#F7EFE8] flex items-center gap-2 transition-colors cursor-pointer w-full text-left"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#7A7672]">
                            edit_note
                          </span>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuTrackId(null);
                            handleDeleteTrack(track.id);
                          }}
                          className="px-3 py-2 text-label-sm font-label-sm text-[#EE5522] hover:bg-[#F7EFE8] flex items-center gap-2 transition-colors cursor-pointer w-full text-left"
                        >
                          <span className="material-symbols-outlined text-[16px] text-[#EE5522]">
                            delete
                          </span>
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <AddTrackModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTrack(null);
        }}
        initialTrack={
          selectedTrack
            ? {
              id: selectedTrack.id,
              youtubeUrl: selectedTrack.youtube_url,
              title: selectedTrack.title,
              artist: selectedTrack.artist,
              duration: selectedTrack.duration,
              cover: selectedTrack.cover_url,
              lyrics: selectedTrack.lyrics || "",
              hasLyrics: selectedTrack.has_lyrics,
            }
            : null
        }
        onAddTrack={handleAddTrack}
        onSaveTrack={handleSaveTrack}
      />
    </>
  );
}