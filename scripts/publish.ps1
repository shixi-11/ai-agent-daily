[CmdletBinding()]
param([switch]$NoPush)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw '需要 Node.js 才能运行跨平台发布链 scripts/publish.cjs。' }

$arguments = @(Join-Path $PSScriptRoot 'publish.cjs')
if ($NoPush) { $arguments += '--no-push' }

& $node.Source @arguments
exit $LASTEXITCODE
