# oneworld29-batch197-20261027 — audit fixes on 196

Entry: index-IjPFkQnM.js · CSS: index-4uuegc51.css (196: index-BYn6lnsF.js / index-CH5AeUfI.css)

## What changed
- Middle-button "What brings you to …?" sheet is denser glass, light and dark (Lee: too transparent).
- Focus moves into each sheet and the tips on open and returns on close (keyboard / screen reader).
- Store build: "Choose an app" no longer offers Rides (store ships Events, Jobs, Homes).
- Back from sign-up: the side question opens without the tips stacked on top.
- Onboarding events counted (trackEvent, respects Do Not Track): landing_app_pick, feed_tips_finished / feed_tips_skipped, feed_app_sheet_pick, feed_join_open, feed_side_pick.

## Rollback
rollback/prod196-index.html over index.html, 404.html and the 131 fixed-route aliases; sandbox: swap the two names back.
