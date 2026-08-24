-- 0003_password_hash.sql — self-hosted credentials auth (ADDITIVE)
-- Auth.js (NextAuth v5) Credentials provider stores a bcrypt hash per user.
-- Rows with NULL password_hash simply cannot sign in with credentials
-- (e.g. student users, or staff not yet onboarded).
-- Apply as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f packages/db/migrations/0003_password_hash.sql

ALTER TABLE core.users ADD COLUMN password_hash varchar(100);
