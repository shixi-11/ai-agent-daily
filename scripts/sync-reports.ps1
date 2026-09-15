[CmdletBinding()]
param(
    [string]$SourceRoot,
    [string]$SiteRoot,
    [string]$TranslationRoot,
    [string]$BaseUrl = 'https://ai.alux.network',
    [string]$BasePath = '/daily'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw '需要 Node.js 才能运行跨平台发布链 scripts/sync-reports.cjs。' }

$arguments = @(Join-Path $PSScriptRoot 'sync-reports.cjs')
if ($SiteRoot) { $arguments += @('--site-root', $SiteRoot) }
if ($SourceRoot) { $arguments += @('--source-root', $SourceRoot) }
if ($TranslationRoot) { $arguments += @('--translation-root', $TranslationRoot) }
if ($BaseUrl) { $arguments += @('--base-url', $BaseUrl) }
if ($BasePath) { $arguments += @('--base-path', $BasePath) }

& $node.Source @arguments
exit $LASTEXITCODE
