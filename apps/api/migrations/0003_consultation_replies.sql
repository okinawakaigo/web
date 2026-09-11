-- A reply is stored before contacting Resend. Its recipient and payload never change.
CREATE TABLE consultation_replies (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  reply_to TEXT NOT NULL,
  sent_by TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('live', 'test')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'failed', 'uncertain', 'test')),
  payload TEXT NOT NULL,
  provider_id TEXT UNIQUE,
  accepted_at TEXT
);
CREATE INDEX consultation_replies_thread ON consultation_replies(consultation_id, created_at DESC, id DESC);
