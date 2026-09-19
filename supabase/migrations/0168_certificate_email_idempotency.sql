-- Train AI 2.0 - Certificate Email Idempotency Column
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
