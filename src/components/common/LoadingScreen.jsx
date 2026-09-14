import React from "react";

export default function LoadingScreen({ message = "Preparing your workspace..." }) {
  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulseLogo {
          0%, 100% { transform: scale(1); opacity: 0.95; filter: drop-shadow(0 4px 20px rgba(37, 99, 235, 0.25)); }
          50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 8px 30px rgba(37, 99, 235, 0.5)); }
        }
        @keyframes progressShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .tai-loading-logo {
          animation: pulseLogo 2.4s ease-in-out infinite;
        }
        .tai-progress-bar-anim {
          animation: progressShimmer 1.8s infinite ease-in-out;
        }
      `}</style>

      {/* Ambient background blur circles */}
      <div style={styles.glowTop} />
      <div style={styles.glowBottom} />

      <div style={styles.content}>
        {/* Brand Logo */}
        <div className="tai-loading-logo" style={styles.logoWrapper}>
          <img
            src="/train-ai-logo.png"
            alt="Train AI"
            style={styles.logo}
          />
        </div>

        {/* Dynamic Glowing Progress Indicator */}
        <div style={styles.track}>
          <div className="tai-progress-bar-anim" style={styles.shimmer} />
        </div>

        {/* Loading Message */}
        <div style={styles.message}>
          {message}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#F8FAFC",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: 24,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
    maxWidth: 320,
    width: "100%",
  },
  logoWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logo: {
    height: 40,
    width: "auto",
    objectFit: "contain",
    display: "block",
  },
  track: {
    width: 160,
    height: 4,
    borderRadius: 99,
    background: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
    marginBottom: 16,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "60%",
    height: "100%",
    background: "#2563EB",
    borderRadius: 99,
  },
  message: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    textAlign: "center",
  },
};
