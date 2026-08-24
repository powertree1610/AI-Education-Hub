-- 0001_agent_chats.sql — staff-facing agent chat history (ADDITIVE)
-- ⚠ Apply ONLY after PM sign-off, as the DB owner role:
--    psql "$DATABASE_URL_DIRECT" -f migrations/0001_agent_chats.sql
--
-- Staff chat history is a different artifact from the consent-gated student
-- session_transcripts (no expires_at, no kiosk semantics). The AI agent role
-- gets NO grants here: staff chat history is never an MCP surface.

CREATE TABLE core.agent_chats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES core.users(id),      -- the staff member (teacher/admin)
  student_id   uuid REFERENCES core.students(id),            -- nullable: chat may span students
  title        varchar(200),
  status       varchar(20) NOT NULL DEFAULT 'active',        -- active | archived
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.agent_chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id       uuid NOT NULL REFERENCES core.agent_chats(id) ON DELETE CASCADE,
  role          varchar(20) NOT NULL,                        -- user | assistant | tool
  content       jsonb NOT NULL,        -- raw OpenAI-format message JSON (incl. tool_calls)
  model_version varchar(80),
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_chats_user     ON core.agent_chats(user_id, updated_at DESC);
CREATE INDEX idx_agent_chat_msgs_chat ON core.agent_chat_messages(chat_id, created_at);

GRANT SELECT, INSERT, UPDATE ON core.agent_chats         TO app_user;
GRANT SELECT, INSERT         ON core.agent_chat_messages TO app_user;
-- deliberately NO ai_agent grants
