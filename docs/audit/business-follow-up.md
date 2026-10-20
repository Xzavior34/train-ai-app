# Business follow-up and KPI evidence

No emails, social posts, contact scraping, partner messages or purchases were performed.

| Existing data | What it supports | What it does not establish |
|---|---|---|
| demo_requests status, attribution, calendar status, contact_verification | Inquiry volume, scheduling progress and explicit contact-verification state | A verified email merely from valid syntax; a sale merely from a closed lead |
| organization_members, cohort_members | Active organization membership and cohort assignments | Attendance or active participation without session/activity evidence |
| lesson_progress, course_enrollments | Recorded learning progress | Independently verified learning outcomes |
| ai_credit_transactions | Debits, purchases, adjustments and refunds | Provider token costs; monetary costs cannot be inferred from credits |
| ai_usage_events | Existing recorded AI Coach provider-call events | Complete coverage of every AI endpoint or failure rates |
| Current errors/retry states | User-visible access/availability failures | Historical mentor-access failure rates; no general reliability event pipeline was found |

Use scripts/audit/kpi-readonly.sql for aggregate review. Do not fabricate historical events or conversions. No new telemetry service was introduced. Broader reliability/access-failure instrumentation needs an agreed event schema, retention policy and owner; this remains an explicit follow-up.

Business action list for the owner:

- Review approved prospect lists, qualification criteria and outreach copy; assign an owner and target dates before sending anything.
- Prepare CAP promotion and registration links for October 24; confirm the attendee roster, actual cohort and support contact before publishing.
- Review demo leads by verification and scheduling status; manually confirm legitimate prospects through the existing authorized workflow.
- Assign partner follow-ups and record actual responses and outcomes; distinguish introductions, demos, qualified opportunities and paid conversions.
- Update the KPI document using source queries, reporting periods, definitions and an accountable owner. Record unavailable measures as unavailable.
- Approve any future instrumentation separately once privacy and retention requirements are agreed.
