-- Cohort peers could only read their own cohort_members row, so every learner
-- saw a roster of one even when the cohort had many members. The learner UI
-- also exposed a reply composer while the database accepted replies only from
-- instructors/admins. Provide safe, cohort-scoped read models and align the
-- collaboration policies with the learner experience.

create or replace function public.is_cohort_member(
  check_user_id uuid,
  check_cohort_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_user_id is not null
    and check_cohort_id is not null
    and exists (
      select 1
      from public.cohort_members cm
      where cm.cohort_id = check_cohort_id
        and cm.user_id = check_user_id
    );
$$;

create or replace function public.can_access_cohort(
  check_user_id uuid,
  check_cohort_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_user_id is not null
    and check_cohort_id is not null
    and (
      public.is_cohort_member(check_user_id, check_cohort_id)
      or public.is_super_admin(check_user_id)
      or exists (
        select 1
        from public.cohorts c
        join public.organization_members om
          on om.organization_id = c.organization_id
        where c.id = check_cohort_id
          and om.user_id = check_user_id
          and om.status = 'active'
          and om.role in ('owner', 'admin', 'people_manager')
      )
    );
$$;

revoke all on function public.is_cohort_member(uuid, uuid) from public, anon;
revoke all on function public.can_access_cohort(uuid, uuid) from public, anon;
grant execute on function public.is_cohort_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_access_cohort(uuid, uuid) to authenticated, service_role;

drop policy if exists cm_select_self_or_admin on public.cohort_members;
drop policy if exists cm_select_same_cohort_or_admin on public.cohort_members;
create policy cm_select_same_cohort_or_admin
on public.cohort_members
for select
using (public.can_access_cohort(auth.uid(), cohort_id));

drop policy if exists cpost_select_member on public.cohort_posts;
create policy cpost_select_member
on public.cohort_posts
for select
using (public.can_access_cohort(auth.uid(), cohort_id));

drop policy if exists cpr_select_member on public.cohort_post_replies;
create policy cpr_select_member
on public.cohort_post_replies
for select
using (
  exists (
    select 1
    from public.cohort_posts p
    where p.id = cohort_post_replies.post_id
      and public.can_access_cohort(auth.uid(), p.cohort_id)
  )
);

drop policy if exists cpr_insert_member on public.cohort_post_replies;
drop policy if exists cpr_insert_instructor_only on public.cohort_post_replies;
create policy cpr_insert_member
on public.cohort_post_replies
for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.cohort_posts p
    where p.id = cohort_post_replies.post_id
      and public.can_access_cohort(auth.uid(), p.cohort_id)
  )
);

drop policy if exists cpreact_select_member on public.cohort_post_reactions;
create policy cpreact_select_member
on public.cohort_post_reactions
for select
using (
  exists (
    select 1
    from public.cohort_posts p
    where p.id = cohort_post_reactions.post_id
      and public.can_access_cohort(auth.uid(), p.cohort_id)
  )
);

-- Safe learner-facing cohort directory. The function exposes no email,
-- phone, organization membership, or other private profile fields.
create or replace function public.get_cohort_member_directory(p_cohort_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.can_access_cohort(auth.uid(), p_cohort_id) then
    raise exception 'Not authorized to view this cohort' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cm.id,
        'cohort_id', cm.cohort_id,
        'user_id', cm.user_id,
        'added_at', cm.added_at,
        'user_profiles', jsonb_build_object(
          'id', up.id,
          'display_name', coalesce(nullif(trim(up.display_name), ''), 'Cohort Member'),
          'avatar_url', up.avatar_url,
          'role', up.role
        )
      )
      order by lower(coalesce(nullif(trim(up.display_name), ''), 'cohort member')), cm.added_at
    ),
    '[]'::jsonb
  )
  into v_result
  from public.cohort_members cm
  join public.user_profiles up on up.id = cm.user_id
  where cm.cohort_id = p_cohort_id;

  return v_result;
end;
$$;

-- Complete feed projection with replies and safe author fields. Returning one
-- authorized document prevents independent nested RLS filters from silently
-- removing replies while leaving their parent post visible.
create or replace function public.get_cohort_feed_for_member(p_cohort_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.can_access_cohort(auth.uid(), p_cohort_id) then
    raise exception 'Not authorized to view this cohort' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(feed.post_json order by feed.is_pinned desc, feed.created_at desc),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      p.is_pinned,
      p.created_at,
      jsonb_build_object(
        'id', p.id,
        'cohort_id', p.cohort_id,
        'author_id', p.author_id,
        'content', p.content,
        'is_announcement', p.is_announcement,
        'is_pinned', p.is_pinned,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'user_profiles', jsonb_build_object(
          'id', post_author.id,
          'display_name', coalesce(nullif(trim(post_author.display_name), ''), 'Cohort Member'),
          'avatar_url', post_author.avatar_url,
          'role', post_author.role
        ),
        'reaction_count', (
          select count(*) from public.cohort_post_reactions reaction
          where reaction.post_id = p.id
        ),
        'cohort_post_reactions', coalesce((
          select jsonb_agg(
            jsonb_build_object('id', reaction.id, 'user_id', reaction.user_id)
            order by reaction.created_at
          )
          from public.cohort_post_reactions reaction
          where reaction.post_id = p.id
        ), '[]'::jsonb),
        'cohort_post_replies', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', reply.id,
              'post_id', reply.post_id,
              'author_id', reply.author_id,
              'content', reply.content,
              'created_at', reply.created_at,
              'user_profiles', jsonb_build_object(
                'id', reply_author.id,
                'display_name', coalesce(nullif(trim(reply_author.display_name), ''), 'Cohort Member'),
                'avatar_url', reply_author.avatar_url,
                'role', reply_author.role
              )
            )
            order by reply.created_at
          )
          from public.cohort_post_replies reply
          join public.user_profiles reply_author on reply_author.id = reply.author_id
          where reply.post_id = p.id
        ), '[]'::jsonb)
      ) as post_json
    from public.cohort_posts p
    join public.user_profiles post_author on post_author.id = p.author_id
    where p.cohort_id = p_cohort_id
  ) feed;

  return v_result;
end;
$$;

revoke all on function public.get_cohort_member_directory(uuid) from public, anon;
revoke all on function public.get_cohort_feed_for_member(uuid) from public, anon;
grant execute on function public.get_cohort_member_directory(uuid) to authenticated, service_role;
grant execute on function public.get_cohort_feed_for_member(uuid) to authenticated, service_role;

comment on function public.get_cohort_member_directory(uuid) is
  'Returns safe public fields for all members of a cohort after a same-cohort or authorized-admin check.';
comment on function public.get_cohort_feed_for_member(uuid) is
  'Returns a complete cohort-scoped post, reply, reaction, and safe-author projection for authorized participants.';
