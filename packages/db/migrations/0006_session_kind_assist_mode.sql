-- 0006_session_kind_assist_mode.sql — Daily/Academic split + assist modes (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0006_session_kind_assist_mode.sql
--
-- PM requirement 1: separate Daily Chat from Academic Support; teacher-set
-- Learning/Practice/Assessment strictness. session rows get a per-session
-- snapshot (stable + auditable); the student row carries the teacher-set
-- default that self-serve Home Mode sessions inherit and cannot change.
-- Existing rows are all supervised kiosk tutoring => 'academic' backfill is
-- correct. assist_mode is meaningless for 'daily' sessions (stays default).
-- No new grants: app_user already holds the needed rights on both tables.

CREATE TYPE core.session_kind AS ENUM ('academic', 'daily');
CREATE TYPE core.assist_mode  AS ENUM ('learning', 'practice', 'assessment');

ALTER TABLE core.ai_sessions
  ADD COLUMN session_kind core.session_kind NOT NULL DEFAULT 'academic',
  ADD COLUMN assist_mode  core.assist_mode  NOT NULL DEFAULT 'learning';

ALTER TABLE core.students
  ADD COLUMN default_assist_mode core.assist_mode NOT NULL DEFAULT 'learning';
