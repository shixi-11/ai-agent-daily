[CmdletBinding()]
param([string]$SiteRoot)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw '需要 Node.js 才能运行跨平台验收链 scripts/verify-site.cjs。' }

$arguments = @(Join-Path $PSScriptRoot 'verify-site.cjs')
if ($SiteRoot) { $arguments += @('--site-root', $SiteRoot) }

& $node.Source @arguments
exit $LASTEXITCODE
