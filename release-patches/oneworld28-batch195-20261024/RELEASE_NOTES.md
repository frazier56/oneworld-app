# Release 195 (24 Oct 2026) — built in the cloud by ORCHESTRATOR on batch 194 source
Entry index-hpMa2yuR.js · css index-Bb1E5tRQ.css · staged to /sandbox/ only (production untouched).
How it works now:
- Profile → Social media → "＋ Add" asks: From this phone, or From your social media (opens Connect your world).
- OneSocial's /social/connect is the same "Connect your world" screen as OneScore's second tab.
- Connect your world: Instagram, TikTok, YouTube, X, Facebook… show "Connect <platform>" when Phyllo serves them; signing in there brings the account and recent posts into your media (server: phyllo-connect v3).
- app.oneworldlabs.ai/onesocial (and anything under it) opens OneSocial instead of the home page.
- VAIA sends the member's own session, so she answers with their data (server vaia-chat v44 already answers guests).
- Public profiles: one person's photo can no longer appear with another person's links (17-r4 restored: remount per id + owner-id check).
