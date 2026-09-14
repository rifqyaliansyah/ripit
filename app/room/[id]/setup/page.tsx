"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WaitingCodeCard from "@/components/room/WaitingCodeCard";
import WaitingParticipantList from "@/components/room/WaitingParticipantList";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

export default function RoomSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const role = searchParams.get("role") || "host";
  const userName = searchParams.get("name") || (role === "host" ? "Maya" : "Alex");
  const isHost = role === "host";

  const [currentCode, setCurrentCode] = useState(resolvedParams.id.toUpperCase());
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Dynamic participant list based on current user's name & role
  const participants = isHost
    ? [
        {
          id: "1",
          name: `${userName} (you)`,
          isHost: true,
          initial: userName.charAt(0).toUpperCase() || "H",
        },
        {
          id: "2",
          name: "Alex",
          isHost: false,
          initial: "A",
        },
      ]
    : [
        {
          id: "1",
          name: "Maya",
          isHost: true,
          initial: "M",
        },
        {
          id: "2",
          name: `${userName} (you)`,
          isHost: false,
          initial: userName.charAt(0).toUpperCase() || "P",
        },
      ];

  const handleRegenerateCode = () => {
    if (!isHost) return;
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    let newCode = "";
    for (let i = 0; i < 3; i++) {
      newCode += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 3; i++) {
      newCode += digits.charAt(Math.floor(Math.random() * digits.length));
    }

    setCurrentCode(newCode);
    window.history.replaceState(
      null,
      "",
      `/room/${newCode}/setup?role=${role}&name=${encodeURIComponent(userName)}`
    );
  };

  const handleStartSession = () => {
    router.push(`/room/${currentCode}`);
  };

  const handleConfirmLeave = () => {
    setShowLeaveModal(false);
    router.push("/");
  };

  return (
    <main className="w-full bg-background font-body-md text-on-surface min-h-screen">
      <div className="flex flex-col w-full">
        {/* Interactive View Container */}
        <div
          className="w-full flex flex-col items-center justify-center min-h-[100dvh] px-margin py-space-xl transition-colors duration-200"
          id="canvas-wrapper"
        >
          {/* Centered Column Sanctuary */}
          <section className="w-full max-w-md flex flex-col items-center text-center">
            {/* Header Identity */}
            <header className="flex flex-col items-center mb-space-2xl">
              <h1 className="text-display font-display tracking-tight text-[#262422] select-none">
                RIPIT
              </h1>
              <p className="text-body-lg font-body-lg text-[#76726D] mt-space-xs font-normal">
                {isHost ? "room setup & partner invite" : "waiting for session to start"}
              </p>
            </header>

            {/* Waiting Hub Flow */}
            <div className="w-full flex flex-col gap-space-xl">
              {/* Room Code & Share Controls */}
              <WaitingCodeCard
                roomCode={currentCode}
                isHost={isHost}
                onRegenerate={handleRegenerateCode}
              />

              {/* Joined Participants */}
              <WaitingParticipantList participants={participants} />

              {/* Actions & Role-Specific Status */}
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

      {/* Leave Room Confirmation Modal */}
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
