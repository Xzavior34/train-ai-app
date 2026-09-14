-- ============================================================================
-- Course materials - confirmed directly against the real 1.0 reference
-- codebase (CourseMaterialsManager.tsx / useCourseMaterials hook) -
-- downloadable files and reference links attached to a course, separate
-- from its lessons and separate from a cohort's own resources (which
-- already existed here as cohort_resources). This table did not exist at
-- all before this migration - a real, confirmed gap, not a duplicate of
-- an existing feature.
-- ============================================================================

create table if not exists course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  material_type text not null default 'link' check (material_type in ('file', 'link')),
  file_url text,
  external_url text,
  description text,
  created_by uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

alter table course_materials enable row level security;

-- Same real authorization shape already proven for lessons on this exact
-- course relationship (lessons_select_published / lessons_write_authorized,
-- 0006_rls_policies.sql) - a published course's materials are visible to
-- any authenticated user, an unpublished course's materials are visible
-- only to its own instructor or an admin, and only the course's own
-- instructor or an admin can write.
drop policy if exists cm_select_published on course_materials;
create policy cm_select_published on course_materials for select
  using (
    exists (select 1 from courses c where c.id = course_materials.course_id and c.is_published)
    or exists (select 1 from courses c where c.id = course_materials.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
  );

drop policy if exists cm_write_authorized on course_materials;
create policy cm_write_authorized on course_materials for all
  using (
    exists (select 1 from courses c where c.id = course_materials.course_id and c.instructor_id = auth.uid())
    or effective_has_permission(auth.uid(), 'manage_courses')
    or is_super_admin(auth.uid())
  );

create index if not exists idx_course_materials_course on course_materials(course_id);
