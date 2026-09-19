-- Migration 0172: Restore Sara Foundation Africa Courses Linkage
-- Fixes courses that were erroneously reassigned to Digital Training Organization

UPDATE public.courses
SET organization_id = '58ebdb4d-8209-4e08-9ab3-8c5eee87b278'
WHERE organization_id = 'bd1b4b0c-abdc-4175-87f8-878a3e22fe4b';
