# Student AI Platform

Web-based student development platform for a childcare & tuition centre (primary students 7–12), with a teacher-supervised AI tutor. Design: [docs/student-data-platform-design.md](docs/student-data-platform-design.md) — but the **live Neon Postgres schema is the authoritative data model** (see the worked example PDF).

## Monorepo

| Workspace | What it is | DB role |
| --- | --- | --- |
| `apps/web` | Next.js App Router — admin/teacher portals, staff AI chat, student kiosk | `app_user` |
| `apps/mcp-server` | MCP server (`@modelcontextprotocol/sdk`, Streamable HTTP) — the ONLY path by which the AI reads/writes student data | `ai_agent` |
| `packages/db` | Drizzle schema **introspected from the live DB** (`drizzle-kit pull`) + seeds + the one additive migration (`agent_chats`) | owner (scripts only) |
| `packages/shared` | Consent gate, storage interface, audit, access checks | — |

**Security model (enforced by Postgres grants, verified by `pnpm check:db`):** the `ai_agent` role can read the approved profile, insert-only observations/analyses/audit, and has **zero access** to the `restricted` schema (health, safeguarding). Nothing the AI writes touches the live profile until a teacher approves it in the review queue.

**LLM access** goes through the licensed **Central AI API Server** (same mechanism as the ERP agent): OpenAI-compatible wire format, `X-Company-Tin` license header, DeepSeek chat models (no vision) + licensed OCR model (`isOcr: true`) for reading uploaded work.

## Getting started

```bash
pnpm install
cp .env.example .env        # fill in values (see below)
pnpm seed                   # reference data + one user per role (idempotent)
pnpm check:db               # verifies seeds, views, and the role-grant boundary
pnpm dev                    # web on :3000 + mcp-server on :6710
```

**Auth** is self-hosted (Auth.js v5 credentials — email + bcrypt password in `core.users.password_hash`, signed JWT session cookie). Modes by configuration:

- `AUTH_SECRET` set → **local auth** (production default). Bootstrap the first admin with `pnpm --filter @platform/db exec tsx scripts/set-password.ts <email> <password>`; manage users/passwords at `/admin/users`. Failed logins are rate-limited (5 → 15 min) and audited.
- Clerk keys set → **Clerk** (dormant option if HQ ever provisions it; JIT-binds by email).
- Nothing set → **dev mode**: `/dev-login` lists seeded users, no passwords.

Env vars are documented in [.env.example](.env.example). Three DB connection strings, never mixed: owner (scripts), `app_user` (web), `ai_agent` (MCP).

## Useful scripts

```bash
pnpm -r typecheck                                    # all workspaces
pnpm --filter @platform/shared test                  # unit tests
pnpm --filter @platform/mcp-server exec tsx scripts/smoke.ts <student_id>   # MCP tool smoke test
pnpm --filter @platform/db pull                      # re-introspect schema (re-apply the citext + relations import fixes!)
```

## v1 flow (verified end-to-end)

1. Admin registers a student + guardian + paper consents (`/admin/students/new`).
2. Admin/teacher uploads work samples (image/PDF → local disk via the `StorageProvider` interface).
3. Staff chat (`/teacher/chat`): the agent calls MCP tools, OCRs the actual work file, and files `save_work_analysis` / `save_observation` — always **pending review**.
4. Teacher starts a kiosk session (`/teacher/sessions`) → student chats with the tutor in their preferred language → activities logged → on end, the transcript is stored **only if** `conversation_storage` consent is granted.
5. Teacher review queue (`/teacher/review`): approving an observation with a proposed level change applies it to `student_levels` (append-only) in one transaction with a sparse audit row.

Deployment (Windows Server + IIS): see [DEPLOYMENT.md](DEPLOYMENT.md).
