"use client";

import { useState } from "react";

interface WaitingCodeCardProps {
  roomCode: string;
  isHost?: boolean;
  onRegenerate?: () => void;
}

export default function WaitingCodeCard({
  roomCode,
  isHost = true,
  onRegenerate,
}: WaitingCodeCardProps) {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  const shareRoomInvite = () => {
    const inviteUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/room/${roomCode}`
        : "";
    if (navigator.share) {
      navigator
        .share({
          title: "RIPIT Music Session",
          text: `Join my synchronous music room on RIPIT: ${roomCode}`,
          url: inviteUrl || window.location.href,
        })
        .catch(() => {});
    } else {
      copyRoomCode();
    }
  };

  return (
    <div
      className="w-full flex flex-col items-center gap-space-md p-space-lg rounded-xl bg-[#F7EFE8] border border-[#E5DDD3] shadow-xs"
      id="room-setup-card"
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-label-md font-label-md text-[#76726D]">
          Your shared room
        </span>
        {/* {isHost && onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="flex items-center gap-space-2xs text-label-sm font-label-sm text-[#76726D] hover:text-on-surface transition-colors cursor-pointer"
            title="Generate new code"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Regenerate</span>
          </button>
        )} */}
      </div>

      {/* Room Code Lavender Pill Badge */}
      <div className="w-full flex items-center justify-center my-space-xs">
        <div className="w-full flex items-center justify-center py-4 px-space-lg rounded-lg bg-[#C89BFF] text-[#262422] font-mono font-bold text-display tracking-widest select-all shadow-inner">
          <span id="room-code-display">{roomCode}</span>
        </div>
      </div>

      {/* Darkened Action Controls using theme palette tokens */}
      <div className="grid grid-cols-2 gap-space-sm w-full">
        <button
          className="flex items-center justify-center gap-space-xs py-space-sm px-space-md rounded-lg bg-surface-dim hover:bg-surface-variant active:opacity-85 border border-[#c4beba] text-on-surface text-label-md font-label-md transition-all cursor-pointer shadow-xs"
          onClick={copyRoomCode}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">
            content_copy
          </span>
          <span id="copy-status">{copied ? "Copied" : "Copy code"}</span>
        </button>
        <button
          className="flex items-center justify-center gap-space-xs py-space-sm px-space-md rounded-lg bg-surface-dim hover:bg-surface-variant active:opacity-85 border border-[#c4beba] text-on-surface text-label-md font-label-md transition-all cursor-pointer shadow-xs"
          onClick={shareRoomInvite}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">share</span>
          <span>Share link</span>
        </button>
      </div>
    </div>
  );
}
