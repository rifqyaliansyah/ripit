"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomMember } from "@/lib/types";
import { getUser } from "@/lib/api";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

interface RoomMembersProps {
  members: RoomMember[];
  roomCode: string;
  currentHostId?: string;
  hostLatencyMs: number | null;
  myLatencyMs: number | null;
  leaveRoom: () => void;
  className?: string;
}

function latencyBadgeClass(ms: number) {
  return ms < 100
    ? "bg-green-100 text-green-700"
    : ms < 300
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
}

export default function RoomMembers({
  members,
  roomCode,
  currentHostId,
  hostLatencyMs,
  myLatencyMs,
  leaveRoom,
  className = "",
}: RoomMembersProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const currentUser = getUser();

  const isHost = currentUser?.id === currentHostId;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmLeave = () => {
    leaveRoom();
    setShowLeaveModal(false);
    router.push("/");
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === "host" && b.role !== "host") return -1;
    if (a.role !== "host" && b.role === "host") return 1;
    return 0;
  });

  return (
    <aside className={`border-t md:border-t-0 md:border-l border-[#E5DDD3] p-space-md md:p-space-lg flex flex-col justify-between h-full min-h-0 ${className}`}>
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
            const memberIsHost = m.role === "host" || m.user_id === currentHostId;
            const username = m.user?.username || "Unknown";
            const isYou = m.user_id === currentUser?.id;

            // Each row shows the latency that belongs to that specific person:
            // the host's row shows hostLatencyMs, your own (non-host) row shows myLatencyMs.
            // No latency is shown for other members since we don't track theirs.
            const rowLatencyMs = memberIsHost
              ? hostLatencyMs
              : isYou
                ? myLatencyMs
                : null;
            const latencyTitle = memberIsHost
              ? "Host latency"
              : isYou
                ? "Your latency"
                : undefined;

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
                    {memberIsHost && (
                      <span className="font-label-sm text-label-sm text-[#7A7672]">
                        host
                      </span>
                    )}
                  </div>
                </div>

                {rowLatencyMs !== null && (
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${latencyBadgeClass(
                      rowLatencyMs
                    )}`}
                    title={latencyTitle}
                  >
                    {rowLatencyMs}ms
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave button — pinned at the bottom (desktop/tablet only, mobile uses bottom nav) */}
      <div className="pt-space-md shrink-0 hidden md:block">
        <button
          type="button"
          onClick={() => setShowLeaveModal(true)}
          className="w-full py-space-md px-space-lg rounded-lg bg-surface-dim hover:bg-surface-variant active:bg-[#c8c2be] border border-[#c4beba] text-on-surface font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-xs"
        >
          Leave Room
        </button>
      </div>

      <ConfirmationModal
        isOpen={showLeaveModal}
        title="Leave room?"
        subtitle={
          isHost
            ? "Leaving now will close the room for everyone. This session will end."
            : "Are you sure you want to leave this listening session?"
        }
        confirmText="Leave"
        cancelText="Stay"
        isDestructive={true}
        onConfirm={handleConfirmLeave}
        onCancel={() => setShowLeaveModal(false)}
      />
    </aside>
  );
}