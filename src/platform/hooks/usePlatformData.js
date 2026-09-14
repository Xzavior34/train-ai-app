import { useAuth } from "../../lib/useAuth.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";

export function usePlatformData() {
  const { session } = useAuth();
  const profileQuery = useSupabaseQuery(async () => {
    return await fetchCurrentUserProfile(session?.user?.id);
  }, [session?.user?.id]);

  const rawOrgId = profileQuery.data?.organization_id;
  const orgId = (rawOrgId && rawOrgId !== "demo-org-id") ? rawOrgId : (rawOrgId || "demo-org-id");
  const userRoles = ["admin"];

  return {
    session,
    profileQuery,
    orgId,
    userRoles,
  };
}
