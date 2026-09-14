"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WaitingCodeCard from "@/components/room/WaitingCodeCard";
import WaitingParticipantList from "@/components/room/WaitingParticipantList";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useRoomSocketContext } from "@/lib/RoomSocketContext";
import { getUser } from "@/lib/api";

export default function RoomSetupPage() {
  const router = useRouter();
  const { room, members, send, leaveRoom } = useRoomSocketContext();
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const currentUser = getUser();
  const isHost = room?.host_id === currentUser?.id;
  const roomCode = room?.room_code?.toUpperCase() ?? "";

  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === "host" && b.role !== "host") return -1;
    if (a.role !== "host" && b.role === "host") return 1;
    return 0;
  });

  const participants = sortedMembers.map((m) => ({
    id: m.user_id,
    name:
      m.user?.username && m.user_id === currentUser?.id
        ? `${m.user.username} (you)`
        : m.user?.username || "Unknown",
    isHost: m.role === "host",
    initial: m.user?.username?.charAt(0).toUpperCase() || "?",
  }));

  const handleStartSession = () => {
    send({ type: "SESSION_STARTED", payload: {} });
    router.push(`/room/${roomCode}`);
  };

  const handleConfirmLeave = () => {
    leaveRoom(); // kirim LEAVE_ROOM eksplisit sebelum socket ditutup
    setShowLeaveModal(false);
    router.push("/");
  };

  return (
    <main className="w-full bg-background font-body-md text-on-surface min-h-screen">
      <div className="flex flex-col w-full">
        <div
          className="w-full flex flex-col items-center justify-center min-h-[100dvh] px-margin py-space-xl transition-colors duration-200"
          id="canvas-wrapper"
        >
          <section className="w-full max-w-md flex flex-col items-center text-center">
            <header className="flex flex-col items-center mb-space-2xl">
              <h1 className="text-display font-display tracking-tight text-[#262422] select-none">
                RIPIT
              </h1>
              <p className="text-body-lg font-body-lg text-[#76726D] mt-space-xs font-normal">
                {isHost ? "room setup & partner invite" : "waiting for session to start"}
              </p>
            </header>

            <div className="w-full flex flex-col gap-space-xl">
              <WaitingCodeCard
                roomCode={roomCode}
                isHost={isHost}
                onRegenerate={() => { }}
              />

              <WaitingParticipantList participants={participants} />

              <div className="w-full flex flex-col gap-space-sm">
                {isHost ? (
                  <>
                    <button
                      className="w-full py-space-md px-space-lg rounded-lg bg-[#EE5522] hover:bg-[#d84817] active:bg-[#c23f12] text-white font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-sm"
                      onClick={handleStartSession}
                      type="button"
                    >
                      Enter Room
                    </button>
                    <button
                      className="w-full py-space-md px-space-lg rounded-lg bg-surface-dim hover:bg-surface-variant active:bg-[#c8c2be] border border-[#c4beba] text-on-surface font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-xs"
                      onClick={() => setShowLeaveModal(true)}
                      type="button"
                    >
                      Leave Room
                    </button>
                    <span className="text-label-sm font-label-sm text-[#76726D] mt-space-2xs">
                      You can enter now or wait for your partner to connect
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-full flex flex-col items-center justify-center p-space-md rounded-lg bg-[#F7EFE8] border border-[#E5DDD3] gap-space-xs">
                      <div className="flex items-center gap-space-xs">
                        <span className="font-title-sm text-title-sm text-[#262422] font-medium">
                          Waiting for host
                        </span>
                      </div>
                      <p className="text-body-sm font-body-sm text-[#76726D]">
                        The host will start the listening session shortly. You will enter automatically.
                      </p>
                    </div>
                    <button
                      className="w-full py-space-md px-space-lg rounded-lg bg-surface-dim hover:bg-surface-variant active:bg-[#c8c2be] border border-[#c4beba] text-on-surface font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-xs"
                      onClick={() => setShowLeaveModal(true)}
                      type="button"
                    >
                      Leave Room
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showLeaveModal}
        title="Leave room?"
        subtitle={
          isHost
            ? "Leaving now will close the room setup session. Your invite link will no longer be active."
            : "Are you sure you want to leave this waiting room and return to the home screen?"
        }
        confirmText="Leave"
        cancelText="Stay"
        isDestructive={true}
        onConfirm={handleConfirmLeave}
        onCancel={() => setShowLeaveModal(false)}
      />
    </main>
  );
}