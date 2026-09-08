-- 0007_work_sample_texts.sql — persisted OCR extraction per work sample (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0007_work_sample_texts.sql
--
-- PM requirement: "transcript or convert documents to AI friendly text first
-- instead of storing raw document". OCR runs once at upload; the AI's
-- read_work_sample_file tool serves the cached text (no re-billing).
-- Separate 1:1 table (not columns on work_samples) so multi-KB text stays
-- off listing scans AND so ai_agent gets NO grant here: the cached text is
-- served only through the web app's local tool (app_user), consent-gated.
-- DELETE grant is the v7 right-to-erasure seam.

CREATE TABLE core.work_sample_texts (
  work_sample_id   uuid PRIMARY KEY REFERENCES core.work_samples(id) ON DELETE CASCADE,
  extracted_text   text NOT NULL,
  extraction_model varchar(128) NOT NULL,
  page_count       smallint,
  truncated        boolean NOT NULL DEFAULT false,   -- PDF 10-page cap hit
  extracted_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON core.work_sample_texts TO app_user;
-- deliberately NO ai_agent grants (see header)
