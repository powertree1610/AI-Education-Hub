-- 0005_schools.sql — schools master table + students.school_id (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0005_schools.sql
--
-- Replaces the free-text students.school_name with a master record (the PM's
-- "master school instead of free text"). school_name is KEPT as read-only
-- legacy; displays fall back to it for old rows. ai_agent gets SELECT only
-- (the profile tool may join for the school name; it never writes masters).

CREATE TABLE core.schools (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(200) NOT NULL,
  school_type varchar(100),                 -- e.g. SK / SJKC / private (free text for now)
  curriculum  varchar(100),                 -- e.g. KSSR
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX schools_name_lower_key ON core.schools (lower(name));

ALTER TABLE core.students ADD COLUMN school_id uuid REFERENCES core.schools(id);

-- Backfill from legacy free text (exact trimmed, case-insensitive match).
INSERT INTO core.schools (name)
  SELECT DISTINCT trim(school_name) FROM core.students
  WHERE school_name IS NOT NULL AND trim(school_name) <> ''
ON CONFLICT DO NOTHING;

UPDATE core.students st
   SET school_id = sc.id
  FROM core.schools sc
 WHERE st.school_id IS NULL
   AND st.school_name IS NOT NULL
   AND lower(trim(st.school_name)) = lower(sc.name);

GRANT SELECT, INSERT, UPDATE ON core.schools TO app_user;
GRANT SELECT ON core.schools TO ai_agent;
