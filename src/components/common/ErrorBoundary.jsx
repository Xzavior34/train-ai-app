import React from "react";
import { AlertTriangle, RotateCcw, Home, BookOpen, Compass, ShieldCheck, ArrowRight, ChevronDown, ChevronUp, Layers, Trash2 } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      showPortalMenu: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleResetState = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    try {
      this.setState({ hasError: false, error: null });
      window.location.href = "/";
    } catch {
      window.location.reload();
    }
  };

  handleGoRoute = (path) => {
    try {
      this.setState({ hasError: false, error: null });
      window.location.href = path;
    } catch {
      window.location.reload();
    }
  };

  handleHardReset = () => {
    if (window.confirm("This will clear temporary browser cache and reload the application. Continue?")) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error("Failed to clear storage:", e);
      }
      window.location.href = "/";
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "An unexpected error occurred while loading this view.";
      const errorStack = this.state.error?.stack || (this.state.errorInfo?.componentStack || "");

      return (
        <div
          className="ambient-mesh-glow"
          style={{
            minHeight: "100vh",
            width: "100%",
            background: "linear-gradient(135deg, #090D1A 0%, #0F172A 50%, #1E1B4B 100%)",
            color: "#F8FAFC",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(20px, 4vw, 40px) 20px",
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxSizing: "border-box"
          }}
        >
          {/* Liquid Glass Container Card */}
          <div
            className="anim-fluid-entrance"
            style={{
              maxWidth: 580,
              width: "100%",
              background: "rgba(18, 24, 41, 0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderRadius: 16,
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 20px 50px -10px rgba(0, 0, 0, 0.6), 0 0 30px rgba(37, 99, 235, 0.2)",
              padding: "clamp(24px, 3.5vw, 36px)",
              textAlign: "left",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {/* Header Brand & Status Pill */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 4px 14px rgba(37, 99, 235, 0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontWeight: 900,
                    fontSize: 15
                  }}
                >
                  T
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.01em" }}>Train AI</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>System Recovery</div>
                </div>
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#FCA5A5",
                  fontSize: 11.5,
                  fontWeight: 700
                }}
              >
                <AlertTriangle size={13} color="#EF4444" />
                <span>Notice</span>
              </span>
            </div>

            {/* Error Title & Description */}
            <h1
              style={{
                fontSize: "clamp(20px, 2.5vw, 24px)",
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.02em",
                margin: "0 0 8px"
              }}
            >
              Let's get you back on track
            </h1>
            <p style={{ fontSize: 13.5, color: "#94A3B8", lineHeight: 1.55, margin: "0 0 20px" }}>
              The application encountered an unexpected hiccup while loading this specific view. Your account and progress remain safe. Choose an option below to continue.
            </p>

            {/* Technical Diagnostic Disclosure (Collapsible) */}
            <div
              style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 24
              }}
            >
              <div
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#93C5FD"
                }}
              >
                <span>Diagnostic summary: {errorMsg.substring(0, 45)}{errorMsg.length > 45 ? "..." : ""}</span>
                {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>

              {this.state.showDetails && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <div style={{ fontSize: 11.5, color: "#F87171", fontFamily: "monospace", wordBreak: "break-all", marginBottom: 6 }}>
                    {errorMsg}
                  </div>
                  {errorStack && (
                    <pre
                      style={{
                        fontSize: 10.5,
                        color: "#64748B",
                        maxHeight: 120,
                        overflowY: "auto",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        margin: 0,
                        lineHeight: 1.4
                      }}
                    >
                      {errorStack}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Primary Action Row */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={this.handleGoHome}
                  className="tai-btn tai-btn-primary"
                  style={{
                    padding: "11px 16px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    cursor: "pointer"
                  }}
                >
                  <Home size={15} />
                  <span>Return to Home</span>
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="tai-btn tai-btn-outline"
                  style={{
                    padding: "11px 16px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#FFFFFF",
                    background: "rgba(255, 255, 255, 0.06)",
                    borderColor: "rgba(255, 255, 255, 0.15)"
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Reload View</span>
                </button>
              </div>

              {/* Secondary Navigation Options */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid rgba(255, 255, 255, 0.08)", flexWrap: "wrap", gap: 8 }}>
                <button
                  onClick={() => this.setState(prev => ({ showPortalMenu: !prev.showPortalMenu }))}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#60A5FA",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: 0
                  }}
                >
                  <Layers size={13} />
                  <span>Switch Role / Portal</span>
                  {this.state.showPortalMenu ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                <button
                  onClick={this.handleHardReset}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94A3B8",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: 0
                  }}
                  title="Clear Local Cache"
                >
                  <Trash2 size={12} />
                  <span>Clear Cache &amp; Reset</span>
                </button>
              </div>

              {/* Portals Rerouting Drawer */}
              {this.state.showPortalMenu && (
                <div
                  className="anim-fluid-entrance"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                    gap: 8,
                    paddingTop: 10
                  }}
                >
                  {[
                    { label: "Learner App", path: "/?role=learner" },
                    { label: "Courses Catalog", path: "/?screen=courses" },
                    { label: "Superadmin", path: "/?role=superadmin" },
                    { label: "Instructor", path: "/?role=instructor" },
                    { label: "Mentor", path: "/?role=mentor" },
                    { label: "Manager", path: "/?role=manager" },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => this.handleGoRoute(item.path)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "#E2E8F0",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all .14s ease"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(37, 99, 235, 0.25)"; e.currentTarget.style.color = "#FFFFFF"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.color = "#E2E8F0"; }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
