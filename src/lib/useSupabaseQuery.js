import { useState, useEffect, useCallback, useContext, useId, useRef } from "react";
import { PageLoadingContext } from "../components/common/PageLoadingContext.js";

// Small shared pattern so every screen wired to Supabase handles
// loading/error the same way, instead of each one reinventing it.
// `fetcher` should be an async function returning the data directly (throw
// on error). `deps` works like useEffect's dependency array.
// Secondary cards can set blocksPage:false and display their local skeleton
// without holding the entire page behind the full-page loading boundary.
export function useSupabaseQuery(fetcher, deps = [], { blocksPage = true, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const previouslyEnabled = useRef(enabled);
  const pending = enabled && (loading || !previouslyEnabled.current);
  const reportPageLoading = useContext(PageLoadingContext);
  const queryId = useId();
  useEffect(() => { reportPageLoading?.(queryId, blocksPage && pending); }, [reportPageLoading, queryId, pending, blocksPage]);
  useEffect(() => () => reportPageLoading?.(queryId, false), [reportPageLoading, queryId]);

  useEffect(() => {
    let cancelled = false;
    previouslyEnabled.current = enabled;
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setData(null);
    setError(null);
    Promise.resolve().then(fetcher)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message || String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken, enabled]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  return { data, loading: pending, error, refetch };
}
