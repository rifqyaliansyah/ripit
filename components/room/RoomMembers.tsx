"use client";
import { useState } from "react";
import type { RoomMember } from "@/lib/types";
import { getUser } from "@/lib/api";

interface RoomMembersProps {
  members: RoomMember[];
  roomCode: string;
  currentHostId?: string;
}

export default function RoomMembers({ members, roomCode, currentHostId }: RoomMembersProps) {
  const [copied, setCopied] = useState(false);
  const currentUser = getUser();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === "host" && b.role !== "host") return -1;
    if (a.role !== "host" && b.role === "host") return 1;
    return 0;
  });

  return (
    <aside className="col-span-12 lg:col-span-2 border-t lg:border-t-0 lg:border-l border-[#E5DDD3] p-space-lg flex flex-col justify-between h-full min-h-0">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Header with Room Code */}
        <div className="pb-space-md border-b border-[#E5DDD3] shrink-0 flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-label-sm text-[#7A7672]">
              Room Code
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="font-title-sm text-title-sm font-semibold tracking-wider uppercase text-[#2B2A27]">
                {roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-1 hover:text-[#EE5522] text-[#7A7672] transition-colors cursor-pointer rounded"
                title={copied ? "Copied!" : "Copy room code"}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? "check" : "content_copy"}
                </span>
              </button>
            </div>
            <span className="font-label-sm text-[11px] text-[#7A7672]">
              {members.length} {members.length === 1 ? "listener" : "listeners"}
            </span>
          </div>
        </div>

        {/* Member list */}
        <div className="flex flex-col divide-y divide-[#E5DDD3] overflow-y-auto flex-1">
          {sortedMembers.map((m) => {
            const isHost = m.role === "host" || m.user_id === currentHostId;
            const username = m.user?.username || "Unknown";
            const isYou = m.user_id === currentUser?.id;

            return (
              <div key={m.user_id} className="py-space-md flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <div className="w-7 h-7 rounded-full bg-[#EAE1D7] flex items-center justify-center text-label-sm font-label-sm font-semibold text-[#2B2A27]">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body-sm text-body-sm text-[#2B2A27]">
                      {username}
                      {isYou && " (you)"}
                    </span>
                    {isHost && (
                      <span className="font-label-sm text-label-sm text-[#7A7672]">
                        host
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}