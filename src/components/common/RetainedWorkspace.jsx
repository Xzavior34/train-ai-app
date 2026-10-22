import React, { Suspense, useEffect, useState } from "react";
import LoadingScreen from "./LoadingScreen.jsx";

// First visits load only the chosen dashboard. Keep visited dashboards mounted
// so switching back preserves navigation and unfinished forms.
export default function RetainedWorkspace({ active, children }) {
  const [visited, setVisited] = useState(false);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!active && !visited) return null;
  return <div hidden={!active} style={{ display: active ? "block" : "none" }}>
    <Suspense fallback={<LoadingScreen message="Opening your workspace..." />}>{children}</Suspense>
  </div>;
}
