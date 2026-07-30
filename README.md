# Train AI — Prototype + Backend + Mobile Shells

A learning-platform build spanning frontend, backend, and mobile:

- **Frontend**: React + Vite. One entry flow — sign in, a one-time
  personalization onboarding, then automatic routing into either the
  **Learner** experience or the unified **Platform** app (Admin, Mentor,
  Super Admin as one app with a real workspace switcher, not three separate
  apps) — based on the signed-in account's actual role. From either app, a
  control lets you switch over to the other and back at any time, with your
  place in each preserved (see step 3 below). Currently backed by in-memory
  mock data unless a real Supabase project is connected (see below).
- **Backend**: a real Supabase/Postgres schema — 137 tables, 8 views, 42
  SECURITY DEFINER functions, 80 RLS policies — verified against a live
  Postgres instance before delivery (see `SECURITY.md`). A real integration
  layer (`src/lib/`) connects to it — see "What's wired to Supabase" below
  for exactly which screens use it versus mock data.
- **Mobile**: real native Android (Gradle) and iOS (Xcode) project shells,
  generated via Capacitor, wrapping the same web app, with responsive layouts
  for both apps (see "Cross-platform optimizations").

Read this whole file before opening an issue about something "missing" —
several things below are hard platform limits (e.g. no tool can compile a
signed iOS app outside macOS+Xcode), not oversights.

## Requirements

- Node.js 18+ and npm
- For Android builds: Android Studio (includes the SDK)
- For iOS builds: a Mac with Xcode + CocoaPods (`sudo gem install cocoapods`)
- For the backend: a free Supabase account (or local Supabase CLI + Docker)

## 1. Run the web app

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. The flow is:

1. **Sign in** — if no Supabase project is configured (see `.env.example`),
   this is skipped entirely and you land straight in demo mode.
2. **Onboarding** (once) — pick a learning track and skill level. In demo
   mode, a third step asks "continue as Learner or Admin?", since there's no
   real account role to read; that choice is remembered in `localStorage` so
   it won't ask again on reload. Clear it with
   `localStorage.removeItem('trainai_demo_onboarding_v1')` in the browser
   console to see onboarding again.
3. **Routed automatically** into Learner or the Platform app, based on the
   account's actual role in `user_roles` in real mode (or the onboarding
   choice, in demo mode). From there:
   - **Platform → Learner**: the sidebar's workspace switcher has a "Learner
     view" entry, always available (everyone is a learner by default, per
     the spec — an admin isn't locked out of their own course library).
   - **Learner → Platform**: a "Switch to Admin workspace" control appears in
     Settings and the desktop sidebar footer — but only if the signed-in
     account actually holds an admin/mentor/super_admin role. A plain
     learner account won't see it.
   - Both apps stay mounted the whole time (CSS shows/hides them, nothing
     unmounts), so switching back and forth preserves exactly where you were
     in each — scroll position, which Platform workspace/screen was open,
     in-progress form state, all of it.

## 2. Stand up the real backend (Supabase)

See `docs/SUPABASE_SETUP.md` for full steps. Short version:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push          # applies everything in supabase/migrations/
```

Then copy `.env.example` to `.env.local` and fill in your project's URL/anon
key. The frontend does **not** call Supabase yet — it's mock data today;
wiring each screen's `useState` constants to `supabase.from(...)` /
`supabase.rpc(...)` calls is a separate, real integration step, described in
`docs/SUPABASE_SETUP.md`.

Read `SECURITY.md` for exactly what the RLS/permissions model does and does
not cover — it's written to be accurate, not reassuring.

## 3. Mobile — Android

```bash
npm run build
npx cap sync android
npx cap open android    # opens Android Studio
```

The `android/` folder is a complete, real Gradle project (manifest,
resources, gradle wrapper). **I cannot compile an APK inside this sandbox** —
my container has no network access to Android's SDK/Gradle distribution
servers (verified: the gradle wrapper's own download attempt returns a
blocked/403 response here). This is a sandbox network restriction, not a
defect in the generated project. Open `android/` in Android Studio on your
own machine and it will build normally.

## 4. Mobile — iOS

```bash
npm run build
npx cap sync ios
npx cap open ios         # opens Xcode (macOS only)
```

The `ios/` folder is a complete, real Xcode project (`App.xcodeproj`,
`Info.plist`, `AppDelegate.swift`, `Podfile`). **Building/signing an iOS app
is only possible on macOS with Xcode** — this is an Apple platform
restriction, true for any tool, not something specific to how this was
built. Before opening in Xcode, run `cd ios/App && pod install` (needs
CocoaPods, macOS-only in practice).

## Cross-platform optimizations

This isn't just "resize the browser and hope" — specific things were changed:

**Responsive layout (Platform app)** — the Admin/Mentor/Super Admin sidebar
was a fixed 240px column with zero breakpoints; on a phone it would have
either overflowed or crushed the content. It now:
- Collapses into an off-canvas drawer below 900px width, opened via a
  hamburger button in the top bar and closed via a scrim/backdrop tap, an X
  button, or the hardware back button (see below)
- Reflows every stat/content grid (2–6 columns) down to 2 columns at 900px
  and 1 column at 560px
- Makes data tables horizontally scrollable within their card at narrow
  widths instead of squeezing columns unreadably
- Hides the desktop search bar on mobile rather than letting it overflow

**Desktop layout (Learner app)** — the mirror image of the above: this app
was mobile-first with a fixed bottom tab bar, which would look and feel
wrong stretched across a desktop window. At ≥900px width:
- The bottom tab bar is replaced by a proper left sidebar (brand mark, the
  same 4 sections, plus a Profile entry that doesn't rely on tapping an
  avatar the way mobile does)
- The content column widens progressively (640px → 720px at ≥1080px) rather
  than either staying phone-narrow or stretching into unreadably long line
  lengths — the same pattern used by e.g. X/Instagram's desktop web views
- Both layouts exist in the same DOM at all times; only CSS `@media` rules
  decide which is visible, so there's no JS viewport-detection to get out of
  sync on resize

**Learner app** — already mobile-first; added:
- `env(safe-area-inset-*)` padding on the fixed bottom nav and top content,
  so it isn't obscured by the iPhone notch/home-indicator or Android's
  gesture bar
- `100dvh` (with `100vh` fallback) instead of plain `100vh`, which avoids the
  classic mobile-browser bug where `100vh` is taller than the actually
  visible area behind the browser's address bar

**Android hardware/gesture back button** — this is a real, easy-to-miss gap:
Capacitor's default behavior is to call the WebView's back history, and exit
the app the instant there's none. Without wiring anything up, pressing back
while several screens deep in either app would exit immediately rather than
navigating up one level. Both apps now push a browser history entry on every
in-app navigation and listen for `popstate`, so back correctly walks up the
in-app screen stack (Learner) or closes the mobile drawer / returns toward
the dashboard (Platform) before ever reaching "exit the app."

**Touch & input feel** — tap-highlight flash removed, `touch-action:
manipulation` on buttons/nav/pills (removes the ~300ms tap delay some
mobile browsers add), interactive chrome marked non-selectable so repeated
taps don't trigger text selection, while table/body text stays selectable
(important for the desktop/web use case — copying an email or ID out of a
table). `prefers-reduced-motion` is respected for the fade-in animations.

**`index.html`** — `viewport-fit=cover` (required for `env(safe-area-inset-*)`
to work at all on iOS), `theme-color`, and `apple-mobile-web-app-*` /
`mobile-web-app-capable` meta tags for a proper full-screen feel if the web
build is ever added to a home screen directly, independent of the native
Capacitor wrapper.

**What this doesn't cover**: real device testing. Everything above was
verified by reading the rendered CSS/behavior logic and via `vite build`
succeeding, not on an actual iPhone/Android device or simulator — this
sandbox has no device, emulator, or Android/iOS build toolchain available
(see the Android/iOS sections above for why). Test on a real device or
simulator before shipping.

## Visual design

**Layout bug fix (verified with real rendering, not guesswork)**: the Learner
app's container was hard-capped at `max-width: 480px` regardless of viewport,
while the desktop sidebar layout only kicked in at 900px+. That left a real
dead zone roughly 600–899px wide — common tablet/split-screen/small-laptop
widths — where the app sat stranded in a narrow column with large wasted
margins on both sides, still showing the mobile bottom nav. This was found
and confirmed by actually building the app, serving it, and driving a
headless Chromium against it (Playwright) to measure rendered widths at
several breakpoints, not by inspecting CSS in isolation. Fixed with a fluid
`clamp(480px, 75vw, 640px)` width that grows continuously from phone width up
to exactly the value the desktop breakpoint takes over at, so there's no
jump. Also re-checked for element overlap and horizontal overflow
programmatically across Home/Courses/AI/Community in both the broken and
fixed states — zero overlap issues, zero overflow, in both.

Both apps share one design-token system (colors, radii, spacing, gradient)
so a change to a shared class propagates everywhere at once, rather than
each screen drifting independently:

**Bottom nav / content misalignment (two real bugs, found via measurement,
not guesswork)**: reported as "the bottom navigation and home screen layout
is still not aligned" — confirmed and root-caused by measuring actual
bounding boxes (`getBoundingClientRect`) for the nav bar vs. the content
column at several widths, including the ~925px width visible in the
reported screenshots (a VS Code Simple Browser panel), rather than
eyeballing it:

1. **The mobile bottom nav never actually hid on desktop.** Its base
   `.tai-navbar` CSS rule was positioned *after* the
   `@media (min-width: 900px) { .tai-navbar { display: none; } }` override
   in the stylesheet. CSS resolves equal-specificity conflicts by source
   order, not by whether a rule sits inside a media query — so the later
   base rule silently won at every width, and the nav bar (which centers
   itself via `position: fixed; left: 50%` against the *full viewport*)
   kept rendering on top of the desktop sidebar layout, offset from the
   content column sitting next to the sidebar. Measured at 925px width
   before the fix: content column at x=232–872, nav bar at x=143–783 — an
   89px mismatch. Fixed by moving the override after its base rule; after
   the fix, the nav bar measures `width: 0` at that viewport (genuinely
   `display: none`), confirmed programmatically, not just visually.
2. **A second, narrower-range version of the same class of bug** at
   600–899px (bottom nav still showing, sidebar not yet active): the
   content column defaulted to flex `flex-start` and sat flush against the
   left edge, while the fixed-position nav bar centered itself against the
   full viewport — an 88px mismatch at 700px width. Fixed by centering the
   content column explicitly in that range without touching the desktop
   two-column layout. After the fix, content and nav bar left-edges match
   exactly (both at x=88 at 700px width) — confirmed numerically, along
   with a full re-check for element overlap across Home/Courses/AI/Community
   (zero issues, matching the pre-fix baseline).

- Soft two-layer shadows added to every card (`.tai-card` / `.ta-card`) —
  the most noticeable gap versus the reference mockups, which show real
  depth under every card and the phone frame itself
- Sticky/fixed nav surfaces (bottom nav, Platform's top bar) get a matching
  directional shadow instead of sitting flush against content
- Buttons get a consistent hover/active language: primary buttons lift
  slightly with a deepening shadow, outline/ghost buttons get a background
  shift, all buttons scale down slightly on press — gated behind
  `@media (hover: hover)` in the Learner app so touch devices don't get
  "stuck" hover states after a tap
- The Auth and Onboarding screens were rebuilt from generic inline styles to
  match the actual brand: gradient mark + wordmark, soft radial background
  glow, icon-forward option cards, the same card shadow and button treatment
  as the rest of the app — these are the very first thing anyone sees, so
  they shouldn't look like a different, unstyled app bolted onto the front

### Micro-animations

A reusable animation system lives in both apps' shared token CSS (`popIn`,
`bounceIn`, `slideDownReveal`, `slideInRight/Left`, `staggerItem`,
`pulseDot`, plus utility classes like `.anim-stagger`) so it's one place to
extend, not 40 one-off implementations. Applied to:

- **Reveal on entry**: every screen already faded in on navigation; list-like
  content (course cards, community posts, notifications, leaderboard rows,
  mentor/message lists, Admin Dashboard panels, mentor applications,
  moderation/feedback queues, cohorts) now staggers in item-by-item via
  `.anim-stagger`, rather than the whole list appearing at once
- **Table rows** (People, Organizations) use an opacity-only stagger variant
  (`.anim-stagger-rows`) instead — animating `transform` on `<tr>` elements
  has real cross-browser inconsistencies, so rows fade rather than slide
- **Bounce**: the quiz-results card genuinely bounces in on a pass, with the
  score, XP badge, and party icon popping in with a slight stagger and a
  wiggle — the one moment in the app designed to feel celebratory
- **Slide/reveal**: quiz hints and answer explanations slide down when
  shown; Platform's org-detail drawer slides in from the right with its
  scrim fading in underneath; the mobile sidebar drawer already slid via a
  transform transition, now with matching curve/timing
- **Tab/pill feedback**: switching a tab or pill now gives it a quick,
  springy scale-pop (`popTab`) so the active state change reads as
  intentional rather than an instant, flat color swap
- **Ambient**: the unread-notification dot on Home pulses; nav-item icons
  pop when they become active; progress bars animate their width on change
  instead of snapping
- Every animation above inherits the existing global
  `prefers-reduced-motion` rule in `index.css` (a blanket `*` selector), so
  none of this needed a second accessibility pass — it was already covered

## About `node_modules`

Deliberately **not included**, and not an oversight: `node_modules` is
machine-specific, deterministic build output — regenerated exactly from
`package.json` + `package-lock.json` via `npm install`. Shipping it would
make the project *larger and less portable*, not more complete. This is
standard practice for every real JS project, not unique to this one.

## Project structure

```
train-ai-app/
├── package.json, vite.config.js, index.html, capacitor.config.ts
├── .env.example                  # copy to .env.local for Supabase keys
├── SECURITY.md                   # what the security model actually covers
├── docs/
│   └── SUPABASE_SETUP.md         # backend deployment steps
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│       ├── 0001_init_schema.sql              # identity, orgs, roles, permissions, courses
│       ├── 0002_progress_quizzes_cohorts.sql # enrollment, quizzes, AI assistant, compliance
│       ├── 0003_mentors_sessions_messaging.sql
│       ├── 0004_community_gamification_admin.sql
│       ├── 0005_functions.sql                # SECURITY DEFINER functions
│       └── 0006_rls_policies.sql             # row-level security
├── android/                      # real Gradle project (Capacitor)
├── ios/                          # real Xcode project (Capacitor)
└── src/
    ├── main.jsx, App.jsx, index.css   # App.jsx = the auth/onboarding/routing flow
    ├── lib/
    │   ├── supabaseClient.js         # client + demo-mode detection
    │   ├── useAuth.js                # session state, sign in/up/out
    │   ├── useSupabaseQuery.js       # shared loading/error/data hook
    │   ├── AuthScreen.jsx, OnboardingScreen.jsx
    │   └── api/
    │       ├── auth.js               # role lookup, personalization
    │       ├── learner.js            # courses, quizzes, leaderboard, notifications
    │       └── platform.js           # org members, organizations, compliance, cohorts
    ├── learner/TrainAILearnerApp.jsx
    └── platform/TrainAIPlatformApp.jsx   # Admin + Mentor + Super Admin, one app
```

## Functional gaps that were actually fixed (not just visual polish)

**Every button with no `onClick` handler at all, found via static scan, not
guessing.** A regex sweep across both app files for `<button>` elements with
zero click handler found 38 of them — 9 in Learner, 29 in Platform. All 38
are now wired to real behavior:

- **Learner (9/9)**: course filter (real bookmarked-only toggle), course
  discussion posting, **"Mark as complete"** (the important one — actually
  updates the module's progress count and unlocks the next lesson, verified
  by checking the count changed from 4/8 to 5/8), timestamped lesson notes,
  learning-path enrollment, study-group join (member count actually
  increments), community follow toggle, post replies, and a real inline
  session-feedback form.
- **Platform (29/29)**: quick-action menus that navigate for real, a working
  invite-user form, role/status filters that actually filter the visible
  list, CSV export buttons that trigger real file downloads (not a toast —
  an actual `Blob` + anchor-click download), compliance recalculation using
  real date comparison against due dates (matching the spec's described
  background job), webhook/agreement/template/availability-slot creation,
  payout requests that actually deduct the available balance, and more.

**Update**: "Edit roadmap" for learning paths was initially left as an
honest "not built yet" toast rather than faked. It's since been built for
real — a `PathBuilder` with title/description/level and a real ordered
course sequence (add from the actual course list, reorder up/down, remove),
wired to both "New learning path" and "Edit roadmap". Verified the same
way as the rest: edited the existing "AI Engineer Career Track" path,
added a course, saved, and confirmed the course count in the list actually
went from 4 to 5, not just that the dialog closed without erroring.

A shared toast/confirmation system was added to both apps so these actions
have visible feedback, matching how the rest of the app already confirms
things.

**How this was verified**: re-ran the same static scan after the fixes —
zero buttons without a handler remain, in either file. Beyond that, several
of the fixes were verified with actual Playwright interaction, not a
screenshot glance: confirmed the lesson-completion count genuinely changes,
confirmed a study group's member count increments on Join, confirmed a
CSV export produces a real downloaded file named `people.csv`, and
confirmed a dropdown "Quick action" item actually navigates to the right
screen.

Two concrete, substantive gaps — flagged directly, not surface-level:

**Course thumbnails were icon-on-gradient, not real images.** Every course
card (Learner course library, course detail hero, Admin course manager)
now renders a real seeded photo via Lorem Picsum
(`picsum.photos/seed/{courseId}/...` — the same seed always returns the
same photo, so thumbnails stay consistent across renders), with a graceful
fallback to the original gradient+icon treatment if the image fails to
load (offline, blocked network, etc.) — verified by deliberately triggering
that failure path, see below.

**"New course" and "Edit" in Admin → Content did nothing.** They were
decorative buttons with no handler at all. There's now a real
`CourseBuilder`: title/description/category/level/price/duration, a cover
image with a "shuffle" control, a full lesson editor (add, remove, reorder
up/down, per-lesson title/duration/video URL), mandatory-compliance
settings, and save-as-draft vs. save-and-publish — wired to actually
create/update rows in the course list, not just show a form that goes
nowhere.

**How this was verified**: not by eyeballing it. I drove a real headless
Chromium (Playwright) through the actual built app: created a course, added
a lesson, published it, confirmed the new row appeared in the table with
the right data, then opened "Edit" on an existing course and confirmed the
form came back pre-filled with its real title and lesson list — checked via
`input_value()` on the actual form fields, not a screenshot glance. Also
deliberately checked the image fallback path: this sandbox's network
egress proxy returns `403` for `picsum.photos` (not on its allowlist), which
correctly triggers the `<img>` element's error handler and swaps to the
gradient fallback — confirmed via intercepting the actual HTTP responses.
That means **I cannot show you a screenshot of the real photos loading from
inside this sandbox** — only the fallback state. On your own machine, with
normal internet access, the real photos will load; there's nothing
sandbox-specific in the shipped code.

## What's wired to Supabase vs. still mock

Converting all ~40 screens across both apps in one pass, shallowly and
unverified, would have been worse than converting fewer screens correctly —
so this is deliberately a "spine," not everything:

| Screen | Status |
|---|---|
| Auth (sign in/up/out) | **Real** — `useAuth.js` |
| Onboarding / personalization | **Real** — writes to `user_personalization` |
| Role-based routing | **Real** — reads `user_roles`, falls back to Learner |
| Learner → Community → Leaderboard | **Real** — `get_leaderboard_with_profiles()` RPC |
| Learner → AI Assistant → Quiz scoring | Mock — `check_quiz_answers()` RPC and the answer-safe `safe_quiz_questions` view already exist in `api/learner.js`, just not called from the quiz screen yet |
| Admin → People → Users | **Real** — `user_profiles`, RLS-scoped to the caller's org automatically |
| Super Admin → Organizations | **Real** — `organizations`, RLS returns every org only if you're actually `super_admin` |
| Everything else (courses, lessons, community posts, mentors, messages, schedule, cohorts, compliance, analytics, settings, etc.) | Mock data, unchanged |

Each "real" row above was chosen because it's self-contained — it doesn't
require also rewiring three other interlinked screens to avoid a
half-broken state (e.g. Course Library and Course Detail share course IDs
across several screens; wiring one without the others would break
navigation between them). Extending this list means following the same
pattern already in `src/lib/api/` — one query function per table/RPC, a
`useSupabaseQuery` call at the top of the relevant component, demo-mode
fallback to the existing mock constant.

## Honest status summary

| Piece | Status |
|---|---|
| Web frontend (Learner + unified Admin/Mentor/Super Admin platform) | Working; real auth/onboarding/role-routing; responsive mobile+desktop views for both apps; verified build |
| Frontend ↔ Supabase wiring | Partial by design — auth, onboarding, leaderboard, admin people, org list are real; rest is mock (see table above) |
| Supabase schema/RLS/functions | Written + verified against real Postgres, not yet live (needs your Supabase account) |
| Android project | Real Gradle project generated; not compiled here (no SDK/network access in this sandbox) |
| iOS project | Real Xcode project generated; cannot be compiled/signed outside macOS+Xcode, ever, by any tool |
| Security | RLS genuinely enforced and tested as a non-superuser role; see `SECURITY.md` for exact scope and known gaps |
