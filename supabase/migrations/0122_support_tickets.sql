-- ============================================================================
-- Support Queue - PRD "Platform Owner Support System," confirmed unbuilt
-- ============================================================================
-- "Organizations can: Submit support request, ask questions, report
-- problems, track request status. Platform Owner can: view support
-- tickets, respond, change status, track organization, maintain support
-- history." Checked the codebase before building: zero matches for
-- "support_ticket" or "SupportQueue" anywhere.
-- ============================================================================

create type support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type support_ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  created_by uuid not null references user_profiles(id) on delete cascade,
  subject text not null,
  description text not null,
  status support_ticket_status not null default 'open',
  priority support_ticket_priority not null default 'normal',
  assigned_to uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid not null references user_profiles(id) on delete cascade,
  message text not null,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;

-- An org's own users can see and create their own org's tickets (any org
-- admin/staff member, not just the creator - "track request status" implies
-- the whole org can follow it, not just whoever happened to file it).
-- Only Platform Owner sees across every organization.
drop policy if exists st_select_own_org_or_platform on support_tickets;
create policy st_select_own_org_or_platform on support_tickets for select
  using (
    organization_id = get_user_organization_id(auth.uid())
    or is_super_admin(auth.uid())
  );

drop policy if exists st_insert_own_org on support_tickets;
create policy st_insert_own_org on support_tickets for insert
  with check (
    created_by = auth.uid()
    and organization_id = get_user_organization_id(auth.uid())
  );

-- Status/assignment changes: Platform Owner only - "change status" is
-- listed as a Platform Owner capability specifically, not a self-service
-- org action (an org marking its own ticket "resolved" would defeat the
-- point of a support queue Train AI actually manages).
drop policy if exists st_update_platform_owner on support_tickets;
create policy st_update_platform_owner on support_tickets for update
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

drop policy if exists stm_select_scoped on support_ticket_messages;
create policy stm_select_scoped on support_ticket_messages for select
  using (
    (
      exists (select 1 from support_tickets t where t.id = support_ticket_messages.ticket_id and t.organization_id = get_user_organization_id(auth.uid()))
      and not is_internal_note
    )
    or is_super_admin(auth.uid())
  );

drop policy if exists stm_insert_scoped on support_ticket_messages;
create policy stm_insert_scoped on support_ticket_messages for insert
  with check (
    author_id = auth.uid()
    and (
      (exists (select 1 from support_tickets t where t.id = support_ticket_messages.ticket_id and t.organization_id = get_user_organization_id(auth.uid())) and not is_internal_note)
      or is_super_admin(auth.uid())
    )
  );

create index if not exists idx_support_tickets_org on support_tickets(organization_id);
create index if not exists idx_support_ticket_messages_ticket on support_ticket_messages(ticket_id);
