# TRAIN AI 2.0 — PLATFORM OWNER → ADMIN CONTROL MATRIX

This matrix documents every supported Platform Owner control operation over Organization Administrators in Train AI 2.0 and records empirical verification across Database State, Admin UI, Admin Route Access, Admin API/RPC Enforcement, Session Behavior, New Login behavior, Learner Downstream Impact, Tenant Isolation, and Overall Status.

---

## Control Verification Matrix

| Control Operation | DB State (Before / After) | Admin UI | Admin Route Guard | Admin API / RPC Enforcement | Existing Session Behavior | New Login Behavior | Learner Downstream Impact | Tenant Isolation Security | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Create Admin** | `organizations`: `id` created<br>`user_profiles`: `role='admin'`, `org_id=OrgA`<br>`organization_members`: `role='admin'`, `status='active'` | Lands on Organisation Dashboard | Accesses Admin screens | RPCs/APIs scoped to `organization_id = OrgA` | Authenticates cleanly with JWT | Session lands on `ORGANISATION` dashboard | Can create courses/cohorts for learners | Bound strictly to Org A | **PASS** |
| **Invite Admin** | `user_invitations`: `status='pending'` → `accepted` | Displays pending invitation | Invite link accepts token | RPC `create_user_invitation` validates token & expiry | Token redeemable once | Upon signup/accept, lands in Org Admin shell | Inviting admin expands organization staff | Email & Org bound | **PASS** |
| **Role Change** | `user_profiles.role`: `'admin'` → `'mentor'` → `'learner'`<br>`user_roles`: updated<br>`org_members.role`: `'admin'` → `'content_manager'` → `'member'` | UI switches from Admin to Instructor / Learner view | Non-admin routes blocked for plain learner | Staff APIs/RPCs check `user_roles` and block plain learner | Dynamic role check (`hasStaffOrAdminRole`) updates shell | New login lands on `LEARNER` shell when downgraded | Learner cannot manage staff/courses | Scope restricted to updated role | **PASS** |
| **Deactivate / Suspend Admin** | `organization_members.status`: `'active'` → `'suspended'` | Renders suspended badge; administrative controls disabled | Direct routes return 0 records or access error | DB RLS & queries filter `status = 'active'` | Active session queries return empty sets for org data | Login succeeds but org admin features remain suspended | No impact on learner progress | Cross-tenant access stays blocked | **PASS** |
| **Reactivate Admin** | `organization_members.status`: `'suspended'` → `'active'` | Restores active status & full admin UI controls | Direct admin routes accessible again | Staff RPCs and queries execute successfully | Refreshed queries return active org data | Login restores Organisation Dashboard access | Learner management & courses resumed | Scope restricted to assigned org | **PASS** |
| **Remove Admin** | `organization_members`: Row deleted<br>`user_profiles.organization_id`: `NULL` | Member removed from directory | Admin routes return 0 records | Queries fail to match `organization_id = NULL` | Immediate loss of org management authority | Login defaults to plain learner dashboard | None | Cannot access removed org | **PASS** |
| **Organization Assignment / Reassignment** | `organization_members.organization_id`: `OrgA` → `OrgB`<br>`user_profiles.organization_id`: `OrgB` | Admin directory reflects new organization | Org A routes return 0 records; Org B routes work | Queries filter by `organization_id = OrgB` | Immediate drop of Org A access; Org B queries work | Login loads Org B data | Learners in Org B gain new Admin | 0 records exposed from Org A | **PASS** |
| **Organization Feature Control** | `organizations.settings`: JSONB flags toggled (Leaderboard `true` ↔ `false`, AI Coach `true` ↔ `false`) | Admin settings screen displays updated toggles | Feature routes show fallback state when disabled | RPCs (`get_leaderboard_with_profiles`) & Edge Functions (`ai-chat`) enforce server-side 403 / empty returns | Immediate behavior change on next query | Session fetches fresh DB settings | Learner loses/regains feature access synchronously | Org-level jsonb settings isolated | **PASS** |
| **Seat & Subscription Control** | `organizations.subscription_tier`: `'enterprise'`, `max_users`: `50` | Seats screen shows capacity & usage | Seat purchase RPCs validate tier limits | `get_org_seats_summary` RPC enforces capacity limits | Prevents adding users beyond `max_users` | Preserves tier limits on new login | Prevents over-enrollment | Org tier settings isolated | **PASS** |

---

## Escalation Security & Session Revocation Summary

1. **Privilege Escalation Protection**:
   - Org Admin attempting to insert `'super_admin'` into `user_roles`: **BLOCKED BY RLS** (`ur_write_super_admin`).
   - Org Admin attempting to modify another organization's settings: **BLOCKED BY RLS** (`o_update_admin`).
   - Org Admin attempting to access Platform Owner Dashboard: **BLOCKED BY ROLE ROUTING** (`getAvailableDashboards` restricts `OWNER` shell to `super_admin` / platform owner emails).
2. **Hierarchy Propagation**:
   - Demonstrated complete flow: Platform Owner changes setting → DB persists → Admin sees change → Learner behavior updates → Direct API/RPC respects setting → Platform Owner reverses setting → Learner regains access.
3. **Session Revocation**:
   - Suspending or removing an Admin takes effect server-side immediately on subsequent queries.
