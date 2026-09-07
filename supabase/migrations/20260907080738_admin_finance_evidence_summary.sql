-- Read-only Admin finance evidence. This extends the existing five-section
-- dashboard without changing payment, refund, subscription, or identity state.
--
-- Refund counts use only lifecycle fields that explicitly confirm a refund.
-- Monetary totals use only bookings.refund_amount because the agreement and
-- event schemas do not store an authoritative refunded amount.
--
-- MRR remains null until One World adopts a business definition and stores a
-- price/currency for recurring subscriptions. Contract and rent commitments are
-- reported separately so they cannot be mistaken for earned platform revenue.
create or replace function public.admin_dashboard_sections()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin access required' using errcode = '42501';
  end if;

  with
  agreement_refunds as (
    select count(*)::integer as confirmed_count
    from public.agreements
    where refunded_at is not null
  ),
  booking_refunds as (
    select
      coalesce(sum(amounts.records), 0)::integer as confirmed_count,
      coalesce(jsonb_agg(to_jsonb(amounts) order by amounts.currency), '[]'::jsonb)
        as amounts_by_currency
    from (
      select
        coalesce(nullif(upper(bl.currency), ''), 'UNKNOWN') as currency,
        count(*)::integer as records,
        sum(b.refund_amount)::numeric(16,2) as amount
      from public.bookings b
      left join public.booking_links bl on bl.id = b.booking_link_id
      where coalesce(b.refund_amount, 0) > 0
      group by 1
    ) amounts
  ),
  event_refunds as (
    select
      count(*) filter (
        where refunded_at is not null
          or lower(coalesce(refund_status, '')) in ('succeeded', 'refunded', 'completed')
      )::integer as confirmed_count,
      count(*) filter (
        where refunded_at is null
          and lower(coalesce(refund_status, '')) in ('requested', 'pending', 'processing')
      )::integer as pending_count
    from public.event_registrations
  ),
  recognized_fees as (
    select coalesce(jsonb_agg(to_jsonb(fees) order by fees.currency), '[]'::jsonb) as rows
    from (
      select
        coalesce(nullif(upper(currency), ''), 'UNKNOWN') as currency,
        count(*)::integer as agreements,
        sum(coalesce(platform_fee, 0))::numeric(16,2) as platform_fee
      from public.agreements
      where captured_at is not null and refunded_at is null
      group by 1
    ) fees
  ),
  scheduled_recurring_work as (
    select coalesce(jsonb_agg(to_jsonb(work) order by work.currency), '[]'::jsonb) as rows
    from (
      select
        coalesce(nullif(upper(a.currency), ''), 'UNKNOWN') as currency,
        count(*)::integer as cycles,
        sum(coalesce(ac.amount, 0))::numeric(16,2) as amount
      from public.agreement_cycles ac
      join public.agreements a on a.id = ac.agreement_id
      where coalesce(a.is_recurring, false)
        and lower(coalesce(ac.status, '')) = 'scheduled'
      group by 1
    ) work
  ),
  accepted_monthly_rent as (
    select coalesce(jsonb_agg(to_jsonb(rent) order by rent.currency), '[]'::jsonb) as rows
    from (
      select
        coalesce(nullif(upper(currency), ''), 'UNKNOWN') as currency,
        count(*)::integer as agreements,
        sum(coalesce(monthly_rent, 0))::numeric(16,2) as monthly_rent
      from public.rental_monthly_agreements
      where guest_accepted_at is not null
        and host_accepted_at is not null
        and declined_at is null
      group by 1
    ) rent
  ),
  subscription_coverage as (
    select
      count(*) filter (where current_period_end > now())::integer as current_rows,
      count(*) filter (
        where current_period_end > now() and stripe_subscription_id is not null
      )::integer as provider_linked_rows,
      count(*) filter (
        where current_period_end > now() and lower(coalesce(plan_interval, '')) = 'founder_free'
      )::integer as founder_free_rows
    from public.app_subscriptions
  )
  select jsonb_build_object(
    'money', jsonb_build_object(
      'paid_agreements', (select count(*) from public.agreements where payment_status = 'paid'),
      'paid_bookings', (select count(*) from public.bookings where payment_status = 'paid'),
      'active_promos', (select count(*) from public.promotional_access_passes where is_active),
      -- Backwards-compatible keys used by the prior Admin bundle.
      'refunds', (
        (select confirmed_count from agreement_refunds)
        + (select confirmed_count from booking_refunds)
        + (select confirmed_count from event_refunds)
      ),
      'mrr', null,
      'finance', jsonb_build_object(
        'generated_at', now(),
        'access_scope', 'platform_admin_aggregate_only',
        'recognized_platform_fees', (select rows from recognized_fees),
        'refunds', jsonb_build_object(
          'confirmed_records', (
            (select confirmed_count from agreement_refunds)
            + (select confirmed_count from booking_refunds)
            + (select confirmed_count from event_refunds)
          ),
          'pending_records', (select pending_count from event_refunds),
          'amounts_by_currency', (select amounts_by_currency from booking_refunds),
          'amount_scope', 'Amounts include only explicit bookings.refund_amount values. Agreement and event refunds are count-only because those schemas do not store an authoritative refunded amount.',
          'sources', jsonb_build_array(
            jsonb_build_object(
              'label', 'OneJob agreements',
              'confirmed_records', (select confirmed_count from agreement_refunds),
              'amount_coverage', 'count_only'
            ),
            jsonb_build_object(
              'label', 'Booking refunds',
              'confirmed_records', (select confirmed_count from booking_refunds),
              'amount_coverage', 'explicit_amount_and_currency'
            ),
            jsonb_build_object(
              'label', 'OneEvent registrations',
              'confirmed_records', (select confirmed_count from event_refunds),
              'pending_records', (select pending_count from event_refunds),
              'amount_coverage', 'count_only'
            )
          )
        ),
        'recurring', jsonb_build_object(
          'mrr', null,
          'status', 'definition_required',
          'decision_question', 'Should MRR include only earned One World subscription fees, or also recurring marketplace and rental platform fees, and which products are in scope?',
          'current_subscription_rows', (select current_rows from subscription_coverage),
          'provider_linked_subscription_rows', (select provider_linked_rows from subscription_coverage),
          'founder_free_rows', (select founder_free_rows from subscription_coverage),
          'priced_subscription_rows', 0,
          'pricing_coverage', 'app_subscriptions has no authoritative amount or currency columns',
          'scheduled_recurring_work', (select rows from scheduled_recurring_work),
          'accepted_monthly_rent', (select rows from accepted_monthly_rent),
          'commitment_scope', 'Scheduled work and accepted monthly rent are commitments, not earned One World recurring revenue.'
        )
      )
    ),
    'ops', jsonb_build_object(
      'open_incidents', (select count(*) from public.ai_accountability_log where status <> 'resolved'),
      'total_incidents', (select count(*) from public.ai_accountability_log),
      'blocked_ips', (select count(*) from public.blocked_ips),
      'last_aws_sync', coalesce((
        select jsonb_build_object(
          'started_at', started_at,
          'status', status,
          'records_synced', records_synced
        )
        from public.aws_sync_runs
        order by started_at desc
        limit 1
      ), '{}'::jsonb)
    )
  ) into v_result;

  insert into public.admin_audit_log(actor_id, action, resource, metadata)
  values (
    auth.uid(),
    'view',
    'dashboard_sections',
    jsonb_build_object('finance_evidence_version', 1)
  );

  return v_result;
end;
$function$;

revoke all on function public.admin_dashboard_sections() from public, anon;
grant execute on function public.admin_dashboard_sections() to authenticated;
