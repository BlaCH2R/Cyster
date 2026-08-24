param([int]$TargetPid, [string]$HostHwnd = "")
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SizeWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumChildProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out R r);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L, T, Rt, B; }
}
"@
$p = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
if (-not $p) { Write-Output "no-process"; exit 1 }
$found = @()
if ($HostHwnd) {
  $hostPtr = [IntPtr][Convert]::ToInt64(($HostHwnd -replace '^0x', ''), 16)
  [SizeWin]::EnumChildWindows($hostPtr, { param($h, $l)
    $r = New-Object SizeWin+R
    [SizeWin]::GetWindowRect($h, [ref]$r) | Out-Null
    $c = New-Object SizeWin+R
    [SizeWin]::GetClientRect($h, [ref]$c) | Out-Null
    $sb = New-Object System.Text.StringBuilder 256
    [SizeWin]::GetClassName($h, $sb, 256) | Out-Null
    $script:found += [PSCustomObject]@{
      W = $r.Rt - $r.L; H = $r.B - $r.T
      L = $r.L; T = $r.T; R = $r.Rt; B = $r.B
      CW = $c.Rt - $c.L; CH = $c.B - $c.T
      Cls = $sb.ToString()
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
} else {
[SizeWin]::EnumWindows({ param($h, $l)
  $wpid = 0
  [SizeWin]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
  if ($wpid -eq $TargetPid -and [SizeWin]::IsWindowVisible($h)) {
    $r = New-Object SizeWin+R
    [SizeWin]::GetWindowRect($h, [ref]$r) | Out-Null
    $script:found += [PSCustomObject]@{ W = $r.Rt - $r.L; H = $r.B - $r.T }
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
}
if ($found.Count -eq 0) { Write-Output "no-window"; exit 1 }
$i = 0
foreach ($f in $found) {
  Write-Output ("win" + $i + "=" + $f.W + "x" + $f.H + " rect=" + $f.L + "," + $f.T + "," + $f.R + "," + $f.B + " client=" + $f.CW + "x" + $f.CH + " cls=" + $f.Cls)
  $i++
}
