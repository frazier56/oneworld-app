-- pgcrypto is installed in the `extensions` schema in production. These
-- SECURITY DEFINER functions deliberately keep a fixed search_path, so the
-- hashing helper must be included explicitly or every owner terms acceptance
-- fails before the email-verification step.

alter function public.rental_listing_review_submit(
  text, text, text, text, boolean, boolean, text, text, text, text, text
) set search_path = public, extensions, pg_temp;

alter function public.rental_owner_terms_acknowledge_existing(
  text, text, boolean, boolean, text, text, text, text, text
) set search_path = public, extensions, pg_temp;
