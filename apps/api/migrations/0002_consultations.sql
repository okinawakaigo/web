CREATE TABLE consultations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  age_group TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  availability TEXT NOT NULL DEFAULT '',
  questions TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  medium TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '未対応' CHECK(status IN ('未対応','連絡済み','日程確定','対応完了')),
  note TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,
  notification TEXT NOT NULL DEFAULT 'pending' CHECK(notification IN ('pending','sent','failed','unconfigured')),
  notification_started_at TEXT,
  notification_payload TEXT,
  notification_id TEXT
);
CREATE INDEX consultations_created ON consultations(created_at DESC, id DESC);
CREATE INDEX consultations_status_created ON consultations(status, created_at DESC, id DESC);
