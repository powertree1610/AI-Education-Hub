# Deployment — Windows Server + IIS

Two Node processes behind an IIS reverse proxy:

```
IIS (ARR reverse proxy, HTTPS) ──► Next.js standalone server  (:3000)
                                   MCP server                 (:6710, localhost-bound)
```

## 1. Build

On the build machine (Node 22 LTS + pnpm):

```bash
pnpm install
pnpm --filter @platform/mcp-server build     # → apps/mcp-server/dist
pnpm --filter @platform/web build            # → apps/web/.next/standalone
```

Notes:
- The repo's `.npmrc` sets `node-linker=hoisted` — required on Windows so the
  standalone output tracing works without the symlink privilege (Developer Mode).
- Copy to the server:
  - `apps/web/.next/standalone/` (self-contained; entry `apps/web/server.js` inside it)
  - `apps/web/.next/static/` → into `standalone/apps/web/.next/static`
  - `apps/mcp-server/dist/` + `node_modules` (or run `pnpm deploy` for a pruned copy)
  - `packages/db/migrations/` (for future migrations)

## 2. Environment

Production env vars come from the **service configuration** (WinSW/NSSM), NOT `.env`
(the standalone server does not execute `next.config.ts` side effects):

- `DATABASE_URL_APP` (web), `DATABASE_URL_AI` (mcp) — pooled Neon endpoints, `sslmode=require`
- `AI_API_SERVER_URL`, `LICENSE_KEY`
- `DEFAULT_MODEL`, `OCR_MODEL` (fallbacks; license values win)
- `AUTH_SECRET` — long random string; enables self-hosted credentials auth (the default).
  (Clerk keys instead would switch to Clerk mode — dormant option.)
- `MCP_URL=http://localhost:6710/mcp`, `MCP_SHARED_SECRET` (long random string, same on both services)
- `UPLOAD_DIR` — **absolute path** on a backed-up data volume
- `TRANSCRIPT_RETENTION_DAYS`
- `JOB_SECRET` — long random string for the `/api/jobs/*` routes (Task Scheduler)
- `PORT=3000` (Next standalone reads PORT), `MCP_PORT=6710`

## 3. Windows services (WinSW example)

Install [WinSW](https://github.com/winsw/winsw), one XML per service:

```xml
<!-- student-web.xml -->
<service>
  <id>student-web</id>
  <name>Student Platform Web</name>
  <executable>C:\Program Files\nodejs\node.exe</executable>
  <arguments>C:\apps\student-platform\standalone\apps\web\server.js</arguments>
  <env name="PORT" value="3000"/>
  <!-- ...all env vars above... -->
  <onfailure action="restart" delay="10 sec"/>
  <log mode="roll-by-size"/>
</service>
```

```xml
<!-- student-mcp.xml -->
<service>
  <id>student-mcp</id>
  <name>Student Platform MCP</name>
  <executable>C:\Program Files\nodejs\node.exe</executable>
  <arguments>C:\apps\student-platform\mcp\dist\index.js</arguments>
  <env name="MCP_PORT" value="6710"/>
  <!-- DATABASE_URL_AI, MCP_SHARED_SECRET -->
  <onfailure action="restart" delay="10 sec"/>
</service>
```

`winsw install student-web.xml && winsw start student-web` (same for mcp). Both must
survive a reboot (services default to Automatic start).

## 4. IIS reverse proxy (ARR)

1. Install **URL Rewrite** + **Application Request Routing**; enable proxy in ARR settings.
2. Site → URL Rewrite → reverse-proxy rule to `http://localhost:3000/{R:1}`.
3. **SSE streaming (critical):** chat responses are `text/event-stream`. ARR buffers by
   default and the chat will look frozen. Set the proxy `responseBufferLimit` to 0:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" set config "Default Web Site" `
  -section:system.webServer/rewrite/rules `
  "/[name='ReverseProxy'].serverVariables.[name='HTTP_ACCEPT_ENCODING'].value:" 
# and in applicationHost.config set the ARR proxy: <proxy ... responseBufferLimit="0" />
```

   (Verify by watching a staff chat stream token-by-token through the IIS hostname —
   do this FIRST, before anything else, it is the most common failure.)
4. Do **not** expose :6710 through IIS — the MCP server is localhost-only, spoken to
   by the web process.
5. HTTPS binding with your certificate; HTTP → HTTPS redirect.

## 5. Scheduled jobs (Windows Task Scheduler)

Two tasks:

1. **Weekly synthesis** — Sundays 02:00, action `Program: curl.exe`, arguments:

   ```
   -s -X POST -H "x-job-secret: <JOB_SECRET>" http://localhost:3000/api/jobs/weekly-synthesis
   ```

   Runs one consolidated AI pass per student active that week; proposals land in
   the teacher review queue tagged with a `synthesis_batch_id`. Allow up to 10
   minutes (`maxDuration=600` on the route).

2. **Transcript purge** — daily 03:00, working directory = the repo checkout
   (needs `DATABASE_URL` in env or the repo `.env`):

   ```
   pnpm --filter @platform/db purge-transcripts
   ```

   Deletes `session_transcripts` rows past `expires_at` and writes an audit row.

(The per-session observation pass needs no scheduling — it runs automatically
when a teacher ends a kiosk session.)

## 6. Post-deploy checklist

- `pnpm check:db` against production (from a workstation) — grants still hold.
- Staff chat streams through IIS; kiosk reachable from a LAN device.
- Upload → preview a JPG and a PDF.
- `UPLOAD_DIR` included in backups; Neon PITR enabled.
- Auth: set `AUTH_SECRET`, bootstrap the first admin password with
  `pnpm --filter @platform/db exec tsx scripts/set-password.ts <email> <password>`,
  then create staff + set passwords at `/admin/users`.

## Known gaps (as of v2)

- Upload malware/NSFW scanning stubbed (`upload_scans` records what was checked).
- Clerk deactivation does not auto-sync without a public webhook URL — deactivate in
  `core.users` manually as well.
- Kiosk lock-down is soft (route chrome only); PIN-to-exit is a fast follow.
- Parent portal, safeguarding UI, safety-event classifiers: later versions.
- Kiosk running context is in-memory — a web-service restart mid-session loses the
  unfinished conversation (the session row and activities survive).
