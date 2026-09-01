-- ============================================================================
-- Learner AI-credit requests - Train AI 2.0 learner-section simplification.
-- The org-based credits model means a learner should be able to either buy
-- credits themselves (existing paystack/stripe flow, unchanged) or request
-- them from their organization. There was no table for the latter at all.
--
-- Scope, confirmed directly: learner-side request only for this pass - the
-- learner submits a request and can see its own status. No admin
-- approve/deny screen or auto-crediting yet; that is a follow-up once the
-- org/admin side of this workflow is designed. Rows just sit `pending`
-- until an admin-side feature (not built here) starts updating them.
-- ============================================================================

create table if not exists credit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  amount int not null check (amount > 0),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

comment on table credit_requests is 'A learner asking their organization to grant them AI credits, instead of buying credits themselves. Learner-writable/readable only for now - no admin review UI yet.';

create index if not exists credit_requests_user_id_idx on credit_requests(user_id);
create index if not exists credit_requests_org_id_idx on credit_requests(organization_id);

alter table credit_requests enable row level security;

drop policy if exists cr_select_own on credit_requests;
create policy cr_select_own on credit_requests for select
  using (user_id = auth.uid() or is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

drop policy if exists cr_insert_own on credit_requests;
create policy cr_insert_own on credit_requests for insert
  with check (user_id = auth.uid());

-- Learners can't edit/withdraw a submitted request or forge its status; only
-- an admin-side workflow (future) resolving it needs update access, and org
-- admins/super admins already get that via is_org_admin/is_super_admin.
drop policy if exists cr_update_admin on credit_requests;
create policy cr_update_admin on credit_requests for update
  using (is_org_admin(auth.uid()) or is_super_admin(auth.uid()));
