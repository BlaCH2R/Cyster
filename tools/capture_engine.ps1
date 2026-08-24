param(
  [int]$TargetPid,
  [string]$Out = "engine.png"
)
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CapWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
[CapWin]::SetProcessDPIAware() | Out-Null
$hwnds = @()
[CapWin]::EnumWindows({ param($h, $l)
  $wpid = 0
  [CapWin]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
  if ($wpid -eq $TargetPid -and [CapWin]::IsWindowVisible($h)) {
    $r = New-Object CapWin+RECT
    [CapWin]::GetWindowRect($h, [ref]$r) | Out-Null
    $script:hwnds += [PSCustomObject]@{ HW = $h; L = $r.L; T = $r.T; W = $r.R - $r.L; H = $r.B - $r.T }
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
$best = $hwnds | Sort-Object { $_.W * $_.H } -Descending | Select-Object -First 1
if (-not $best) { Write-Output "no-window"; exit 1 }
Add-Type -AssemblyName System.Drawing
[CapWin]::ShowWindow($best.HW, 9) | Out-Null  # SW_RESTORE
Start-Sleep -Milliseconds 500
$bmp = New-Object System.Drawing.Bitmap($best.W, $best.H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
try {
  $g.CopyFromScreen($best.L, $best.T, 0, 0, (New-Object System.Drawing.Size($best.W, $best.H)))
} catch {
  # CopyFromScreen fails on occluded/odd desktops: fall back to PrintWindow
  # (renders the window's own content, works even if not on the active desktop).
  $hdc = $g.GetHdc()
  $ok = [CapWin]::PrintWindow($best.HW, $hdc, 2)  # PW_RENDERFULLCONTENT
  $g.ReleaseHdc($hdc)
  if (-not $ok) {
    $g.Dispose(); $bmp.Dispose()
    Write-Output "capture-failed"
    exit 1
  }
}
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("engine " + $best.W + "x" + $best.H + " -> " + $Out)
