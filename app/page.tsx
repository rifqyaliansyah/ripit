"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NameInputModal from "@/components/NameInputModal";

export default function EntryScreen() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [feedback, setFeedback] = useState("");

  // Modal State
  const [modalMode, setModalMode] = useState<"create" | "join" | null>(null);

  const handleOpenCreateModal = () => {
    setModalMode("create");
  };

  const handleOpenJoinModal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = joinCode.trim().toUpperCase();

    if (!val) {
      setFeedback("Please enter a 6-character room code.");
      return;
    }

    if (val.length < 5) {
      setFeedback("Codes are typically 6 characters.");
      return;
    }

    setFeedback("");
    setModalMode("join");
  };

  const handleNameSubmit = (name: string) => {
    if (modalMode === "create") {
      const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
      const digits = "23456789";
      let randomCode = "";
      for (let i = 0; i < 3; i++) {
        randomCode += letters.charAt(Math.floor(Math.random() * letters.length));
      }
      for (let i = 0; i < 3; i++) {
        randomCode += digits.charAt(Math.floor(Math.random() * digits.length));
      }

      setModalMode(null);
      router.push(
        `/room/${randomCode}/setup?role=host&name=${encodeURIComponent(name)}`
      );
    } else if (modalMode === "join") {
      const val = joinCode.trim().toUpperCase();
      setModalMode(null);
      setFeedback(`Connecting to ${val}...`);

      setTimeout(() => {
        router.push(
          `/room/${val}/setup?role=joiner&name=${encodeURIComponent(name)}`
        );
      }, 500);
    }
  };

  return (
    <main className="w-full bg-background font-body-md text-on-surface min-h-screen">
      <div className="flex flex-col w-full">
        {/* Interactive View Container */}
        <div
          className="w-full flex flex-col items-center justify-center min-h-[100dvh] px-margin transition-colors duration-200"
          id="canvas-wrapper"
        >
          {/* Centered Column Sanctuary */}
          <section className="w-full max-w-md flex flex-col items-center text-center">
            {/* Brand & Quiet Intimate Identity */}
            <header className="flex flex-col items-center mb-space-3xl">
              <h1 className="text-display font-display tracking-tight text-[#262422] select-none">
                RIPIT
              </h1>
              <p className="text-body-lg font-body-lg text-[#76726D] mt-space-xs font-normal">
                listen to music together, in real time
              </p>
            </header>

            {/* Primary Action */}
            <div className="w-full flex flex-col gap-space-lg">
              <button
                className="w-full py-space-md px-space-lg rounded-lg bg-[#EE5522] hover:bg-[#d84817] active:bg-[#c23f12] text-white font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-sm"
                onClick={handleOpenCreateModal}
                type="button"
              >
                Create a room
              </button>
            </div>

            {/* Hairline Divider */}
            <div className="w-full my-space-2xl flex items-center justify-center">
              <div className="w-full h-px bg-[#E5DDD3]"></div>
            </div>

            {/* Join Secondary Flow: Sharp Hairline Controls */}
            <div className="w-full flex flex-col items-start text-left">
              <label
                className="text-label-md font-label-md text-[#76726D] mb-space-xs"
                htmlFor="room-input"
              >
                Have a code from your partner?
              </label>
              <form
                className="w-full flex flex-col gap-space-xs"
                onSubmit={handleOpenJoinModal}
              >
                <div className="w-full flex gap-space-sm">
                  <input
                    className="flex-1 px-space-md py-space-md rounded-lg bg-[#FDF6F0] border border-[#E5DDD3] text-[#262422] placeholder-[#76726D] focus:outline-none focus:border-[#262422] font-body-md text-body-md transition-colors uppercase tracking-wider"
                    id="room-input"
                    maxLength={8}
                    placeholder="e.g. LUV924"
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                  />
                  <button
                    className="px-space-xl py-space-md rounded-lg bg-surface-dim hover:bg-surface-variant active:bg-[#c8c2be] border border-[#c4beba] text-on-surface font-title-sm text-title-sm transition-colors whitespace-nowrap cursor-pointer shadow-xs"
                    type="submit"
                  >
                    Join
                  </button>
                </div>
                {feedback && (
                  <span
                    className={`text-label-sm font-label-sm ${
                      feedback.startsWith("Connecting")
                        ? "text-[#76726D]"
                        : "text-[#EE5522]"
                    }`}
                  >
                    {feedback}
                  </span>
                )}
              </form>
            </div>

            {/* Footer Micro-Presence Indicator */}
            <footer className="mt-space-3xl flex items-center justify-center gap-space-xs text-label-sm font-label-sm text-[#76726D]">
              <span className="inline-block w-1 h-1 rounded-full bg-[#76726D]"></span>
            </footer>
          </section>
        </div>
      </div>

      {/* Name Input Modal */}
      <NameInputModal
        isOpen={modalMode !== null}
        title={modalMode === "create" ? "What's your name?" : "Enter your name"}
        subtitle={
          modalMode === "create"
            ? "Your partner will see this name as host."
            : `Joining room ${joinCode.trim().toUpperCase() || ""}`
        }
        buttonText={modalMode === "create" ? "Create Room" : "Join Session"}
        onClose={() => setModalMode(null)}
        onSubmit={handleNameSubmit}
      />
    </main>
  );
}
