-- Run once in the Supabase SQL editor against project owtljqjastcewgqqntdu
-- before the first scrape. Idempotent — safe to re-run.

ALTER TABLE telegram_messages
    ADD COLUMN IF NOT EXISTS message_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_messages_message_id_key
    ON telegram_messages(message_id);

-- Helpful index for the generator's week-range query (gte/lte on timestamp).
CREATE INDEX IF NOT EXISTS telegram_messages_timestamp_idx
    ON telegram_messages(timestamp);
