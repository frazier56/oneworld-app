import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@18.5.0'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret = Deno.env.get('EMAIL_QUEUE_CRON_SECRET') || ''
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || ''
  const queueSecret = req.headers.get('x-email-queue-secret') || ''
  const hasCronSecret = Boolean(cronSecret && queueSecret && queueSecret === cronSecret)
  const hasServiceBearer = Boolean(serviceKey && bearer === serviceKey)
  let requestingHostId: string | null = null

  const service = createClient(supabaseUrl, serviceKey)
  const body = await req.json().catch(() => ({})) as {
    applicationIds?: string[]
    dryRun?: boolean
    minimumAgeMinutes?: number
    draftMinimumAgeMinutes?: number
  }
  const results: Array<Record<string, unknown>> = []

  // Cron/service calls may process the queue. A signed-in event host may only
  // request a reminder for an explicitly named application belonging to them.
  if (!hasCronSecret && !hasServiceBearer) {
    const { data: authData, error: authError } = await service.auth.getUser(bearer)
    if (authError || !authData.user || !body.applicationIds?.length || body.applicationIds.length > 1) {
      return json({ error: 'Forbidden' }, 403)
    }
    requestingHostId = authData.user.id
  }

  const minimumAgeMinutes = Math.max(5, Math.min(1440, Number(body.minimumAgeMinutes || 15)))
  const cutoff = new Date(Date.now() - minimumAgeMinutes * 60_000).toISOString()
  const draftMinimumAgeMinutes = Math.max(15, Math.min(1440, Number(body.draftMinimumAgeMinutes || 30)))
  const draftCutoff = new Date(Date.now() - draftMinimumAgeMinutes * 60_000).toISOString()

  // Stripe Checkout can complete even when the shopper closes the tab before
  // the browser calls verify-event-payment. Reconcile those completed manual
  // authorizations here so the application never remains falsely labelled as
  // "awaiting payment" after Stripe has approved the card hold.
  if (!body.dryRun && !requestingHostId) {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' })
      const { data: staleApplications, error: staleErr } = await service
        .from('event_applications')
        .select('id, applicant_user_id, stripe_session_id, payment_status')
        .eq('payment_status', 'pending')
        .not('stripe_session_id', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(50)

      if (staleErr) {
        results.push({ status: 'authorization_reconciliation_failed', error: staleErr.message })
      } else {
        for (const application of staleApplications || []) {
          try {
            const session = await stripe.checkout.sessions.retrieve(application.stripe_session_id, {
              expand: ['payment_intent'],
            })
            const pi = session.payment_intent && typeof session.payment_intent === 'object'
              ? session.payment_intent as Stripe.PaymentIntent
              : null

            if (pi?.capture_method !== 'manual' || pi.status !== 'requires_capture') continue

            const { data: reconciled, error: reconcileErr } = await service
              .from('event_applications')
              .update({
                payment_status: 'authorized',
                stripe_payment_method_id: pi.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', application.id)
              .eq('payment_status', 'pending')
              .select('id')
              .maybeSingle()

            if (reconcileErr) throw reconcileErr
            if (!reconciled?.id) continue

            const { error: publishErr } = await service.rpc('publish_authorized_event_application', {
              p_application_id: application.id,
            })
            if (publishErr) throw publishErr

            results.push({
              applicationId: application.id,
              status: 'reconciled_authorized',
              paymentIntentId: pi.id,
            })
          } catch (error) {
            results.push({
              applicationId: application.id,
              status: 'authorization_reconciliation_failed',
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }

      // Recover the narrow failure window after a host approves an application:
      // Stripe may capture successfully before the application + registration
      // transaction returns. The durable journal lets this worker resume safely.
      const nowIso = new Date().toISOString()
      const { data: fulfillmentAttempts, error: attemptsErr } = await service
        .from('event_payment_fulfillment_attempts')
        .select('id, application_id, event_id, approved_by, stripe_payment_intent_id, stripe_session_id, status, attempt_count, captured_at')
        .in('status', ['capture_pending', 'captured', 'fulfillment_pending'])
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .order('created_at', { ascending: true })
        .limit(20)

      if (attemptsErr) {
        results.push({ status: 'payment_fulfillment_recovery_failed', error: attemptsErr.message })
      } else {
        for (const attempt of fulfillmentAttempts || []) {
          const nextAttemptCount = Number(attempt.attempt_count || 0) + 1
          try {
            const session = attempt.stripe_session_id
              ? await stripe.checkout.sessions.retrieve(attempt.stripe_session_id)
              : null
            const pi = await stripe.paymentIntents.retrieve(attempt.stripe_payment_intent_id)

            if (pi.status === 'requires_capture') {
              await stripe.paymentIntents.capture(pi.id)
            } else if (pi.status !== 'succeeded') {
              throw new Error(`PaymentIntent cannot be fulfilled from status ${pi.status}`)
            }

            const capturedAt = attempt.captured_at || new Date().toISOString()
            await service
              .from('event_payment_fulfillment_attempts')
              .update({
                status: 'captured',
                captured_at: capturedAt,
                attempt_count: nextAttemptCount,
                last_error: null,
                next_retry_at: new Date(Date.now() + 60_000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', attempt.id)

            const ticketAmount = Number.parseInt(session?.metadata?.onesocial_ticket_amount || '0', 10) / 100
            const platformFee = Number.parseInt(session?.metadata?.onesocial_platform_fee || '0', 10) / 100
            const currency = String(session?.currency || 'USD').toUpperCase()
            const qrCode = `OS-EVT-${attempt.event_id.slice(0, 8)}-RECOVER-${attempt.application_id.slice(0, 8)}`

            const { data: registrationId, error: fulfillmentErr } = await service.rpc(
              'fulfill_approved_event_application',
              {
                p_attempt_id: attempt.id,
                p_application_id: attempt.application_id,
                p_approved_by: attempt.approved_by,
                p_paid_at: capturedAt,
                p_ticket_amount: ticketAmount,
                p_platform_fee: platformFee,
                p_currency: currency,
                p_stripe_session_id: attempt.stripe_session_id,
                p_payment_intent_id: attempt.stripe_payment_intent_id,
                p_qr_code: qrCode,
              },
            )
            if (fulfillmentErr || !registrationId) {
              throw new Error(fulfillmentErr?.message || 'Fulfillment transaction returned no registration')
            }

            results.push({
              applicationId: attempt.application_id,
              registrationId,
              status: 'payment_fulfillment_recovered',
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const terminal = nextAttemptCount >= 8
            await service
              .from('event_payment_fulfillment_attempts')
              .update({
                status: terminal ? 'manual_review' : 'fulfillment_pending',
                attempt_count: nextAttemptCount,
                last_error: message,
                next_retry_at: terminal ? null : new Date(Date.now() + 5 * 60_000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', attempt.id)
            results.push({
              applicationId: attempt.application_id,
              status: terminal ? 'payment_fulfillment_manual_review' : 'payment_fulfillment_retry_scheduled',
              error: message,
            })
          }
        }
      }
    }
  }

  let query = service
    .from('event_applications')
    .select('id, event_id, applicant_name, applicant_email, approval_status, created_at, recovery_email_sent_at, recovery_email_attempts, events!inner(title, start_date, timezone, location, venue_name, host_id)')
    .in('payment_status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(25)

  if (body.applicationIds?.length) {
    query = query.in('id', body.applicationIds.slice(0, 25))
  } else {
    query = query.is('recovery_email_sent_at', null).lte('created_at', cutoff)
  }

  const { data: applications, error: applicationsErr } = await query
  if (applicationsErr) return json({ error: applicationsErr.message }, 500)

  const siteUrl = (Deno.env.get('ONEEVENT_SITE_URL') || 'https://app.oneworldlabs.ai').replace(/\/+$/, '')
  for (const application of applications || []) {
    const event = application.events as any
    if (requestingHostId && event.host_id !== requestingHostId) {
      results.push({ applicationId: application.id, status: 'forbidden' })
      continue
    }

    if (requestingHostId && application.recovery_email_sent_at) {
      const lastSent = new Date(application.recovery_email_sent_at).getTime()
      const nextAllowed = lastSent + 24 * 60 * 60_000
      if (Number.isFinite(lastSent) && nextAllowed > Date.now()) {
        results.push({
          applicationId: application.id,
          status: 'cooldown',
          nextAllowedAt: new Date(nextAllowed).toISOString(),
        })
        continue
      }
    }
    const { data: host } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', event.host_id)
      .maybeSingle()

    const completionUrl = `${siteUrl}/events/e/${application.event_id}/checkout?applicationId=${application.id}`
    const templateData = {
      recipientName: application.applicant_name?.split(/\s+/)[0] || 'there',
      eventTitle: event.title,
      hostName: host?.full_name || 'the event host',
      eventDate: event.start_date
        ? new Date(event.start_date).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: event.timezone || 'UTC',
            timeZoneName: 'short',
          })
        : 'Date TBD',
      eventLocation: event.venue_name || event.location || 'Location TBD',
      completionUrl,
      preapproved: ['approved', 'auto_approved'].includes(String(application.approval_status || '').toLowerCase()),
      eventId: application.event_id,
      applicationId: application.id,
      siteUrl,
    }

    if (body.dryRun) {
      results.push({ applicationId: application.id, recipientEmail: application.applicant_email, templateData })
      continue
    }

    const { data: sendResult, error: sendErr } = await service.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'event-payment-required',
        recipientEmail: application.applicant_email,
        idempotencyKey: requestingHostId
          ? `event-payment-required-${application.id}-${new Date().toISOString().slice(0, 10)}`
          : `event-payment-required-${application.id}-v1`,
        templateData,
      },
    })

    if (sendErr || sendResult?.success === false) {
      const message = sendErr?.message || sendResult?.reason || 'Email queue rejected the request'
      await service
        .from('event_applications')
        .update({
          recovery_email_attempts: Number(application.recovery_email_attempts || 0) + 1,
          recovery_email_last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', application.id)
      results.push({ applicationId: application.id, status: 'failed', error: message })
      continue
    }

    await service
      .from('event_applications')
      .update({
        recovery_email_sent_at: new Date().toISOString(),
        recovery_email_attempts: Number(application.recovery_email_attempts || 0) + 1,
        recovery_email_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id)

    results.push({ applicationId: application.id, status: 'queued' })
  }

  // A completed application already has its own payment-recovery lane above. This
  // second lane covers people who typed contact details/questions but left before
  // pressing Request to join. It restores the exact draft through an opaque token.
  if (!body.applicationIds?.length && !requestingHostId) {
    const { data: drafts, error: draftsErr } = await service
      .from('event_application_drafts')
      .select('id, event_id, resume_token, applicant_name, applicant_email, last_activity_at, reminder_email_attempts, events!inner(title, start_date, timezone, location, venue_name, status)')
      .is('submitted_at', null)
      .is('reminder_email_sent_at', null)
      .lte('last_activity_at', draftCutoff)
      .order('last_activity_at', { ascending: true })
      .limit(25)

    if (draftsErr) return json({ error: draftsErr.message, results }, 500)

    for (const draft of drafts || []) {
      const email = String(draft.applicant_email || '').trim().toLowerCase()
      const event = draft.events as any
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || event?.status !== 'published') continue

      // If the form was submitted but the browser closed before it marked the
      // draft, let the payment lane own recovery and suppress the partial reminder.
      const { data: submitted } = await service
        .from('event_applications')
        .select('id')
        .eq('event_id', draft.event_id)
        .ilike('applicant_email', email)
        .gte('created_at', new Date(new Date(draft.last_activity_at).getTime() - 5 * 60_000).toISOString())
        .limit(1)
        .maybeSingle()
      if (submitted?.id) {
        await service.from('event_application_drafts').update({
          submitted_application_id: submitted.id,
          submitted_at: new Date().toISOString(),
        }).eq('id', draft.id)
        continue
      }

      const resumeUrl = `${siteUrl}/events/e/${draft.event_id}/apply?resumeDraft=${draft.resume_token}`
      const firstName = String(draft.applicant_name || '').trim().split(/\s+/)[0] || 'there'
      const eventDate = event.start_date
        ? new Date(event.start_date).toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
            timeZone: event.timezone || 'UTC', timeZoneName: 'short',
          })
        : 'Date TBD'
      const eventLocation = event.venue_name || event.location || 'Location TBD'
      const subject = `Finish your application for ${event.title}`
      const bodyText = `Hi ${firstName},\n\nYou started an application for "${event.title}" but did not finish submitting it. Your progress is saved.\n\nContinue where you left off: ${resumeUrl}\n\nEvent: ${event.title}\nDate: ${eventDate}\nLocation: ${eventLocation}\n\nAfter you finish the application, OneEvent will guide you through account creation and payment authorization.\n\n— OneEvent, a One World Labs app`
      const bodyHtml = `<div style="background:#f8f5f2;padding:32px 12px;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eadfd6;border-radius:22px;overflow:hidden"><div style="padding:28px 28px 16px;text-align:center"><img src="${siteUrl}/mark-oneevent.png" alt="OneEvent" width="68" height="68" style="display:block;margin:0 auto 8px;object-fit:contain"><div style="font-size:26px;font-weight:800">One<span style="color:#9C4A0C">Event</span></div><div style="margin-top:6px;font-size:11px;font-weight:700;color:#9C4A0C;letter-spacing:2px;text-transform:uppercase">Show Up · Sell Out</div></div><div style="padding:10px 32px 32px"><div style="margin-bottom:10px;color:#9C4A0C;font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase">Application saved</div><h1 style="margin:0 0 16px;font-size:26px;line-height:1.25">Continue where you left off</h1><p style="color:#4b5563;font-size:15px;line-height:1.65">Hi ${escapeHtml(firstName)},</p><p style="color:#4b5563;font-size:15px;line-height:1.65">You started an application for <strong>${escapeHtml(event.title)}</strong> but did not finish submitting it. Your progress is saved, so you do not need to start over.</p><div style="margin:20px 0;padding:16px 18px;background:#fff7ed;border:1px solid #f2c39a;border-radius:14px"><div style="font-weight:800">${escapeHtml(event.title)}</div><div style="margin-top:6px;color:#6b7280;font-size:14px">${escapeHtml(eventDate)}</div><div style="color:#6b7280;font-size:14px">${escapeHtml(eventLocation)}</div></div><div style="text-align:center;padding:6px 0 8px"><a href="${resumeUrl}" style="display:inline-block;padding:14px 30px;background:linear-gradient(135deg,#E2711D 0%,#9C4A0C 100%);color:#fff;font-size:15px;font-weight:800;text-decoration:none;border-radius:99px">Continue My Application</a></div><p style="margin:20px 0 0;color:#6b7280;font-size:12px;line-height:1.6">After you submit the application, OneEvent will guide you through account creation and payment authorization.</p></div></div></div>`

      if (body.dryRun) {
        results.push({ draftId: draft.id, recipientEmail: email, resumeUrl, status: 'dry_run' })
        continue
      }

      const { data: existing } = await service
        .from('outbound_messages')
        .select('id')
        .eq('template', 'event_application_draft_nudge')
        .contains('context', { draft_id: draft.id })
        .limit(1)
        .maybeSingle()
      if (existing?.id) {
        await service.from('event_application_drafts').update({
          reminder_email_sent_at: new Date().toISOString(),
          reminder_email_last_error: null,
        }).eq('id', draft.id)
        continue
      }

      const { error: queueErr } = await service.from('outbound_messages').insert({
        channel: 'email',
        to_address: email,
        to_name: draft.applicant_name || '',
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        template: 'event_application_draft_nudge',
        status: 'queued',
        from_name: 'OneEvent',
        context: { draft_id: draft.id, event_id: draft.event_id, lane: 'incomplete_application', auto: true },
      })
      if (queueErr) {
        await service.from('event_application_drafts').update({
          reminder_email_attempts: Number(draft.reminder_email_attempts || 0) + 1,
          reminder_email_last_error: queueErr.message,
        }).eq('id', draft.id)
        results.push({ draftId: draft.id, status: 'failed', error: queueErr.message })
        continue
      }

      await service.from('event_application_drafts').update({
        reminder_email_sent_at: new Date().toISOString(),
        reminder_email_attempts: Number(draft.reminder_email_attempts || 0) + 1,
        reminder_email_last_error: null,
      }).eq('id', draft.id)
      results.push({ draftId: draft.id, status: 'queued_incomplete_application' })
    }
  }

  return json({ success: true, dryRun: !!body.dryRun, count: results.length, results })
})
