# One World Labs — Privacy Policy

> **DRAFT v3 — 5 August 2026. NOT PUBLISHED, NOT BINDING.** Launch-state; v2 preserved. Applies
> `MAX-20260805-1515` privacy corrections (GDPR rights + withdrawal effect, provider mapping, SMS split).
> **Every statement here is a row in `PRODUCT_BEHAVIOR_CLAIM_MATRIX.md`; publication is blocked
> while any depended-on row is red or unverified.** `[[PLACEHOLDER: …]]` = CEO decision or
> pending entity fact. `⟨M-nn⟩` = matrix row. Requires: current-law verification pass,
> outside-counsel review, and the Spanish version for consent/money surfaces before `/privacy`
> goes live. This is the substance behind the sign-up "How your data is used" link (notice
> version 2026-08-03).

**Effective date:** `[[LAUNCH PROOF: date of publication]]`
**Controller:** **One World Labs, Inc.** `[[LAUNCH PROOF ⟨M-35⟩: Delaware formation + principal
address — drafting name per Lee's direction 5 Aug]]`.
**Privacy contact:** `[[LAUNCH PROOF ⟨M-36⟩: proposed privacy@oneworldlabs.ai — mailbox created
and monitored before publication]]`.

## 1. One account, told up front

When you sign up anywhere in One World, you create **one account (a One ID) that works across
all our products** — OneJob, OneScore, OneEvent, OneSocial, OneAgent, OneVoice, OnePage and
OneApp ⟨M-01⟩. We say this on the sign-up screen before the account exists, and we keep a record
that you were shown it ⟨M-02⟩.

## 2. What we collect, and what is required

- **Required to have an account:** email address and phone number (each confirmed by a code
  we send you — the platform moves money and work arrangements, so we need a reachable person), your name, and the general
  location you enter. **If you do not provide these, you cannot complete sign-up**; nothing else
  in this section is required ⟨M-24⟩.
- **Optional:** profile photo, bio and profile details, language and theme preferences.
- **Consents:** which purposes you agreed to, when, and under which notice version ⟨M-25⟩.
- **Usage:** which products you use and the actions you take in them, and how you arrived (for
  example, which product's page brought you in).
- **Payments:** handled by our payment processor (Stripe). We do not store your card number
  ⟨M-12⟩.
- **OneHome rental identity documents:** a Tenant may upload a passport, national ID or residence
  permit for a specific rental request. The file, document type, request link, submission and
  review timestamps, reviewer and decision are collected to prevent fraud, support the Host's
  request decision and document the resulting lease. These files are private; they are not public
  profile or listing content. The applicant and the Host for that property may access the file
  only through the restricted request workflow. `[[COUNSEL + SECURITY GATE: verify encryption,
  signed-link lifetime, download controls, reviewer audit, breach response, and a short retention
  period by jurisdiction before production ID collection.]]`
- **Passkeys:** if you choose to add one, the biometric check (fingerprint or face) happens on
  your device and **your biometric data is never sent to us**. What we store is the passkey's
  public key; your device or its password manager holds the private key, and your platform
  account (for example your phone maker's password manager) may sync that passkey between your
  own devices ⟨M-06⟩.

We do not track your device's GPS position ⟨M-26⟩, and we do not buy data about you from data
brokers ⟨M-27⟩.

## 3. Why we use it, and on what legal basis

- **To run your account and products you use** — performance of our contract with you.
- **To move money you asked us to move and keep records of it** — contract and legal obligation.
- **To send transactional messages** (codes, receipts, account notices) — contract.
- **Platform safety** — abuse and fraud prevention, keeping the service working — our
  legitimate interest in operating a safe service, balanced against your rights ⟨M-28⟩.
- **Separately consented purposes** — consent, given per purpose. Agreeing to terms is never
  treated as agreeing to data sharing ⟨M-25⟩.

**Scores and profiling:** OneScore computes a credibility score from information you connect to
it. `[[COUNSEL GATE ⟨M-29⟩: the published description of OneScore's logic, its significance and
consequences, and the applicable safeguards — required disclosure where automated evaluation
has meaningful effects; wording needs EU/consumer counsel before publication.]]`

## 4. What we deliberately do not do

- **We do not sell your personal data** ⟨M-27⟩.
- **As a matter of product design, OneVoice call content and OneJob payment activity are not
  used to calculate OneScore, and no setting enables it** ⟨M-15⟩.
- We do not use your data for third-party advertising ⟨M-30⟩.

## 5. Who receives your data

Service providers who run the platform for us, bound to use data only to provide the service
⟨M-31⟩:

| Provider | Purpose | Data category | Region | Contract/transfer |
|---|---|---|---|---|
| **Supabase, Inc.** (the platform's cloud/database/auth; the in-product label "Lovable Cloud" is marketing copy, not the legal counterparty) | infrastructure, database, authentication | account, profile, usage, auth | `[[⟨M-31⟩: US region confirm]]` | `[[⟨M-32⟩: DPA + SCCs/DPF]]` |
| **Stripe, Inc.** | payment processing | payment identifiers, payout | US | `[[⟨M-32⟩: DPA + transfer mechanism]]` |
| **Cloudflare, Inc.** (Turnstile) | bot protection on sign-up | IP, challenge token | US/global edge | `[[⟨M-32⟩: DPA + SCCs]]` |
| **Brevo (Sendinblue SAS)** | account/transactional email delivery | email address, message content | EU | `[[⟨M-32⟩: DPA]]` |
| `[[RED ⟨M-31⟩: SMS delivery provider — behind Supabase phone auth, identity UNVERIFIED]]` | verification SMS | phone number | — | `[[⟨M-32⟩]]` |
| `[[RED ⟨M-31⟩: any other subprocessor found in the pre-publication sweep]]` | | | | |

**The contracting entity, purpose, data category, region, DPA and transfer mechanism above are a
launch-requirement mapping — every cell marked `[[…]]` is unverified and blocks publication of
this table ⟨M-31⟩⟨M-32⟩.**

Public profile pages show what you have chosen to make public ⟨M-10⟩⟨M-11⟩. We disclose data
where the law genuinely requires it. If the business changes hands, data goes with it under this
policy's promises.

**International transfers:** our providers process data in the United States. For people in the
EEA/UK and other regions with transfer rules, transfers rest on
`[[COUNSEL GATE ⟨M-32⟩: the named safeguard — e.g. EU Standard Contractual Clauses and/or an
adequacy framework — confirmed per provider before publication]]`.

## 6. Withdrawal, and why the record stays

You can withdraw any consent. **Withdrawal stops the consented use going forward but does not
make earlier processing unlawful**, and where another lawful basis we have disclosed still
applies (for example, keeping transaction records the law requires), that processing may continue
⟨M-39⟩. The **record** that you consented and later withdrew is kept, because it is the legal
evidence of both events ⟨M-25⟩.

## 7. Your rights

Access, correction, deletion, a copy of your data in a portable form, restriction of processing,
and objection to processing based on our legitimate interests — and the right not to be subject
to certain purely automated decisions, as described in §3 ⟨M-38⟩. To exercise any right, contact
`[[PLACEHOLDER: privacy contact]]` from your account email, or use the in-product controls where
they exist. **Account deletion:** you may request deletion of your account and personal data; we
delete what we are not legally required to keep (for example, transaction records required for
tax and payment law) and tell you what was retained and why ⟨M-16⟩. `[[LAUNCH REQUIREMENT ⟨M-38⟩:
the operational request channel, identity verification, response handling and retention proof
must be built and tested before these rights publish.]]`

**If you are in the EEA/UK:** you may also complain to your data-protection supervisory
authority.

**Colombia (Ley 1581 de 2012)** ⟨M-33⟩: the controller identified above requests your
authorization **previa, expresa e informada** at sign-up and keeps proof of it ⟨M-02⟩⟨M-25⟩. You
have the right to know, update and rectify your data (**conocer, actualizar y rectificar**), to
request proof of the authorization, to be informed of how your data has been used, to revoke
authorization and request deletion where the law allows (**revocar y suprimir**), and to
consult your data free of charge. **Consultas y reclamos:** submit them to
`[[PLACEHOLDER: privacy contact]]`; we respond within the terms set by Colombian law
`[[LAUNCH REQUIREMENT ⟨M-33⟩: the operational consultas/reclamos channel, procedure and
statutory response timelines must be confirmed and staffed before any collection from people in
Colombia; verify current statutory windows at drafting time]]`. A Spanish version of this policy
will be published; `[[PLACEHOLDER: which language controls in a conflict]]`.

## 8. Retention

- Account data: while your account exists ⟨M-34⟩.
- Consent records: for as long as we must be able to prove the consent, and after withdrawal or
  deletion for `[[PLACEHOLDER — counsel gate ⟨M-34⟩: the specific period]]`.
- Transaction and tax records: the period required by payment and tax law
  `[[PLACEHOLDER — counsel gate ⟨M-34⟩: the specific periods by record type]]`.
- Everything else: no longer than needed for the purpose it was collected for, after which it is
  deleted or anonymized.
- OneHome identity files: `[[COUNSEL DECISION: short request-based period, with prompt deletion
  after rejection, expiry or tenancy verification unless a documented dispute or legal duty
  requires a limited hold; implement and test the matching automated deletion job before launch.]]`

## 9. Children

One World is not directed to children and may not be used by anyone under **18** (proposed
launch default per Lee's reasonable-placeholder direction; counsel-gated ⟨M-35⟩). If we learn we
hold a child's data, we delete it.

## 10. Changes

If we change this policy in a way that matters, we tell you in the product before it takes
effect. **If a change would use your personal data in a materially broader way, you get fresh
notice and — where the use rests on consent — a fresh consent request; continued use alone is
never treated as agreement to a materially broader use** ⟨M-17⟩. The notice version shown at
your sign-up is recorded so both of us know which version you saw ⟨M-02⟩.
