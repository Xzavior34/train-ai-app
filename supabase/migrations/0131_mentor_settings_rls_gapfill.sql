-- ============================================================================
-- Nine tables backing the full Instructor Settings experience had zero RLS
-- policies at all - a real, significant, previously undiscovered gap.
-- ============================================================================
-- mentor_credentials, mentor_portfolio_items, session_templates,
-- cancellation_policies, mentorship_agreements, reminder_settings,
-- video_integration_settings, mentor_resources, mentor_pricing_tiers all
-- had RLS enabled (via the blanket per-table loop, 0006_rls_policies.sql)
-- with zero actual policies defined - meaning every one of them has been
-- completely inaccessible by default this whole time, including to the
-- mentor who owns the row. This was masked in earlier testing because
-- demo mode's `if (!supabase) return []` never touches a real database at
-- all - a real, connected Supabase project would have rejected every read
-- and write against all nine tables outright.
--
-- Ownership pattern: mentor_id -> mentors.user_id = auth.uid(). Tables
-- meant to build trust with a learner deciding whether to book
-- (credentials, portfolio, resources, pricing tiers) are readable by any
-- authenticated user; pure back-office configuration (reminders, video
-- settings, session templates, cancellation policies) is owner + admin
-- only. mentorship_agreements is two-sided - both the mentor and the
-- named learner can read/sign their own agreement.
-- ============================================================================

create or replace function is_mentor_owner(check_user_id uuid, check_mentor_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from mentors m where m.id = check_mentor_id and m.user_id = check_user_id);
$$;

do $$
declare
  t text;
  owner_readable_tables text[] := array['mentor_credentials', 'mentor_portfolio_items', 'mentor_resources', 'mentor_pricing_tiers'];
  owner_only_tables text[] := array['session_templates', 'cancellation_policies', 'reminder_settings'];
begin
  foreach t in array owner_readable_tables loop
    execute format('drop policy if exists %I_select_all on %I', t, t);
    execute format('create policy %I_select_all on %I for select using (true)', t, t);
    execute format('drop policy if exists %I_write_owner on %I', t, t);
    execute format(
      'create policy %I_write_owner on %I for all using (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid())) with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))',
      t, t
    );
  end loop;

  foreach t in array owner_only_tables loop
    execute format('drop policy if exists %I_all_owner on %I', t, t);
    execute format(
      'create policy %I_all_owner on %I for all using (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid())) with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))',
      t, t
    );
  end loop;
end $$;

-- video_integration_settings uses mentor_id as its own primary key, not a
-- separate id column - same ownership check, singular row per mentor.
drop policy if exists vis_all_owner on video_integration_settings;
create policy vis_all_owner on video_integration_settings for all
  using (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()))
  with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

-- mentorship_agreements - two-sided: the mentor and the specific named
-- learner can each read/sign their own agreement; only the mentor (or
-- admin) creates one in the first place.
drop policy if exists ma_select_party on mentorship_agreements;
create policy ma_select_party on mentorship_agreements for select
  using (is_mentor_owner(auth.uid(), mentor_id) or learner_id = auth.uid() or is_org_admin(auth.uid()) or is_super_admin(auth.uid()));

drop policy if exists ma_insert_mentor on mentorship_agreements;
create policy ma_insert_mentor on mentorship_agreements for insert
  with check (is_mentor_owner(auth.uid(), mentor_id) or is_org_admin(auth.uid()));

-- Update is for signing - a learner can only ever flip their own
-- signed_by_learner/learner_signed_at, never rewrite the agreement terms
-- or sign on the mentor's behalf; enforced by application logic calling a
-- narrow update, this policy just gates who can touch the row at all.
drop policy if exists ma_update_party on mentorship_agreements;
create policy ma_update_party on mentorship_agreements for update
  using (is_mentor_owner(auth.uid(), mentor_id) or learner_id = auth.uid() or is_org_admin(auth.uid()))
  with check (is_mentor_owner(auth.uid(), mentor_id) or learner_id = auth.uid() or is_org_admin(auth.uid()));
