<#
.SYNOPSIS
  Build the platform on this machine and stage the two IIS site folders (web + MCP)
  ready to copy onto the server.

.DESCRIPTION
  Output (default deploy\out\):

    student-ai-web\                 -> copy to C:\Web\student-ai-web on the server
      web.config                    HttpPlatformHandler -> node apps\web\server.js
      apps\web\server.js            Next.js standalone server
      apps\web\.env                 runtime config (copied from deploy\.env.web)
      apps\web\.next\static\        client assets
      node_modules\, packages\      traced dependencies (from the standalone build)
      logs\                         node stdout/stderr (written by IIS)
      VERSION.txt

    student-ai-mcp\                 -> copy to C:\Web\student-ai-mcp on the server
      web.config                    HttpPlatformHandler -> node index.js
      index.js (+ .map)             single-file MCP server bundle (no node_modules needed)
      .env                          runtime config (copied from deploy\.env.mcp)
      logs\
      VERSION.txt

    student-ai-web.zip, student-ai-mcp.zip   (same content, for a quick RDP transfer)

  web.config contains ABSOLUTE server paths (-SiteDirWeb / -SiteDirMcp / -NodeExe),
  so the folders must land at exactly those paths on the server.

.EXAMPLE
  .\deploy\build-deploy.ps1
    Server paths C:\Web\student-ai-web, C:\Web\student-ai-mcp, node at C:\Program Files\nodejs\node.exe.

.EXAMPLE
  .\deploy\build-deploy.ps1 -NodeExe "C:\nvm4w\nodejs\node.exe" -SkipInstall
#>
[CmdletBinding()]
param(
  # Where the folders will live ON THE SERVER (baked into web.config).
  [string]$SiteDirWeb = "C:\Web\student-ai-web",
  [string]$SiteDirMcp = "C:\Web\student-ai-mcp",
  # node.exe ON THE SERVER that the IIS app pool will launch (`where node` on the server).
  [string]$NodeExe = "C:\Program Files\nodejs\node.exe",
  # Where to stage on THIS machine.
  [string]$OutDir = "",
  # Runtime config files (gitignored). Copy deploy\env.*.example and fill them in.
  [string]$EnvWeb = "",
  [string]$EnvMcp = "",
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$NoZip
)

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
if (-not $OutDir) { $OutDir = Join-Path $repo "deploy\out" }
if (-not $EnvWeb) { $EnvWeb = Join-Path $repo "deploy\.env.web" }
if (-not $EnvMcp) { $EnvMcp = Join-Path $repo "deploy\.env.mcp" }
$WebOut = Join-Path $OutDir "student-ai-web"
$McpOut = Join-Path $OutDir "student-ai-mcp"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }
function Run($cmd) {
  Write-Host "    $cmd" -ForegroundColor DarkGray
  & cmd /c $cmd
  if ($LASTEXITCODE -ne 0) { Fail "command failed (exit $LASTEXITCODE): $cmd" }
}
function Mirror($src, $dst) {
  # /MIR makes dst identical to src (stale files from older builds are removed).
  & robocopy "$src" "$dst" /MIR /NFL /NDL /NJH /NJS /NP /R:3 /W:2 | Out-Null
  if ($LASTEXITCODE -ge 8) { Fail "robocopy $src -> $dst failed (exit $LASTEXITCODE)" }
}
function LogsDir($dir) {
  # HttpPlatformHandler will not create the stdout log folder, and zips drop empty
  # folders — so ship a placeholder file inside it.
  $logs = Join-Path $dir "logs"
  New-Item -ItemType Directory -Force $logs | Out-Null
  Set-Content (Join-Path $logs "README.txt") "IIS (HttpPlatformHandler) writes node stdout/stderr here, one file per process start."
}
function Render($template, $dest, $siteDir) {
  $xml = Get-Content $template -Raw
  $xml = $xml.Replace("{{NODE_EXE}}", $NodeExe).Replace("{{SITE_DIR}}", $siteDir.TrimEnd("\"))
  Set-Content -Path $dest -Value $xml -Encoding UTF8
}

# ── Preflight ───────────────────────────────────────────────────────────
Step "Preflight"
foreach ($f in @($EnvWeb, $EnvMcp)) {
  if (-not (Test-Path $f)) {
    Fail "missing $f`n       Copy deploy\env.web.example -> deploy\.env.web and deploy\env.mcp.example -> deploy\.env.mcp, fill them in, re-run."
  }
}
$versionFile = Join-Path $repo "apps\web\src\lib\version.ts"
$version = ([regex]::Match((Get-Content $versionFile -Raw), 'APP_VERSION\s*=\s*"([^"]+)"')).Groups[1].Value
if (-not $version) { Fail "could not read APP_VERSION from $versionFile" }
Write-Host "    version         : v$version"
Write-Host "    server node.exe : $NodeExe   (check with 'where node' on the server)"
Write-Host "    server web dir  : $SiteDirWeb"
Write-Host "    server mcp dir  : $SiteDirMcp"
Write-Host "    staging to      : $OutDir"

# ── Build ───────────────────────────────────────────────────────────────
Set-Location $repo
if (-not $SkipInstall) { Step "pnpm install"; Run "pnpm install --frozen-lockfile" }
if (-not $SkipBuild) {
  Step "Build MCP server (typecheck + esbuild bundle)"
  Run "pnpm --filter @platform/mcp-server build"
  Step "Build web (Next.js standalone)"
  Run "pnpm --filter @platform/web build"
}
$standalone = Join-Path $repo "apps\web\.next\standalone"
$static     = Join-Path $repo "apps\web\.next\static"
$mcpDist    = Join-Path $repo "apps\mcp-server\dist\index.js"
foreach ($p in @("$standalone\apps\web\server.js", $static, $mcpDist)) {
  if (-not (Test-Path $p)) { Fail "build output missing: $p" }
}

# ── Stage web ───────────────────────────────────────────────────────────
Step "Stage web -> $WebOut"
Mirror $standalone $WebOut
Mirror $static (Join-Path $WebOut "apps\web\.next\static")
Copy-Item $EnvWeb (Join-Path $WebOut "apps\web\.env") -Force
Render (Join-Path $PSScriptRoot "templates\web.web.config") (Join-Path $WebOut "web.config") $SiteDirWeb
LogsDir $WebOut
Set-Content (Join-Path $WebOut "VERSION.txt") "v$version  built $(Get-Date -Format s)"

# ── Stage MCP ───────────────────────────────────────────────────────────
Step "Stage MCP -> $McpOut"
if (Test-Path $McpOut) { Remove-Item -Recurse -Force $McpOut }
New-Item -ItemType Directory -Force $McpOut | Out-Null
Copy-Item $mcpDist $McpOut -Force
Copy-Item "$mcpDist.map" $McpOut -Force -ErrorAction SilentlyContinue
Copy-Item $EnvMcp (Join-Path $McpOut ".env") -Force
Render (Join-Path $PSScriptRoot "templates\mcp.web.config") (Join-Path $McpOut "web.config") $SiteDirMcp
LogsDir $McpOut
Set-Content (Join-Path $McpOut "VERSION.txt") "v$version  built $(Get-Date -Format s)"

# ── Zip ─────────────────────────────────────────────────────────────────
if (-not $NoZip) {
  Step "Zip"
  foreach ($name in @("student-ai-web", "student-ai-mcp")) {
    $zip = Join-Path $OutDir "$name.zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -Path (Join-Path $OutDir "$name\*") -DestinationPath $zip -CompressionLevel Optimal
    Write-Host ("    {0}  ({1:N1} MB)" -f $zip, ((Get-Item $zip).Length / 1MB))
  }
}

Step "Done - v$version staged"
Write-Host "    Copy the CONTENTS of $WebOut  ->  $SiteDirWeb"
Write-Host "    Copy the CONTENTS of $McpOut  ->  $SiteDirMcp"
Write-Host "    (or extract the zips there), then restart both IIS sites."
exit 0   # robocopy's non-zero "success" codes must not leak to the caller
