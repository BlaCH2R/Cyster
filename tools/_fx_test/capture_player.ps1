param(
  [string]$PlayerDir = "D:\sd\Cytoid flies",
  [string]$OutDir = "V:\cytoid storyboarder\tools\_fx_test\shots",
  [int]$WaitSeconds = 12,
  [string]$ShotName = "shot",
  [switch]$NoPause,
  [switch]$Pause,
  [double]$Seek = -1
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$exe = Join-Path $PlayerDir "CytoidPlayer.exe"
$proc = Get-Process -Name "CytoidPlayer" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) {
  $proc = Start-Process -FilePath $exe -WorkingDirectory $PlayerDir -PassThru
}
Start-Sleep -Seconds $WaitSeconds
$proc.Refresh()
if ($proc.HasExited) { Write-Output "PLAYER EXITED code=$($proc.ExitCode)"; exit 1 }
$h = $proc.MainWindowHandle
if ($h -eq [IntPtr]::Zero) { $h = (Get-Process -Name CytoidPlayer -ErrorAction SilentlyContinue | Select-Object -First 1).MainWindowHandle }
[Win32]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
[Win32]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 800
if ($Pause) {
  $wshell = New-Object -ComObject WScript.Shell
  $wshell.SendKeys(" ")   # Space toggles pause
  Start-Sleep -Milliseconds 600
}
if ($Seek -ge 0) {
  # slider track detected at window-relative y=372, x from 8 to width-8
  $sx = $r.Left + [int](8 + ($r.Right - $r.Left - 16) * $Seek)
  $sy = $r.Top + 372
  [Win32]::SetCursorPos($sx, $sy) | Out-Null
  Start-Sleep -Milliseconds 200
  [Win32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [Win32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 800
}
$r = New-Object Win32+RECT
[Win32]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.Right - $r.Left; $ht = $r.Bottom - $r.Top
if ($w -le 0 -or $ht -le 0) { Write-Output "BAD RECT $w x $ht"; exit 1 }
$bmp = New-Object System.Drawing.Bitmap($w, $ht)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($w, $ht)))
$out = Join-Path $OutDir "$ShotName.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "SAVED $out ($w x $ht)"
