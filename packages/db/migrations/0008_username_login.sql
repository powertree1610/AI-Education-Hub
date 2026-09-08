-- 0008_username_login.sql — case-insensitive username login backing (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0008_username_login.sql
--
-- Students (7-12, no email) sign in with users.username + password. Auth
-- matches lower(username); write paths normalize to lowercase; this index
-- enforces uniqueness against races and legacy rows.
-- Pre-flight (2026-09-08): zero existing usernames violate lowercase.

CREATE UNIQUE INDEX users_username_lower_key ON core.users (lower(username));
