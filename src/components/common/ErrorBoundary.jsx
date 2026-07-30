import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#0F172A", color: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "sans-serif" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px", color: "#EF4444" }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#94A3B8", maxWidth: 400, textAlign: "center", margin: "0 0 20px" }}>
            {this.state.error?.message || "An unexpected error occurred while loading the application."}
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#2563EB", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Reset Session &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
