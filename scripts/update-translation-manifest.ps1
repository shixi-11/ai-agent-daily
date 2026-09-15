[CmdletBinding(DefaultParameterSetName = 'Single')]
param(
    [Parameter(ParameterSetName = 'Single', Mandatory)] [string]$Date,
    [Parameter(ParameterSetName = 'All', Mandatory)] [switch]$All,
    [switch]$MarkReviewed,
    [string]$SiteRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw '需要 Node.js 才能运行 scripts/update-translation-manifest.cjs。' }

$arguments = @(Join-Path $PSScriptRoot 'update-translation-manifest.cjs')
if ($SiteRoot) { $arguments += @('--site-root', $SiteRoot) }
if ($All) { $arguments += '--all' }
elseif ($Date) { $arguments += @('--date', $Date) }
if ($MarkReviewed) { $arguments += '--mark-reviewed' }

& $node.Source @arguments
exit $LASTEXITCODE
