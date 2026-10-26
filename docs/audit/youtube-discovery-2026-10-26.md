# Admin YouTube course discovery

Admins can open **Courses → Find YouTube courses**, describe a skill and audience, choose a level, preview real YouTube suggestions, accept or reject them, and assign an accepted course to selected active learners or an entire cohort. Accepted courses are organization-owned drafts with a real playable lesson; **Publish & assign** explicitly publishes and enrolls learners. The existing course manager remains available for editing or publication without assignment.

## Provider connection

The `youtube-course-discovery` Edge Function uses the existing server-side `OPENAI_API_KEY` and a new server-side `YOUTUBE_API_KEY`. The latter must belong to a Google Cloud project with **YouTube Data API v3** enabled and should be restricted to that API. Public video discovery uses an API key; admins do not need to grant access to a personal YouTube account. Keys are never stored in browser code or learner records.

The function was deployed to the canonical production project `jeobggrtxeybxvlwpxvn`. Migration `202610260001_youtube_course_discovery.sql` was applied successfully through its SQL editor. YouTube Data API v3 was subsequently enabled in the existing Train AI Google Cloud project. With the user's explicit confirmation, a dedicated key restricted to that API was created and saved as the encrypted `YOUTUBE_API_KEY` server secret. No key was saved in source code.

## Accuracy and permissions

- AI prepares a search query, then ranks only the video IDs actually returned and verified by the YouTube Data API. Title, channel, publication date and duration come from YouTube rather than AI. Recommendations assess metadata and explicitly require administrator review of teaching content.
- Private, unprocessed, live, age-restricted, unembeddable and known Nigeria-restricted videos are excluded. Availability is checked again when accepted. Playback restrictions can still vary by viewer location or change later.
- Saved suggestions, review decisions and imports are scoped to an organization. Only its active owner/admin or a platform owner can operate this flow. Learners cannot create suggestions or approve courses, and direct browser writes to discovery tables are denied.
- Accepting is transactional and deduplicates imports by organization and YouTube video. New imports stay unpublished; accepted/rejected state survives reload. Rejection can be reversed. Old unverified suggestions expire after one day.
- Assignment validates active organization membership, excludes suspended members and cohort instructors from whole-cohort assignment, preserves existing enrollment progress, and prevents duplicate records. No automatic enrollment occurs on search or acceptance.
- Admin search uses one organization AI credit and the existing ledger/refund mechanism; provider failures and empty results are refunded. Organization search limits (10/hour, 50/day) prevent unbounded provider usage. No learner personal data is sent to the AI; only the administrator's course request, chosen level and public video metadata are used.
- Removed the previous curriculum button that inserted four fixed YouTube links while claiming to generate AI lessons.

## Verification

- `npm run test:youtube`: isolated PostgreSQL migration replay, RLS, permission, stale suggestion, review, draft, deduplication, atomic assignment, tenant membership, suspended learner, progress-preservation and rate-limit checks; nine provider/handler regression tests.
- `node scripts/audit/youtube-browser.mjs`: search, review, rejection reversal, persistent acceptance, individual and cohort assignment, missing key, provider failure, failed save, and layouts at 320/390/768/1440 pixels.
- Existing unit suite: 33 passed. Screen render audit: 73 passed (existing unrelated React `fetchPriority` warning).
- Deno type check and production website build passed.
- Screenshots in `youtube-discovery/review-*.png` use synthetic records and a synthetic thumbnail. No test courses, learner assignments or fake suggestions were created in production.

## Organization credit routing correction

The user requested 50 additional Sara Foundation organization credits. They were added once to the verified organization account with an `admin_grant` ledger entry, yielding a balance of 50. A later live search still reported exhausted credits. Reading the actual production `consume_ai_credits` function established the cause: it explicitly excludes Sara Foundation from organization fallback and uses personal learner credits.

Migration `202610260002_admin_discovery_organization_credits.sql` introduces an admin-only organization-funded operation bound to the saved search, its creator, and its organization. It charges one credit with row locks, records the debit in the existing ledger, denies duplicate charges, and preserves the existing learner credit policy. It also adds an admin-only balance read. The admin search page displays the organization balance with an explicit refresh control and refreshes it after a search, including failed searches/refunds. No second 50-credit grant was made.

Regression coverage verifies the 50→49 organization debit, duplicate-charge denial, cross-organization/learner access denial, zero-credit denial without a ledger write, and updated balance display after searching.
