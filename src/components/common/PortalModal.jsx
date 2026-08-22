import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Universal PortalModal component with adaptive Light/Dark Gaussian Glass styling.
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
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return (
      document.documentElement.classList.contains("dark") ||
      localStorage.getItem("trainai_theme_dark") === "true"
    );
  });

  useEffect(() => {
    if (!isOpen) return;

    // Real-time theme sync for dynamic theme toggle while modal is open
    const checkTheme = () => {
      const dark =
        document.documentElement.classList.contains("dark") ||
        localStorage.getItem("trainai_theme_dark") === "true";
      setIsDark(dark);
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });

    window.addEventListener("storage", checkTheme);

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
      observer.disconnect();
      window.removeEventListener("storage", checkTheme);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const glassCardStyle = isDark
    ? {
        background: "rgba(17, 24, 39, 0.94)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow:
          "0 32px 85px -12px rgba(0, 0, 0, 0.88), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)",
        color: "#F8FAFC"
      }
    : {
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(24px) saturate(190%)",
        WebkitBackdropFilter: "blur(24px) saturate(190%)",
        border: "1px solid rgba(255, 255, 255, 0.92)",
        boxShadow:
          "0 30px 75px -12px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(226, 232, 240, 0.85), inset 0 1px 0 0 rgba(255, 255, 255, 1)",
        color: "#0F172A"
      };

  return createPortal(
    <div
      className={`tai ta ${isDark ? "dark" : ""}`}
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
        background: isDark ? "rgba(3, 7, 18, 0.78)" : "rgba(15, 23, 42, 0.60)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
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
          borderRadius: 24,
          padding: "clamp(18px, 2.5vw, 28px)",
          boxSizing: "border-box",
          position: "relative",
          ...glassCardStyle,
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
