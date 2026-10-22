# Page functionality review — October 21, 2026

Scope: page rendering, navigation, forms, dialogs, images, theme switching and
desktop/mobile layout. This pass did not perform a security audit or run database
security, vulnerability or payment-security tests. Existing unrelated changes
were preserved.

## Fixes

- Users & Access crashed because its new scrolling components were undefined.
  Added the missing components, tab selection and keyboard navigation, scroll
  buttons and keyboard-accessible table regions.
- Global search offered destinations that did not exist in the current dashboard.
  Search now uses the current workspace's pages; owner search opens owner pages.
- Hidden dashboards also handled the search shortcut, creating overlapping
  dialogs. Only the active dashboard now responds to global search events.
- Learner theme state ignored the theme event sent from staff dashboards.
  Theme changes now stay in sync when switching dashboards.
- Course images could render broken or empty when missing or unavailable.
  Added a local course-cover fallback and initials for the selected learner avatar.
- Marketplace course details lacked keyboard closing and could exceed the phone
  viewport. Added focus containment, Escape/backdrop closing, focus restoration
  and a scrollable dialog constrained to the screen.
- Leaderboard period requests could reject without a useful page error or show
  stale results after changing periods. Added a retry message and request ordering.

## Verification

| Check | Result |
|---|---|
| Initial render of all 72 discovered screen exports | Pass |
| 140 desktop/mobile browser page states across six views | No crashes, runtime errors or document-width overflow |
| Sign-in password visibility, sign-up navigation and browser Back | Pass |
| Forgot-password form opening | Pass |
| Marketplace mobile dialog, keyboard closing and focus restoration | Pass |
| All nine People tabs, member search, horizontal table scrolling and invite dialog | Pass |
| Manager search and owner search destinations | Pass |
| Staff-to-learner dark-theme persistence | Pass |
| Production build | Pass; existing large-bundle advisory remains |

The six views are public, learner, instructor, administrator, manager and platform
owner. Desktop viewport: 1440×1000. Mobile viewport: 390×844.

Browser checks use an isolated preview with local fixtures. Supabase clients are
replaced with a null fixture and external requests are blocked. Failure of a remote
image is deliberately exercised; the image lists in the browser output include
hidden images and are not evidence that a production image URL is unavailable.

These checks cover every discovered screen's initial render and the listed
navigation/interaction states. They do not exercise every possible record,
validation branch or button. Real sign-in, live records, email delivery, uploads,
calendar integrations, AI responses and payment completion still need a connected
staging environment. No deployment or live account changes were performed.

## Evidence and rerunning

- `page-render-results.json`: screen-by-screen render results.
- `page-browser-results.json`: browser page-state results.
- `page-interaction-results.json`: seven focused functional scenarios.
- `page-people-mobile.png` and `page-learner-dark.png`: local browser screenshots.

Run `npm run test:pages` for isolated render checks. Browser checks require the
local preview (`node scripts/audit/serve-website-preview.mjs`, port 5188), Chrome
and `playwright-core` installed under `%TEMP%/trainai-page-check`. Run
`npm run test:pages:browser` with that preview running. The preview service and
browser fixtures are test tools, not application routes.
