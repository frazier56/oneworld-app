# Batch 208 — Hire button on profiles (Lee, 29 Oct 2026)
- Public profile (shell PublicWorld): "Hire / Contratar" button when the person lists what they do (job_title). Opens OneJob /jobs/qr?to=<id>.
- OneJob QRPay reads ?to= and opens the contract form with that person filled in as the one being paid (viewer = payer). Self-hire ignored.
- /jobs/hire/:proId redirects to the same (old hireLink share links no longer dead-end).
- World feed "Hire" card already opens the profile, which now has the button.
