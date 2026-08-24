# Register .ctr (and legacy .ctdsber) file association for the win-unpacked
# Cyster build so double-clicking a project file opens the app.
#
# Usage (from the repo root, PowerShell):
#   powershell -ExecutionPolicy Bypass -File tools\register_cyster_file_assoc.ps1
param(
  [string]$ExePath = ""
)

$ErrorActionPreference = 'Stop'

if (-not $ExePath) {
  $candidate = Join-Path $PSScriptRoot '..\app\dist\win-unpacked\Cyster.exe'
  $ExePath = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
}
$ExePath = (Resolve-Path -LiteralPath $ExePath -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $ExePath)) {
  Write-Error "Cyster executable not found: $ExePath"
  exit 1
}

$base = 'HKCU:\Software\Classes'
$progId = 'Cyster.Project'

# Primary extension: .ctr
New-Item -Path "$base\.ctr" -Force | Out-Null
Set-ItemProperty -Path "$base\.ctr" -Name '(default)' -Value $progId

# Legacy extension: .ctdsber
New-Item -Path "$base\.ctdsber" -Force | Out-Null
Set-ItemProperty -Path "$base\.ctdsber" -Name '(default)' -Value $progId

# ProgID: icon + open command
New-Item -Path "$base\$progId\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$base\$progId\DefaultIcon" -Name '(default)' -Value "`"$ExePath`",0"
New-Item -Path "$base\$progId\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "$base\$progId\shell\open\command" -Name '(default)' -Value "`"$ExePath`" `"%1`""

Write-Output "OK $ExePath"
