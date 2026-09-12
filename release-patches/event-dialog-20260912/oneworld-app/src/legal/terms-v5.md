# One World Labs — Terms of Service

> **DRAFT v5 — 5 August 2026. NOT PUBLISHED, NOT BINDING.** Launch-state draft; v2 preserved.
> Applies `MAX-20260805-1515-LEGAL-V2-REVIEW` (nine corrections). **Every claim is a row in
> `PRODUCT_BEHAVIOR_CLAIM_MATRIX.md`; no page publishes while a depended-on row is red or
> unverified.** `⟨M-nn⟩` = matrix row. `[[…]]` = CEO decision, launch proof, or counsel gate.
> Outside counsel is the publication authority.
>
> **v5:** VP architecture ruling (`MAX-20260805-1545`) — **both cancellation journeys ship at
> launch** as distinct user contracts; A3a records that as the intended architecture and corrects
> the actor (the HOST selects the booking policy; the CLIENT agrees to it).
>
> **v5.1 (7 Aug 2026 — CEO ruling "fix the fee forever"):** the platform fee is **5.99%**, resolved
> and no longer a conflict. Verified across every authoritative money path: DB `platform_fee_rate()`
> returns `0.0599`; no database function carries 8.99%; the `create-quick-hire-payment` and
> `create-contract-payment` edge functions both compute `PLATFORM_FEE = 0.0599` and describe it to
> the customer as "5.99%"; the shell carries `FEE_RATE = 0.0599`. The old 8.99% is retired. The fee
> gate is CLEARED.

**Effective date:** `[[LAUNCH PROOF: date of publication]]`
**Version:** 2026-08-05.3

These Terms are an agreement between you and **One World Labs, Inc.** ("One World," "we," "us")
`[[LAUNCH PROOF ⟨M-35⟩: Delaware formation, EIN, principal address — pending; drafting name per
Lee 5 Aug]]`. Contact: `[[LAUNCH PROOF ⟨M-36⟩: proposed support@oneworldlabs.ai, staffed]]`.

## 1. One account, several products
When you create an account you create a **One ID** — one account across OneJob, OneScore,
OneEvent, OneSocial, OneAgent, OneVoice, OnePage and OneApp ⟨M-01⟩. We tell you this before the
account is created, on the sign-up screen ⟨M-02⟩. Each product below has its own **Schedule**, and
**you accept these Terms, the Privacy Policy, and every Schedule at once, when you create your
account** — not again, product by product. That single acceptance lets you move freely across every
One World product without signing anything else; we record the version and the moment you accepted
⟨M-03⟩. Signing in is not subscribing — a paid service is yours only if you have bought it ⟨M-04⟩.

## 2. Who may use One World
At least **18** ⟨M-35⟩. Give accurate information, including a phone number we can reach you at.

## 3. Early release, and money that does not work
Newly launched; features may change. If a **paid service** does not work for you, tell us at the
contact address; we review what you report against our records and may refund some or all of what
you paid for the affected period — an administrative decision after that review ⟨M-05⟩. Payment
disputes about a specific **job** follow Schedule A, not this section.

## 4. Your account
Keep your sign-in method to yourself. A passkey's biometric check happens on your device and your
fingerprint or face is never sent to us; passkeys may sync between your own devices through your
platform account ⟨M-06⟩. "Sign out everywhere" ends your sessions on your other devices too
⟨M-07⟩. Tell us immediately if someone else has used your account.

## 5. What we do not do
One World is a venue where independent people find and pay each other. Unless a Schedule says
otherwise:
- **No background, reference, or identity checks.** What a member says about themselves —
  including being licensed or certified — is **self-reported**; we have not confirmed it ⟨M-08⟩.
- **We do not supervise work and are not a party** to the client–professional arrangement ⟨M-20⟩.
  Meeting someone — including at a home — is your decision and your risk; take normal precautions.
- **We do not insure anyone or anything** ⟨M-09⟩.

## 6. Acceptable use
No unlawful activity, harassment, impersonation, scraping or bulk collection of member data, or
moving a transaction off-platform to dodge fees after using the platform to find the other party.

## 7. Your content
You own what you post and license us to display it. Public profile pages are public by design —
a signed-out person can open a link to one ⟨M-10⟩. You control what your public profile shows
through the visibility settings in the product ⟨M-11⟩. To report content that infringes your
rights, contact `[[LAUNCH PROOF ⟨M-36⟩: takedown/IP contact — proposed legal@oneworldlabs.ai]]`;
we remove infringing material and may remove accounts that repeatedly infringe ⟨M-42⟩.

## 8. Fees and payments
Per each Schedule. Platform-wide: card and bank details are processed by Stripe; we do not store
your card number ⟨M-12⟩. Where the platform holds funds for a job, the Schedule states exactly
when they are collected and released.

## 9. Messages and texts
We send a **verification code by text** to the number you give us ⟨M-13⟩. `[[LAUNCH REQUIREMENT
⟨M-13b⟩: any broader transactional/job/account texts, and their consent/notice path, before this
sentence may name them]]` Message and data rates may apply. Not marketing consent; marketing
texts would be a separate opt-in you can decline ⟨M-14⟩.

## 10. Privacy, and one product rule
Our Privacy Policy (`/privacy`) is part of these Terms. One rule shapes the platform: **as a
matter of product design, OneVoice call content and OneJob payment activity are not used to
calculate anyone's OneScore, and no setting turns that on** ⟨M-15⟩.

## 11. Ending the relationship
Stop any time; request deletion of your account and personal data per the Privacy Policy ⟨M-16⟩.
We can suspend or terminate for breach; money mid-transaction finishes under the Schedule first.

## 12. The app licence
We grant you a personal, non-transferable, revocable licence to use the One World app for its
intended purpose, subject to these Terms and the app store's terms. Support is provided at the
contact address on a reasonable-effort basis during the beta ⟨M-40⟩.

## 13. Disclaimers
Provided "as is" and "as available." To the extent the law allows, we disclaim implied
warranties. Some places do not allow certain disclaimers, so parts may not apply to you.

## 14. Limits on our liability
To the extent the law allows, our total liability for all claims arising out of the service is
limited to `[[CEO DECISION + COUNSEL GATE ⟨M-21⟩: the cap]]`, and we are not liable for indirect
or consequential damages. Nothing limits liability that cannot lawfully be limited.

## 15. Disputes with us
Talk to us first; most problems are fixable in a message.
**Proposed framework, publication blocked until outside-counsel enforceability review ⟨M-22⟩:**
disputes we cannot resolve informally within 30 days go to **binding individual arbitration**
under a recognized provider's consumer rules, and **each side waives class actions**. Exceptions:
either side may use **small-claims court**, and you may **opt out of arbitration by writing to us
within 30 days of first accepting these Terms**, in which case the courts below apply.
`[[COUNSEL GATE ⟨M-22⟩: provider, fees, mass-arbitration protocol, severability — counsel drafts
the operative clause.]]`
**Governing law: Georgia (USA). Venue: state or federal courts in Atlanta, Fulton County,
Georgia** — proposed per Lee 5 Aug, counsel-gated ⟨M-35⟩.

## 16. Changes
We tell you in the product before a material change takes effect. **A materially broader use of
your personal data gets fresh notice and, where the use rests on consent, fresh consent;
continued use alone is never treated as agreement to it** ⟨M-17⟩. The version number is recorded
with your acceptance.

## 17. General
**Notices** to you may be given in the app or by email to your account address; notices to us go
to the contact address above ⟨M-42⟩. **Assignment:** you may not assign these Terms; we may
assign them to an affiliate or successor. **Severability & entire agreement:** if a term is
unenforceable the rest stands; these Terms plus the Schedules and Privacy Policy are the entire
agreement. **Force majeure:** we are not liable for delays or failures caused by events beyond our
reasonable control. **Survival:** Sections 5, 8–11, 13–15 and 17, and each Schedule's payment
provisions, survive termination.

---

## Schedule A — OneJob
Applies to OneJob, with the master Terms. **Every money sentence here is gated on (a) reading the
actual OneJob cancellation source ⟨M-05a⟩, (b) verification against the live Stripe/Connect
configuration ⟨M-19⟩⟨M-23⟩, and (c) payments/marketplace counsel ⟨M-20⟩.**

**A1. Roles.** A **client** pays; a **professional** performs and is an independent member, not
our employee or contractor ⟨M-20⟩.

**A2. Platform fee.** The platform fee is **5.99%** of the transaction, shown before you commit.
`[[⟨M-18⟩ — RESOLVED 7 Aug 2026: 5.99% is the charged amount across every authoritative money path.
Verified: DB `platform_fee_rate()` = `0.0599`; no database function carries 8.99%; the
`create-quick-hire-payment` and `create-contract-payment` edge functions both compute
`PLATFORM_FEE = 0.0599` and label it "5.99%" to the customer; shell `FEE_RATE = 0.0599`. The legacy
OneJob client `PublicJobBooking.tsx` is being retired onto the shared shell; its display value is
corrected to 5.99% as a display-only follow-up and is not a charge path. Live payment UAT remains
the final publish proof.]]`

**A3a. Before work starts — cancellation and no-shows.** OneJob has **two cancellation
contracts, and which one applies depends on how the job was set up.** Both ship at launch (VP
architecture ruling, 5 Aug 2026); the applicable policy is always named and shown before you
commit, stored with your transaction, and enforced from that stored copy — so the rule you agreed
to is the rule that runs, even if the platform later changes its defaults.

- **A hire you agreed directly (contract / job-execution).** The platform's standard time-tier
  policy applies, based on hours before the scheduled start: **more than 24h before = full
  refund; 12–24h before = 50% refund and a −10 OneScore penalty; under 12h before = no refund and
  a −25 OneScore penalty.** A job that has already started cannot be cancelled.
  (`JobExecutionPanel.tsx` → `calculateCancellation()` in `cancellationPolicy.ts`.)
- **A public booking of someone's posted job.** The **job's host chooses a cancellation policy
  when they create the job** — **Flexible** (free more than 24h before; 50% within 24h),
  **Moderate** (free more than 7 days before; 50% within 7 days; none within 24h), or **Strict**
  (100% non-refundable once confirmed). **You see that policy and agree to it before you pay**, and
  it is then locked to your booking. If the host cancels, you get a full refund; a payment that
  was only authorized and not yet charged is released rather than refunded.
  (Host selects in `CreateJobForm.tsx` → snapshotted by `create-job-booking-checkout` → shown to
  the client in `PublicJobBooking.tsx` → enforced by `cancel-job-booking`.)

`[[LAUNCH REQUIREMENT + COUNSEL GATE ⟨M-05a⟩: architecture is settled (both journeys ship). A3a
stays RED until each journey is PROVEN to (1) name and show the applicable policy before commit,
(2) snapshot it to the transaction, (3) display it in booking/contract details, and (4) enforce
from the snapshot — with regression tests — and payments/marketplace counsel reviews the wording.
A user must never have to infer which model applies.]]`

**A3b. Completion and the 72-hour release.** When a professional marks a job complete, the client
has **72 hours** to accept or raise a problem. No response → the held payment **releases
automatically** at the deadline. This is Lee's chosen launch timer (the "B plus timer" decision)
⟨M-05b⟩. `[[LAUNCH REQUIREMENT ⟨M-05b⟩: the 72-hour timer and auto-release must be built and
independently proven; today the staged source proves the accept-window sweeper, not this
completion timer.]]`

**A4. A dispute over held funds.** If the client raises a problem in time, both sides have **7
days** to agree on a release, refund, or split. If they cannot, either side may open a dispute:
each submits their side and **we make the final administrative decision on where the held payment
goes** — release, refund, or split ⟨M-05c⟩. **This is an administrative allocation of the held
funds under our disclosed criteria — not a legal finding about workmanship, negligence, or
liability**, and either side remains free to pursue the other directly ⟨M-20⟩.
`[[LAUNCH REQUIREMENT + COUNSEL GATE ⟨M-05c⟩/⟨M-37⟩: publish only after the review criteria,
evidence rules, conflict/appeal/escalation path, response-time target, record retention, and
operator access controls exist and are proven; counsel confirms the administrative-not-adjudicative
framing.]]`

**A5. Taxes.** Professionals handle their own taxes. Where required, we or our processor issue tax
forms ⟨M-23⟩.

**A6. Safety.** Section 5 applies in full. Client and professional each hold us harmless from
claims arising out of the work arrangement itself, to the extent the law allows ⟨M-21⟩.

---

## Schedule B — OneScore
Applies to OneScore, with the master Terms.

**B1.** Your score is built from work you completed and reviews you received. **B2.** OneVoice call
recordings and OneJob payment details never affect it, and no setting turns that on ⟨M-15⟩.
**B3.** You can see every item that moved your score and dispute any of them; we correct errors we
confirm. **B4.** OneScore is our own measure of activity on this platform. It is **not a consumer
credit report**, and it is not to be used as the basis for credit, employment, tenancy or insurance
decisions. `[[COUNSEL GATE ⟨M-24⟩: if a permitted use ever touches those decisions, FCRA / consumer-
reporting obligations (permissible purpose, dispute, adverse-action) attach and this Schedule must be
rewritten with counsel.]]`

## Schedule C — OneEvent
Applies to OneEvent, with the master Terms.

**C1.** Tickets you buy are held in your account and scanned at the door. **C2.** Organisers set
their own refund terms — you see them before you pay, and they govern that purchase; disputes about a
specific event are between you and the organiser, who is the merchant for that sale. **C3.** One
World Labs charges a fee on each ticket sold, shown before you commit ⟨M-18⟩. **C4.** Section 5
applies: we are the venue, not the organiser, and do not run the event.

## Schedule D — OneSocial
Applies to OneSocial, with the master Terms.

**D1.** Your profile is public by design — anything you post can be seen and shared, and a
signed-out person can open a link to it ⟨M-10⟩. **D2.** Your OneScore appears on your profile only
if you switch it on ⟨M-11⟩. **D3.** Impersonation, fake credentials and scraping or bulk collection
of member data are prohibited and get the account removed ⟨M-08⟩⟨M-42⟩. **D4.** You own what you
post and license us to display it (Section 7).

## Schedule E — OneAgent
Applies to OneAgent, with the master Terms.

**E1.** The agent acts on your behalf, and **you approve anything binding before it happens** — it
never commits you to a payment or a contract on its own. **E2.** It reads only what you connect to
it, and you can disconnect it at any time. **E3.** OneAgent is an intermediary; it is not a party to
any arrangement it helps you reach, and Section 5 applies. **E4.** Nothing the agent handles is used
to change your OneScore ⟨M-15⟩.

## Schedule F — OneVoice
Applies to OneVoice, with the master Terms.

**F1. What OneVoice is.** OneVoice is an AI voice assistant for your business — it answers callers,
gives information, and helps with routine questions. The always-on assistant (Ava) is an
informational / sales agent. **By default, OneVoice does not record or retain the content of your
callers' calls, and does not use caller information for any other purpose.**

**F2. If you enable call recording.** Call recording is an optional feature that **you** turn on and
control for **your own** business line — it is not part of the default service. If you enable it,
**you are solely responsible for meeting any legal requirement to notify your callers or obtain
their consent** (for example, a spoken notice at the start of the call in places that require
all-party consent). One World Labs provides the tool; those calls are between you and your callers,
and we are not a party to them and do not record them for you.

**F3.** Nothing OneVoice handles is used to calculate anyone's OneScore ⟨M-15⟩. **F4.** Where you
enable recording, any recordings are handled under the Privacy Policy and you control retention where
the product allows. **F5.** If you enable recording, you indemnify One World Labs against any claim
arising from your recording of, or notice to, your own callers, to the extent the law allows.

## Schedule G — OnePage
Applies to OnePage, with the master Terms.

**G1.** You own your content and your domain, and you can take both with you. **G2.** Published
changes go live immediately — there is no staging step, so review before you publish. **G3.** Fees
for the service are shown before you buy.

## Schedule H — OneApp
Applies to OneApp, with the master Terms.

**H1.** You own what gets built and can export it at any time. **H2.** App-store submissions are
handled by One World Labs and are subject to the stores' own review, which can take weeks and is
outside our control (Section 17, force majeure). **H3.** Fees for the service are shown before you buy.

## Schedule I — OneHome rentals

> **COUNSEL-GATED LAUNCH DRAFT — NOT YET BINDING.** This Schedule is a product-behaviour and
> legal-review specification, not legal advice and not a substitute for the signed lease. It must
> be reviewed for Colombia, Georgia, Illinois, Atlanta and Chicago before publication. A local
> supplement controls over this Schedule where local law gives a host or tenant a right that
> cannot be waived.

**I1. Roles and platform role.** A **Host** is the owner, landlord, property manager or authorized
agent offering a home. A **Tenant** is the person requesting and, if approved, occupying it.
OneHome provides listing, messaging, payment-routing, document-signing and condition-evidence
tools. OneHome is not the owner, landlord, tenant, property manager, insurer, real-estate broker,
lawyer or guarantor, except to the limited extent a separately disclosed payment service appoints
it or a regulated processor as collection agent. The signed lease and mandatory local law govern
the tenancy itself.

**I2. Host authority and listing accuracy.** Before publishing, the Host represents that the Host
has authority to offer the property; the listing, price, availability, address, amenities,
occupancy limits, licensing and safety disclosures are accurate; the property may lawfully be
rented for the offered period; and required landlord, owner, agent, building, tax and permit
information will be supplied. The Host must promptly correct or unpublish inaccurate information,
honor confirmed dates, maintain habitability and safety, and avoid discriminatory screening or
terms. OneHome may request proof, pause a listing or preserve records when reasonably necessary
for safety, fraud, legal compliance or a dispute.

**I3. Tenant request and identity.** A request is not a lease or final reservation. A Tenant may
submit a government ID with the request or wait. If the Host pre-approves without it, the request
is **Pre-approved — ID required** for the Host-selected 24-, 36- or 48-hour window. Final approval
is unavailable until the required identity document is submitted and reviewed. Identity review
reduces risk but does not guarantee a person's identity, conduct, creditworthiness or suitability.
The document is private, is not a public listing asset, and may be viewed only through the
restricted request-review workflow described in the Privacy Policy. A Host may use it only to
evaluate and administer that request and must not download, republish, profile or discriminate
from it except as lawfully required.

**I4. Pre-approval, availability and expiration.** A pre-approval temporarily holds the requested
dates while the Tenant completes the stated conditions. The notice identifies the exact deadline
and remaining requirements. If they are not completed on time, the hold may expire automatically
without final approval. Expiration is not an eviction, lease termination or adverse credit
decision. The Host must not promise the same dates to another person while an active hold remains.

**I5. Price, fees and payment routes.** The request screen must show the rent, currency, disclosed
fees, deposit or other security arrangement, payment route and due timing before submission.
Card payments may be authorized first and captured only when the product says final approval is
ready. An authorization is not a completed charge and the issuing bank controls when a released
hold disappears. Remitly, Wise, PayPal or another external route is a direct transfer whose
availability, fees, exchange rate, reversibility and account rules come from that provider. For an
external route, final approval remains blocked until the Host confirms actual receipt. OneHome
does not claim to hold or escrow a direct transfer. No party may mark payment received falsely or
move a OneHome-introduced transaction off platform to evade disclosed fees.

**I6. Final approval and lease.** Final approval requires both an accepted identity state and the
required payment state. When both gates pass, OneHome records the approval, locks the confirmed
dates and delivers the lease or booking record. The Tenant must review the property, parties,
dates, rent, fees, security arrangement, utilities, rules, cancellation terms and local notices
before signing. A negotiated change to price, dates or material terms requires a new version and
fresh agreement; a party is never deemed to accept a silent edit.

**I7. Cancellations, changes and refunds.** The applicable cancellation rule must be shown before
the Tenant commits and stored with the request. Host cancellations, Tenant cancellations,
unavailable premises, material listing inaccuracies, failed payments and force-majeure events may
have different consequences. OneHome may facilitate a refund or release, but no wording in this
Schedule removes a non-waivable statutory remedy. Refund timing depends on the payment provider.
`[[COUNSEL GATE: approve the exact cancellation matrix and processor-specific refund promises
before enabling paid production requests.]]`

**I8. Check-in and move-in condition record.** Check-in is a server-timestamped event. It unlocks
the private move-in evidence and starts the disclosed review period. The Tenant reviews each Host
photo or video: accept if accurate, or dispute it with a comment, replacement evidence, or both.
Work remains a private draft until **Finalize and submit**. The Host then reviews the submitted
differences; the Tenant may add one final statement; and the resulting record is frozen with its
timestamps and participants. Silence does not fabricate agreement. This evidentiary workflow does
not waive habitability, repair, safety or other statutory rights.

**I9. Checkout and condition disputes.** Standard checkout is 11:00 a.m. local property time unless
the parties record a different time in OneHome. Checkout is server-timestamped. The Tenant may
state that condition is unchanged or submit checkout evidence. The Host has four hours after the
recorded checkout, and always no later than the next Tenant's check-in, to submit a damage issue.
Late evidence is not automatically attributed to the prior Tenant and requires support review.
The Tenant may agree or disagree and add a final statement; unresolved matters are preserved for
the parties, insurer, payment provider, support review or a court. OneHome's record is evidence,
not a legal judgment about liability.

**I10. Deposits, damage and insurance.** The listing and lease must identify who receives and holds
any deposit, when it may be retained, the return deadline and the governing local rules. OneHome
does not hold or return a Host-direct deposit. Ordinary wear and tear is not damage. A damage-cover
or insurance label may be used only when an actual carrier or binding program exists and its
coverage, exclusions, excess, claims procedure and contracting entity are shown. A Host's
insurance attestation is the Host's statement, not OneHome verification.

**I11. Safety, access and conduct.** Hosts must supply a lawful, safe and habitable home and required
alarms, utilities and disclosures. Tenants must use the home lawfully, follow disclosed occupancy
and building rules, avoid nuisance and prevent damage beyond ordinary wear. Host entry, lockouts,
service interruptions, removal of property and eviction must follow the lease and applicable law;
the app does not authorize self-help. Emergencies should be directed to local emergency services.

**I12. Communications and notices.** The parties should keep material requests, approvals, time
extensions, payment confirmations and condition discussions in OneHome messages. Transactional
in-app, email and SMS notices may link to the same message card after sign-in. Delivery failure
does not extend a statutory deadline unless applicable law or the signed lease says so. Marketing
requires a separate opt-in.

**I13. Taxes, licensing and fair housing.** Hosts are responsible for property-specific taxes,
registrations, licenses, zoning, building rules and legally required disclosures. U.S. Hosts must
comply with the federal Fair Housing Act and applicable state and local protections. Screening,
pricing, availability and approval decisions must not use protected characteristics. OneHome may
retain an audit trail and restrict tools that appear to be used unlawfully.

**I14. Local supplements.** The following launch supplements are mandatory and cannot reduce a
non-waivable right:

- **Colombia.** Urban housing leases may be governed by **Ley 820 de 2003**, including rules on
  the lease, rent, guarantees, duties and termination. The Spanish lease and legally required
  notices control where Colombian law requires them. The Host remains responsible for tourism or
  short-stay registration when a stay falls outside the urban-housing regime. Source for counsel:
  [Ley 820 de 2003](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=8738).
- **Georgia.** Georgia landlord-tenant law and the signed lease govern possession, repairs,
  deposits, inspections, deductions and dispossession. Deposit workflows must support the legally
  required move-in/move-out damage lists, escrow or bond rules where applicable, itemized
  deductions and return timing. Source for counsel: [Georgia Landlord-Tenant
  Handbook](https://dca.georgia.gov/housing-choice-voucher/landlords/georgia-landlord-tenant-handbook).
- **Illinois.** State law governs deposits, itemized damage statements, receipts, return timing,
  retaliation, repairs and possession. The product must not treat a four-hour OneHome evidence
  window as shortening a statutory deposit or claim period. Source for counsel: [Illinois Security
  Deposit Return Act](https://ilga.gov/Legislation/ILCS/Articles?ActID=2202&Chapter=PROPERTY&ChapterID=62&MajorTopic=RIGHTS+AND+REMEDIES).
- **Atlanta.** Georgia controls unless an applicable Atlanta code, license, tax, zoning or
  short-term-rental rule adds a requirement. `[[COUNSEL GATE: property-type and stay-length
  applicability matrix before Atlanta launch.]]`
- **Chicago.** Covered dwellings are subject to the Chicago Residential Landlord and Tenant
  Ordinance, including required summaries/notices, deposit handling, access, maintenance,
  remedies and prohibited lease waivers. The platform must determine exclusions rather than
  assuming every Chicago unit is covered. Source for counsel: [Chicago RLTO, Chapter
  5-12](https://codelibrary.amlegal.com/codes/chicago/latest/chicago_il/0-0-0-2639041).

**I15. Disputes and mandatory law.** Start with the in-app record and support review. Administrative
review may organize evidence or route funds only as separately authorized; it is not arbitration,
a court judgment or a waiver of either party's claims. The master dispute clause does not override
mandatory landlord-tenant venue, notice, anti-waiver, fair-housing or consumer-protection law.
`[[COUNSEL GATE: reconcile the master Georgia arbitration proposal with Colombia, Illinois and
Chicago tenancy disputes before publication.]]`

**I16. Coverage benchmark and publication gate.** This Schedule was structured against the topic
coverage in Airbnb's current platform and payment terms—roles, listing duties, identity, payment
collection, payouts, cancellations, damage claims, records, prohibited activity, liability and
disputes—without copying its language or claiming OneHome offers the same services. Benchmark:
[Airbnb Payments Terms, updated 5 February 2026](https://www.airbnb.com/help/article/2909).
Publication remains blocked until product behaviour, processor authority, translations, local
supplements, retention rules, consent records and outside-counsel review are complete.

---

> **Schedules B–H drafted 7 Aug 2026 to consolidate every product's terms into this ONE agreement
> accepted once at onboarding (per Lee's CEO ruling; supersedes the removed per-app terms gates).
> Still DRAFT / NOT PUBLISHED — same counsel and launch gates as the rest of this document; the
> per-product summaries formerly shown in each app are now rolled up here.**
