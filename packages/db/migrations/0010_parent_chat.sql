-- 0010_parent_chat.sql — parent AI chat as a third session surface (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0010_parent_chat.sql
--
-- PM requirement (v6): "parent add AI chat feature regarding children".
-- Parent chats reuse core.ai_sessions (student_id = the child, started_by =
-- the guardian's portal user, started_by_role = 'guardian') through the same
-- shared chat handler as kiosk/Home Mode, so safety classification and
-- safeguarding escalation cover this surface too. The new session_kind value
-- keeps parent conversations distinguishable so they can be EXCLUDED from
-- everything child-facing (get_session_history, student surfaces) and from
-- transcript storage until v7's privacy framework decides their retention.
-- No new tables, no new grants: app_user already holds the needed rights on
-- ai_sessions.

ALTER TYPE core.session_kind ADD VALUE 'parent';
