"use client";

import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "sm",
}: ModalProps) {
  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-space-md bg-black/40 backdrop-blur-[2px] transition-all animate-in fade-in duration-150">
      {/* Backdrop click to close */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative w-full ${maxWidthClass} rounded-xl bg-[#FDF6F0] border border-[#E5DDD3] p-space-xl shadow-xl z-10 flex flex-col items-center text-center`}
      >
        {/* Header if title is provided */}
        {title && (
          <h3 className="font-title-sm text-title-sm text-[#262422] font-semibold">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-body-sm font-body-sm text-[#76726D] mt-space-2xs mb-space-lg">
            {subtitle}
          </p>
        )}

        {/* Modal Content */}
        {children}
      </div>
    </div>
  );
}
