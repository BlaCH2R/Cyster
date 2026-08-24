param(
  [int]$TargetPid,
  [string]$HostHwnd,
  [int]$Width = -1,
  [int]$Height = -1
)
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EmbedDpi {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[EmbedDpi]::SetProcessDPIAware() | Out-Null

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EmbedWin32 {
  [DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int width, int height, bool repaint);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern uint GetWindowLong(IntPtr h, int idx);
  [DllImport("user32.dll")] public static extern IntPtr SetWindowLongPtr(IntPtr h, int idx, IntPtr val);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@

$proc = Get-Process -Id $TargetPid -ErrorAction Stop
$h = $proc.MainWindowHandle
if ($h -eq [IntPtr]::Zero) { throw 'NO_WINDOW' }
$hostPtr = [IntPtr][Convert]::ToInt64(($HostHwnd -replace '^0x', ''), 16)

[EmbedWin32]::SetParent($h, $hostPtr) | Out-Null

# GWL_STYLE: make it a child window and drop the caption/border.
$GWL_STYLE = -16
$WS_CHILD = 0x40000000
$WS_POPUP = 0x80000000
$WS_CAPTION = 0x00C00000
$WS_THICKFRAME = 0x00040000
$style = [EmbedWin32]::GetWindowLong($h, $GWL_STYLE)
$newStyle = ($style -band (-bnot $WS_POPUP)) -bor $WS_CHILD
$newStyle = $newStyle -band (-bnot ($WS_CAPTION -bor $WS_THICKFRAME))
[EmbedWin32]::SetWindowLongPtr($h, $GWL_STYLE, [IntPtr]$newStyle) | Out-Null

$r = New-Object EmbedWin32+RECT
[EmbedWin32]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.R - $r.L
$hh = $r.B - $r.T
if ($Width -gt 0 -and $Height -gt 0) {
  [EmbedWin32]::MoveWindow($h, 0, 0, $Width, $Height, $true) | Out-Null
  Write-Output "OK $Width $Height"
} else {
  [EmbedWin32]::MoveWindow($h, 0, 0, $w, $hh, $true) | Out-Null
  Write-Output "OK $w $hh"
}
[EmbedWin32]::ShowWindow($h, 5) | Out-Null
