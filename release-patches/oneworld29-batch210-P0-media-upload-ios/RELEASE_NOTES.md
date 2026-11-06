# Batch 210 — P0: iPhone media upload hangs (6 Nov 2026, Javier Suarez)
Server shows no media upload request at all from his phone (only his profile photo, via the other uploader, landed) — it stalls in the browser before uploading.
1. Picker `accept` named image/heic → iOS sent raw full-size HEIC instead of converting to JPEG. Now `image/*,video/mp4,video/quicktime,video/webm` (as PhotoDeck). HEIC still accepted if it arrives.
2. `videoDuration`: detached <video> never loads metadata on iOS → "Checking…" forever, Publish disabled. Now muted+playsInline+load() and an 8 s cap.
3. Photo shrink capped at 20 s; original uploads instead of hanging.
4. Preview thumbnails decode async/lazy.
Production still needs this — see the in-place patch recipe in the P0 report.
