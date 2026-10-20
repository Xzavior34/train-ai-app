import { useEffect } from "react";
import { supabase } from "./supabaseClient.js";

// Focus refresh works even when Realtime publication is disabled in a project.
export function useAssignmentRefresh(userId, refetch) {
  useEffect(() => {
    if (!userId) return;
    const refresh = () => refetch();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    const channel = supabase?.channel("cohort-access-" + userId + "-" + Math.random())
      .on("postgres_changes", { event: "*", schema: "public", table: "cohort_members", filter: "user_id=eq." + userId }, refresh)
      .subscribe();
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, refetch]);
}
