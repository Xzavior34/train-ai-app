// NOT CURRENTLY USED - nothing in src/ imports this file. The learner and
// platform app shells import the identical hook from ../lib/useSupabaseQuery.js
// instead. Left in place (can't be deleted from this environment) so a future
// edit doesn't silently fork behavior between two copies again - if you need
// this hook, import from ../lib/useSupabaseQuery.js, don't edit this copy.
import { useState, useEffect, useCallback } from "react";

export function useSupabaseQuery(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message || String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  return { data, loading, error, refetch };
}
