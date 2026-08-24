# Kill leftover Cytoid Storyboarder / Electron processes.
# Uses a single fast Get-Process -Name pipeline (no full-process-table scan),
# which is much quicker and avoids the occasional timeout of the old
# "Get-Process | Where-Object ..." form when combined with GUI launches.
Get-Process -Name 'electron', 'Cytoid*', 'Cytoid Storyboarder' -ErrorAction SilentlyContinue |
  Stop-Process -Force -ErrorAction SilentlyContinue
