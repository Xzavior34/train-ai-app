import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import LoadingScreen from "./components/common/LoadingScreen.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen message="Loading Train AI..." />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
