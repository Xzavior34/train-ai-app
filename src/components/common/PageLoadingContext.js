import { createContext } from "react";

// A mounted page can collect its own queries without blocking unrelated workspaces.
export const PageLoadingContext = createContext(null);
