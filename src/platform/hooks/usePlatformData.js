import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";

export function usePlatformData(session, userRoles = []) {
  // App already verified this session and its roles; do not repeat auth boot
  // or the workspace-role RPC when a staff dashboard mounts.
  const profileQuery = useSupabaseQuery(async () => {
    return await fetchCurrentUserProfile(session?.user?.id);
  }, [session?.user?.id]);

  const rawOrgId = profileQuery.data?.organization_id;
  const orgId = rawOrgId || null;
  return {
    session,
    profileQuery,
    orgId,
    userRoles,
  };
}
