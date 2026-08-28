-- OneEvent direct-checkout webhook invariants.
-- Read-only: every returned count must be zero before deployment.

with duplicate_sessions as (
  select stripe_session_id
  from public.event_registrations
  where stripe_session_id is not null
  group by stripe_session_id
  having count(*) > 1
),
duplicate_payment_intents as (
  select stripe_payment_intent_id
  from public.event_registrations
  where stripe_payment_intent_id is not null
  group by stripe_payment_intent_id
  having count(*) > 1
),
function_acl as (
  select
    has_function_privilege(
      'anon',
      'public.fulfill_direct_event_checkout(uuid,uuid,text,text,text,integer,text,numeric,numeric,text,timestamptz,text,text,text)',
      'EXECUTE'
    ) as anon_can_execute,
    has_function_privilege(
      'authenticated',
      'public.fulfill_direct_event_checkout(uuid,uuid,text,text,text,integer,text,numeric,numeric,text,timestamptz,text,text,text)',
      'EXECUTE'
    ) as authenticated_can_execute,
    has_function_privilege(
      'service_role',
      'public.fulfill_direct_event_checkout(uuid,uuid,text,text,text,integer,text,numeric,numeric,text,timestamptz,text,text,text)',
      'EXECUTE'
    ) as service_can_execute
)
select 'duplicate_stripe_sessions' as invariant, count(*)::bigint as violations
from duplicate_sessions

union all
select 'duplicate_stripe_payment_intents', count(*)::bigint
from duplicate_payment_intents

union all
select 'public_can_execute_fulfillment', count(*)::bigint
from function_acl
where anon_can_execute or authenticated_can_execute

union all
select 'service_cannot_execute_fulfillment', count(*)::bigint
from function_acl
where not service_can_execute

order by invariant;
