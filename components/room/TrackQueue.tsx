"use client";

import { useState } from "react";
import AddTrackModal from "@/components/room/AddTrackModal";

const INITIAL_QUEUED_TRACKS = [
  {
    id: "1",
    title: "Golden Hour",
    artist: "JVKE",
    duration: "3:29",
    isPlaying: true,
    hasLyrics: true,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDFhWyarsgnG7s3HQg2CIrX08UL8VQYN937QJkSGoSQII3mlrtVMgIJ2Fqmj9LWP_0lMVvXAScm5QZzASskS1mUmIqgUsAlZyfZK3gbAYGXICmRg4d3pYy6r6-Vtq9br8-jK9duyqYsDW20sPvvf2NLdvtPyyMb6FjeXdvI3T0br6jSsJ-RMWGiSXDwj5wfhuDoe95S5XHr-PXLnH-R8p0XKXdoXBb5a1rk_8dcjRmz-zZuRLgcsORn",
    alt: "Intimate golden sunlight flooding a minimal studio room",
  },
  {
    id: "2",
    title: "Mystery of Love",
    artist: "Sufjan Stevens",
    duration: "3:35",
    isPlaying: false,
    hasLyrics: true,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC1ZXDn6qXY1eqGRV6TwnFJFuG9JaLnzeI7yKvfdyLUe-fqufDPj7Q8iqsQ3VdoK1m8-2g7qC2uJovzMHFoCjqpfCRxGOKcgvKTLgzLgdo2_zgemsIr_2cM1FdEUT78wu06LcExCfCZ5IVAcLOom4gbuX8nfleFsAe2dEWtv4SzW--Zxvj2lqUbRYK5oSxXv4mr10dkQ4i0x7NHc6tDNcadC8f2qNz3d2vNX3Am3aietp3DI_dd4z32",
    alt: "A quiet dusk ocean shoreline",
  },
  {
    id: "3",
    title: "Apocalypse",
    artist: "Cigarettes After Sex",
    duration: "4:50",
    isPlaying: false,
    hasLyrics: false,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBfmQXmlrLu4mtIwFJToSlMEQysGTsv3Ivvoo4KJW17Y19BiddyabQKXzAEO0I_zWxLbo7BB2CtpVZey7fgqXndld1AnSKKKfnkVlhQlXT1rbxrT21Vh7lpkavAw_mWaeh1CwL9VFseSQMBkqZJWMBfuepU6tQbdyTPezYTWiW-95GKTUcwER0Kql0EXLjMraF8jFRluyBCTMK4LHAy6acLH697yPI0EZa3l4yZTXW0nsjQJLP89kEM",
    alt: "Two porcelain tea cups resting on warm untreated oak table",
  },
  {
    id: "4",
    title: "Slow Burn",
    artist: "Kacey Musgraves",
    duration: "4:06",
    isPlaying: false,
    hasLyrics: false,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBe7dwx6v17miLHvEqNlsL_GC4NvAISVLFtv3VA9rdjK8XlRBJhPyhkBAzqa9R_sOoymbLEn_mygqzamJKuWUgZ1gWM7aAfUh529zUy3qTitXiUGFuwK4QmRkUW0iZQd73lH9YpRgYWwum6lrupFn7yph2n7ZZz-zJy76Le6y7RqHl8Fr7wKcbens9D4X907tM1SUp5Gtu5a0IRBdum6WwPJqRb8U4Yp36DRSs2-LcIH2FIZJnhwF9d",
    alt: "Abstract architectural shadows cast across textured beige plaster wall",
  },
  {
    id: "5",
    title: "Coffee",
    artist: "beabadoobee",
    duration: "2:06",
    isPlaying: false,
    hasLyrics: true,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDFhWyarsgnG7s3HQg2CIrX08UL8VQYN937QJkSGoSQII3mlrtVMgIJ2Fqmj9LWP_0lMVvXAScm5QZzASskS1mUmIqgUsAlZyfZK3gbAYGXICmRg4d3pYy6r6-Vtq9br8-jK9duyqYsDW20sPvvf2NLdvtPyyMb6FjeXdvI3T0br6jSsJ-RMWGiSXDwj5wfhuDoe95S5XHr-PXLnH-R8p0XKXdoXBb5a1rk_8dcjRmz-zZuRLgcsORn",
    alt: "Cup of warm morning coffee",
  },
  {
    id: "6",
    title: "Motion Sickness",
    artist: "Phoebe Bridgers",
    duration: "3:49",
    isPlaying: false,
    hasLyrics: false,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC1ZXDn6qXY1eqGRV6TwnFJFuG9JaLnzeI7yKvfdyLUe-fqufDPj7Q8iqsQ3VdoK1m8-2g7qC2uJovzMHFoCjqpfCRxGOKcgvKTLgzLgdo2_zgemsIr_2cM1FdEUT78wu06LcExCfCZ5IVAcLOom4gbuX8nfleFsAe2dEWtv4SzW--Zxvj2lqUbRYK5oSxXv4mr10dkQ4i0x7NHc6tDNcadC8f2qNz3d2vNX3Am3aietp3DI_dd4z32",
    alt: "Open road sunset drive",
  },
  {
    id: "7",
    title: "Space Song",
    artist: "Beach House",
    duration: "5:20",
    isPlaying: false,
    hasLyrics: true,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBfmQXmlrLu4mtIwFJToSlMEQysGTsv3Ivvoo4KJW17Y19BiddyabQKXzAEO0I_zWxLbo7BB2CtpVZey7fgqXndld1AnSKKKfnkVlhQlXT1rbxrT21Vh7lpkavAw_mWaeh1CwL9VFseSQMBkqZJWMBfuepU6tQbdyTPezYTWiW-95GKTUcwER0Kql0EXLjMraF8jFRluyBCTMK4LHAy6acLH697yPI0EZa3l4yZTXW0nsjQJLP89kEM",
    alt: "Dreamy star constellation",
  },
  {
    id: "8",
    title: "Sweet / I Thought You Wanted to Dance",
    artist: "Tyler, The Creator",
    duration: "9:48",
    isPlaying: false,
    hasLyrics: false,
    cover:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBe7dwx6v17miLHvEqNlsL_GC4NvAISVLFtv3VA9rdjK8XlRBJhPyhkBAzqa9R_sOoymbLEn_mygqzamJKuWUgZ1gWM7aAfUh529zUy3qTitXiUGFuwK4QmRkUW0iZQd73lH9YpRgYWwum6lrupFn7yph2n7ZZz-zJy76Le6y7RqHl8Fr7wKcbens9D4X907tM1SUp5Gtu5a0IRBdum6WwPJqRb8U4Yp36DRSs2-LcIH2FIZJnhwF9d",
    alt: "Pastel color palette landscape",
  },
];

export default function TrackQueue() {
  const [tracks, setTracks] = useState(INITIAL_QUEUED_TRACKS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<(typeof INITIAL_QUEUED_TRACKS)[0] | null>(null);
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);

  const handleAddTrack = (newTrack: {
    youtubeUrl: string;
    title: string;
    artist: string;
    duration: string;
    cover: string;
    lyrics: string;
  }) => {
    setTracks((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        title: newTrack.title,
        artist: newTrack.artist,
        duration: newTrack.duration,
        isPlaying: false,
        hasLyrics: Boolean(newTrack.lyrics && newTrack.lyrics.trim().length > 0),
        cover: newTrack.cover,
        alt: newTrack.title,
      },
    ]);
  };

  const handleSaveTrack = (updated: { id: string; lyrics: string }) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === updated.id
          ? {
              ...t,
              hasLyrics: Boolean(updated.lyrics && updated.lyrics.trim().length > 0),
            }
          : t
      )
    );
  };

  const handleDeleteTrack = (id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleOpenAddModal = () => {
    setSelectedTrack(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (track: (typeof INITIAL_QUEUED_TRACKS)[0]) => {
    setSelectedTrack(track);
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Backdrop for open dropdown */}
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
          </div>
          <div className="flex flex-col divide-y divide-[#E5DDD3] border-t border-b border-[#E5DDD3] overflow-y-auto flex-1 min-h-0 -mx-space-lg">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="py-space-md px-space-lg flex items-center justify-between gap-space-sm group hover:bg-[#F7EFE8] transition-colors cursor-pointer w-full relative"
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  {/* Cover image with overlay icon */}
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-black/5">
                    <img
                      className="w-full h-full object-cover"
                      alt={track.alt}
                      src={track.cover}
                    />
                    {track.isPlaying ? (
                      /* Currently playing track: pause icon always visible */
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          pause
                        </span>
                      </div>
                    ) : (
                      /* Inactive tracks: play icon appears on row hover */
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
                      className={`truncate ${
                        track.isPlaying
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
                      {track.hasLyrics && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-[#E5DDD3]/70 text-[#54504B] text-[9px] font-bold rounded-[3px] tracking-wider leading-none">
                          LYRICS
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Duration & 3-Dot Options Swap Container */}
                <div className="relative shrink-0 flex items-center justify-end min-w-[36px] h-6">
                  {/* Duration text (visible normally, hidden when hovered or menu opened) */}
                  <span
                    className={`font-label-sm text-label-sm text-[#7A7672] transition-opacity select-none ${
                      openMenuTrackId === track.id
                        ? "opacity-0"
                        : "opacity-100 group-hover:opacity-0"
                    }`}
                  >
                    {track.duration}
                  </span>

                  {/* 3-dot options button (replaces duration in place on hover or when open) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuTrackId(
                        openMenuTrackId === track.id ? null : track.id
                      );
                    }}
                    className={`absolute right-0 top-0 bottom-0 flex items-center justify-end text-[#7A7672] hover:text-[#2B2A27] transition-opacity cursor-pointer ${
                      openMenuTrackId === track.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                    title="Track options"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      more_horiz
                    </span>
                  </button>

                  {/* Dropdown Menu Popup */}
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
            ))}
          </div>
        </div>
      </aside>

      {/* Add / Edit Track Modal */}
      <AddTrackModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTrack(null);
        }}
        initialTrack={selectedTrack}
        onAddTrack={handleAddTrack}
        onSaveTrack={handleSaveTrack}
      />
    </>
  );
}





