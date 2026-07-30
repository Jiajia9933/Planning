CREATE TABLE gebaeude_cache (
  id          BIGSERIAL PRIMARY KEY,
  source      TEXT NOT NULL,
  label       TEXT,
  geometry    JSONB NOT NULL,
  min_lng     DOUBLE PRECISION NOT NULL,
  min_lat     DOUBLE PRECISION NOT NULL,
  max_lng     DOUBLE PRECISION NOT NULL,
  max_lat     DOUBLE PRECISION NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gebaeude_cache_bbox ON gebaeude_cache (min_lng, max_lng, min_lat, max_lat);
