CREATE TABLE daily_events (
  day TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('direct', 'instagram', 'indeed', 'jwarm', 'corp', 'qr')),
  medium TEXT NOT NULL CHECK(medium IN ('none', 'bio', 'highlight', 'post', 'listing', 'link', 'print')),
  event TEXT NOT NULL CHECK(event IN ('page_view', 'reserve_view', 'form_open')),
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY (day, source, medium, event)
) WITHOUT ROWID;
