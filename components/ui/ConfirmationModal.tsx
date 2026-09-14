"use client";

import Modal from "@/components/ui/Modal";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  subtitle,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} subtitle={subtitle}>
      <div className="flex items-center gap-space-sm w-full mt-space-xs">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-space-md px-space-md rounded-lg bg-surface-dim hover:bg-surface-variant border border-[#c4beba] text-on-surface font-title-sm text-title-sm transition-colors cursor-pointer shadow-xs"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`flex-1 py-space-md px-space-md rounded-lg font-title-sm text-title-sm transition-colors cursor-pointer select-none text-center shadow-xs text-white ${
            isDestructive
              ? "bg-[#EE5522] hover:bg-[#d84817] active:bg-[#c23f12]"
              : "bg-[#7349a7] hover:bg-[#5f398e] active:bg-[#4d2c75]"
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
