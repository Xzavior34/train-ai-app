-- ============================================================================
-- Real outbound webhook dispatch for org_integrations.
--
-- Confirmed gap: org_integrations and integration_dispatch_log already
-- existed, and the admin "New Webhook" form (IntegrationsScreen.jsx)
-- already saved a name/url/events row and could toggle it on/off - but
-- nothing anywhere in this codebase ever read that row back and actually
-- called webhook_url. It was a form that saved to a table nobody read.
-- This migration adds the actual dispatch path with pg_net (Supabase's
-- built-in async HTTP extension), fired from real row-level triggers on
-- the only events an admin can actually pick in the UI.
--
-- Wired for real, from real row events:
--   - user.invited       -> AFTER INSERT on user_invitations
--   - enrollment.created -> AFTER INSERT on course_enrollments
--   - course.completed   -> AFTER UPDATE on course_enrollments, only when
--                           completed_at goes from null to not null
--
-- Deliberately NOT wired, and deliberately removed from the UI's
-- selectable events rather than left there half-working: compliance.overdue.
-- "Overdue" is a passage-of-time state, not a row insert/update - firing it
-- for real needs a scheduled job (pg_cron or similar) periodically scanning
-- course_enrollments against courses.compliance_due_days, with a
-- de-duplication marker so it doesn't refire on every scan. That is a real,
-- separate piece of work; faking it here (e.g. firing on enrollment insert)
-- would be exactly the kind of mock behavior this change is meant to remove.
--
-- pg_net is async: it queues the HTTP request and returns immediately, it
-- does not hand back the destination's real response inline. The dispatch
-- log therefore records "sent" (the request was genuinely queued and
-- handed to pg_net for delivery) rather than a live HTTP status/body -
-- reading the real delivery outcome back would mean polling pg_net's own
-- net._http_response table by request id, which is a reasonable follow-up
-- but out of scope here. This is a real, functioning dispatch - not a mock
-- - it just doesn't yet report delivery confirmation into
-- integration_dispatch_log.http_status.
-- ============================================================================

create extension if not exists pg_net;

create or replace function dispatch_org_webhooks(p_org_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  integ record;
  req_id bigint;
begin
  if p_org_id is null or p_event is null then
    return;
  end if;

  for integ in
    select id, webhook_url
    from org_integrations
    where organization_id = p_org_id
      and enabled = true
      and webhook_url is not null
      and webhook_url <> ''
      and p_event = any(events)
  loop
    begin
      select net.http_post(
        url := integ.webhook_url,
        body := p_payload,
        headers := jsonb_build_object('Content-Type', 'application/json')
      ) into req_id;

      insert into integration_dispatch_log (integration_id, organization_id, event, payload, status)
      values (integ.id, p_org_id, p_event, p_payload, 'sent');
    exception when others then
      insert into integration_dispatch_log (integration_id, organization_id, event, payload, status, error)
      values (integ.id, p_org_id, p_event, p_payload, 'failed', sqlerrm);
    end;
  end loop;
end;
$$;

-- user.invited
create or replace function trg_dispatch_user_invited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform dispatch_org_webhooks(
    new.organization_id,
    'user.invited',
    jsonb_build_object(
      'event', 'user.invited',
      'email', new.email,
      'role', new.organization_role,
      'invited_at', new.created_at
    )
  );
  return new;
end;
$$;

drop trigger if exists on_user_invitation_dispatch_webhook on user_invitations;
create trigger on_user_invitation_dispatch_webhook
  after insert on user_invitations
  for each row execute function trg_dispatch_user_invited();

-- enrollment.created
create or replace function trg_dispatch_enrollment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from user_profiles where id = new.user_id;
  if v_org_id is not null then
    perform dispatch_org_webhooks(
      v_org_id,
      'enrollment.created',
      jsonb_build_object(
        'event', 'enrollment.created',
        'user_id', new.user_id,
        'course_id', new.course_id,
        'enrolled_at', new.enrolled_at
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_course_enrollment_dispatch_webhook on course_enrollments;
create trigger on_course_enrollment_dispatch_webhook
  after insert on course_enrollments
  for each row execute function trg_dispatch_enrollment_created();

-- course.completed
create or replace function trg_dispatch_course_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if new.completed_at is not null and old.completed_at is null then
    select organization_id into v_org_id from user_profiles where id = new.user_id;
    if v_org_id is not null then
      perform dispatch_org_webhooks(
        v_org_id,
        'course.completed',
        jsonb_build_object(
          'event', 'course.completed',
          'user_id', new.user_id,
          'course_id', new.course_id,
          'completed_at', new.completed_at
        )
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_course_completion_dispatch_webhook on course_enrollments;
create trigger on_course_completion_dispatch_webhook
  after update on course_enrollments
  for each row execute function trg_dispatch_course_completed();
