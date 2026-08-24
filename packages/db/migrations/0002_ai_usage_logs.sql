-- 0002_ai_usage_logs.sql — LLM token usage tracking (ADDITIVE, PM-approved)
-- Mirrors the ERP dbo.UsageLogs design (usage-log.ts), adapted to Postgres and
-- this platform: proper uuid refs plus student attribution for kiosk calls.
-- Apply as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f packages/db/migrations/0002_ai_usage_logs.sql

CREATE TABLE core.ai_usage_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES core.users(id),      -- null = system/background job
  student_id        uuid REFERENCES core.students(id),   -- who the call was about (kiosk/analysis)
  usage_type        varchar(50) NOT NULL,                -- feature slug: staff_chat | kiosk_chat | ocr | …
  ref_id            uuid,                                -- agent_chats.id / ai_sessions.id / work_samples.id (no FK: polymorphic)
  model             varchar(128) NOT NULL DEFAULT '',
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens      integer NOT NULL DEFAULT 0,
  estimated_cost    numeric(12,6) NOT NULL DEFAULT 0,    -- USD, from the pricing table at call time
  is_estimated      boolean NOT NULL DEFAULT false,      -- true when the provider returned no usage
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_logs_user    ON core.ai_usage_logs (user_id, created_at);
CREATE INDEX idx_ai_usage_logs_student ON core.ai_usage_logs (student_id, created_at);
CREATE INDEX idx_ai_usage_logs_created ON core.ai_usage_logs (created_at DESC);

-- The web app makes every LLM call, so it owns usage logging.
GRANT SELECT, INSERT ON core.ai_usage_logs TO app_user;
-- ai_agent makes no LLM calls (the MCP server only touches the DB): no grants.
