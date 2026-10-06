-- Prevent direct client use of internal credit-account creation helpers and
-- provide one authorised, atomic operation for an admin granting credits to
-- a learner in their own organisation.

revoke all on function get_or_create_org_credit_account(uuid) from public, anon, authenticated;
revoke all on function get_or_create_learner_credit_account(uuid, uuid) from public, anon, authenticated;

create or replace function grant_ai_credits_to_learner(
  p_user_id uuid,
  p_organization_id uuid,
  p_amount int,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not (
    is_super_admin(auth.uid())
    or (
      is_org_admin(auth.uid())
      and get_user_organization_id(auth.uid()) = p_organization_id
    )
  ) then
    raise exception 'Not authorized to grant credits for this organization';
  end if;
  if not exists (
    select 1
    from organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
      and om.status = 'active'
  ) then
    raise exception 'Learner is not an active member of this organization';
  end if;

  v_account_id := get_or_create_learner_credit_account(p_user_id, p_organization_id);
  return grant_ai_credits(
    v_account_id,
    p_amount,
    'adjustment',
    coalesce(nullif(trim(p_reference), ''), 'admin_direct')
  );
end;
$$;

revoke all on function grant_ai_credits_to_learner(uuid, uuid, int, text) from public, anon;
grant execute on function grant_ai_credits_to_learner(uuid, uuid, int, text) to authenticated;

