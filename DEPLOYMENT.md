# Deployment — Windows Server + IIS

Two IIS sites, each launching one Node process through **HttpPlatformHandler**.
IIS is the process manager: it starts node with the site, restarts it on failure,
and proxies the site's binding to the process. No WinSW, no ARR, no URL Rewrite.

```
student-ai-web  (IIS, :3330 / HTTPS)  ──HttpPlatformHandler──►  node apps\web\server.js   (Next.js standalone)
                                                                        │  MCP_URL=http://127.0.0.1:3331/mcp
student-ai-mcp  (IIS, 127.0.0.1:3331)  ──HttpPlatformHandler──►  node index.js            (MCP server bundle)
```

The MCP site must stay bound to `127.0.0.1` only. It is an internal dependency of the
web process, never a public endpoint.

## 1. Server prerequisites (once)

- Node 22 LTS, git, pnpm (`corepack enable` or `npm i -g pnpm@10.29.3`).
- IIS with **HttpPlatformHandler** — check IIS Manager → server → Modules for
  `httpPlatformHandler`; if absent install it from
  <https://www.iis.net/downloads/microsoft/httpplatformhandler>.
- IIS feature **Application Initialization** (Server Manager → Web Server → Application
  Development) so node starts with IIS instead of on the first visitor.
- The two sites created in IIS Manager (already done):
  - `student-ai-web` → `C:\Web\student-ai-web`, http `*:3330`
  - `student-ai-mcp` → `C:\Web\student-ai-mcp`, http `*:3331`
- IIS Manager settings, for **each** of the two app pools (`student-ai-web`,
  `student-ai-mcp` → Basic Settings / Advanced Settings):
  - .NET CLR version: **No Managed Code**
  - Start Mode: **AlwaysRunning**
  - Process Model → Idle Time-out (minutes): **0**
  - Recycling → Regular Time Interval (minutes): **0**, no Specific Times
  - (Idle/recycle matter: the web process holds live kiosk conversations in memory;
    an IIS recycle mid-session loses them.)
- For each site → Advanced Settings → Preload Enabled: **True** (needs the
  Application Initialization feature), so node boots with IIS.
- `student-ai-mcp` → Bindings → edit the http binding: IP address **127.0.0.1**,
  port 3331. It must not be reachable from the LAN.
- Data folder for uploads, e.g. `C:\Web\student-ai-data\uploads`, writable by both app
  pool identities (node runs as the app pool user):

  ```powershell
  New-Item -ItemType Directory -Force C:\Web\student-ai-data\uploads
  icacls C:\Web\student-ai-data\uploads /grant "IIS AppPool\student-ai-web:(OI)(CI)M" "IIS AppPool\student-ai-mcp:(OI)(CI)M"
  icacls C:\Web\student-ai-web /grant "IIS AppPool\student-ai-web:(OI)(CI)M"
  icacls C:\Web\student-ai-mcp /grant "IIS AppPool\student-ai-mcp:(OI)(CI)M"
  ```

  (Modify on the site folders is needed so node can write `logs\`.)

## 2. Runtime config (once, then whenever a value changes)

```powershell
Copy-Item deploy\env.web.example deploy\.env.web
Copy-Item deploy\env.mcp.example deploy\.env.mcp
```

Fill both in (they are gitignored). Key points:

- `DATABASE_URL_APP` (web) and `DATABASE_URL_AI` (mcp) — pooled Neon endpoints, `sslmode=require`.
- `AUTH_SECRET` — long random string; enables self-hosted credentials auth.
- `MCP_SHARED_SECRET` — long random string, **identical in both files**.
- `MCP_URL=http://127.0.0.1:3331/mcp` — the MCP site's binding.
- `UPLOAD_DIR` — the absolute data path above, same in both files.
- `JOB_SECRET` — for the Task Scheduler jobs (§5).
- Do **not** set `PORT`, `HOSTNAME` or `MCP_PORT` — IIS supplies them via `web.config`.

The build script copies these into the site folders as `apps\web\.env` (web) and
`.env` (mcp). Both processes read them at startup; IIS-supplied variables take
precedence. To change a value later, edit the copy in the site folder and restart
that site.

## 3. Build & deploy (every version)

1. Bump `APP_VERSION` in `apps/web/src/lib/version.ts` (starts at `0.1`; shown
   bottom-left on every screen), commit, tag (`git tag v0.1`).
2. Build on your machine:

   ```powershell
   .\deploy\build-deploy.ps1
   ```

   The script: `pnpm install --frozen-lockfile` → builds the MCP bundle (typecheck +
   esbuild, one self-contained `index.js`) → builds the Next standalone output →
   stages `deploy\out\student-ai-web\` and `deploy\out\student-ai-mcp\` with
   `web.config` (from `deploy\templates`) and the `.env` files → zips both.

   `web.config` contains **absolute server paths**. Defaults: `C:\Web\student-ai-web`,
   `C:\Web\student-ai-mcp`, node at `C:\Program Files\nodejs\node.exe`. If the server
   differs, pass `-SiteDirWeb`, `-SiteDirMcp`, `-NodeExe` (run `where node` on the
   server; the app pool identity must be able to read that path, so a per-user nvm
   install under `C:\Users\...` will not do).
3. Copy to the server (RDP): stop both sites in IIS Manager, then copy the
   **contents** of `deploy\out\student-ai-web\` into `C:\Web\student-ai-web\` and of
   `deploy\out\student-ai-mcp\` into `C:\Web\student-ai-mcp\` (or extract the two
   zips there), replacing existing files. Delete the old `node_modules\` in the web
   folder first when upgrading, so stale packages do not linger. Start both sites.
4. Verify (§6).

Folder layout produced:

```
C:\Web\student-ai-web\               C:\Web\student-ai-mcp\
  web.config                           web.config
  VERSION.txt                          VERSION.txt
  logs\                 <- node output  logs\
  apps\web\server.js                   index.js  (+ .map)
  apps\web\.env            <- config   .env      <- config
  apps\web\.next\static\
  node_modules\  packages\  package.json
```

Verified on the build machine: both folders start under plain `node` exactly as IIS
launches them (only `PORT`/`MCP_PORT` from outside, everything else from the `.env`
files), the MCP bundle needs no `node_modules`, and the web build serves its static
assets from the copied folder.

## 4. Public access / HTTPS

Port 3330 is fine for LAN testing. For real users add an **https** binding on the
`student-ai-web` site itself (hostname + certificate, port 443) — HttpPlatformHandler
handles the proxying, nothing else is needed. If instead you front it with an existing
ARR reverse-proxy site, set that proxy's response buffer threshold to 0, otherwise the
streamed chat (`text/event-stream`) appears frozen until 256 KB has accumulated.

## 5. Scheduled jobs (Windows Task Scheduler)

1. **Weekly synthesis** — Sundays 02:00, `Program: curl.exe`, arguments:

   ```
   -s -X POST -H "x-job-secret: <JOB_SECRET>" http://localhost:3330/api/jobs/weekly-synthesis
   ```

   One consolidated AI pass per student active that week; proposals land in the teacher
   review queue tagged with a `synthesis_batch_id`. Allow up to 10 minutes.

2. **Transcript purge** — daily 03:00, working directory = the repo checkout (needs
   the owner `DATABASE_URL` in the repo `.env`):

   ```
   pnpm --filter @platform/db purge-transcripts
   ```

   Deletes `session_transcripts` rows past `expires_at` and writes an audit row.

## 6. Post-deploy checklist

- Both sites Started; `logs\` in each folder shows node listening (a new file per start).
- `http://<server>:3330/sign-in` loads and shows the new version bottom-left.
- Staff chat streams token-by-token (not all at once after a pause).
- Kiosk reachable from a LAN device; upload → preview a JPG and a PDF.
- `pnpm check:db` against production (from a workstation) — grants still hold.
- First deploy only: bootstrap the admin password
  `pnpm --filter @platform/db exec tsx scripts/set-password.ts <email> <password>`,
  then create staff at `/admin/users`.
- `UPLOAD_DIR` included in backups; Neon PITR enabled.

## 7. Troubleshooting

- **502.3 / 502.5 from IIS** — node failed to start or IIS could not reach it. Read
  the newest file in the site's `logs\`. No file at all → the app pool identity cannot
  read `node.exe` or write `logs\` (§1 icacls), or `httpPlatformHandler` is not
  installed. Node listening but still 502 → remove the `HOSTNAME` line from the web
  `web.config` (see the comment there) and restart the site.
- **Sign-in page shows dev-login / no password box** — `AUTH_SECRET` missing:
  `apps\web\.env` was not copied or is empty.
- **Chat says the AI is unavailable** — web cannot reach MCP: check `MCP_URL` port
  matches the MCP site binding, `MCP_SHARED_SECRET` identical in both `.env` files,
  MCP site started (`http://127.0.0.1:3331/health` on the server returns `{"ok":true}`).
- **Chat text arrives in one lump** — a proxy in front is buffering (§4).
- **Kiosk conversation lost mid-session** — the web app pool recycled; re-check the
  app pool settings in §1 (idle timeout 0, no periodic recycle).
