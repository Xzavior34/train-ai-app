import React from "react";

export default function LoadingScreen({ message = "Loading Train AI..." }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A" }}>
      <div style={{ color: "#94A3B8", fontFamily: "-apple-system, sans-serif", fontSize: 14, fontWeight: 500 }}>
        {message}
      </div>
    </div>
  );
}
