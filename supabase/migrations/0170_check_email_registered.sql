-- =============================================================================
-- 0170: is_email_registered function
--
-- Allows authentication and registration screens to verify whether an email
-- is already registered to an account in any organization across the platform
-- before attempting signup, preventing duplicate accounts or cross-tenant
-- re-registration attempts.
-- =============================================================================

create or replace function is_email_registered(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_clean text := lower(trim(p_email));
begin
  if v_clean is null or v_clean = '' or position('@' in v_clean) = 0 then
    return false;
  end if;

  return exists (
    select 1 from auth.users where lower(email) = v_clean
  );
end;
$$;

grant execute on function is_email_registered(text) to anon, authenticated, service_role;
