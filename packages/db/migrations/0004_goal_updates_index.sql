-- 0004_goal_updates_index.sql — index for the goal progress history (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0004_goal_updates_index.sql
--
-- Pre-flight (2026-09-08) showed the required grants ALREADY exist in the
-- approved DB: app_user has full CRUD on core.goals and core.goal_updates,
-- and ai_agent has SELECT on core.goal_updates. So the v5 goal-workflow fix
-- needs no grant changes — only this read-path index for "latest update per
-- goal" queries.

CREATE INDEX idx_goal_updates_goal ON core.goal_updates (goal_id, updated_at DESC);
