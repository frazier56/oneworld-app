# Batch 208 — Hire button on profiles (Lee, 29 Oct 2026)
- Public profile (shell PublicWorld): "Hire / Contratar" button when the person lists what they do (job_title). Opens OneJob /jobs/qr?to=<id>.
- OneJob QRPay reads ?to= and opens the contract form with that person filled in as the one being paid (viewer = payer). Self-hire ignored.
- /jobs/hire/:proId redirects to the same (old hireLink share links no longer dead-end).
- World feed "Hire" card already opens the profile, which now has the button.
- 208b: Hire prefills the contract title with what the person does and opens the description with "Hiring <name> for <job> services." (VAIA already keeps date/time/place/price out of the description).
- 208b: "N payments together · History" on the hire contract when you've dealt with the person before → /jobs/money?person=<id> (money dashboard opens on that person, in the currency you used).
- 208b: OneJob centre screen gets a "History" option → money dashboard (people, jobs, payments, totals).
