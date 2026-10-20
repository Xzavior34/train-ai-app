begin;
-- Keep daily rewards working without allowing browser writes to achievement statistics.
create or replace function public.claim_my_daily_login_reward()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_last public.daily_login_rewards%rowtype; v_day int:=1; v_points int; v_bonus text; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,200004));
 select * into v_last from public.daily_login_rewards where user_id=auth.uid() order by claimed_date desc limit 1;
 if v_last.claimed_date=current_date then return null; end if;
 if v_last.claimed_date=current_date-1 then v_day:=v_last.day_in_cycle%7+1; end if;
 v_points:=(array[5,8,10,12,15,15,20])[v_day];
 if v_day=7 then v_bonus:='Streak freeze'; end if;
 insert into public.daily_login_rewards(user_id,claimed_date,day_in_cycle,points_awarded,bonus_reward)
 values(auth.uid(),current_date,v_day,v_points,to_jsonb(v_bonus));
 insert into public.user_gamification_stats(user_id,total_points,streak_freezes_available)
 values(auth.uid(),v_points,1+case when v_day=7 then 1 else 0 end)
 on conflict(user_id) do update set total_points=user_gamification_stats.total_points+v_points,
 streak_freezes_available=user_gamification_stats.streak_freezes_available+case when v_day=7 then 1 else 0 end;
 return jsonb_build_object('day',v_day,'points',v_points,'bonus',v_bonus);
end $$;
revoke insert,update,delete on public.daily_login_rewards from anon,authenticated;
revoke all on function public.claim_my_daily_login_reward() from public,anon;
grant execute on function public.claim_my_daily_login_reward() to authenticated;

create table public.ai_generated_quiz_attempts(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_profiles(id) on delete cascade,
 questions jsonb not null check(jsonb_typeof(questions)='array'), result jsonb,
 created_at timestamptz not null default now(),completed_at timestamptz
);
alter table public.ai_generated_quiz_attempts enable row level security;
revoke all on public.ai_generated_quiz_attempts from anon,authenticated;
grant all on public.ai_generated_quiz_attempts to service_role;
create or replace function public.submit_generated_quiz(p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.ai_generated_quiz_attempts%rowtype; q jsonb; v_answer text; v_correct text; v_count int:=0; v_total int; v_details jsonb:='[]'; v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into a from public.ai_generated_quiz_attempts where id=p_attempt_id and user_id=auth.uid() for update;
 if not found then raise exception 'Generated quiz not found'; end if;
 if a.completed_at is not null then return a.result; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then raise exception 'Invalid quiz answers'; end if;
 v_total:=jsonb_array_length(a.questions);
 if v_total<1 or v_total>20 then raise exception 'Invalid generated quiz'; end if;
 for q in select * from jsonb_array_elements(a.questions) loop
 v_answer:=p_answers->>(q->>'id'); v_correct:=q->'options'->>((q->>'correctAnswer')::int);
 if v_answer=v_correct then v_count:=v_count+1; end if;
 v_details:=v_details||jsonb_build_array(jsonb_build_object('question',q->>'question','selected',v_answer,'correctOption',v_correct,'isCorrect',coalesce(v_answer=v_correct,false),'explanation',q->>'explanation'));
 end loop;
 v_result:=jsonb_build_object('score',round(v_count*100.0/v_total),'correct_count',v_count,'total',v_total,'total_points',v_count*10,'details',v_details);
 update public.ai_generated_quiz_attempts set result=v_result,completed_at=now() where id=a.id;
 insert into public.user_gamification_stats(user_id,total_points) values(auth.uid(),v_count*10)
 on conflict(user_id) do update set total_points=user_gamification_stats.total_points+v_count*10;
 return v_result;
end $$;
revoke all on function public.submit_generated_quiz(uuid,jsonb) from public,anon;
grant execute on function public.submit_generated_quiz(uuid,jsonb) to authenticated;

-- Cohort creation and instructor assignment succeed or roll back together.
create or replace function public.create_cohort_with_instructor(p_organization_id uuid,p_name text,p_starts_at date,p_ends_at date,p_program_name text,p_trial_status text,p_instructor_id uuid default null)
returns public.cohorts language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.cohorts; begin
 if auth.uid() is null or not (public.can_administer_org(p_organization_id) or (public.has_role(auth.uid(),'mentor') and exists(select 1 from public.organization_members where user_id=auth.uid() and organization_id=p_organization_id and status='active'))) then raise exception 'Not authorized to create this cohort'; end if;
 if nullif(trim(p_name),'') is null or length(p_name)>200 or p_starts_at is null or p_ends_at<=p_starts_at then raise exception 'Invalid cohort name or dates'; end if;
 if p_instructor_id is not null then
 if p_instructor_id is distinct from auth.uid() and not public.can_administer_org(p_organization_id) then raise exception 'Only organization administrators can assign another instructor'; end if;
 if not public.has_role(p_instructor_id,'mentor') or not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_instructor_id and status='active') then raise exception 'Instructor must be an active mentor in this organization'; end if;
 end if;
 insert into public.cohorts(organization_id,name,starts_at,ends_at,program_name,trial_status,status,created_by)
 values(p_organization_id,trim(p_name),p_starts_at,p_ends_at,p_program_name,p_trial_status,case when p_starts_at>current_date then 'Upcoming' else 'Active' end,auth.uid()) returning * into c;
 if p_instructor_id is not null then insert into public.cohort_members(cohort_id,user_id,added_by) values(c.id,p_instructor_id,auth.uid()) on conflict do nothing; end if;
 return c;
end $$;
revoke all on function public.create_cohort_with_instructor(uuid,text,date,date,text,text,uuid) from public,anon;
grant execute on function public.create_cohort_with_instructor(uuid,text,date,date,text,text,uuid) to authenticated;
commit;
