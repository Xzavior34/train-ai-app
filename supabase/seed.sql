-- =============================================================================
-- Train AI - seed data. Small, realistic dataset matching the personas used
-- across the frontend prototypes (Elena Cross, Naomi Park, etc.) so the
-- backend and frontend tell the same story. Safe to run repeatedly in a dev
-- project (uses fixed UUIDs + ON CONFLICT DO NOTHING).
--
-- Run after all migrations. Requires real auth.users rows to exist first
-- on Supabase, create these people via the Auth dashboard or signup flow
-- using the same UUIDs, then run this file.
-- =============================================================================

insert into role_permissions_matrix (role, permission_key, allowed) values
  ('super_admin', 'manage_users', true), ('super_admin', 'manage_courses', true),
  ('super_admin', 'view_analytics', true), ('super_admin', 'manage_org_settings', true),
  ('super_admin', 'manage_payouts', true), ('super_admin', 'moderate_content', true),
  ('admin', 'manage_users', true), ('admin', 'manage_courses', true),
  ('admin', 'view_analytics', true), ('admin', 'manage_org_settings', true),
  ('admin', 'manage_payouts', true), ('admin', 'moderate_content', true),
  ('mentor', 'access_mentor_workspace', true), ('mentor', 'manage_mentor_schedule', true),
  ('mentor', 'manage_mentees', true), ('mentor', 'view_mentor_analytics', true),
  ('learner', 'access_mentor_workspace', false), ('learner', 'manage_cohorts', false),
  ('hr', 'view_analytics', true), ('manager', 'view_analytics', false)
on conflict (role, permission_key) do nothing;

insert into achievements (id, name, description, category, points) values
  ('a0000000-0000-0000-0000-000000000001', '12-Day Streak', 'Maintained a 12-day learning streak', 'streak', 50),
  ('a0000000-0000-0000-0000-000000000002', 'Quiz Master', 'Scored 90%+ on 5 quizzes', 'quiz', 100),
  ('a0000000-0000-0000-0000-000000000003', 'First Course', 'Completed your first course', 'milestone', 25)
on conflict (id) do nothing;

insert into platform_settings (setting_key, setting_value, setting_type, description, is_public) values
  ('platform.maintenance_mode', 'false', 'boolean', 'Show maintenance banner platform-wide', false),
  ('signup.require_invite', 'false', 'boolean', 'Restrict signups to invited emails only', true),
  ('gamification.streak_freeze_max', '3', 'number', 'Max streak freezes a learner can hold', true),
  ('compliance.default_due_days', '30', 'number', 'Default days-to-complete for mandatory courses', false),
  ('email.sender_name', 'Train AI', 'string', 'Default "from" name on transactional email', false)
on conflict (setting_key) do nothing;

insert into organizations (id, name, slug, domain, status, subscription_tier, max_users, is_super_admin) values
  ('00000000-0000-0000-0000-000000000001', 'Train AI (Platform)', 'train-ai-platform', 'trainai.com', 'active', 'enterprise', 999999, true),
  ('00000000-0000-0000-0000-000000000002', 'Northwind Analytics Academy', 'northwind-analytics', 'northwind.io', 'active', 'growth', 2000, false)
on conflict (id) do nothing;

-- NOTE: the insert below assumes matching auth.users rows already exist with
-- these UUIDs (create them via Supabase Auth first, e.g. through the
-- dashboard "Add user" action, or your own signup flow).
insert into user_profiles (id, display_name, role, organization_id) values
  ('10000000-0000-0000-0000-000000000001', 'Naomi Park', 'super_admin', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Elena Cross', 'admin', '00000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003', 'Jordan Blake', 'learner', '00000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into user_roles (user_id, role) values
  ('10000000-0000-0000-0000-000000000001', 'super_admin'),
  ('10000000-0000-0000-0000-000000000002', 'admin'),
  ('10000000-0000-0000-0000-000000000002', 'mentor'), -- dual-role, matches the frontend's workspace switcher
  ('10000000-0000-0000-0000-000000000003', 'learner')
on conflict (user_id, role) do nothing;

insert into organization_members (organization_id, user_id, role, status, joined_at) values
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner', 'active', now()),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'member', 'active', now())
on conflict (organization_id, user_id) do nothing;

insert into mentors (id, user_id, organization_id, title, bio, tagline, hourly_rate, is_active, is_approved) values
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
   'Applied Analytics Mentor', 'Ex-analytics lead turned mentor.', 'From theory to shipped models.', 65, true, true)
on conflict (id) do nothing;

insert into courses (id, title, description, category, level, duration_hours, is_published) values
  ('c0000000-0000-0000-0000-000000000001', 'Applied Machine Learning', 'Build adaptive intelligence.', 'Data & AI', 'intermediate', 8, true),
  ('c0000000-0000-0000-0000-000000000002', 'Foundations of Algebra', 'Turn equations into clarity.', 'Data & AI', 'beginner', 10, true)
on conflict (id) do nothing;
