"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";

interface NameInputModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  buttonText?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export default function NameInputModal({
  isOpen,
  title,
  subtitle = "Choose a display name for this listening session",
  buttonText = "Continue",
  onClose,
  onSubmit,
}: NameInputModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or less.");
      return;
    }
    setError("");
    onSubmit(trimmed);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-space-md">
        <div className="w-full flex flex-col text-left">
          <input
            type="text"
            autoFocus
            placeholder="e.g. Maya, Alex, Jordan"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            maxLength={20}
            className="w-full px-space-md py-space-md rounded-lg bg-surface-container-lowest border border-[#E5DDD3] text-[#262422] placeholder-[#76726D] focus:outline-none focus:border-[#262422] font-body-md text-body-md transition-colors"
          />
          {error && (
            <span className="text-label-sm font-label-sm text-[#EE5522] mt-space-2xs">
              {error}
            </span>
          )}
        </div>

        <div className="flex items-center gap-space-sm w-full mt-space-xs">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-space-md px-space-md rounded-lg bg-surface-dim hover:bg-surface-variant border border-[#c4beba] text-on-surface font-title-sm text-title-sm transition-colors cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-space-md px-space-md rounded-lg bg-[#EE5522] hover:bg-[#d84817] active:bg-[#c23f12] text-white font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-xs"
          >
            {buttonText}
          </button>
        </div>
      </form>
    </Modal>
  );
}
