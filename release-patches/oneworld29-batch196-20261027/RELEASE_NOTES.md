# oneworld29-batch196-20261027 — new-visitor landing, first-visit tips, footer sheets

Entry: index-BYn6lnsF.js · CSS: index-CH5AeUfI.css (195 was index-hpMa2yuR.js / index-Bb1E5tRQ.css)
Built from release 195 source + the changes below (VITE_OW_GLASS_REFRESH=true npx vite build). tsc --noEmit clean.

## What works now
- Signed-out visit to `/` shows "Pick an app": glass tiles, app-coloured icons (Everything, Events, Jobs, Homes, Rides); Social, Score, Pay, Agent, Business greyed "Coming soon" and not tappable. Store build shows only Everything, Events, Jobs, Homes. Signed in, `/` is still the feed.
- Tapping an app opens `/feed?lane=…`. First visit per device shows three centred tips (up/down, left/right, middle button), light and dark, no panel; Skip top right.
- Feed footer LOOK unchanged. Far-left button now opens "Choose an app" (swipe order, "You're here", Rides). Middle button: signed out → Join sheet; after sign-up returns with `ow_do=start` and opens "What brings you to …?" (finder side → app feed, creator side → app centre tab from config).
- Shared Join sheet (every guest action) restyled as glass: Join One World · Sign up · Sign in · Keep browsing.
- Guest card hidden on `/`; on `/feed` it sits above the floating footer instead of covering it.
- Deep links, /signin, /join, /yourworld, /events, /jobs, /rentals, /rides, not-found: unchanged (UAT).

## Files
app: src/App.tsx, src/products/world/{Landing.tsx (new), FeedSheets.tsx (new), Intro.tsx, WorldFeed.tsx}
shell: src/components/AccountGate.tsx, src/screens/AuthGate.tsx, src/index.ts (export oneWorldTagline)

## Rollback
Production: copy rollback/prod195-index.html over index.html, 404.html and every fixed-route alias */index.html. Sandbox: rollback/sandbox195-index.html → sandbox/index.html.
