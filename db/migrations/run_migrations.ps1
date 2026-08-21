<#
.SYNOPSIS
    Apply the ConfigHub migrations to a config database, in order.

.DESCRIPTION
    Runs 000_migration_log.sql, then every version folder in ascending order,
    then every script inside it in filename order. Each script records itself
    in dbo.uCfgMigrations, so the log is the same whether you use this or run
    them by hand in SSMS.

    Every migration is idempotent, so a re-run is safe. -WhatIf lists what
    would run without touching anything.

    STOPS AT THE FIRST FAILURE. A half-applied set is worse than none: the
    activation formulas assume the sections migration has run, and the push
    button rules assume CMBSPECIFICATION exists.

.EXAMPLE
    .\run_migrations.ps1 -Server GIZEME -Database RP_config -WhatIf

.EXAMPLE
    .\run_migrations.ps1 -Server myazure.database.windows.net `
                         -Database RP_config -User cfgadmin

.NOTES
    Take a backup first. These scripts change pricing configuration.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)][string]$Server,
    [Parameter(Mandatory = $true)][string]$Database,
    # Omit for Windows authentication.
    [string]$User,
    # Prompted for if -User is given and this is not. Never put it on the
    # command line: it lands in your shell history.
    [System.Security.SecureString]$Password,
    # Only run this version, e.g. v0.4.0.
    [string]$OnlyVersion
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

$sqlcmd = (Get-Command sqlcmd -ErrorAction SilentlyContinue).Source
if (-not $sqlcmd) {
    $candidate = Get-ChildItem `
        'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\*\Tools\Binn\sqlcmd.exe' `
        -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($candidate) { $sqlcmd = $candidate.FullName }
}
if (-not $sqlcmd) { throw "sqlcmd not found. Install the SQL Server command line tools." }

if ($User -and -not $Password) {
    $Password = Read-Host -AsSecureString "Password for $User"
}

function Invoke-SqlFile {
    param([string]$Path)

    $sqlArgs = @('-S', $Server, '-d', $Database, '-b', '-C', '-i', $Path)
    if ($User) {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
        $sqlArgs += @('-U', $User, '-P', $plain)
    } else {
        $sqlArgs += '-E'
    }
    # -b makes sqlcmd exit non-zero on a SQL error, which is what lets the
    # loop below stop instead of ploughing on through a broken sequence.
    & $sqlcmd @sqlArgs
    if ($LASTEXITCODE -ne 0) {
        throw "FAILED: $Path (sqlcmd exit $LASTEXITCODE)"
    }
}

# 000 first: everything else records itself into the table it creates.
$log = Join-Path $here '000_migration_log.sql'
if ($PSCmdlet.ShouldProcess($log, 'run')) {
    Write-Host "`n=== 000_migration_log.sql ===" -ForegroundColor Cyan
    Invoke-SqlFile -Path $log
} else {
    Write-Host "would run: $log"
}

$versions = Get-ChildItem -Path $here -Directory |
    Where-Object { $_.Name -match '^v\d+\.\d+\.\d+$' } |
    Sort-Object { [version]($_.Name.TrimStart('v')) }

if ($OnlyVersion) {
    $versions = $versions | Where-Object { $_.Name -eq $OnlyVersion }
    if (-not $versions) { throw "No migration folder named '$OnlyVersion'." }
}

foreach ($v in $versions) {
    foreach ($script in Get-ChildItem -Path $v.FullName -Filter *.sql | Sort-Object Name) {
        if ($PSCmdlet.ShouldProcess($script.FullName, 'run')) {
            Write-Host "`n=== $($v.Name) / $($script.Name) ===" -ForegroundColor Cyan
            Invoke-SqlFile -Path $script.FullName
        } else {
            Write-Host "would run: $($v.Name)/$($script.Name)"
        }
    }
}

if (-not $WhatIfPreference) {
    Write-Host "`nAll migrations applied. Applied log:" -ForegroundColor Green
    $q = 'SET NOCOUNT ON; SELECT Version, Script, AppliedUtc FROM dbo.uCfgMigrations ORDER BY AppliedUtc;'
    $sqlArgs = @('-S', $Server, '-d', $Database, '-b', '-C', '-W', '-Q', $q)
    if ($User) {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
        $sqlArgs += @('-U', $User, '-P', $plain)
    } else { $sqlArgs += '-E' }
    & $sqlcmd @sqlArgs
    Write-Host "`nRestart the API afterwards so it picks up the new columns." -ForegroundColor Yellow
}
