param(
  [Parameter(Mandatory = $true)][string]$Probe,
  [int]$TimeoutSeconds = 40,
  [switch]$NoClean
)
# Watchdog runner for Electron probes: runs the probe in a background job and
# force-kills it (and any stray electron processes) on timeout instead of
# hanging the terminal. Usage:
#   powershell -File tools\run_probe.ps1 tools\probe_xxx.js
$ErrorActionPreference = "Continue"
$electron = "V:\cytoid storyboarder\app\node_modules\electron\dist\electron.exe"
$probeFull = Join-Path (Get-Location) $Probe
$job = Start-Job -ScriptBlock {
  param($exe, $probePath)
  & $exe --no-sandbox --disable-gpu $probePath
} -ArgumentList $electron, $probeFull
$finished = Wait-Job $job -Timeout $TimeoutSeconds
if (-not $finished) {
  Write-Output "PROBE_TIMEOUT after ${TimeoutSeconds}s: $Probe"
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -Force -ErrorAction SilentlyContinue
  Get-Process -Name 'electron' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  exit 2
}
$output = Receive-Job $job
Remove-Job $job -Force -ErrorAction SilentlyContinue
if (-not $NoClean) {
  Get-Process -Name 'electron' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
if ($output) { Write-Output $output }
Write-Output "PROBE_DONE: $Probe"
