-- ============================================================================
-- Broaden webhook dispatch beyond raw JSON to the actual message formats
-- real chat destinations expect, so a saved webhook shows up as a readable
-- message instead of an unparsed JSON blob.
--
-- Confirmed protocol differences (this is why one payload shape can't
-- serve all of them):
--   - Slack Incoming Webhooks, and anything that intentionally mirrors that
--     same wire format (Mattermost, Rocket.Chat, and similar self-hosted
--     chat tools all document "Slack-compatible incoming webhooks"), want
--     a JSON body shaped {"text": "..."}.
--   - Discord's webhook endpoint wants {"content": "..."} - same idea,
--     different field name, so it needs its own branch.
--   - Microsoft Teams incoming webhooks want a MessageCard object
--     ({"@type": "MessageCard", ...}), not a bare text field - the closest
--     of the four to actually being rejected outright if you send it
--     something else.
--   - Anything else (Zapier, a custom endpoint, a developer's own
--     receiver) generally wants the real event data, not a pre-formatted
--     chat message - so "raw" (the original behavior) stays the default
--     and is left completely unchanged.
--
-- This does not hardcode "Slack" and "Teams" as the only two destinations
-- the way the earlier version did in spirit - `payload_format` is a
-- protocol choice (raw / slack-compatible / discord / teams-card), so any
-- tool that speaks one of those same wire formats works too, not just the
-- two named products.
-- ============================================================================

alter table org_integrations
  add column if not exists payload_format text not null default 'raw';

alter table org_integrations
  drop constraint if exists org_integrations_payload_format_check;
alter table org_integrations
  add constraint org_integrations_payload_format_check
  check (payload_format in ('raw', 'slack', 'discord', 'teams'));

comment on column org_integrations.payload_format is
  'How the outgoing webhook body is shaped: raw (original event JSON - Zapier, custom endpoints), slack (Slack-compatible {"text":...} - also correct for Mattermost/Rocket.Chat), discord ({"content":...}), teams (MessageCard).';

-- Replaces the 0163 version: adds p_summary (a human-readable one-line
-- description the caller already has the real names for, e.g. "Jane Doe
-- enrolled in Intro to Python") and branches the outgoing body by each
-- integration's own payload_format instead of always sending raw JSON.
create or replace function dispatch_org_webhooks(p_org_id uuid, p_event text, p_payload jsonb, p_summary text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  integ record;
  req_id bigint;
  body jsonb;
  summary text;
begin
  if p_org_id is null or p_event is null then
    return;
  end if;

  summary := coalesce(p_summary, 'Train AI event: ' || p_event);

  for integ in
    select id, webhook_url, payload_format
    from org_integrations
    where organization_id = p_org_id
      and enabled = true
      and webhook_url is not null
      and webhook_url <> ''
      and p_event = any(events)
  loop
    begin
      body := case integ.payload_format
        when 'slack' then jsonb_build_object('text', summary)
        when 'discord' then jsonb_build_object('content', summary)
        when 'teams' then jsonb_build_object(
          '@type', 'MessageCard',
          '@context', 'http://schema.org/extensions',
          'summary', summary,
          'themeColor', '2563EB',
          'title', 'Train AI',
          'text', summary
        )
        else p_payload
      end;

      select net.http_post(
        url := integ.webhook_url,
        body := body,
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

-- user.invited - now also builds a real human-readable summary line.
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
    ),
    new.email || ' was invited to join as ' || new.organization_role || '.'
  );
  return new;
end;
$$;

-- enrollment.created - joins to real display name / course title so the
-- chat-formatted message reads as a sentence, not a row of ids.
create or replace function trg_dispatch_enrollment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_display_name text;
  v_course_title text;
begin
  select organization_id, display_name into v_org_id, v_display_name
  from user_profiles where id = new.user_id;
  select title into v_course_title from courses where id = new.course_id;

  if v_org_id is not null then
    perform dispatch_org_webhooks(
      v_org_id,
      'enrollment.created',
      jsonb_build_object(
        'event', 'enrollment.created',
        'user_id', new.user_id,
        'course_id', new.course_id,
        'enrolled_at', new.enrolled_at
      ),
      coalesce(v_display_name, 'A learner') || ' enrolled in ' || coalesce(v_course_title, 'a course') || '.'
    );
  end if;
  return new;
end;
$$;

-- course.completed - same real-name join as above.
create or replace function trg_dispatch_course_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_display_name text;
  v_course_title text;
begin
  if new.completed_at is not null and old.completed_at is null then
    select organization_id, display_name into v_org_id, v_display_name
    from user_profiles where id = new.user_id;
    select title into v_course_title from courses where id = new.course_id;

    if v_org_id is not null then
      perform dispatch_org_webhooks(
        v_org_id,
        'course.completed',
        jsonb_build_object(
          'event', 'course.completed',
          'user_id', new.user_id,
          'course_id', new.course_id,
          'completed_at', new.completed_at
        ),
        coalesce(v_display_name, 'A learner') || ' completed ' || coalesce(v_course_title, 'a course') || '.'
      );
    end if;
  end if;
  return new;
end;
$$;
