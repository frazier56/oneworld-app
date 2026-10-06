# Batch124 — reviewed OneHome corrections

Based on cumulative batch123, production commit281137b88222fd2a9f6f7e39f4b6422469b555f6. Max is acting sole publisher while PUB30 is unavailable. Independent coordinator review cleared these corrections and the explicit dependency changes.

- Search controls open and focus the requested filter section, including late layout changes and narrow screens.
- Drawer tagline shares the existing localized wordmark; identity disclosure describes retained verification data accurately.
- Payment destination dialog escapes clipping and remains reachable at small heights.
- Messages use stable client UUIDs so realtime echoes cannot duplicate the optimistic row; edits and recalls update both participants live.
- Rental request shows one ID submission block and preserves currency cents in displayed fees and transfer totals.
- jsPDF is explicitly upgraded from3.0.4 to4.2.1; DOMPurify from3.4.13 to3.4.16. Their isolated locked dependency set reports zero audit advisories. This does not claim that all application dependencies are advisory-free.

The original source-only batch123 archive omitted build configuration. Reconstructed baseline output matched217/218 JS/CSS chunks after import-name hash normalization. The sole content difference deduplicated TUS4.3.1 from ListHub into the existing shared runtime; actual staging resumable upload passed. The unchanged baseline remains separate from this candidate's explicit security upgrades.

Validation: full TypeScript/Vite build;18 compiled-app filter/tagline cases across seven locales, mobile/desktop and light/dark;2 late-layout regressions;3 genuine staging payment-dialog viewport checks; real two-role messaging including a delayed response, edit and recall;5 reconciliation assertions;6 baseline/patched PDF pairs generated in Chrome with identical page text and signature image bytes verified by pypdf; final Vite-bundled PDF generation and sanitizer/version checks; genuine staging TUS upload. No real provider payment or identity submission occurred. Broader nine-level role UAT remains incomplete.

No new database prerequisite is introduced. MAX-ID-004 resubmission-history/RPC correction is independently cleared and tested on staging but remains PENDING PRODUCTION because the Supabase connector failed authentication. This release must not be reported as fixing that database defect in production.

## Rebuilding

Run `node rebuild.cjs <fresh-output-directory>` from this saved source directory. It reconstructs the original relative layout, installs only from the three saved lockfiles with lifecycle scripts disabled, links the shared shell to the app dependencies, and runs TypeScript/Vite. It refuses to remove an existing output directory. Node/npm must be available on PATH. The original hand-written production HTML is preserved by the packer; generated Vite index.html is not the production activation shell.

The publisher preserves existing static media, stages hashed assets without overwrites, and switches all fixed-route aliases together. The previous activation bytes are the rollback target. Staging and production verification receipts are maintained separately.

Fresh `npm ci` reconstruction independently reproduced all218 JavaScript/CSS assets byte-for-byte. Existing app lockfile audit still reports inherited router advisories and Node/toolchain dependency findings; these are separate from the two upgraded browser libraries and remain tracked for follow-up. No blanket application security certification is claimed.
