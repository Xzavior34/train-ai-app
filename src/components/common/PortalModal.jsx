import React, { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Universal PortalModal component.
 * Renders modal content directly into document.body using React Portals.
 * Guarantees true viewport centering regardless of any parent CSS transforms,
 * animations, or page scroll positions.
 */
export function PortalModal({
  isOpen,
  onClose,
  children,
  maxWidth = 580,
  zIndex = 9999,
  className = "",
  style = {}
}) {
  useEffect(() => {
    if (!isOpen) return;

    // Lock body scroll while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Handle ESC key press
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex,
        background: "rgba(10, 14, 26, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(12px, 3vw, 24px)",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
      onClick={onClose}
    >
      <div
        className={`anim-slide-down ${className}`}
        style={{
          maxWidth,
          width: "100%",
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          background: "var(--surface)",
          color: "var(--text)",
          borderRadius: 22,
          padding: "clamp(18px, 2.5vw, 26px)",
          boxShadow: "0 24px 60px -8px rgba(0, 0, 0, 0.6), 0 0 1px 1px rgba(255, 255, 255, 0.08)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
          position: "relative",
          ...style
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export default PortalModal;
