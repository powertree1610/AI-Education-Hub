-- 0009_teaching_materials.sql — teacher-assigned materials + Learning Workspace spine (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0009_teaching_materials.sql
--
-- PM requirement (v6): "teaching material for teacher specific student" and
-- "goal, set goal base on material". A material is teacher-authored content
-- FOR the child (worksheet, reading, exercise) — it is not child personal
-- data, unlike work_samples which are the child's own work.
--   * file is optional: a material can be instructions-only.
--   * lifecycle is is_active (deactivate, never delete) — sessions and goals
--     keep their references.
--   * goals.material_id lets a goal be proposed from a material.
--   * ai_sessions.material_id ties a Learn (Workspace) session to the
--     material so the tutor sees the actual task (attempt-first policy).
-- Grants: app_user only. NO ai_agent grants anywhere in this pack — the
-- material text reaches the tutor via the web-side prompt/local tools
-- (app_user), same posture as work_sample_texts (0007).

CREATE TABLE core.teaching_materials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES core.students(id) ON DELETE CASCADE,
  subject_id   uuid REFERENCES core.subjects(id),
  title        varchar(300) NOT NULL,
  instructions text,                                   -- teacher's note to the student (and tutor AI)
  file_url     text,                                   -- optional attachment
  file_type    varchar(50),
  scan_status  core.scan_verdict NOT NULL DEFAULT 'pending',
  due_date     date,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL REFERENCES core.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teaching_materials_student
  ON core.teaching_materials (student_id, is_active, created_at DESC);

-- Persisted OCR of the attachment, 1:1, mirroring work_sample_texts (0007).
CREATE TABLE core.teaching_material_texts (
  material_id      uuid PRIMARY KEY REFERENCES core.teaching_materials(id) ON DELETE CASCADE,
  extracted_text   text NOT NULL,
  extraction_model varchar(128) NOT NULL,
  page_count       smallint,
  truncated        boolean NOT NULL DEFAULT false,     -- PDF 10-page cap hit
  extracted_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE core.goals
  ADD COLUMN material_id uuid REFERENCES core.teaching_materials(id);

ALTER TABLE core.ai_sessions
  ADD COLUMN material_id uuid REFERENCES core.teaching_materials(id);

GRANT SELECT, INSERT, UPDATE ON core.teaching_materials TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.teaching_material_texts TO app_user;
-- deliberately NO ai_agent grants (see header)
