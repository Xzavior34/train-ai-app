# TRAIN AI 2.0 — FINAL LEARNER CONTROL MATRIX

This matrix details every discovered administrative toggle/setting in Train AI 2.0 and documents its verified real-world behavior across database persistence, backend RPC/Edge Function enforcement, learner UI visibility, direct route protection, API blocking, and persistence across session refreshes/re-logins.

---

## Administrative Toggle & Control Verification Matrix

| Setting / Feature Toggle | Controlling Location / Schema | Initial State (Org A / Org B) | Reversed State (Org A / Org B) | Direct Route Behavior | Backend API / RPC Enforcement | Session Refresh / Re-login Behavior | Cross-Tenant Boundary Security | Overall Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Leaderboard Visibility** | `organizations.settings->'leaderboard'->'enabled'` | Org A: **ON**<br>Org B: **OFF** | Org A: **OFF**<br>Org B: **ON** | Learner UI hides tab when OFF; direct route `?screen=leaderboard` renders fallback message | RPC `get_leaderboard_with_profiles` & `get_leaderboard_for_period` check setting; returns `[]` (0 rows) when OFF | Persistent; new JWT session receives updated DB setting state | Enforced via `p_org_id` param + RLS filtering | **PASS** |
| **AI Coach Access** | `organizations.settings->'ai_coach'->'enabled'` | Org A: **ON**<br>Org B: **OFF** | Org A: **OFF**<br>Org B: **ON** | Learner navigation hides "AI Coach"; direct route renders fallback card | `ai-chat` Edge Function checks `organizations.settings`; returns HTTP `403 Forbidden` when OFF | Persistent across re-login; edge function reads fresh setting from DB | Edge function verifies `user_id` belongs to requesting org | **PASS** |
| **AI Quiz Generation** | `organizations.settings->'ai'->'quiz_enabled'` | Org A: **ON**<br>Org B: **OFF** | Org A: **OFF**<br>Org B: **ON** | Learner Quiz screen renders disabled state banner | `ai-generate-quiz` Edge Function checks setting; returns HTTP `403 Forbidden` when OFF | Persistent across re-login; Edge Function reads fresh DB state | Scoped to authenticated user's organization | **PASS** |
| **Gamification Points** | `organizations.settings->'gamification'->'enabled'` | Org A: **ON**<br>Org B: **OFF** | Org A: **OFF**<br>Org B: **ON** | Point badges & streak metrics hidden when OFF | `user_gamification_stats` queries filtered by org settings | Persistent across re-login | Tenant isolated via user profile organization binding | **PASS** |
| **AI Insights Moderation** | `organizations.settings->'ai_insights'` | Org A: **Raw AI**<br>Org B: **Manual Mode** | Org A: **Manual Mode**<br>Org B: **Raw AI** | Learner dashboard replaces AI cards with admin manual announcement when `manual_mode=true` | Frontend & API read `settings->'ai_insights'` override payload | Persistent across re-login | Org-level jsonb settings isolation | **PASS** |
| **Course Publishing** | `courses.is_published` | Org A: **Draft (false)**<br>Org B: **Published (true)** | Org A: **Published (true)**<br>Org B: **Draft (false)** | Unpublished courses hidden from course discovery & search | Database RLS policy `c_select_published` blocks select for `is_published=false` from learners | Persistent across re-login | RLS enforces `organization_id = user.org_id AND is_published = true` | **PASS** |
| **Community Post Moderation** | `community_posts.moderation_status` | Org A: **Pending**<br>Org B: **Approved** | N/A | Feed filters out `pending`/`rejected` posts from non-author learners | Select queries enforce `moderation_status = 'approved' OR user_id = auth.uid()` | Persistent across re-login | Users only see approved public posts or their own posts | **PASS** |
| **Cross-Tenant Data Isolation** | `user_profiles.organization_id` & RLS | Org A: **Isolated**<br>Org B: **Isolated** | Org A: **Isolated**<br>Org B: **Isolated** | Learner A attempting to access Org B resources receives 0 records | RLS policies unconditionally append `organization_id = auth_org_id()` | Persistent across re-login | 0 cross-tenant records exposed across all queries | **PASS** |

---

## Key Verification Summary

1. **Dual-Tenant Validation**: Tested across two distinct organizations (Org A: Enterprise, Org B: Restricted).
2. **Dynamic Setting Reversal**: Proven that toggling settings in `organizations.settings` immediately updates backend RPC outputs and Edge Function HTTP status codes.
3. **Multi-Layer Enforcement**: Verified that disabling a feature in Admin settings enforces protection at **all layers**:
   - UI navigation links hidden
   - Direct screen routes guarded with informative fallback UI
   - Edge Functions return HTTP 403 Forbidden
   - Database RPCs return empty result sets (`[]`)
4. **Persistence & Refresh Integrity**: Re-authenticating with fresh JWT tokens proves settings persist cleanly across browser reloads and login sessions.
5. **Zero Cleanup Leftovers**: Automated test runner purged all `TRAINAI_QA_CONTROL_*` organizations, profiles, courses, posts, and auth users in `finally` blocks.
