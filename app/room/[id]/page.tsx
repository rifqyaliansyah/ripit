"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TrackQueue from "@/components/room/TrackQueue";
import PlayerStage from "@/components/room/PlayerStage";
import RoomMembers from "@/components/room/RoomMembers";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useRoomSocketContext } from "@/lib/RoomSocketContext";
import { getUser } from "@/lib/api";

type RoomMobileTab = "queue" | "player" | "members";

export default function RoomPage() {
  const router = useRouter();
  const { room, tracks, members, hostLatencyMs, myLatencyMs, leaveRoom } = useRoomSocketContext();
  const [mobileTab, setMobileTab] = useState<RoomMobileTab>("player");
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const currentUser = getUser();
  const isHost = currentUser?.id === room?.host_id;

  const handleConfirmLeave = () => {
    leaveRoom();
    setShowLeaveModal(false);
    router.push("/");
  };

  const isPlaying = room?.playback_state === "playing";

  return (
    <div className="flex flex-col h-[100dvh] w-full font-body-md overflow-hidden bg-[#FDF6F0] text-[#2B2A27]">
      <main className="w-full flex-1 flex flex-col min-h-0 relative">
        <div className="w-full max-w-[1440px] mx-auto grid grid-cols-12 flex-1 min-h-0 h-full pb-16 md:pb-0">
          {/* Track Queue: Fullscreen on mobile when active, col-span-3 on md/lg */}
          <TrackQueue
            className={`col-span-12 md:col-span-3 lg:col-span-3 ${
              mobileTab === "queue" ? "flex" : "hidden md:flex"
            }`}
          />

          {/* Player Stage: Fullscreen on mobile when active, col-span-6 on md, 7 on lg */}
          <PlayerStage
            className={`col-span-12 md:col-span-6 lg:col-span-7 ${
              mobileTab === "player" ? "flex" : "hidden md:flex"
            }`}
          />

          {/* Room Members: Fullscreen on mobile when active, col-span-3 on md, 2 on lg */}
          <RoomMembers
            members={members}
            roomCode={room?.room_code ?? ""}
            currentHostId={room?.host_id}
            hostLatencyMs={hostLatencyMs}
            myLatencyMs={myLatencyMs}
            leaveRoom={leaveRoom}
            className={`col-span-12 md:col-span-3 lg:col-span-2 ${
              mobileTab === "members" ? "flex" : "hidden md:flex"
            }`}
          />
        </div>

        {/* =========================================
            MOBILE BOTTOM NAVIGATION (< 768px, Fixed)
           ========================================= */}
        <nav
          aria-label="Room Mobile Navigation"
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#FDF9F4]/95 backdrop-blur-md border-t border-[#E5DDD3] px-2 py-1.5 flex items-center justify-around md:hidden shadow-lg select-none"
        >
          {/* Queue Tab */}
          <button
            type="button"
            onClick={() => setMobileTab("queue")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative cursor-pointer ${
              mobileTab === "queue"
                ? "text-[#EE5522] font-semibold"
                : "text-[#7A7672] hover:text-[#2B2A27]"
            }`}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]">queue_music</span>
              {tracks.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-[#EE5522] text-white text-[9px] font-bold rounded-full min-w-[14px] text-center leading-tight">
                  {tracks.length}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5">Queue</span>
          </button>

          {/* Player Tab */}
          <button
            type="button"
            onClick={() => setMobileTab("player")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
              mobileTab === "player"
                ? "text-[#EE5522] font-semibold"
                : "text-[#7A7672] hover:text-[#2B2A27]"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[24px]"
                style={mobileTab === "player" ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {isPlaying ? "graphic_eq" : "play_circle"}
              </span>
            </div>
            <span className="text-[11px] mt-0.5">Player</span>
          </button>

          {/* Members Tab */}
          <button
            type="button"
            onClick={() => setMobileTab("members")}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative cursor-pointer ${
              mobileTab === "members"
                ? "text-[#EE5522] font-semibold"
                : "text-[#7A7672] hover:text-[#2B2A27]"
            }`}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]">group</span>
              {members.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-[#7349a7] text-white text-[9px] font-bold rounded-full min-w-[14px] text-center leading-tight">
                  {members.length}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5">Members</span>
          </button>

          {/* Leave Button */}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 transition-colors text-[#7A7672] hover:text-[#EE5522] active:text-[#EE5522] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">logout</span>
            <span className="text-[11px] mt-0.5">Leave</span>
          </button>
        </nav>
      </main>

      {/* Confirmation modal for leaving room on mobile */}
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
    </div>
  );
}