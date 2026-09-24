import { useAuth } from "../../lib/useAuth.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";
import { isRealDatabaseId } from "../../lib/mockDataManager.js";

export function usePlatformData() {
  const { session } = useAuth();
  const profileQuery = useSupabaseQuery(async () => {
    return await fetchCurrentUserProfile(session?.user?.id);
  }, [session?.user?.id]);

  const rawOrgId = profileQuery.data?.organization_id;
  const orgId = (rawOrgId && isRealDatabaseId(rawOrgId)) ? rawOrgId : null;
  const userRoles = ["admin"];

  return {
    session,
    profileQuery,
    orgId,
    userRoles,
  };
}
