-- ============================================================================
-- Migration: 202610100001_public_organizations_directory_and_promo_codes.sql
-- Description:
--   1. Public read-only RPC `list_public_organizations` so the signup page
--      can display available active organizations in a searchable dropdown
--      without weakening tenant RLS on `public.organizations`.
--   2. Ensure all standard foundation & partner promo codes are seeded in
--      `public.org_promo_codes`.
-- ============================================================================

begin;

-- 1. Seed all standard Foundation & Partner Bypass Codes
insert into public.org_promo_codes (
  code, name, tier, grant_ai_credits, grant_seats, max_redemptions,
  is_active, organization_type, expires_at
) values
  ('SARA-FOUNDATION', 'Sara Foundation Africa Social Impact Grant', 'starter', 1000, 50, 500, true, 'foundation', now() + interval '2 years'),
  ('FOUNDATION-FREE', 'Global Non-Profit Free Basic Plan', 'starter', 1000, 50, 500, true, 'foundation', now() + interval '2 years'),
  ('TRAINAI-FOUNDATION', 'Train AI Impact & Foundation Partner', 'starter', 1000, 50, 500, true, 'foundation', now() + interval '2 years'),
  ('CAP3-FOUNDATION', 'CAP Cohort 3 Foundation Sponsor', 'starter', 1000, 50, 500, true, 'foundation', now() + interval '2 years'),
  ('IMPACT-2026', 'Non-Governmental Organization Grant 2026', 'starter', 1000, 50, 500, true, 'foundation', now() + interval '2 years')
on conflict (code) do update set
  grant_ai_credits = excluded.grant_ai_credits,
  grant_seats = excluded.grant_seats,
  is_active = true,
  updated_at = now();

-- 2. Public directory RPC for signup organization dropdown
create or replace function public.list_public_organizations(p_search text default null)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  subscription_tier subscription_tier,
  status org_status
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    o.id,
    o.name,
    o.slug,
    o.logo_url,
    o.subscription_tier,
    o.status
  from public.organizations o
  where o.status in ('active', 'trial')
    and o.slug not in ('demo-org-starter', 'demo-org-growth', 'demo-org-enterprise', 'demo-academy-sample')
    and (
      p_search is null
      or trim(p_search) = ''
      or o.name ilike '%' || trim(p_search) || '%'
      or o.slug ilike '%' || trim(p_search) || '%'
    )
  order by o.name asc
  limit 50;
$$;

revoke all on function public.list_public_organizations(text) from public;
grant execute on function public.list_public_organizations(text) to anon, authenticated, service_role;

commit;
