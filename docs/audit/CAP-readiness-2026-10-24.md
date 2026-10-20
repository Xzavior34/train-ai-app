# CAP readiness — Saturday, October 24, 2026

Assessment as of October 20: **local repairs verified; production readiness remains unverified**. No deployments, production changes, email outreach, calendar invitations, payment transactions or record deletions were performed.

| Gate | Evidence/status | Required before attendees arrive |
|---|---|---|
| Database deployment | 103 migrations replay in a fresh PostgreSQL 18 fixture | Compare each deployed project's schema/history; stage the new migrations on the configured PostgreSQL 17/Supabase stack |
| Signup and login | Profile/organization/seat trigger tested locally | Test email confirmation, login, password recovery and refreshed sessions with approved staging accounts |
| Cohort access | Assigned, unassigned, reassigned, learner and cross-tenant cases pass real RLS tests | Confirm actual CAP cohort IDs, dates, active membership and instructors in both projects |
| Study groups/resources | Enrolled learner messaging; private self-join denied; mentor resources scoped | Test the actual group roster, intended global groups, downloads and mobile messaging |
| CAP teams | Atomic registration, creator membership, cohort isolation and protected review fields pass | Exercise create/join/edit project links, mentor assignment, check-ins and organizer reviews in staging |
| AI | Three unaffiliated welcome credits, paid-credit preservation, concurrent consumption and refunds pass | Verify configured providers and payment callbacks in test mode; confirm request-cost labels |
| Demo inquiries | Pure validation and concurrent rate-limit tests pass | Verify calendar credentials/delivery and truthful contact verification; no automatic outreach |
| Desktop/mobile | Community server render and production build pass | After workspace access changed, the desktop/390px Community fixture and full-list destinations were checked in-browser. Manually verify other authenticated screens, 768px/1440px layouts, device keyboard/focus and dialogs |
| Reliability | Targeted automated coverage passes | Check deployed console/network errors, realtime publication, session recovery and load under expected attendance |

Priority runbook: stage and compare schema; run the automated checks; complete one attendee, one mentor and one organizer journey; confirm roster/resource access with event organizers; designate a support contact and record any remaining blocker. Do not call this production-ready until these gates are signed off.
