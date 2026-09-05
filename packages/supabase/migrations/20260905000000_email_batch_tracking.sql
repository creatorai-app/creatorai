-- Resumable daily batches: record who a send actually reached, so the next batch
-- of the same template can exclude them.
--
-- recipient_ids can't serve this. It's the *requested* list: it includes people
-- the worker skips at send time (unsubscribed) and everyone in a chunk that
-- failed. Excluding on it would drop those people from every future batch —
-- they'd never receive the email at all.

alter table email_sends
  add column if not exists delivered_ids uuid[] not null default '{}',
  add column if not exists delivered_count int not null default 0;

-- Historical rows predate per-chunk tracking, so the exact list is unknowable —
-- treat anything not wholly failed as delivered. Going forward the worker writes
-- the real one.
update email_sends
set delivered_ids = recipient_ids,
    delivered_count = coalesce(array_length(recipient_ids, 1), 0)
where status in ('sent', 'partial_failure');
