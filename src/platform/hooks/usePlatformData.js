import { fetchMyRoles } from "../../services/authService.js";
import { useAuth } from "../../lib/useAuth.js";
import { useSupabaseQuery } from "../../lib/useSupabaseQuery.js";
import { fetchCurrentUserProfile } from "../../lib/api/platform.js";

export function usePlatformData() {
  const { session } = useAuth();
  const profileQuery = useSupabaseQuery(async () => {
    return await fetchCurrentUserProfile(session?.user?.id);
  }, [session?.user?.id]);

  const rawOrgId = profileQuery.data?.organization_id;
  const orgId = rawOrgId || null;
  const rolesQuery = useSupabaseQuery(() => session?.user?.id ? fetchMyRoles() : Promise.resolve([]), [session?.user?.id]);
  const userRoles = rolesQuery.data || [];

  return {
    session,
    profileQuery,
    orgId,
    userRoles,
  };
}
