insert into public.app_secrets (key, value, updated_at)
values (
  'ONEEVENT_BROADCAST_RECOVERY_SECRET',
  encode(gen_random_bytes(32), 'hex'),
  now()
)
on conflict (key) do nothing;

select cron.unschedule(jobid)
from cron.job
where jobname = 'oneevent-broadcast-recovery-1min';

select cron.schedule(
  'oneevent-broadcast-recovery-1min',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://wseblryyqxawvbjmylbo.supabase.co/functions/v1/resume-event-rolodex-broadcasts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-oneevent-recovery-secret', (
          select value
          from public.app_secrets
          where key = 'ONEEVENT_BROADCAST_RECOVERY_SECRET'
          limit 1
        )
      ),
      body := '{}'::jsonb
    );
  $cron$
);
