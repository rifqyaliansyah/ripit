"use client";
import { useState } from "react";

export default function PlayerStage() {
  const [isPlaying, setIsPlaying] = useState(true);

  return (
    <main className="col-span-12 lg:col-span-7 flex flex-col justify-between p-space-lg lg:px-space-2xl lg:py-space-lg h-full min-h-0">
      {/* Track Header */}
      <div className="shrink-0 flex flex-col md:flex-row items-center justify-between gap-space-md pb-space-md border-b border-[#E5DDD3]">
        <div className="flex items-center gap-space-md text-center md:text-left">
          <img
            className="w-12 h-12 lg:w-14 lg:h-14 rounded-lg object-cover shrink-0"
            alt="Warm sunlight spilling through an open loft window"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAb7nOt_DtEujnrAVcxtzuIPsmBkN-5ZOWhg9CO4usLRMoB0o9tsG4_kGbaZFMjamaRlpnLDZ3_1luXW6Fvqk7c6Cub3LAN9d0mRAM7H_WeKTQmCFDlwkDzWrSomIP036mjTx2etrDe4Ei3PxcgXH8n90MURDP6F1sx7TIp24LuTkvM5dW0NtegRtkERO4WnDbB7tuOp_xyBEzFEfxSjUMVRUj2Px_f2Vw1hYLWUjZ0sIrZMlkS2gYd"
          />
          <div>
            <h1 className="font-headline-lg text-title-sm lg:text-headline-md text-[#262422]">
              Golden Hour
            </h1>
            <p className="font-body-sm text-body-sm text-[#7A7672]">JVKE</p>
          </div>
        </div>
        <div className="flex items-center gap-space-sm text-[#7A7672]">
          <button
            className="p-space-xs hover:text-[#2B2A27] transition-colors cursor-pointer"
            title="Volume balance"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              volume_up
            </span>
          </button>
        </div>
      </div>

      {/* Center Lyric Stage: Spotify-style, left-aligned, prominent font size */}
      <section className="flex-1 min-h-0 flex flex-col items-start justify-center text-left space-y-space-md lg:space-y-space-lg px-space-md max-w-[760px] overflow-hidden">
        <p className="font-headline-md text-headline-md lg:text-headline-lg text-[#7A7672]/35 select-none transition-all duration-300 font-medium">
          It's your world and I'm just living in it
        </p>
        <p className="font-headline-md text-headline-md lg:text-headline-lg text-[#7A7672]/60 select-none transition-all duration-300 font-medium">
          You shine so bright, you make the sun look dim
        </p>
        <p className="font-headline-md text-headline-md lg:text-headline-lg text-[#262422] font-bold select-none transition-all duration-300">
          She's got that golden glow, skin glistening in the dusk light
        </p>
        <p className="font-headline-md text-headline-md lg:text-headline-lg text-[#7A7672]/60 select-none transition-all duration-300 font-medium">
          I don't ever want this evening to end
        </p>
        <p className="font-headline-md text-headline-md lg:text-headline-lg text-[#7A7672]/35 select-none transition-all duration-300 font-medium">
          Hold your breath while the sky turns pink
        </p>
      </section>

      {/* Playback Console: anchored cleanly at the bottom */}
      <div className="shrink-0 pt-space-md border-t border-[#E5DDD3] flex flex-col gap-space-sm">
        <div className="w-full flex flex-col gap-space-2xs">
          <div className="relative w-full h-[3px] bg-[#E5DDD3] cursor-pointer">
            <div
              className="h-full bg-[#EE5522] relative"
              style={{ width: "48%" }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#2B2A27]"></div>
            </div>
          </div>
          <div className="w-full flex items-center justify-between font-label-sm text-label-sm text-[#7A7672]">
            <span>1:38</span>
            <span>3:29</span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-space-md lg:gap-space-xl">
          {/* 1. Shuffle */}
          <button
            className="text-[#7A7672] hover:text-[#2B2A27] transition-colors p-space-xs cursor-pointer flex items-center justify-center"
            title="Shuffle"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              shuffle
            </span>
          </button>

          {/* 2. Previous */}
          <button
            className="text-[#2B2A27] hover:text-[#EE5522] transition-colors p-space-xs cursor-pointer flex items-center justify-center"
            title="Previous track"
            type="button"
          >
            <span className="material-symbols-outlined text-[26px]">
              skip_previous
            </span>
          </button>

          {/* 3. Play/Pause */}
          <button
            className="text-[#EE5522] hover:opacity-85 transition-opacity p-space-xs flex items-center justify-center cursor-pointer"
            id="main-play-btn"
            title="Play or Pause"
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            <span
              className="material-symbols-outlined text-[38px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? "pause" : "play_arrow"}
            </span>
          </button>

          {/* 4. Next */}
          <button
            className="text-[#2B2A27] hover:text-[#EE5522] transition-colors p-space-xs cursor-pointer flex items-center justify-center"
            title="Next track"
            type="button"
          >
            <span className="material-symbols-outlined text-[26px]">
              skip_next
            </span>
          </button>

          {/* 5. Repeat */}
          <button
            className="text-[#7A7672] hover:text-[#2B2A27] transition-colors p-space-xs cursor-pointer flex items-center justify-center"
            title="Repeat"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              repeat
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
